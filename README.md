# Job Application Agent

Automated end-to-end job application CLI for Timothy Victor Rachuri.

Paste a job URL → get a tailored DOCX resume + cover letter → auto-fill the application form → review in browser → submit manually.

---

## What it does

1. Fetches the job description from a URL (or accepts a paste)
2. Uses Claude to extract structured data from the JD
3. Scores your fit and selects the 3–4 most relevant projects
4. Rewrites resume bullets to mirror the JD's exact language
5. Generates a tailored DOCX resume + cover letter in `output/`
6. Opens both files for you to review
7. Launches a real visible browser, navigates to the job page
8. Detects the portal type (Teamtailor, LinkedIn, Greenhouse, Lever, or generic)
9. Fills every form field automatically — name, email, phone, LinkedIn, resume upload, cover letter, custom questions
10. **Pauses before submitting** — you review the filled form and click Submit yourself
11. Logs the application to a local SQLite database

**The agent never submits without your explicit action.**

---

## Prerequisites

- **Node.js** 18 or later
- **An Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com)
- (Optional) LinkedIn email + password if you want LinkedIn Easy Apply automation

---

## One-time setup

```bash
# 1. Clone the repo
git clone https://github.com/timothyvictor1/job-automation.git
cd job-automation

# 2. Install dependencies (~2 min)
npm install

# 3. Install the Playwright browser (~130 MB download)
npx playwright install chromium

# 4. Create your .env file
cp .env.example .env
```

Open `.env` and fill in your values:

```env
ANTHROPIC_API_KEY=sk-ant-...          # required
LI_EMAIL=your@email.com               # optional — only needed for LinkedIn
LI_PASSWORD=yourpassword              # optional — only needed for LinkedIn
```

> ⚠️ **Edit `.env` with a plain-text editor** — use `nano .env` or VS Code.
> **Do not use TextEdit.** TextEdit can insert curly quotes and hidden formatting
> that corrupt the key and cause `invalid x-api-key` errors. The key must start
> with `sk-ant-`, sit on one line, with no quotes and no trailing spaces.

That's it. You're ready to run.

---

## Running the agent

```bash
npm run apply
```

You'll see this prompt:

```
🤖 Job Application Agent — Timothy Victor Rachuri

📎 Enter job URL (or press ENTER to paste JD manually):
```

**Option A — Job URL** (recommended): Paste the full URL to the job posting. The agent fetches and parses it automatically.

```
📎 Enter job URL: https://career.example.com/jobs/12345
```

**Option B — Paste JD manually**: Press ENTER without typing a URL, then paste the job description text, and type `END` on a new line when done.

---

## Full flow walkthrough

```
📎 Enter job URL: https://jobs.teamtailor.com/example

  Fetching job page...
  Parsing job description...

✅ Parsed: Senior AI Engineer @ Acme AB | Stockholm, Sweden
   Tech: Python, LangChain, FastAPI, PostgreSQL, Docker

  Tailoring resume...

✅ Fit score: 9/10 — Strong match: production agentic AI, government clients, Python
   Projects selected: forsakringskassan, paraply-booking, dipt
   Notes: Emphasised agentic architecture and Swedish enterprise context

📝 Generate resume + cover letter? (y/n): y

  Generating cover letter text...
  Generating DOCX resume...
  ✅ Resume:       output/Acme-AB_Senior-AI-Engineer_Resume_Timothy.docx
  Generating DOCX cover letter...
  ✅ Cover letter: output/Acme-AB_Senior-AI-Engineer_CoverLetter_Timothy.docx

📂 Open files to review now? (y/n): y

Press ENTER when you've reviewed the documents...

🌐 Open application form in browser? (y/n): y

  Detecting portal type...
🌐 Portal: teamtailor

  → Filling Teamtailor form...
  → Found 2 custom question(s) — answering with Claude...
  ✅ Teamtailor form filled.

⏸️  PAUSED — The form is filled. Review everything in the browser.
   ✓ Submit manually when ready. Press ENTER here to log the application.

Did you submit the application? (y/n): y

✅ Logged as 'applied'. Good luck! 🎯
   View history: npm run history
```

---

## Other commands

### View application history

```bash
npm run history
```

Prints a table of all logged applications, most recent first:

```
=== Application History ===
[3] 2026-06-05 14:22:10 | applied  | fit:9 | Acme AB — Senior AI Engineer
      https://jobs.teamtailor.com/...
[2] 2026-06-04 11:05:43 | prepared | fit:7 | Beta Corp — ML Engineer
      https://boards.greenhouse.io/...
```

### View statistics

```bash
npm run stats
```

```
=== Application Stats ===
Total logged:   12
Applied:        9
Avg fit score:  7.8

By portal:
  teamtailor: 5
  linkedin: 3
  greenhouse: 2
  generic: 2

By month:
  2026-06: 3
  2026-05: 9
```

---

## Supported portals

| Portal | Detection | Fields filled | Custom questions |
|---|---|---|---|
| **Teamtailor** | URL + page fingerprint | Name, email, phone, LinkedIn, resume, cover letter | ✅ |
| **LinkedIn Easy Apply** | URL | Phone, resume, multi-step form | ✅ |
| **Greenhouse** | URL + page fingerprint | First name, last name, email, phone, LinkedIn, resume, cover letter | ✅ |
| **Lever** | URL | Name, email, phone, LinkedIn, resume, comments | ✅ |
| **Generic** | Fallback | Smart label-matching for any form | — |

