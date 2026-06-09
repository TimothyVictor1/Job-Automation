import { ParsedJD } from './jd-parser';

export interface PreScreenResult {
  fitScore: number;
  keywordCoverage: number;
  mustHaveCoverage: number;
  matchedSkills: string[];
  missingMustHaves: string[];
  missingNiceToHaves: string[];
  hardBlockers: string[];
  seniorityFit: 'good' | 'senior-role' | 'junior-role' | 'not-specified';
  recommendation: 'apply' | 'review-gaps' | 'skip';
  gapSummary: string;
}

// Common aliases for fuzzy matching between JD and profile skills
const SKILL_ALIASES: Record<string, string[]> = {
  'machine learning': ['ml', 'ai/ml'],
  'artificial intelligence': ['ai', 'ai/ml'],
  'javascript': ['js'],
  'typescript': ['ts'],
  'python': ['py'],
  'postgresql': ['postgres', 'pg', 'psql'],
  'react': ['reactjs', 'react.js'],
  'node.js': ['nodejs', 'node'],
  'kubernetes': ['k8s'],
  'docker': ['containers', 'containerization'],
  'retrieval-augmented generation': ['rag'],
  'large language model': ['llm', 'llms'],
  'natural language processing': ['nlp'],
  'generative ai': ['genai', 'gen-ai'],
  'langchain': ['lang-chain'],
  'langgraph': ['lang-graph'],
  'anthropic': ['claude', 'claude api'],
  'openai': ['gpt', 'gpt-4', 'chatgpt'],
  'fastapi': ['fast-api'],
  'next.js': ['nextjs', 'next'],
  'redis': ['upstash redis', 'upstash'],
  'aws': ['amazon web services'],
  'gcp': ['google cloud'],
  'azure': ['microsoft azure'],
};

function buildProfileSkillSet(profile: any): Set<string> {
  const skills = new Set<string>();

  const add = (text: string) => {
    if (text) skills.add(text.toLowerCase().trim());
  };

  // From skills object
  for (const arr of Object.values(profile.skills || {})) {
    for (const s of arr as string[]) {
      add(s);
    }
  }

  // From project tags and tech_stack
  for (const p of profile.projects || []) {
    for (const t of p.tags || []) add(t);
    for (const t of p.tech_stack || []) add(t);
  }

  // From experience tags
  for (const e of profile.experience || []) {
    for (const t of e.tags || []) add(t);
  }

  return skills;
}

function skillMatches(jdSkill: string, profileSkills: Set<string>): boolean {
  const needle = jdSkill.toLowerCase().trim();

  // Exact match
  if (profileSkills.has(needle)) return true;

  // Containment match
  for (const ps of profileSkills) {
    if (ps.includes(needle) || needle.includes(ps)) return true;
  }

  // Alias match
  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    const allForms = [canonical, ...aliases];
    if (allForms.some(f => f === needle || needle.includes(f) || f.includes(needle))) {
      // Check if profile has any form of this
      if (allForms.some(f => profileSkills.has(f) || [...profileSkills].some(ps => ps.includes(f) || f.includes(ps)))) {
        return true;
      }
    }
  }

  return false;
}

function matchSkills(
  jdSkills: string[],
  profileSkills: Set<string>
): { matched: string[]; missing: string[] } {
  const matched: string[] = [];
  const missing: string[] = [];
  for (const skill of jdSkills) {
    if (skill && skillMatches(skill, profileSkills)) {
      matched.push(skill);
    } else if (skill) {
      missing.push(skill);
    }
  }
  return { matched, missing };
}

function detectHardBlockers(parsedJD: ParsedJD, profile: any): string[] {
  const blockers: string[] = [];
  const jdText = [
    parsedJD.roleDescription,
    parsedJD.aboutCompany,
    ...parsedJD.mustHaveSkills,
    ...parsedJD.keywords,
  ].join(' ').toLowerCase();

  // Citizenship / work authorization
  if (/eu citizen|swedish citizen|citizenship required|work permit not|no sponsorship|must be a citizen/i.test(jdText)) {
    blockers.push('Role may require EU/Swedish citizenship — verify work authorization');
  }

  // Swedish language requirement
  if (/fluent swedish|native swedish|swedish required|swedish is required|svenska krävs|kräver svenska/i.test(jdText)) {
    blockers.push('Swedish fluency required — Timothy is actively learning (not yet fluent)');
  }

  // PhD requirement
  if (/phd required|must have phd|doctorate required/i.test(jdText)) {
    blockers.push('PhD required — Timothy holds a BSc');
  }

  // Minimum years of experience mismatch (5+ years)
  if (/minimum\s+[5-9]\+?\s+years|at least\s+[5-9]\+?\s+years|[5-9]\+?\s+years.*experience/i.test(jdText)) {
    blockers.push('Role requires 5+ years experience — Timothy has ~2 years of professional AI engineering');
  }

  return blockers;
}

