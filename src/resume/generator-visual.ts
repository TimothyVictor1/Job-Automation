import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalAlign,
  ShadingType,
  ImageRun,
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';
import { TailoredResume } from '../agents/resume-tailor';
import { ParsedJD } from '../agents/jd-parser';

// Accent color palette
const COLOR = {
  accent: '1B3F6A',      // dark navy
  accentLight: '2E6DA4', // medium blue
  leftBg: 'EEF2F7',      // very light blue-gray
  textDark: '1C2833',    // near-black
  textMid: '4A5568',     // medium gray
  textLight: '718096',   // light gray
  divider: 'CBD5E0',     // border gray
  white: 'FFFFFF',
};

function sanitizeFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').substring(0, 40);
}

function leftSectionHeader(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 16, font: 'Calibri', color: COLOR.accent, characterSpacing: 40 })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: COLOR.accentLight } },
    spacing: { before: 180, after: 80 },
  });
}

function rightSectionHeader(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 18, font: 'Calibri', color: COLOR.accent, characterSpacing: 40 })],
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: COLOR.accentLight, space: 6 } },
    spacing: { before: 200, after: 80 },
    indent: { left: 120 },
  });
}

function leftBody(text: string, bold = false, italic = false, size = 18): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold, italics: italic, size, font: 'Calibri', color: COLOR.textMid })],
    spacing: { after: 40 },
  });
}

function rightBody(text: string, bold = false, italic = false, color = COLOR.textDark, size = 19): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold, italics: italic, size, font: 'Calibri', color })],
    spacing: { after: 50 },
  });
}

function rightBullet(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `•  ${text}`, size: 19, font: 'Calibri', color: COLOR.textDark })],
    spacing: { after: 50 },
    indent: { left: 200 },
  });
}

