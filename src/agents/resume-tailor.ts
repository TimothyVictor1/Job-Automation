import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import { ParsedJD } from './jd-parser';
dotenv.config();

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
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const profileContext = `PROFILE JSON:\n${JSON.stringify(profile, null, 2)}\n\nPROJECT DETAILS:\n${projectsMd}`;

  const prompt = `You are a senior tech recruiter helping Timothy Victor Rachuri tailor his resume for a specific job. Your job is to select the best projects and rewrite bullet points to mirror the exact language of the job description.

TIMOTHY'S FULL PROFILE (JSON):
${JSON.stringify(profile, null, 2)}

TIMOTHY'S DETAILED PROJECT REFERENCE (markdown):
${projectsMd}

TARGET JOB:
${JSON.stringify(parsedJD, null, 2)}

TAILOR AGENT NOTE from profile:
${profile._meta?.tailor_agent_note || ''}

Instructions:
1. Select 3-4 projects from the JSON profile that best match this specific JD
2. Rewrite bullet points for selected projects to mirror JD language exactly
   — use the same verbs, same tech terms, same framing as the JD
   — pull richer detail from projects.md if it adds relevance
3. Write a tailored professional summary (3 sentences max) that speaks directly to this company's needs
4. Select the top 8-10 skills most relevant to this JD from Timothy's full skill set
5. Score the overall fit

Return ONLY valid JSON, no markdown:
{
  "fitScore": 8,
  "fitReason": "why this is a strong/weak match",
  "shouldApply": true,
  "tailoredSummary": "3 sentence summary tailored to this specific company and role",
  "selectedProjectIds": ["id1", "id2", "id3"],
  "projectOrder": ["id2", "id1", "id3"],
  "rewrittenBullets": {
    "project_id": [
      "rewritten bullet 1 mirroring JD language",
      "rewritten bullet 2"
    ]
  },
  "highlightedSkills": ["skill1", "skill2"],
  "tailoringNotes": "brief notes on what was emphasised and why"
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
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
