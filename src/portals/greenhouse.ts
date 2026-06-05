import { Page } from 'playwright';
import { humanDelay, safeFill, safeUpload, findAndFill, scrollToBottom } from '../utils/browser';
import { extractQuestionsFromPage, answerQuestions, fillAnswersOnPage } from '../agents/question-answerer';
import { ParsedJD } from '../agents/jd-parser';
import { TailoredResume } from '../agents/resume-tailor';

export async function fillGreenhouse(
  page: Page,
  profile: any,
  parsedJD: ParsedJD,
  tailored: TailoredResume,
  resumePath: string,
  coverLetterText: string
): Promise<void> {
  console.log('  → Filling Greenhouse form...');
  await humanDelay(1000, 2000);

  // Name fields — Greenhouse uses first/last separately
  const fullNameParts = profile.personal.name.split(' ');
  const firstName = fullNameParts[0];
  const lastName = fullNameParts.slice(1).join(' ');

  await safeFill(page, 'input#first_name', firstName);
  await humanDelay(300, 700);
  await safeFill(page, 'input#last_name', lastName);
  await humanDelay(300, 700);
  await safeFill(page, 'input#email', profile.personal.email);
  await humanDelay(300, 700);
  await safeFill(page, 'input#phone', profile.personal.phone);
  await humanDelay(300, 700);

  // LinkedIn
  await findAndFill(page, ['linkedin', 'linkedin url', 'linkedin profile'], profile.personal.linkedin);
  await humanDelay(300, 700);

  // Resume upload
  await safeUpload(page, 'input#resume', resumePath);
  await humanDelay(1000, 2000);

  // Cover letter — could be textarea or file upload
  const coverTextarea = await page.$('textarea#cover_letter');
  if (coverTextarea) {
    await coverTextarea.fill(coverLetterText);
  } else {
    await safeUpload(page, 'input#cover_letter', resumePath);
  }
  await humanDelay(500, 1000);

  // Custom questions
  const questions = await page.evaluate(() => {
    const result: string[] = [];
    document.querySelectorAll('.field label').forEach(label => {
      const text = label.textContent?.trim();
      const hasInput = label.parentElement?.querySelector('input:not([type="file"]):not([type="hidden"]), textarea, select');
      if (text && hasInput) result.push(text);
    });
    return result;
  });

  const standardFields = ['first name', 'last name', 'email', 'phone', 'resume', 'cover letter', 'linkedin'];
  const customQs = questions.filter(q => !standardFields.some(s => q.toLowerCase().includes(s)));

  if (customQs.length > 0) {
    console.log(`  → Found ${customQs.length} custom question(s)...`);
    const answers = await answerQuestions(customQs, profile, parsedJD, tailored);
    await fillAnswersOnPage(page, answers);
  }

  await scrollToBottom(page);

  console.log('  ✅ Greenhouse form filled.');
  console.log('  ⛔ Submit button NOT clicked — waiting for human review.');
}