function assessSeniority(seniorityLevel: string): PreScreenResult['seniorityFit'] {
  const level = seniorityLevel.toLowerCase();
  if (level === 'junior' || level === 'mid' || level === 'not specified') return 'good';
  if (level === 'senior') return 'senior-role';
  if (level === 'lead') return 'senior-role';
  return 'not-specified';
}

function buildGapSummary(
  missingMustHaves: string[],
  missingNiceToHaves: string[],
  hardBlockers: string[],
  seniorityFit: PreScreenResult['seniorityFit']
): string {
  const lines: string[] = [];

  if (hardBlockers.length > 0) {
    lines.push(`HARD BLOCKERS (${hardBlockers.length}):`);
    for (const b of hardBlockers) lines.push(`  ✗ ${b}`);
  }

  if (missingMustHaves.length > 0) {
    lines.push(`\nMISSING MUST-HAVES (${missingMustHaves.length}):`);
    for (const s of missingMustHaves) lines.push(`  △ ${s}`);
  } else {
    lines.push('\n✓ All must-have skills matched');
  }

  if (missingNiceToHaves.length > 0) {
    lines.push(`\nMISSING NICE-TO-HAVES (${missingNiceToHaves.length}):`);
    for (const s of missingNiceToHaves.slice(0, 5)) lines.push(`  ○ ${s}`);
  }

  if (seniorityFit === 'senior-role') {
    lines.push('\n⚠  Senior/lead role — consider whether experience level aligns');
  }

  return lines.join('\n');
}

export function preScreen(parsedJD: ParsedJD, profile: any): PreScreenResult {
  const profileSkills = buildProfileSkillSet(profile);

  const { matched: matchedMustHaves, missing: missingMustHaves } = matchSkills(parsedJD.mustHaveSkills, profileSkills);
  const { missing: missingNiceToHaves } = matchSkills(parsedJD.niceToHaveSkills, profileSkills);
  const { matched: matchedTech } = matchSkills(parsedJD.techStack, profileSkills);

  const totalMustHave = parsedJD.mustHaveSkills.length;
  const mustHaveCoverage = totalMustHave > 0 ? matchedMustHaves.length / totalMustHave : 1.0;

  const allJDSkills = [...parsedJD.mustHaveSkills, ...parsedJD.techStack];
  const allMatchedSet = new Set([...matchedMustHaves, ...matchedTech]);
  const keywordCoverage = allJDSkills.length > 0 ? allMatchedSet.size / allJDSkills.length : 1.0;

  const hardBlockers = detectHardBlockers(parsedJD, profile);
  const seniorityFit = assessSeniority(parsedJD.seniorityLevel);

  // Score: keyword coverage (40%) + must-have coverage (35%) + gap score (25%)
  const gapScore = totalMustHave > 0 ? 1 - (missingMustHaves.length / totalMustHave) : 1.0;
  let fitScore = Math.round((keywordCoverage * 0.4 + mustHaveCoverage * 0.35 + gapScore * 0.25) * 10);

  // Deductions
  fitScore = Math.max(0, fitScore - hardBlockers.length * 2);
  if (seniorityFit === 'senior-role') fitScore = Math.max(0, fitScore - 1);
  fitScore = Math.min(10, fitScore);

  let recommendation: PreScreenResult['recommendation'];
  if (hardBlockers.length > 0 || fitScore < 4) {
    recommendation = 'skip';
  } else if (fitScore >= 6 && missingMustHaves.length === 0) {
    recommendation = 'apply';
  } else {
    recommendation = 'review-gaps';
  }

  const gapSummary = buildGapSummary(missingMustHaves, missingNiceToHaves, hardBlockers, seniorityFit);

  return {
    fitScore,
    keywordCoverage,
    mustHaveCoverage,
    matchedSkills: [...allMatchedSet],
    missingMustHaves,
    missingNiceToHaves,
    hardBlockers,
    seniorityFit,
    recommendation,
    gapSummary,
  };
}