Teamtailor is the highest-priority portal — it's the most common ATS in Sweden.

---

## Output files

All generated files go to `output/` and are named automatically:

```
output/
  Acme-AB_Senior-AI-Engineer_Resume_Timothy.docx
  Acme-AB_Senior-AI-Engineer_CoverLetter_Timothy.docx
```

The DOCX files are ATS-friendly single-column layouts (Calibri, no tables, real bullet characters).

---

## Application database

Applications are logged to `data/applications.db` (SQLite, auto-created on first run).

The file is excluded from git (`.gitignore`). Your application history stays private on your machine.

---

## Project structure

```
job-automation/
├── src/
│   ├── index.ts                  ← Main CLI — full orchestration flow
│   ├── agents/
│   │   ├── jd-fetcher.ts         ← Fetch job page via Playwright
│   │   ├── jd-parser.ts          ← Extract structured JD data with Claude
│   │   ├── resume-tailor.ts      ← Select projects, score fit, rewrite bullets
│   │   ├── cover-letter.ts       ← Write tailored cover letter
│   │   └── question-answerer.ts  ← Answer custom ATS questions
│   ├── portals/
│   │   ├── detector.ts           ← Detect portal from URL + page content
│   │   ├── teamtailor.ts         ← Teamtailor handler (priority for Sweden)
│   │   ├── linkedin.ts           ← LinkedIn Easy Apply multi-step handler
│   │   ├── greenhouse.ts         ← Greenhouse handler
│   │   ├── lever.ts              ← Lever handler
│   │   └── generic.ts            ← Fallback smart-fill for any form
│   ├── resume/
│   │   └── generator.ts          ← Generate DOCX resume
│   ├── coverletter/
│   │   └── generator.ts          ← Generate DOCX cover letter
│   ├── db/
│   │   └── tracker.ts            ← SQLite application log
│   └── utils/
│       ├── browser.ts            ← Playwright helpers (delays, fill, upload)
│       ├── profile-loader.ts     ← Load timothy.json + projects.md
│       └── open-file.ts          ← Open files with system default app
├── profile/
│   ├── timothy.json              ← Master profile — personal info, skills, projects
│   └── projects.md               ← Full project reference — richer narrative detail
├── output/                       ← Generated DOCX files (gitignored)
├── data/                         ← SQLite database (gitignored)
├── .env.example                  ← Environment variable template
├── package.json
└── tsconfig.json
```

---

## Updating your profile

Two files drive all content decisions:

**`profile/timothy.json`** — structured data used for DOCX layout, skill selection, and project ordering. Edit this when you have new roles, projects, or skills to add.

**`profile/projects.md`** — rich narrative detail about each project. Claude reads both files together; the markdown gives it more context to write better bullets and cover letters. Keep it updated as projects evolve.

The `_meta.tailor_agent_note` field at the bottom of `timothy.json` tells Claude which projects to prioritise for which types of roles. Edit it if your priorities change.

---

## Troubleshooting

### `sh: ts-node: command not found`

Dependencies didn't fully install. Run `npm install` again from the project root,
then `npm run apply`. (`ts-node` and `typescript` are dev dependencies and install
automatically with `npm install`.)

### `invalid x-api-key` / 401 authentication error

Anthropic received a key but rejected it. The key in `.env` is wrong, incomplete,
or has hidden characters. Fix it:

1. Copy your **full** key from https://console.anthropic.com/settings/keys — it
   starts with `sk-ant-` and is ~100 characters. Make sure you copy all of it.
2. Edit `.env` with a plain-text editor — **not TextEdit**:
   ```bash
   nano .env          # or open the folder in VS Code
   ```
3. The line must read exactly (one line, no quotes, no spaces):
   ```env
   ANTHROPIC_API_KEY=sk-ant-...
   ```
4. Confirm your Anthropic account has **billing/credits enabled** — a key with no
   credits is rejected.
5. Save and run `npm run apply` again.

The agent now validates the key at startup and prints these steps if anything's
wrong, so you'll know immediately rather than mid-run.

### `Could not resolve authentication method`

There's no `.env` file yet. Run `cp .env.example .env`, then add your key as above.

### The browser download fails / `npx playwright install chromium` errors

You need network access to download the browser (~130 MB). On a restricted network
it may be blocked. Run the command again on a normal connection. This is only
needed once.

---

## Tips

- **Fit score below 5**: The agent will warn you and ask before continuing. It's worth reading the `fitReason` — sometimes a low score means the JD uses different terminology, not that you're actually underqualified.
- **Portal not filling correctly**: The generic fallback covers most cases. If a specific portal is misbehaving, the browser stays open so you can fill remaining fields manually before submitting.
- **LinkedIn login**: The agent handles login automatically if `LI_EMAIL` and `LI_PASSWORD` are set in `.env`. If LinkedIn adds a CAPTCHA or 2FA, complete it in the open browser window and press ENTER in the terminal to continue.
- **Resume upload format**: The agent uploads the DOCX file. Some portals prefer PDF — you can convert the generated DOCX to PDF manually and re-upload in the paused browser window.
