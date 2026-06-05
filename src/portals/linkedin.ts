import { Page } from 'playwright';
import { humanDelay, safeClick, safeFill, safeUpload, waitForKeypress } from '../utils/browser';
import { extractQuestionsFromPage, answerQuestions, fillAnswersOnPage } from '../agents/question-answerer';
import { ParsedJD } from '../agents/jd-parser';
import { TailoredResume } from '../agents/resume-tailor';
import * as dotenv from 'dotenv';
dotenv.config();

async function loginLinkedIn(page: Page): Promise<void> {
  const email = process.env.LI_EMAIL;
  const password = process.env.LI_PASSWORD;
  if (!email || !password) {
    console.warn('  ⚠  LI_EMAIL or LI_PASSWORD not set — skipping LinkedIn login');
    return;
  }

  const isLoggedIn = await page.$('#global-nav');
  if (isLoggedIn) {
    console.log('  → Already logged in to LinkedIn');
    return;
  }

  console.log('  → Logging in to LinkedIn...');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
  await humanDelay(1500, 3000);
  await safeFill(page, '#username', email);
  await humanDelay(300, 800);
  await safeFill(page, '#password', password);
  await humanDelay(300, 800);
  await safeClick(page, '[data-litms-control-urn="login-submit"]');
  await humanDelay(3000, 5000);
}

export async function fillLinkedIn(
  page: Page,
  profile: any,
  parsedJD: ParsedJD,
  tailored: TailoredResume,
  resumePath: string,
  coverLetterText: string
): Promise<void> {
  console.log('  → Handling LinkedIn Easy Apply...');

  await loginLinkedIn(page);
  await humanDelay(1000, 2000);

  // Click Easy Apply button
  const easyApplyClicked = await safeClick(page, 'button[aria-label*="Easy Apply"], .jobs-apply-button');
  if (!easyApplyClicked) {
    console.warn('  ⚠  Easy Apply button not found');
  }
  await humanDelay(1500, 2500);

  let stepCount = 0;
  const MAX_STEPS = 15;

  while (stepCount < MAX_STEPS) {
    stepCount++;

    // Check if we're on the review/submit step
    const submitBtn = await page.$('button[aria-label="Submit application"]');
    if (submitBtn) {
      console.log('  → Reached Submit step — STOPPING. Do not click Submit.');
      break;
    }

    // Detect step type by looking at content
    const hasFileUpload = await page.$('input[type="file"]');
    const hasPhoneInput = await page.$('input[id*="phoneNumber"], input[name*="phone"]');
    const nextBtn = await page.$('button[aria-label="Continue to next step"], button[aria-label="Next"]');
    const reviewBtn = await page.$('button[aria-label="Review your application"]');

    if (hasFileUpload) {
      console.log('  → Upload step — uploading resume...');
      await safeUpload(page, 'input[type="file"]', resumePath);
      await humanDelay(1000, 2000);
    }

    if (hasPhoneInput) {
      console.log('  → Contact info step — filling phone...');
      await safeFill(page, 'input[id*="phoneNumber"]', profile.personal.phone.replace(/[^0-9+]/g, ''));
      await humanDelay(300, 700);
    }

    // Answer any visible custom questions
    const questions = await page.evaluate(() => {
      const result: string[] = [];
      document.querySelectorAll('.jobs-easy-apply-form-section__grouping label').forEach(label => {
        const text = label.textContent?.trim();
        if (text) result.push(text);
      });
      return result;
    });

    const standardFields = ['phone', 'email', 'name', 'city', 'country', 'first name', 'last name'];
    const customQs = questions.filter(q => !standardFields.some(s => q.toLowerCase().includes(s)));

    if (customQs.length > 0) {
      const answers = await answerQuestions(customQs, profile, parsedJD, tailored);
      await fillAnswersOnPage(page, answers);
    }

    if (reviewBtn) {
      await reviewBtn.click();
      await humanDelay(1000, 2000);
      continue;
    }

    if (nextBtn) {
      await nextBtn.click();
      await humanDelay(1000, 2000);
    } else {
      break;
    }
  }

  console.log('  ✅ LinkedIn Easy Apply form filled and paused at Review step.');
  console.log('  ⛔ Submit button NOT clicked — waiting for human review.');
}
