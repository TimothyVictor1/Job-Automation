import { getClient, CLAUDE_MODEL } from '../utils/anthropic';
import { ParsedJD } from './jd-parser';

export interface TailoredResume {
  fitScore: number;
  fitReason: string;
  shouldApply: boolean;
  tailoredSummary: string;
  selectedProjectIds: string[];
  projectOrder: string[];
  rewrittenBullets: Record<string, string[]>;
  highlightedSkills: string[];
  tailoringNotes: string;
}

export async function tailorResume(
  profile: any,
  projectsMd: string,
  parsedJD: ParsedJD
): Promise<TailoredResume> {
  const client = getClient();

  const prompt = `You are helping Timothy Victor Rachuri tailor his resume for a specific job.

CRITICAL GROUNDING RULE — READ THIS FIRST:
Every noun you write (tool name, technology, metric, client name, company name, project name, framework, achievement) MUST exist verbatim in Timothy's PROFILE DATA below. You are selecting and reframing real facts — you are NEVER inventing new claims. If a JD keyword has no matching fact in the profile, do NOT add it. Highlight the closest real match instead. Your output will be verified against the source profile — any fabricated noun will be rejected.

TIMOTHY'S FULL PROFILE (JSON):
${JSON.stringify(profile, null, 2)}

TIMOTHY'S DETAILED PROJECT REFERENCE (markdown):
${projectsMd}

TARGET JOB:
${JSON.stringify(parsedJD, null, 2)}

TAILOR AGENT NOTE from profile:
${profile._meta?.tailor_agent_note || ''}

Instructions:
1. Select 3-4 projects from the JSON profile that best match this specific JD (use the tailor_agent_note guidance above)
2. Rewrite bullet points for selected projects to EMPHASISE the facts most relevant to this JD
   — You may restructure sentences and adjust verb choice for relevance
   — NEVER add a tool, technology, metric, client, or result that is not in the source profile data
   — If a bullet from the source already says what needs to be said, keep it close to the original wording
   — Pull richer detail from the projects markdown ONLY if that detail is documented there
3. Write a tailored professional summary (3 sentences max) that speaks directly to this company's needs
   — Mention only real technologies and projects from the profile
   — Do not claim skills or experience not present in the profile
4. Select the top 8-10 skills MOST relevant to this JD from Timothy's actual skills list (profile.skills only — do not add skills not listed there)
5. Score the fit honestly — a 7+ means strong genuine match, not inflated

Return ONLY valid JSON, no markdown:
{
  "fitScore": 8,
  "fitReason": "why this is a strong/weak match, grounded in profile facts",
  "shouldApply": true,
  "tailoredSummary": "3 sentence summary tailored to this company — only facts from profile",
  "selectedProjectIds": ["id1", "id2", "id3"],
  "projectOrder": ["id2", "id1", "id3"],
  "rewrittenBullets": {
    "project_id": [
      "rewritten bullet emphasising JD-relevant fact from profile",
      "another bullet — only real facts"
    ]
  },
  "highlightedSkills": ["skill1", "skill2"],
  "tailoringNotes": "what was emphasised and why, and any gaps noted"
}`;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (response.content[0] as any).text;
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as TailoredResume;
  } catch (err) {
    console.error('Raw tailor response:', text);
    throw new Error(`Failed to parse tailored resume JSON: ${err}`);
  }
}
