import { Page } from 'playwright';
import { getClient, CLAUDE_MODEL } from '../utils/anthropic';
import { TailoredResume } from './resume-tailor';
import { ParsedJD } from './jd-parser';
import { humanDelay } from '../utils/browser';

export interface QA {
  question: string;
  answer: string;
}

export async function answerQuestions(
  questions: string[],
  profile: any,
  parsedJD: ParsedJD,
  tailored: TailoredResume
): Promise<QA[]> {
  if (questions.length === 0) return [];

  const client = getClient();

  const selectedTitles = tailored.selectedProjectIds
    .map(id => profile.projects?.find((p: any) => p.id === id))
    .filter(Boolean)
    .map((p: any) => p.title);

  const prompt = `Timothy Victor Rachuri is applying for ${parsedJD.role} at ${parsedJD.company}.
Answer these application questions honestly, concisely, and in first person.
Draw from his profile and projects.

Profile summary: ${tailored.tailoredSummary}
Key projects: ${selectedTitles.join(', ')}
Location: Karlskrona, Sweden (willing to relocate: depends on role)
Skills: ${tailored.highlightedSkills.join(', ')}

Questions:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Return JSON array only:
[
  { "question": "...", "answer": "concise honest answer, max 3 sentences" }
]`;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (response.content[0] as any).text;
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as QA[];
  } catch (err) {
    console.error('Raw QA response:', text);
    return questions.map(q => ({ question: q, answer: '' }));
  }
}

export async function extractQuestionsFromPage(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const questions: string[] = [];
    const fields = document.querySelectorAll('.job-application-form__field, .application-field, [data-qa="application-question"]');

    fields.forEach(field => {
      const label = field.querySelector('label');
      if (label) {
        const labelText = label.textContent?.trim();
        const hasInput = field.querySelector('input:not([type="file"]):not([type="hidden"]), textarea, select');
        if (labelText && hasInput) {
          questions.push(labelText);
        }
      }
    });

    return questions;
  });
}

export async function fillAnswersOnPage(page: Page, answers: QA[]): Promise<void> {
  for (const qa of answers) {
    const filled = await page.evaluate((qa) => {
      const labels = document.querySelectorAll('label');
      for (const label of Array.from(labels)) {
        if (label.textContent?.trim().toLowerCase().includes(qa.question.toLowerCase().substring(0, 30))) {
          const forAttr = label.getAttribute('for');
          const target = forAttr
            ? document.getElementById(forAttr)
            : label.nextElementSibling;
          if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
            (target as HTMLInputElement | HTMLTextAreaElement).value = qa.answer;
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
      }
      return false;
    }, qa);

    if (!filled) {
      console.warn(`  ⚠  Could not fill answer for: ${qa.question.substring(0, 60)}`);
    }
    await humanDelay(300, 700);
  }
}
