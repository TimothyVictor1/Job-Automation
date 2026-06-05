import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalAlign,
  ShadingType,
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';
import { TailoredResume } from '../agents/resume-tailor';
import { ParsedJD } from '../agents/jd-parser';

function sanitizeFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').substring(0, 40);
}

function hr(): Paragraph {
  return new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '333333' },
    },
    spacing: { after: 80 },
  });
}

function sectionHeader(text: string): Paragraph[] {
  return [
    new Paragraph({
      children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 24, font: 'Calibri' })],
      spacing: { before: 200, after: 60 },
    }),
    hr(),
  ];
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `• ${text}`, size: 21, font: 'Calibri' })],
    spacing: { after: 60 },
    indent: { left: 360 },
  });
}

function bodyText(text: string, bold = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold, size: 21, font: 'Calibri' })],
    spacing: { after: 60 },
  });
}

export async function generateResumeDOCX(
  profile: any,
  tailored: TailoredResume,
  parsedJD: ParsedJD,
  coverLetterText: string
): Promise<string> {
  const children: Paragraph[] = [];

  // Header
  children.push(
    new Paragraph({
      children: [new TextRun({ text: profile.personal.name, bold: true, size: 56, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    })
  );

  const contactParts = [
    profile.personal.email,
    profile.personal.phone,
    profile.personal.linkedin,
    profile.personal.github,
    profile.personal.location,
  ].filter(Boolean).join(' · ');

  children.push(
    new Paragraph({
      children: [new TextRun({ text: contactParts, size: 18, font: 'Calibri', color: '444444' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  // Summary
  children.push(...sectionHeader('Professional Summary'));
  children.push(bodyText(tailored.tailoredSummary));

  // Skills
  children.push(...sectionHeader('Core Skills'));
  children.push(bodyText(tailored.highlightedSkills.join(' · ')));

  // Selected Projects
  children.push(...sectionHeader('Selected Projects'));

  for (const projectId of tailored.projectOrder) {
    const project = profile.projects?.find((p: any) => p.id === projectId);
    if (!project) continue;

    const bullets = tailored.rewrittenBullets[projectId] || project.bullets || [];

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: project.title, bold: true, size: 23, font: 'Calibri' }),
          new TextRun({ text: `  ·  ${project.company || project.client || ''}`, size: 21, font: 'Calibri', color: '666666' }),
        ],
        spacing: { before: 120, after: 40 },
      })
    );

    if (project.status) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: project.status, size: 18, font: 'Calibri', italics: true, color: '888888' })],
          spacing: { after: 60 },
        })
      );
    }

    for (const b of bullets) {
      children.push(bullet(b));
    }

    if (project.tech_stack?.length) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Tech: ', bold: true, size: 19, font: 'Calibri', color: '555555' }),
            new TextRun({ text: project.tech_stack.join(', '), size: 19, font: 'Calibri', color: '555555' }),
          ],
          spacing: { after: 80 },
        })
      );
    }
  }

  // Experience
  children.push(...sectionHeader('Professional Experience'));

  for (const exp of profile.experience || []) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: exp.role, bold: true, size: 23, font: 'Calibri' }),
          new TextRun({ text: `  ·  ${exp.company}`, size: 21, font: 'Calibri', color: '666666' }),
        ],
        spacing: { before: 100, after: 40 },
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${exp.location || ''}  |  ${exp.period || ''}`, size: 18, font: 'Calibri', italics: true, color: '888888' }),
        ],
        spacing: { after: 60 },
      })
    );
    for (const b of exp.bullets || []) {
      children.push(bullet(b));
    }
  }

  // Education
  children.push(...sectionHeader('Education'));
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: profile.education.degree, bold: true, size: 23, font: 'Calibri' }),
      ],
      spacing: { before: 80, after: 40 },
    })
  );
  children.push(bodyText(`${profile.education.institution} · ${profile.education.location}`));
  if (profile.education.thesis) {
    children.push(bodyText(`Thesis: ${profile.education.thesis}`));
  }
  if (profile.education.supervisor) {
    children.push(bodyText(`Supervisor: ${profile.education.supervisor}`));
  }

  // Achievements
  children.push(...sectionHeader('Achievements'));
  for (const a of (profile.achievements || []).slice(0, 3)) {
    children.push(bullet(a));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 }, // ~2cm in twips
        },
      },
      children,
    }],
  });

  const company = sanitizeFilename(parsedJD.company);
  const role = sanitizeFilename(parsedJD.role);
  const filename = `${company}_${role}_Resume_Timothy.docx`;
  const outputPath = path.join(process.cwd(), 'output', filename);

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);

  return outputPath;
}
