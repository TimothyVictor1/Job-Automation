import * as fs from 'fs';
import * as path from 'path';

export function loadProfile() {
  const jsonPath = path.join(process.cwd(), 'profile', 'timothy.json');
  const mdPath = path.join(process.cwd(), 'profile', 'projects.md');

  const profile = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  let projectsMd = '';
  if (fs.existsSync(mdPath)) {
    projectsMd = fs.readFileSync(mdPath, 'utf-8');
  }

  return { profile, projectsMd };
}
