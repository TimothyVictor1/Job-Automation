import * as dotenv from 'dotenv';
dotenv.config();

import * as readline from 'readline';
import chalk from 'chalk';
import { chromium } from 'playwright';

import { fetchJobPage, readJdFromStdin } from './agents/jd-fetcher';
import { parseJD } from './agents/jd-parser';
import { preScreen } from './agents/pre-screener';
import { tailorResume } from './agents/resume-tailor';
import { generateCoverLetterText } from './agents/cover-letter';
import { generateAtsResumeDOCX, generateVisualResumeDOCX } from './resume/generator';
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
import { assertApiKey, formatApiError } from './utils/anthropic';

function ask(question: string): Promise<string> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function printPreScreenReport(screen: ReturnType<typeof preScreen>): void {
  const scoreColor = screen.fitScore >= 7 ? chalk.green : screen.fitScore >= 5 ? chalk.yellow : chalk.red;
  const recIcon = screen.recommendation === 'apply' ? '✅' : screen.recommendation === 'review-gaps' ? '⚠️ ' : '🚫';

  console.log(chalk.bold('\n── Pre-Screen Report ──────────────────────────────'));
  console.log(`  Fit score:    ${scoreColor(screen.fitScore + '/10')}`);
  console.log(`  Keyword coverage: ${Math.round(screen.keywordCoverage * 100)}%  |  Must-have coverage: ${Math.round(screen.mustHaveCoverage * 100)}%`);
  console.log(`  Recommendation: ${recIcon} ${screen.recommendation.toUpperCase()}`);

  if (screen.matchedSkills.length > 0) {
    console.log(chalk.green(`\n  Matched skills (${screen.matchedSkills.length}): ${screen.matchedSkills.slice(0, 8).join(', ')}${screen.matchedSkills.length > 8 ? '...' : ''}`));
  }

  if (screen.gapSummary) {
    console.log(chalk.yellow('\n' + screen.gapSummary.split('\n').map(l => '  ' + l).join('\n')));
  }

  console.log(chalk.gray('────────────────────────────────────────────────────\n'));
}

