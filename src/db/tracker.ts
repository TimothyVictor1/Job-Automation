import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'applications.db');

function getDb(): Database.Database {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_url TEXT NOT NULL,
      company TEXT NOT NULL,
      role TEXT NOT NULL,
      portal_type TEXT,
      fit_score INTEGER,
      fit_reason TEXT,
      resume_path TEXT,
      cover_letter_path TEXT,
      status TEXT DEFAULT 'prepared',
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    )
  `);
  return db;
}

export interface ApplicationRecord {
  job_url: string;
  company: string;
  role: string;
  portal_type?: string;
  fit_score?: number;
  fit_reason?: string;
  resume_path?: string;
  cover_letter_path?: string;
  status?: string;
  notes?: string;
}

export function logApplication(data: ApplicationRecord): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO applications (job_url, company, role, portal_type, fit_score, fit_reason, resume_path, cover_letter_path, status, notes)
    VALUES (@job_url, @company, @role, @portal_type, @fit_score, @fit_reason, @resume_path, @cover_letter_path, @status, @notes)
  `);
  const result = stmt.run({
    job_url: data.job_url,
    company: data.company,
    role: data.role,
    portal_type: data.portal_type || null,
    fit_score: data.fit_score || null,
    fit_reason: data.fit_reason || null,
    resume_path: data.resume_path || null,
    cover_letter_path: data.cover_letter_path || null,
    status: data.status || 'prepared',
    notes: data.notes || null,
  });
  db.close();
  return result.lastInsertRowid as number;
}

export function listApplications(): any[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM applications ORDER BY applied_at DESC').all();
  db.close();
  return rows;
}

export function printStats(): void {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as c FROM applications').get() as any).c;
  const applied = (db.prepare("SELECT COUNT(*) as c FROM applications WHERE status='applied'").get() as any).c;
  const avgScore = (db.prepare('SELECT AVG(fit_score) as a FROM applications').get() as any).a;

  console.log('\n=== Application Stats ===');
  console.log(`Total logged:   ${total}`);
  console.log(`Applied:        ${applied}`);
  console.log(`Avg fit score:  ${avgScore ? avgScore.toFixed(1) : 'N/A'}`);

  const byPortal = db.prepare('SELECT portal_type, COUNT(*) as c FROM applications GROUP BY portal_type').all();
  console.log('\nBy portal:');
  byPortal.forEach((r: any) => console.log(`  ${r.portal_type || 'unknown'}: ${r.c}`));

  const byMonth = db.prepare("SELECT strftime('%Y-%m', applied_at) as month, COUNT(*) as c FROM applications GROUP BY month ORDER BY month DESC").all();
  console.log('\nBy month:');
  byMonth.forEach((r: any) => console.log(`  ${r.month}: ${r.c}`));

  db.close();
}

// CLI entrypoint
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--list')) {
    const rows = listApplications();
    if (rows.length === 0) {
      console.log('No applications logged yet.');
    } else {
      console.log('\n=== Application History ===');
      rows.forEach(r => {
        console.log(`[${r.id}] ${r.applied_at} | ${r.status.padEnd(8)} | fit:${r.fit_score ?? '?'} | ${r.company} — ${r.role}`);
        console.log(`      ${r.job_url}`);
      });
    }
  } else if (args.includes('--stats')) {
    printStats();
  } else {
    console.log('Usage: ts-node src/db/tracker.ts --list | --stats');
  }
}
