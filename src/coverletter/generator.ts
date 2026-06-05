import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import * as fs from 'fs';
import * as path from 'path';
import { ParsedJD } from '../agents/jd-parser';

function sanitizeFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').substring(0, 40);
}

function para(text: string, bold = false, size = 21): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold, size, font: 'Calibri' })],
    spacing: { after: 160 },
  });
}

export async function generateCoverLetterDOCX(
  profile: any,
  parsedJD: ParsedJD,
  coverLetterText: string
): Promise<string> {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const children: Paragraph[] = [];

  // Sender block
  children.push(para(profile.personal.name, true, 24));
  children.push(para([profile.personal.email, profile.personal.phone, profile.personal.location].filter(Boolean).join('  ·  '), false, 18));
  children.push(para(''));
  children.push(para(today));
  children.push(para(''));

  // Recipient block
  children.push(para(parsedJD.company, true));
  children.push(para(`Re: ${parsedJD.role}`));
  children.push(para(''));

  // Body paragraphs
  const paragraphs = coverLetterText.split(/\n\n+/).filter(p => p.trim());
  for (const p of paragraphs) {
    children.push(para(p.replace(/\n/g, ' ').trim()));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
        },
      },
      children,
    }],
  });

  const company = sanitizeFilename(parsedJD.company);
  const role = sanitizeFilename(parsedJD.role);
  const filename = `${company}_${role}_CoverLetter_Timothy.docx`;
  const outputPath = path.join(process.cwd(), 'output', filename);

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);

  return outputPath;
}
