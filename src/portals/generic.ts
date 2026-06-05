import { Page } from 'playwright';
import { humanDelay, findAndFill, safeUpload, scrollToBottom } from '../utils/browser';
import { ParsedJD } from '../agents/jd-parser';
import { TailoredResume } from '../agents/resume-tailor';

export async function fillGeneric(
  page: Page,
  profile: any,
  parsedJD: ParsedJD,
  tailored: TailoredResume,
  resumePath: string,
  coverLetterText: string
): Promise<void> {
  console.log('  → Filling generic form with smart heuristics...');
  await humanDelay(1000, 2000);

  const filled: string[] = [];
  const notFilled: string[] = [];

  const fields: Array<{ hints: string[]; value: string; label: string }> = [
    { hints: ['full name', 'name', 'your name', 'applicant'], value: profile.personal.name, label: 'Name' },
    { hints: ['first name', 'firstname', 'given name'], value: profile.personal.name.split(' ')[0], label: 'First name' },
    { hints: ['last name', 'lastname', 'surname', 'family name'], value: profile.personal.name.split(' ').slice(1).join(' '), label: 'Last name' },
    { hints: ['email', 'e-mail', 'email address'], value: profile.personal.email, label: 'Email' },
    { hints: ['phone', 'telephone', 'mobile', 'tel', 'cell'], value: profile.personal.phone, label: 'Phone' },
    { hints: ['linkedin', 'linkedin url', 'linkedin profile'], value: profile.personal.linkedin, label: 'LinkedIn' },
    { hints: ['github', 'github url', 'github profile'], value: profile.personal.github, label: 'GitHub' },
    { hints: ['location', 'city', 'town', 'where are you'], value: profile.personal.location, label: 'Location' },
    { hints: ['cover letter', 'letter', 'motivation', 'message', 'tell us', 'about yourself'], value: coverLetterText, label: 'Cover letter' },
  ];

  for (const field of fields) {
    if (!field.value) continue;
    const ok = await findAndFill(page, field.hints, field.value);
    if (ok) filled.push(field.label);
    else notFilled.push(field.label);
    await humanDelay(300, 600);
  }

  // File upload
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    await fileInput.setInputFiles(resumePath);
    await humanDelay(1000, 2000);
    filled.push('Resume (file upload)');
  } else {
    notFilled.push('Resume (file upload)');
  }

  await scrollToBottom(page);

  console.log(`  ✅ Generic form fill complete.`);
  console.log(`  Filled:     ${filled.join(', ')}`);
  if (notFilled.length > 0) {
    console.log(`  Not found:  ${notFilled.join(', ')}`);
  }
  console.log('  ⛔ Submit button NOT clicked — waiting for human review.');
}
