import * as dotenv from 'dotenv';
dotenv.config();

import * as readline from 'readline';
import chalk from 'chalk';
import { chromium } from 'playwright';

import { fetchJobPage, readJdFromStdin } from './agents/jd-fetcher';
import { parseJD } from './agents/jd-parser';
import { tailorResume } from './agents/resume-tailor';
import { generateCoverLetterText } from './agents/cover-letter';
import { generateResumeDOCX } from './resume/generator';
import { generateCoverLetterDOCX } from './coverletter/generator';
import { detectPortal } from './portals/detector';
import { fillTeamtailor } from './portals/teamtailor';
import { fillLinkedIn } from './portals/linkedin';
import { fillGreenhouse } from './portals/greenhouse';
import { fillLever } from './portals/lever';
import { fillGeneric } from './portals/generic';
import { loadProfile } from './utils/profile-loader';
import { openFile } from './utils/open-file';
import { logApplication } from './db/tracker';
import { waitForKeypress } from './utils/browser';

function ask(question: string): Promise<string> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log(chalk.bold.cyan('\n🤖 Job Application Agent — Timothy Victor Rachuri\n'));

  // Step 1: Get job URL or paste JD
  const urlInput = await ask(chalk.yellow('📎 Enter job URL (or press ENTER to paste JD manually): '));

  let jobText: string;
  let jobUrl = urlInput;

  if (urlInput) {
    console.log(chalk.gray('  Fetching job page...'));
    try {
      jobText = await fetchJobPage(urlInput);
    } catch (err) {
      console.error(chalk.red(`  Failed to fetch: ${err}`));
      process.exit(1);
    }
  } else {
    jobText = await readJdFromStdin();
    jobUrl = await ask(chalk.yellow('📎 Enter job URL (for logging purposes): '));
  }

  // Step 2: Parse JD
  console.log(chalk.gray('  Parsing job description...'));
  const parsedJD = await parseJD(jobText);
  console.log(chalk.green(`✅ Parsed: ${parsedJD.role} @ ${parsedJD.company} | ${parsedJD.location}`));
  console.log(chalk.gray(`   Tech: ${parsedJD.techStack.slice(0, 5).join(', ')}`));

  // Step 3: Load profile
  const { profile, projectsMd } = loadProfile();

  // Step 4: Tailor resume
  console.log(chalk.gray('  Tailoring resume...'));
  const tailored = await tailorResume(profile, projectsMd, parsedJD);
  console.log(chalk.green(`✅ Fit score: ${tailored.fitScore}/10 — ${tailored.fitReason}`));
  console.log(chalk.gray(`   Projects selected: ${tailored.selectedProjectIds.join(', ')}`));
  console.log(chalk.gray(`   Notes: ${tailored.tailoringNotes}`));

  if (tailored.fitScore < 5) {
    const proceed = await ask(chalk.yellow('⚠️  Low fit score. Apply anyway? (y/n): '));
    if (proceed.toLowerCase() !== 'y') {
      console.log(chalk.gray('Exiting.'));
      process.exit(0);
    }
  }

  // Step 5: Generate docs
  let resumePath = '';
  let coverLetterPath = '';
  let coverLetterText = '';

  const genDocs = await ask(chalk.yellow('\n📝 Generate resume + cover letter? (y/n): '));
  if (genDocs.toLowerCase() === 'y') {
    console.log(chalk.gray('  Generating cover letter text...'));
    coverLetterText = await generateCoverLetterText(profile, parsedJD, tailored);

    console.log(chalk.gray('  Generating DOCX resume...'));
    resumePath = await generateResumeDOCX(profile, tailored, parsedJD, coverLetterText);
    console.log(chalk.green(`  ✅ Resume:      ${resumePath}`));

    console.log(chalk.gray('  Generating DOCX cover letter...'));
    coverLetterPath = await generateCoverLetterDOCX(profile, parsedJD, coverLetterText);
    console.log(chalk.green(`  ✅ Cover letter: ${coverLetterPath}`));

    const openFiles = await ask(chalk.yellow('📂 Open files to review now? (y/n): '));
    if (openFiles.toLowerCase() === 'y') {
      await openFile(resumePath);
      await openFile(coverLetterPath);
    }

    await waitForKeypress(chalk.yellow('\nPress ENTER when you\'ve reviewed the documents...'));
  }

  // Step 6: Browser automation
  const openBrowser = await ask(chalk.yellow('\n🌐 Open application form in browser? (y/n): '));
  if (openBrowser.toLowerCase() !== 'y') {
    logApplication({
      job_url: jobUrl,
      company: parsedJD.company,
      role: parsedJD.role,
      fit_score: tailored.fitScore,
      fit_reason: tailored.fitReason,
      resume_path: resumePath,
      cover_letter_path: coverLetterPath,
      status: 'prepared',
    });
    console.log(chalk.green('\n✅ Logged as prepared. Run `npm run history` to view.'));
    process.exit(0);
  }

  // Detect portal
  console.log(chalk.gray('  Detecting portal type...'));
  const tempBrowser = await chromium.launch({ headless: true });
  const tempPage = await tempBrowser.newPage();
  try {
    await tempPage.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    const portalType = await detectPortal(jobUrl, tempPage);
    await tempBrowser.close();
    console.log(chalk.cyan(`🌐 Portal: ${portalType}`));

    // Launch visible browser
    const browser = await chromium.launch({ headless: false, slowMo: 50 });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Run portal handler
    try {
      switch (portalType) {
        case 'teamtailor':
          await fillTeamtailor(page, profile, parsedJD, tailored, resumePath, coverLetterText);
          break;
        case 'linkedin':
          await fillLinkedIn(page, profile, parsedJD, tailored, resumePath, coverLetterText);
          break;
        case 'greenhouse':
          await fillGreenhouse(page, profile, parsedJD, tailored, resumePath, coverLetterText);
          break;
        case 'lever':
          await fillLever(page, profile, parsedJD, tailored, resumePath, coverLetterText);
          break;
        default:
          await fillGeneric(page, profile, parsedJD, tailored, resumePath, coverLetterText);
      }
    } catch (err) {
      console.warn(chalk.yellow(`  ⚠  Portal handler error: ${err}`));
    }

    console.log(chalk.bold.yellow('\n⏸️  PAUSED — The form is filled. Review everything in the browser.'));
    console.log(chalk.gray('   ✓ Submit manually when ready. Press ENTER here to log the application.'));
    await waitForKeypress('');

    const submitted = await ask(chalk.yellow('Did you submit the application? (y/n): '));
    const status = submitted.toLowerCase() === 'y' ? 'applied' : 'prepared';

    logApplication({
      job_url: jobUrl,
      company: parsedJD.company,
      role: parsedJD.role,
      portal_type: portalType,
      fit_score: tailored.fitScore,
      fit_reason: tailored.fitReason,
      resume_path: resumePath,
      cover_letter_path: coverLetterPath,
      status,
    });

    console.log(chalk.green(`\n✅ Logged as '${status}'. Good luck! 🎯`));
    console.log(chalk.gray('   View history: npm run history'));

    await page.waitForTimeout(10000);
    await browser.close();

  } catch (err) {
    await tempBrowser.close();
    console.error(chalk.red(`Error: ${err}`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error(chalk.red(`Fatal error: ${err}`));
  process.exit(1);
});