function buildLeftColumn(profile: any, photoPath?: string): Paragraph[] {
  const paras: Paragraph[] = [];

  // Optional photo
  if (photoPath && fs.existsSync(photoPath)) {
    try {
      const imageData = fs.readFileSync(photoPath);
      paras.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: imageData,
              transformation: { width: 100, height: 100 },
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
        })
      );
    } catch {
      // Photo failed to load — skip it silently
    }
  }

  // Name
  paras.push(
    new Paragraph({
      children: [new TextRun({ text: profile.personal.name, bold: true, size: 30, font: 'Calibri', color: COLOR.textDark })],
      spacing: { after: 40 },
    })
  );

  // Tagline
  if (profile.tagline) {
    const parts = profile.tagline.split('·').map((s: string) => s.trim());
    for (const part of parts) {
      paras.push(
        new Paragraph({
          children: [new TextRun({ text: part, size: 17, font: 'Calibri', color: COLOR.accentLight, italics: true })],
          spacing: { after: 20 },
        })
      );
    }
  }

  // Divider
  paras.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: COLOR.divider } }, spacing: { after: 60 } }));

  // Contact section
  paras.push(leftSectionHeader('Contact'));

  const contactItems: { label: string; value: string }[] = [
    { label: 'Email', value: profile.personal.email || '' },
    { label: 'Phone', value: profile.personal.phone || '' },
    { label: 'LinkedIn', value: (profile.personal.linkedin || '').replace('https://', '') },
    { label: 'GitHub', value: (profile.personal.github || '').replace('https://', '') },
    { label: 'Location', value: profile.personal.location || '' },
  ].filter(c => c.value);

  for (const item of contactItems) {
    paras.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${item.label}: `, bold: true, size: 17, font: 'Calibri', color: COLOR.textMid }),
          new TextRun({ text: item.value, size: 17, font: 'Calibri', color: COLOR.textMid }),
        ],
        spacing: { after: 40 },
      })
    );
  }

  // Skills section
  paras.push(leftSectionHeader('Skills'));

  const skillGroups: { label: string; key: string }[] = [
    { label: 'AI & LLM', key: 'ai_ml' },
    { label: 'Automation', key: 'automation_orchestration' },
    { label: 'Languages', key: 'languages' },
    { label: 'Frameworks', key: 'frameworks_tools' },
    { label: 'Databases', key: 'databases' },
    { label: 'Infrastructure', key: 'infrastructure' },
    { label: 'Compliance', key: 'compliance_security' },
  ];

  for (const group of skillGroups) {
    const skills: string[] = profile.skills?.[group.key] || [];
    if (!skills.length) continue;
    paras.push(leftBody(group.label, true, false, 17));
    paras.push(leftBody(skills.slice(0, 5).join(', '), false, false, 16));
  }

  // Languages spoken
  paras.push(leftSectionHeader('Languages'));
  for (const lang of profile.languages || []) {
    paras.push(leftBody(`${lang.language}  —  ${lang.level}`, false, false, 17));
  }

  // Education
  paras.push(leftSectionHeader('Education'));
  paras.push(leftBody(profile.education.degree, true, false, 17));
  paras.push(leftBody(profile.education.institution, false, false, 17));
  paras.push(leftBody(profile.education.location, false, true, 16));
  if (profile.education.expected) {
    paras.push(leftBody(`Expected ${profile.education.expected}`, false, false, 16));
  }

  return paras;
}

function buildRightColumn(profile: any, tailored: TailoredResume): Paragraph[] {
  const paras: Paragraph[] = [];

  // Professional Summary
  paras.push(rightSectionHeader('Professional Summary'));
  paras.push(rightBody(tailored.tailoredSummary));

  // Core Skills
  paras.push(rightSectionHeader('Core Skills'));
  paras.push(
    new Paragraph({
      children: [new TextRun({ text: tailored.highlightedSkills.join('  ·  '), size: 19, font: 'Calibri', color: COLOR.textMid })],
      spacing: { after: 60 },
    })
  );

  // Selected Projects
  paras.push(rightSectionHeader('Selected Projects'));

  for (const projectId of tailored.projectOrder) {
    const project = profile.projects?.find((p: any) => p.id === projectId);
    if (!project) continue;

    const bullets = tailored.rewrittenBullets[projectId] || project.bullets || [];

    paras.push(
      new Paragraph({
        children: [
          new TextRun({ text: project.title, bold: true, size: 21, font: 'Calibri', color: COLOR.textDark }),
          new TextRun({ text: `  ·  ${project.company || project.client || ''}`, size: 19, font: 'Calibri', color: COLOR.textLight }),
        ],
        spacing: { before: 120, after: 30 },
      })
    );

    if (project.status) {
      paras.push(rightBody(project.status, false, true, COLOR.textLight, 17));
    }

    for (const b of bullets) {
      paras.push(rightBullet(b));
    }

    if (project.tech_stack?.length) {
      paras.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Tech: ', bold: true, size: 17, font: 'Calibri', color: COLOR.textMid }),
            new TextRun({ text: project.tech_stack.join(', '), size: 17, font: 'Calibri', color: COLOR.textLight }),
          ],
          spacing: { after: 80 },
        })
      );
    }
  }

  // Professional Experience
  paras.push(rightSectionHeader('Professional Experience'));

  for (const exp of profile.experience || []) {
    paras.push(
      new Paragraph({
        children: [
          new TextRun({ text: exp.role, bold: true, size: 21, font: 'Calibri', color: COLOR.textDark }),
          new TextRun({ text: `  ·  ${exp.company}`, size: 19, font: 'Calibri', color: COLOR.textLight }),
        ],
        spacing: { before: 100, after: 30 },
      })
    );
    paras.push(rightBody(`${exp.location || ''}  ·  ${exp.period || ''}`, false, true, COLOR.textLight, 17));
    for (const b of exp.bullets || []) {
      paras.push(rightBullet(b));
    }
  }

  // Achievements
  if (profile.achievements?.length) {
    paras.push(rightSectionHeader('Achievements'));
    for (const a of profile.achievements.slice(0, 3)) {
      paras.push(rightBullet(a));
    }
  }

  return paras;
}

// Two-column visual resume — Teamtailor-safe (human-reviewed PDF)
export async function generateVisualResumeDOCX(
  profile: any,
  tailored: TailoredResume,
  parsedJD: ParsedJD,
  photoPath?: string
): Promise<string> {
  const leftContent = buildLeftColumn(profile, photoPath);
  const rightContent = buildRightColumn(profile, tailored);

  const noBorder = { style: BorderStyle.NONE, size: 0, color: COLOR.white };

  const table = new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.leftBg, type: ShadingType.CLEAR, color: 'auto' },
            borders: { top: noBorder, bottom: noBorder, left: noBorder, right: { style: BorderStyle.SINGLE, size: 3, color: COLOR.divider } },
            margins: { top: 220, bottom: 220, left: 280, right: 280 },
            verticalAlign: VerticalAlign.TOP,
            children: leftContent,
          }),
          new TableCell({
            width: { size: 67, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.white, type: ShadingType.CLEAR, color: 'auto' },
            borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
            margins: { top: 220, bottom: 220, left: 320, right: 240 },
            verticalAlign: VerticalAlign.TOP,
            children: rightContent,
          }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } },
      },
      children: [table],
    }],
  });

  const company = sanitizeFilename(parsedJD.company);
  const role = sanitizeFilename(parsedJD.role);
  const suffix = photoPath ? '_Photo' : '';
  const filename = `${company}_${role}_Visual${suffix}_Timothy.docx`;
  const outputPath = path.join(process.cwd(), 'output', filename);

  fs.writeFileSync(outputPath, await Packer.toBuffer(doc));
  return outputPath;
}
