import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import { ParsedJD } from './jd-parser';
import { TailoredResume } from './resume-tailor';
dotenv.config();

export async function generateCoverLetterText(
  profile: any,
  parsedJD: ParsedJD,
  tailored: TailoredResume
): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const selectedProjects = tailored.selectedProjectIds
    .map(id => profile.projects?.find((p: any) => p.id === id))
    .filter(Boolean)
    .map((p: any) => p.title)
    .join(', ');

  const prompt = `Write a professional cover letter for Timothy Victor Rachuri applying to the role below.

CANDIDATE PROFILE:
Name: Timothy Victor Rachuri
Location: Karlskrona, Sweden
Email: ${profile.personal?.email || '[email]'}

TAILORING CONTEXT:
Fit reason: ${tailored.fitReason}
Tailored summary: ${tailored.tailoredSummary}
Selected projects: ${selectedProjects}

JOB:
Company: ${parsedJD.company}
Role: ${parsedJD.role}
About company: ${parsedJD.aboutCompany}
Role description: ${parsedJD.roleDescription}
Must-have skills: ${parsedJD.mustHaveSkills.join(', ')}
Key tech: ${parsedJD.techStack.join(', ')}

INSTRUCTIONS:
- 3 paragraphs, maximum 250 words total
- Para 1: Open with the specific role + why Timothy is excited about THIS company (reference something real about the company from the JD)
- Para 2: 2-3 most relevant projects, named explicitly, with 1 concrete result each
- Para 3: Close with what Timothy brings + call to action
- Tone: Direct, confident, specific — no generic filler sentences
- Do NOT use: "I am writing to express my interest", "I believe I would be a great fit", "please find attached", or any other cliché opener/closer
- Write as Timothy speaks — direct, builder mindset, evidence-led
- End with: "Best regards,\\nTimothy Victor Rachuri"

Return the plain cover letter text only — no JSON, no formatting markers.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  return (response.content[0] as any).text.trim();
}
