import { getClient, CLAUDE_MODEL } from '../utils/anthropic';

export interface ParsedJD {
  company: string;
  role: string;
  location: string;
  employmentType: string;
  seniorityLevel: string;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  techStack: string[];
  keywords: string[];
  aboutCompany: string;
  roleDescription: string;
  applicationDeadline: string | null;
  applyUrl: string | null;
}

export async function parseJD(pageText: string): Promise<ParsedJD> {
  const client = getClient();

  const prompt = `You are parsing a job description for Timothy Victor Rachuri's job application system.

Extract all relevant information and return ONLY valid JSON — no markdown, no explanation.

Return this exact schema:
{
  "company": "company name",
  "role": "exact job title",
  "location": "city, country or Remote",
  "employmentType": "full-time | part-time | contract | internship",
  "seniorityLevel": "junior | mid | senior | lead | not specified",
  "mustHaveSkills": ["skill1", "skill2"],
  "niceToHaveSkills": ["skill1", "skill2"],
  "techStack": ["tech1", "tech2"],
  "keywords": ["keyword1", "keyword2"],
  "aboutCompany": "2 sentence summary of the company",
  "roleDescription": "2 sentence summary of what the role does",
  "applicationDeadline": "date or null",
  "applyUrl": "direct apply URL or null"
}

JOB PAGE TEXT:
${pageText}`;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (response.content[0] as any).text;
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as ParsedJD;
  } catch (err) {
    console.error('Raw JD parser response:', text);
    throw new Error(`Failed to parse JD JSON: ${err}`);
  }
}