async function main() {
  console.log(chalk.bold.cyan('\n🤖 Job Application Agent — Timothy Victor Rachuri\n'));

  try {
    assertApiKey();
  } catch (err: any) {
    console.error(chalk.red('\n❌ ' + err.message + '\n'));
    process.exit(1);
  }

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

  // Step 3: Load profile
  const { profile, projectsMd } = loadProfile();

  // Step 4: Pre-screening
  console.log(chalk.gray('  Running pre-screen...'));
  const screen = preScreen(parsedJD, profile);
  printPreScreenReport(screen);

  if (screen.recommendation === 'skip') {
    const force = await ask(chalk.red('🚫 Low fit or hard blockers detected. Apply anyway? (y/n): '));
    if (force.toLowerCase() !== 'y') {
      console.log(chalk.gray('Exiting.'));
      process.exit(0);
    }
  } else if (screen.recommendation === 'review-gaps') {
    const proceed = await ask(chalk.yellow('⚠️  Gaps detected above. Continue to tailoring? (y/n): '));
    if (proceed.toLowerCase() !== 'y') {
      console.log(chalk.gray('Exiting.'));
      process.exit(0);
    }
  }

  // Step 5: Tailor resume
  console.log(chalk.gray('  Tailoring resume (grounded to profile)...'));
  const tailored = await tailorResume(profile, projectsMd, parsedJD);
  console.log(chalk.green(`✅ Fit score: ${tailored.fitScore}/10 — ${tailored.fitReason}`));
  console.log(chalk.gray(`   Projects: ${tailored.selectedProjectIds.join(', ')}`));
  if (tailored.tailoringNotes) {
    console.log(chalk.gray(`   Notes: ${tailored.tailoringNotes}`));
  }

  if (tailored.fitScore < 5) {
    const proceed = await ask(chalk.yellow('⚠️  Low tailor score. Apply anyway? (y/n): '));
    if (proceed.toLowerCase() !== 'y') {
      process.exit(0);
    }
  }

  // Step 6: Generate documents
  let atsResumePath = '';
  let visualResumePath = '';
  let coverLetterPath = '';
  let coverLetterText = '';

  const genDocs = await ask(chalk.yellow('\n📝 Generate resume + cover letter? (y/n): '));
  if (genDocs.toLowerCase() === 'y') {
    // Choose resume format
    console.log(chalk.cyan('\n  Resume formats:'));
    console.log(chalk.gray('  1 = ATS only    (single-column DOCX — safe for Greenhouse/Lever/Workday)'));
    console.log(chalk.gray('  2 = Visual only  (two-column DOCX  — best for Teamtailor/human review)'));
    console.log(chalk.gray('  3 = Both         (recommended)'));
    const formatChoice = await ask(chalk.yellow('  Format choice (1/2/3): '));

    // Photo option for visual
    let photoPath: string | undefined;
    if (formatChoice === '2' || formatChoice === '3') {
      const wantPhoto = await ask(chalk.yellow('  Add photo column to visual resume? (y/n): '));
      if (wantPhoto.toLowerCase() === 'y') {
        const p = await ask(chalk.yellow('  Path to photo file (JPG/PNG): '));
        if (p) photoPath = p;
      }
    }

    console.log(chalk.gray('  Generating cover letter...'));
    coverLetterText = await generateCoverLetterText(profile, parsedJD, tailored);

    if (formatChoice === '1' || formatChoice === '3') {
      console.log(chalk.gray('  Generating ATS resume...'));
      atsResumePath = await generateAtsResumeDOCX(profile, tailored, parsedJD);
      console.log(chalk.green(`  ✅ ATS resume:     ${atsResumePath}`));
    }

    if (formatChoice === '2' || formatChoice === '3') {
      console.log(chalk.gray('  Generating visual resume...'));
      visualResumePath = await generateVisualResumeDOCX(profile, tailored, parsedJD, photoPath);
      console.log(chalk.green(`  ✅ Visual resume:  ${visualResumePath}`));
    }

    console.log(chalk.gray('  Generating cover letter DOCX...'));
    coverLetterPath = await generateCoverLetterDOCX(profile, parsedJD, coverLetterText);
    console.log(chalk.green(`  ✅ Cover letter:   ${coverLetterPath}`));

    const openFiles = await ask(chalk.yellow('📂 Open files to review now? (y/n): '));
    if (openFiles.toLowerCase() === 'y') {
      if (atsResumePath) await openFile(atsResumePath);
      if (visualResumePath) await openFile(visualResumePath);
      await openFile(coverLetterPath);
    }

    await waitForKeypress(chalk.yellow('\nPress ENTER when you\'ve reviewed the documents...'));
  }

  // Step 7: Browser automation
  const openBrowser = await ask(chalk.yellow('\n🌐 Open application form in browser? (y/n): '));
  const resumeForUpload = visualResumePath || atsResumePath;

  if (openBrowser.toLowerCase() !== 'y') {
    logApplication({
      job_url: jobUrl,
      company: parsedJD.company,
      role: parsedJD.role,
      fit_score: tailored.fitScore,
      fit_reason: tailored.fitReason,
      resume_path: resumeForUpload,
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

    // For human-reviewed portals (Teamtailor), prefer the visual resume
    const uploadResume = (portalType === 'teamtailor' && visualResumePath)
      ? visualResumePath
      : resumeForUpload;

    const browser = await chromium.launch({ headless: false, slowMo: 50 });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    try {
      switch (portalType) {
        case 'teamtailor':
          await fillTeamtailor(page, profile, parsedJD, tailored, uploadResume, coverLetterText);
          break;
        case 'linkedin':
          await fillLinkedIn(page, profile, parsedJD, tailored, uploadResume, coverLetterText);
          break;
        case 'greenhouse':
          await fillGreenhouse(page, profile, parsedJD, tailored, uploadResume, coverLetterText);
          break;
        case 'lever':
          await fillLever(page, profile, parsedJD, tailored, uploadResume, coverLetterText);
          break;
        default:
          await fillGeneric(page, profile, parsedJD, tailored, uploadResume, coverLetterText);
      }
    } catch (err) {
      console.warn(chalk.yellow(`  ⚠  Portal handler error: ${err}`));
    }

    console.log(chalk.bold.yellow('\n⏸️  PAUSED — Form filled. Review everything in the browser.'));
    console.log(chalk.gray('   Submit manually when ready. Press ENTER here to log.'));
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
      resume_path: resumeForUpload,
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
  console.error(chalk.red('\n❌ ' + formatApiError(err) + '\n'));
  process.exit(1);
});
