import { Page } from 'playwright';
import { humanDelay, safeFill, safeUpload, findAndFill, scrollToBottom, waitForKeypress } from '../utils/browser';
import { extractQuestionsFromPage, answerQuestions, fillAnswersOnPage } from '../agents/question-answerer';
import { ParsedJD } from '../agents/jd-parser';
import { TailoredResume } from '../agents/resume-tailor';

export async function fillTeamtailor(
  page: Page,
  profile: any,
  parsedJD: ParsedJD,
  tailored: TailoredResume,
  resumePath: string,
  coverLetterText: string
): Promise<void> {
  console.log('  → Filling Teamtailor form...');

  // Try to navigate to apply URL
  const currentUrl = page.url();
  if (!currentUrl.includes('/apply')) {
    try {
      const applyUrl = parsedJD.applyUrl || `${currentUrl.split('?')[0]}/apply`;
      await page.goto(applyUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await humanDelay(1500, 3000);
    } catch {
      console.warn('  ⚠  Could not navigate to /apply — staying on current page');
    }
  }

  // Name
  const nameFilled = await findAndFill(page, ['name', 'full name', 'your name', 'applicant name'], profile.personal.name);
  if (!nameFilled) {
    await safeFill(page, 'input[name="job_application[name]"]', profile.personal.name);
  }
  await humanDelay(300, 800);

  // Email
  const emailFilled = await findAndFill(page, ['email', 'e-mail', 'email address'], profile.personal.email);
  if (!emailFilled) {
    await safeFill(page, 'input[name="job_application[email]"]', profile.personal.email);
  }
  await humanDelay(300, 800);

  // Phone
  const phoneFilled = await findAndFill(page, ['phone', 'telephone', 'mobile', 'tel'], profile.personal.phone);
  if (!phoneFilled) {
    await safeFill(page, 'input[name="job_application[phone]"]', profile.personal.phone);
  }
  await humanDelay(300, 800);

  // LinkedIn
  await findAndFill(page, ['linkedin', 'linkedin url', 'linkedin profile'], profile.personal.linkedin);
  await humanDelay(300, 800);

  // Resume upload
  const resumeUploaded = await safeUpload(page, 'input[type="file"][accept*="pdf"], input[type="file"][accept*=".pdf"], input[type="file"]', resumePath);
  if (!resumeUploaded) {
    console.warn('  ⚠  Could not upload resume — file input not found');
  }
  await humanDelay(1000, 2000);

  // Cover letter textarea
  const coverFilled = await findAndFill(page, ['cover letter', 'cover_letter', 'pitch', 'message', 'letter'], coverLetterText);
  if (!coverFilled) {
    await safeFill(page, 'textarea[name*="cover_letter"], textarea[name*="pitch"], textarea[id*="cover"]', coverLetterText);
  }
  await humanDelay(500, 1000);

  // Custom questions
  const questions = await extractQuestionsFromPage(page);
  const standardQuestions = ['name', 'email', 'phone', 'linkedin', 'cover letter', 'pitch'];
  const customQuestions = questions.filter(q =>
    !standardQuestions.some(s => q.toLowerCase().includes(s))
  );

  if (customQuestions.length > 0) {
    console.log(`  → Found ${customQuestions.length} custom question(s) — answering with Claude...`);
    const answers = await answerQuestions(customQuestions, profile, parsedJD, tailored);
    await fillAnswersOnPage(page, answers);
  }

  await scrollToBottom(page);

  console.log('  ✅ Teamtailor form filled.');
  console.log('  Fields filled: name, email, phone, LinkedIn, resume, cover letter' + (customQuestions.length > 0 ? `, ${customQuestions.length} custom question(s)` : ''));
  console.log('  ⛔ Submit button NOT clicked — waiting for human review.');
}
