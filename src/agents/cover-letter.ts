import { getClient, CLAUDE_MODEL } from '../utils/anthropic';
import { ParsedJD } from './jd-parser';
import { TailoredResume } from './resume-tailor';

export async function generateCoverLetterText(
  profile: any,
  parsedJD: ParsedJD,
  tailored: TailoredResume
): Promise<string> {
  const client = getClient();

  const selectedProjects = tailored.selectedProjectIds
    .map(id => profile.projects?.find((p: any) => p.id === id))
    .filter(Boolean)
    .map((p: any) => p.title)
    .join(', ');

  const prompt = `Write a professional cover letter for Timothy Victor Rachuri applying to the role below.

CRITICAL GROUNDING RULE:
Every project name, technology, metric, achievement, and claim you write MUST exist in the CANDIDATE PROFILE below. Do NOT invent client names, metrics, tool names, or results. Reference only facts documented in the profile. This will be verified.

CANDIDATE PROFILE:
Name: Timothy Victor Rachuri
Location: ${profile.personal?.location || 'Karlskrona, Sweden'}
Email: ${profile.personal?.email || ''}
Summary: ${profile.summary || ''}

Selected projects for this application:
${tailored.selectedProjectIds.map(id => {
  const p = profile.projects?.find((proj: any) => proj.id === id);
  return p ? `- ${p.title} (${p.company || p.client}): ${p.impact || ''}` : '';
}).filter(Boolean).join('\n')}

TAILORING CONTEXT:
Fit reason: ${tailored.fitReason}
Tailored summary: ${tailored.tailoredSummary}

JOB:
Company: ${parsedJD.company}
Role: ${parsedJD.role}
About company: ${parsedJD.aboutCompany}
Role description: ${parsedJD.roleDescription}
Must-have skills: ${parsedJD.mustHaveSkills.join(', ')}
Key tech: ${parsedJD.techStack.join(', ')}

INSTRUCTIONS:
- 3 paragraphs, maximum 250 words total
- Para 1: Open with the specific role + why Timothy is excited about THIS company (reference something real about the company from the JD — do not fabricate)
- Para 2: 2-3 most relevant projects from the selected list above, named explicitly, with 1 concrete result each — use ONLY the impact statements from the profile
- Para 3: Close with what Timothy brings + call to action
- Tone: Direct, confident, specific — no generic filler sentences
- Do NOT use: "I am writing to express my interest", "I believe I would be a great fit", "please find attached", or any other cliché opener/closer
- Write as Timothy speaks — direct, builder mindset, evidence-led
- Do NOT invent any metric, client name, technology, or achievement not present in the profile above
- End with: "Best regards,\\nTimothy Victor Rachuri"

Return the plain cover letter text only — no JSON, no formatting markers.`;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  return (response.content[0] as any).text.trim();
}
