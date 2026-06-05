import { Page } from 'playwright';
import * as readline from 'readline';

export async function humanDelay(min = 300, max = 800): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise(resolve => setTimeout(resolve, ms));
}

export async function safeType(page: Page, selector: string, text: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.click(selector);
    await humanDelay(200, 400);
    await page.type(selector, text, { delay: Math.floor(Math.random() * 50) + 30 });
    return true;
  } catch {
    console.warn(`  ⚠  safeType: selector not found — ${selector}`);
    return false;
  }
}

export async function safeFill(page: Page, selector: string, text: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.fill(selector, text);
    return true;
  } catch {
    console.warn(`  ⚠  safeFill: selector not found — ${selector}`);
    return false;
  }
}

export async function safeClick(page: Page, selector: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await humanDelay(200, 500);
    await page.click(selector);
    return true;
  } catch {
    console.warn(`  ⚠  safeClick: selector not found — ${selector}`);
    return false;
  }
}

export async function safeUpload(page: Page, selector: string, filePath: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.setInputFiles(selector, filePath);
    await humanDelay(1000, 2000);
    return true;
  } catch {
    console.warn(`  ⚠  safeUpload: selector not found — ${selector}`);
    return false;
  }
}

export async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await humanDelay(500, 1000);
}

export function waitForKeypress(prompt = 'Press ENTER to continue...'): Promise<void> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write(prompt);
    rl.once('line', () => {
      rl.close();
      resolve();
    });
  });
}

export async function findAndFill(
  page: Page,
  hintWords: string[],
  value: string
): Promise<boolean> {
  const hints = hintWords.map(h => h.toLowerCase());

  // Build a selector that targets text/email/tel/url inputs and textareas
  const candidates = await page.$$('input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input:not([type]), textarea');

  for (const el of candidates) {
    const name = (await el.getAttribute('name') || '').toLowerCase();
    const placeholder = (await el.getAttribute('placeholder') || '').toLowerCase();
    const id = (await el.getAttribute('id') || '').toLowerCase();
    const ariaLabel = (await el.getAttribute('aria-label') || '').toLowerCase();

    const combined = `${name} ${placeholder} ${id} ${ariaLabel}`;

    if (hints.some(h => combined.includes(h))) {
      try {
        const tag = await el.evaluate(e => e.tagName.toLowerCase());
        if (tag === 'textarea') {
          await el.fill(value);
        } else {
          await el.fill(value);
        }
        await humanDelay(200, 500);
        return true;
      } catch {
        continue;
      }
    }
  }

  // Try label association
  const labels = await page.$$('label');
  for (const label of labels) {
    const text = ((await label.textContent()) || '').toLowerCase();
    if (hints.some(h => text.includes(h))) {
      const forAttr = await label.getAttribute('for');
      if (forAttr) {
        try {
          await page.fill(`#${forAttr}`, value);
          await humanDelay(200, 500);
          return true;
        } catch {
          continue;
        }
      }
    }
  }

  console.warn(`  ⚠  findAndFill: no field matched hints — ${hintWords.join(', ')}`);
  return false;
}
