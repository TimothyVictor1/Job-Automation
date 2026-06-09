import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';
import { TailoredResume, deAiText } from '../agents/resume-tailor';
import { ParsedJD } from '../agents/jd-parser';

function sanitizeFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').substring(0, 40);
}

function hr(): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '444444' } },
    spacing: { after: 60 },
  });
}

function sectionHeader(text: string): Paragraph[] {
  return [
    new Paragraph({
      children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, font: 'Calibri', color: '111111' })],
      spacing: { before: 220, after: 50 },
    }),
    hr(),
  ];
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: deAiText(text), size: 20, font: 'Calibri' })],
    bullet: { level: 0 },
    spacing: { after: 50 },
  });
}

function body(text: string, bold = false, italic = false, color = '111111'): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: deAiText(text), bold, italics: italic, size: 20, font: 'Calibri', color })],
    spacing: { after: 50 },
  });
}

// ATS-safe single-column resume — no tables, standard headings, contact in body
export async function generateAtsResumeDOCX(
  profile: any,
  tailored: TailoredResume,
  parsedJD: ParsedJD
): Promise<string> {
  const children: Paragraph[] = [];

  // Name
  children.push(
    new Paragraph({
      children: [new TextRun({ text: profile.personal.name, bold: true, size: 52, font: 'Calibri', color: '111111' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    })
  );

  // Contact line — plain text, ATS-readable
  const contact = [
    profile.personal.email,
    profile.personal.phone,
    profile.personal.linkedin?.replace('https://', ''),
    profile.personal.github?.replace('https://', ''),
    profile.personal.location,
  ].filter(Boolean).join('  |  ');

  children.push(
    new Paragraph({
      children: [new TextRun({ text: contact, size: 18, font: 'Calibri', color: '444444' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  // Professional Summary
  children.push(...sectionHeader('Professional Summary'));
  children.push(body(tailored.tailoredSummary));

  // Core Skills — flat list for ATS keyword scanning
  children.push(...sectionHeader('Core Skills'));
  children.push(body(tailored.highlightedSkills.join(' · ')));

  // Professional Experience — comes before projects (standard resume order)
  children.push(...sectionHeader('Experience'));

  for (const exp of profile.experience || []) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: exp.role, bold: true, size: 22, font: 'Calibri' }),
          new TextRun({ text: `  |  ${exp.company}`, size: 20, font: 'Calibri', color: '555555' }),
        ],
        spacing: { before: 100, after: 30 },
      })
    );
    children.push(body(`${exp.location || ''}  ·  ${exp.period || ''}`, false, true, '777777'));
    for (const b of exp.bullets || []) {
      children.push(bullet(b));
    }
  }

  // Selected Projects
  children.push(...sectionHeader('Selected Projects'));

  for (const projectId of tailored.projectOrder) {
    const project = profile.projects?.find((p: any) => p.id === projectId);
    if (!project) continue;

    const bullets = tailored.rewrittenBullets[projectId] || project.bullets || [];

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: project.title, bold: true, size: 22, font: 'Calibri' }),
          new TextRun({ text: `  |  ${project.company || project.client || ''}`, size: 20, font: 'Calibri', color: '555555' }),
        ],
        spacing: { before: 100, after: 30 },
      })
    );

    if (project.status) {
      children.push(body(project.status, false, true, '777777'));
    }

    for (const b of bullets) {
      children.push(bullet(b));
    }

    if (project.tech_stack?.length) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Tech: ', bold: true, size: 18, font: 'Calibri', color: '444444' }),
            new TextRun({ text: project.tech_stack.join(', '), size: 18, font: 'Calibri', color: '555555' }),
          ],
          spacing: { after: 80 },
        })
      );
    }
  }

  // Education
  children.push(...sectionHeader('Education'));
  children.push(body(profile.education.degree, true));
  children.push(body(`${profile.education.institution}  ·  ${profile.education.location}`));
  if (profile.education.expected) {
    children.push(body(`Expected: ${profile.education.expected}`, false, true));
  }
  if (profile.education.thesis) {
    children.push(body(`Thesis: ${profile.education.thesis}`));
  }

  // Achievements
  if (profile.achievements?.length) {
    children.push(...sectionHeader('Notable Achievements'));
    for (const a of profile.achievements.slice(0, 3)) {
      children.push(bullet(a));
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } },
      },
      children,
    }],
  });

  const company = sanitizeFilename(parsedJD.company);
  const role = sanitizeFilename(parsedJD.role);
  const filename = `${company}_${role}_ATS_Timothy.docx`;
  const outputPath = path.join(process.cwd(), 'output', filename);

  fs.writeFileSync(outputPath, await Packer.toBuffer(doc));
  return outputPath;
}
