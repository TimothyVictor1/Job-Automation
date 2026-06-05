import { chromium } from 'playwright';
import * as readline from 'readline';

export async function fetchJobPage(url: string): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const bodyText = await page.evaluate(() => {
      const selectors = ['nav', 'header', 'footer', '.nav', '.header', '.footer'];
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove());
      });
      return document.body.innerText;
    });

    await browser.close();
    return bodyText;
  } catch (err) {
    await browser.close();
    throw new Error(`Failed to fetch job page: ${err}`);
  }
}

export async function readJdFromStdin(): Promise<string> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('Paste the job description below. Type END on a new line when done:\n');
    const lines: string[] = [];
    rl.on('line', (line) => {
      if (line.trim() === 'END') {
        rl.close();
        resolve(lines.join('\n'));
      } else {
        lines.push(line);
      }
    });
  });
}
