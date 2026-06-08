import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from the project root regardless of where the process started.
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Model pinned by the project spec. Change here once to update everywhere.
// claude-sonnet-4-20250514 is deprecated (retiring June 15, 2026) and already
// 404s for some accounts — claude-sonnet-4-6 is its direct replacement.
export const CLAUDE_MODEL = 'claude-sonnet-4-6';

/**
 * Clean a pasted key: strip surrounding whitespace and any wrapping quotes
 * (straight OR curly — TextEdit/Word silently insert curly quotes).
 */
function cleanKey(raw?: string): string {
  if (!raw) return '';
  let k = raw.trim();
  k = k.replace(/^[\s'"‘’“”]+|[\s'"‘’“”]+$/g, '');
  return k.trim();
}

/**
 * Read, clean, and validate the API key. Throws a friendly, actionable error
 * if it's missing, still the placeholder, or obviously malformed.
 */
export function getApiKey(): string {
  const key = cleanKey(process.env.ANTHROPIC_API_KEY);

  if (!key || /your[_-]?key[_-]?here/i.test(key)) {
    throw new Error(
      [
        'ANTHROPIC_API_KEY is not set in your .env file.',
        '',
        '  1. Get a key at https://console.anthropic.com/settings/keys (starts with "sk-ant-").',
        '  2. Open the .env file in this folder with a PLAIN-TEXT editor:',
        '        nano .env          (or open it in VS Code — avoid TextEdit)',
        '  3. Set exactly:  ANTHROPIC_API_KEY=sk-ant-...   (one line, no quotes, no spaces)',
        '  4. Save and run  npm run apply  again.',
      ].join('\n')
    );
  }

  if (!key.startsWith('sk-ant-') || key.length < 30) {
    throw new Error(
      [
        'ANTHROPIC_API_KEY looks malformed.',
        `  → It should start with "sk-ant-" and be ~100 characters. Yours starts with "${key.substring(0, 10)}..." (length ${key.length}).`,
        '  → You likely pasted a partial key. Copy the FULL key from',
        '    https://console.anthropic.com/settings/keys and paste it on one line in .env.',
        '  → Use a plain-text editor (nano / VS Code), not TextEdit.',
      ].join('\n')
    );
  }

  return key;
}

/** Preflight helper: validate the key exists before doing any work. */
export function assertApiKey(): void {
  getApiKey();
}

let cachedClient: Anthropic | null = null;

/** Return a configured Anthropic client (validated key, cached). */
export function getClient(): Anthropic {
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey: getApiKey() });
  }
  return cachedClient;
}

/**
 * Turn any thrown error into a clear, actionable message — especially the
 * 401 "invalid x-api-key" that means the key reached Anthropic but was rejected.
 */
export function formatApiError(err: any): string {
  const msg = err?.message || String(err);
  const status = err?.status || err?.statusCode;

  if (status === 401 || /authentication_error|invalid x-api-key/i.test(msg)) {
    return [
      'Anthropic rejected your API key (401 authentication error).',
      'The key reached Anthropic but was not accepted — it is wrong, incomplete, or revoked.',
      '',
      'Fix it:',
      '  1. Open https://console.anthropic.com/settings/keys and copy your key in full (starts with sk-ant-).',
      '  2. Edit the .env file with a PLAIN-TEXT editor (avoid TextEdit — it inserts hidden characters):',
      '        nano .env          (or open the folder in VS Code)',
      '  3. Set exactly:  ANTHROPIC_API_KEY=sk-ant-...   (one line, no quotes, no trailing spaces)',
      '  4. Confirm your Anthropic account has credits/billing enabled.',
      '  5. Save and run  npm run apply  again.',
    ].join('\n');
  }

  if (status === 429 || /rate_limit|overloaded/i.test(msg)) {
    return 'Anthropic is rate-limiting or overloaded (429). Wait a moment and run `npm run apply` again.';
  }

  if (status === 404 || /model/i.test(msg) && /not.*found|does not exist/i.test(msg)) {
    return `Model error: ${msg}\n  → Check CLAUDE_MODEL in src/utils/anthropic.ts is a model your account can access.`;
  }

  return msg;
}
