import { Page } from 'playwright';
import { humanDelay, safeFill, safeUpload, findAndFill, scrollToBottom } from '../utils/browser';
import { answerQuestions, fillAnswersOnPage } from '../agents/question-answerer';
import { ParsedJD } from '../agents/jd-parser';
import { TailoredResume } from '../agents/resume-tailor';

export async function fillLever(
  page: Page,
  profile: any,
  parsedJD: ParsedJD,
  tailored: TailoredResume,
  resumePath: string,
  coverLetterText: string
): Promise<void> {
  console.log('  → Filling Lever form...');
  await humanDelay(1000, 2000);

  await safeFill(page, 'input[name="name"]', profile.personal.name);
  await humanDelay(300, 700);
  await safeFill(page, 'input[name="email"]', profile.personal.email);
  await humanDelay(300, 700);
  await safeFill(page, 'input[name="phone"]', profile.personal.phone);
  await humanDelay(300, 700);
  await safeFill(page, 'input[name="urls[LinkedIn]"]', profile.personal.linkedin);
  await humanDelay(300, 700);

  // Resume upload
  await safeUpload(page, 'input[type="file"]', resumePath);
  await humanDelay(1000, 2000);

  // Cover letter / comments textarea
  const coverFilled = await safeFill(page, 'textarea[name="comments"]', coverLetterText);
  if (!coverFilled) {
    await findAndFill(page, ['cover letter', 'additional information', 'message', 'notes'], coverLetterText);
  }
  await humanDelay(500, 1000);

  // Custom questions
  const questions = await page.evaluate(() => {
    const result: string[] = [];
    document.querySelectorAll('.application-additional-fields label, .custom-question label').forEach(label => {
      const text = label.textContent?.trim();
      if (text) result.push(text);
    });
    return result;
  });

  const standardFields = ['name', 'email', 'phone', 'linkedin', 'resume', 'cover', 'comments'];
  const customQs = questions.filter(q => !standardFields.some(s => q.toLowerCase().includes(s)));

  if (customQs.length > 0) {
    console.log(`  → Found ${customQs.length} custom question(s)...`);
    const answers = await answerQuestions(customQs, profile, parsedJD, tailored);
    await fillAnswersOnPage(page, answers);
  }

  await scrollToBottom(page);

  console.log('  ✅ Lever form filled.');
  console.log('  ⛔ Submit button NOT clicked — waiting for human review.');
}
