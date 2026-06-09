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

export interface ConfirmedSkill {
  skill: string;
  category: 'must-have' | 'nice-to-have';
  note: string;
}

export async function tailorResume(
  profile: any,
  projectsMd: string,
  parsedJD: ParsedJD,
  confirmedSkills?: ConfirmedSkill[]
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
${confirmedSkills && confirmedSkills.length > 0 ? `
ADDITIONAL SKILLS CONFIRMED BY TIMOTHY (treat these as verified facts — use Timothy's own words):
${confirmedSkills.map(s => `- [${s.category.toUpperCase()}] "${s.skill}": ${s.note}`).join('\n')}
These were self-reported in response to JD gaps. Include them where relevant to this role. You may write bullets or summary lines referencing these, using the exact context Timothy provided above.
` : ''}

WRITE LIKE A HUMAN, NOT LIKE AI — this is as important as the grounding rule.
A real engineer wrote this resume by hand. Recruiters can smell AI writing and it kills credibility. Obey every rule:
  - NEVER use an em-dash or en-dash (— or –). This is the #1 AI tell. Use a period and start a new sentence, or use a comma. Zero dashes in any bullet or summary.
  - NEVER end a bullet with a trailing editorial clause like "..., enabling X", "..., ensuring Y", "..., demonstrating Z", "..., replacing W", "..., validating V". State what you did and the result, then STOP.
  - NEVER use buzzword taglines: no "production-grade reliability from day one", no "compliant by design, not by policy", no "from architecture through deployment", no "empowering teams". Cut all self-congratulatory commentary.
  - Keep bullets SHORT: one line each, roughly 12 to 22 words. One idea per bullet. Do not stack three clauses into one bullet.
  - Lead with a number when you genuinely have one in the profile; otherwise lead with a plain past-tense verb. Vary the opening verbs.
  - Use plain, concrete language. Say what was built and what happened. Do not explain why it matters.
  - Do NOT stuff the JD's exact phrases repeatedly. Use a key term once or twice where it fits naturally. Repetition reads as keyword-stuffing.
  - It is fine and good for bullets to be slightly uneven in length and structure. Perfect parallelism reads as machine-generated.

Instructions:
1. Select 3-4 projects from the JSON profile that best match this specific JD (use the tailor_agent_note guidance above)
2. Rewrite bullets for selected projects to emphasise JD-relevant facts, following EVERY human-writing rule above
   - You may restructure and shorten; you may NOT add any tool, technology, metric, client, or result not in the source profile
   - Prefer 3-4 tight bullets per project over 5 long ones. Cut filler.
   - Pull richer detail from the projects markdown ONLY if documented there
3. Write a professional summary of 2 short sentences max. Plain language. What Timothy does + his single strongest proof point. No buzzword stacking, no dashes.
4. Select the top 8-10 skills MOST relevant to this JD from Timothy's actual skills list (profile.skills only)
5. Score the fit honestly. Calibrate to the role's actual seniority. A 7+ means a strong genuine match.

Return ONLY valid JSON, no markdown. Note: the example values below contain NO dashes on purpose. Match that style:
{
  "fitScore": 8,
  "fitReason": "why this is a strong or weak match, grounded in profile facts",
  "shouldApply": true,
  "tailoredSummary": "Two plain sentences. No dashes. Real facts only.",
  "selectedProjectIds": ["id1", "id2", "id3"],
  "projectOrder": ["id2", "id1", "id3"],
  "rewrittenBullets": {
    "project_id": [
      "Built X using Y. Cut booking time from hours to minutes.",
      "Short second bullet, one idea, no trailing clause"
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
    const parsed = JSON.parse(cleaned) as TailoredResume;
    return deAiResume(parsed);
  } catch (err) {
    console.error('Raw tailor response:', text);
    throw new Error(`Failed to parse tailored resume JSON: ${err}`);
  }
}

/**
 * Safety net: strip the most common AI tells the model may still emit, even
 * after being told not to. Runs on every bullet and the summary.
 *   - em/en dashes → sentence break or comma
 *   - smart quotes → straight quotes
 *   - trailing editorial clauses ("..., enabling X.") → cut
 */
export function deAiText(input: string): string {
  if (!input) return input;
  let s = input;

  // Normalise smart quotes
  s = s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

  // All em/en dashes become commas (whether spaced or glued). This turns the
  // typical "action — editorial result" into "action, editorial result", which
  // the trailing-clause remover below can then cleanly cut.
  s = s.replace(/\s*[—–]\s*/g, ', ');

  // Cut a trailing editorial clause: ", enabling/ensuring/replacing X ...".
  s = s.replace(
    /,\s+(enabling|ensuring|demonstrating|validating|replacing|empowering|allowing|providing|delivering|driving|achieving|reflecting|highlighting|showcasing|underscoring|optimising|optimizing|streamlining|facilitating|supporting)\b[^.]*$/i,
    ''
  );

  // Tidy: collapse doubled commas/spaces, drop a dangling trailing comma.
  s = s.replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').replace(/[,\s]+$/, '').trim();

  return s;
}

function deAiResume(r: TailoredResume): TailoredResume {
  r.tailoredSummary = deAiText(r.tailoredSummary);
  const cleanedBullets: Record<string, string[]> = {};
  for (const [id, bullets] of Object.entries(r.rewrittenBullets || {})) {
    cleanedBullets[id] = (bullets as string[]).map(deAiText);
  }
  r.rewrittenBullets = cleanedBullets;
  return r;
}
