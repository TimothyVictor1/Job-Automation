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
import { TailoredResume, deAiText } from '../agents/resume-tailor';
import { ParsedJD } from '../agents/jd-parser';

// ── Layout constants ─────────────────────────────────────────────────────────
// A4: 11906 × 16838 twips. Margins 500 twips (≈0.88 cm) each side.
const MARGIN   = 500;
const PAGE_W   = 11906;
const AVAIL_W  = PAGE_W - MARGIN * 2;  // 10906
const LEFT_W   = 3680;                 // ~34%  (≈6.5 cm — enough for skills)
const RIGHT_W  = AVAIL_W - LEFT_W;    // 7226

// ── Colour palette ───────────────────────────────────────────────────────────
const C = {
  // Dark navy sidebar
  sidebar:   '1B3F6A',
  sideName:  'FFFFFF',
  sideAccent:'7EB3D8',   // light blue — section headers in sidebar
  sideHr:    '2E6096',   // divider inside sidebar
  sideBody:  'C8D8E8',   // regular text in sidebar
  sideSmall: '8AAABF',   // italic/secondary text in sidebar

  // White right column
  rAccent:   '1B3F6A',   // dark navy — headings
  rBar:      '2E6096',   // left-bar on section headers
  rDark:     '1C2833',   // body text
  rMid:      '4A5568',   // secondary text
  rLight:    '8A9BB0',   // metadata (dates, tech)
};

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').substring(0, 40);
}

// All "no border" — used for every cell border to suppress DOCX grid lines
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF', space: 0 };

// ── Left (sidebar) helpers ───────────────────────────────────────────────────

function sHead(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({
      text: text.toUpperCase(),
      bold: true, size: 15, font: 'Calibri',
      color: C.sideAccent, characterSpacing: 50,
    })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.sideHr } },
    spacing: { before: 180, after: 70 },
  });
}

function sBody(
  runs: { text: string; bold?: boolean; italic?: boolean; size?: number; color?: string }[]
): Paragraph {
  return new Paragraph({
    children: runs.map(r => new TextRun({
      text: r.text,
      bold: r.bold ?? false,
      italics: r.italic ?? false,
      size: r.size ?? 16,
      font: 'Calibri',
      color: r.color ?? C.sideBody,
    })),
    spacing: { after: 36 },
  });
}

// ── Right column helpers ─────────────────────────────────────────────────────

function rHead(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({
      text: text.toUpperCase(),
      bold: true, size: 18, font: 'Calibri',
      color: C.rAccent, characterSpacing: 30,
    })],
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: C.rBar, space: 6 } },
    indent: { left: 110 },
    spacing: { before: 200, after: 80 },
  });
}

function rBody(
  text: string,
  opts: { bold?: boolean; italic?: boolean; size?: number; color?: string } = {}
): Paragraph {
  return new Paragraph({
    children: [new TextRun({
      text: deAiText(text),
      bold: opts.bold ?? false,
      italics: opts.italic ?? false,
      size: opts.size ?? 19,
      font: 'Calibri',
      color: opts.color ?? C.rDark,
    })],
    spacing: { after: 50 },
  });
}

function rBullet(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({
      text: `•  ${deAiText(text)}`,
      size: 18, font: 'Calibri', color: C.rDark,
    })],
    indent: { left: 160 },
    spacing: { after: 48 },
  });
}

// ── Build left (sidebar) ─────────────────────────────────────────────────────

function buildLeft(profile: any, photoPath?: string): Paragraph[] {
  const out: Paragraph[] = [];

  // Optional photo
  if (photoPath && fs.existsSync(photoPath)) {
    try {
      const data = fs.readFileSync(photoPath);
      out.push(new Paragraph({
        children: [new ImageRun({ data, transformation: { width: 90, height: 90 } })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      }));
    } catch { /* skip silently */ }
  }

  // Name
  out.push(new Paragraph({
    children: [new TextRun({ text: profile.personal.name, bold: true, size: 28, font: 'Calibri', color: C.sideName })],
    spacing: { after: 40 },
  }));

  // Current role title
  const role = profile.experience?.[0]?.role;
  if (role) {
    out.push(new Paragraph({
      children: [new TextRun({ text: role, size: 16, font: 'Calibri', color: C.sideAccent, italics: true })],
      spacing: { after: 20 },
    }));
  }

  // Location
  out.push(new Paragraph({
    children: [new TextRun({ text: profile.personal.location ?? '', size: 15, font: 'Calibri', color: C.sideBody })],
    spacing: { after: 140 },
  }));

  // ── Contact ──────────────────────────────────────────────────────────────
  out.push(sHead('Contact'));
  const contacts: string[] = [
    profile.personal.email,
    profile.personal.phone,
    (profile.personal.linkedin ?? '').replace('https://', ''),
    (profile.personal.github ?? '').replace('https://', ''),
  ].filter(Boolean);
  for (const c of contacts) {
    out.push(sBody([{ text: c, size: 15 }]));
  }

  // ── Skills — one line per category ──────────────────────────────────────
  out.push(sHead('Skills'));
  const skillGroups = [
    { label: 'AI & LLM',    key: 'ai_ml' },
    { label: 'Automation',  key: 'automation_orchestration' },
    { label: 'Languages',   key: 'languages' },
    { label: 'Frameworks',  key: 'frameworks_tools' },
    { label: 'Databases',   key: 'databases' },
    { label: 'Cloud',       key: 'infrastructure' },
    { label: 'Compliance',  key: 'compliance_security' },
  ];
  for (const g of skillGroups) {
    const items: string[] = (profile.skills?.[g.key] ?? []).slice(0, 5);
    if (!items.length) continue;
    out.push(sBody([
      { text: g.label + '  ', bold: true, size: 14, color: C.sideAccent },
      { text: items.join(', '), size: 14, color: C.sideBody },
    ]));
  }

  // ── Languages spoken ────────────────────────────────────────────────────
  out.push(sHead('Languages'));
  for (const lang of profile.languages ?? []) {
    out.push(sBody([
      { text: lang.language, bold: true, size: 15 },
      { text: `  ${lang.level}`, italic: true, size: 14, color: C.sideSmall },
    ]));
  }

  // ── Education ───────────────────────────────────────────────────────────
  out.push(sHead('Education'));
  out.push(sBody([{ text: profile.education.degree, bold: true, size: 15 }]));
  out.push(sBody([{ text: profile.education.institution, size: 14 }]));
  if (profile.education.expected) {
    out.push(sBody([{ text: `Expected ${profile.education.expected}`, italic: true, size: 13, color: C.sideSmall }]));
  }

  return out;
}

// ── Build right column ───────────────────────────────────────────────────────

function buildRight(profile: any, tailored: TailoredResume): Paragraph[] {
  const out: Paragraph[] = [];

  // Summary
  out.push(rHead('Summary'));
  out.push(rBody(tailored.tailoredSummary));

  // Core skills — horizontal tag line
  out.push(rHead('Core Skills'));
  out.push(new Paragraph({
    children: [new TextRun({
      text: tailored.highlightedSkills.join('  ·  '),
      size: 18, font: 'Calibri', color: C.rMid,
    })],
    spacing: { after: 60 },
  }));

  // Experience — BEFORE projects (standard order)
  out.push(rHead('Experience'));
  for (const exp of profile.experience ?? []) {
    out.push(new Paragraph({
      children: [
        new TextRun({ text: exp.role, bold: true, size: 20, font: 'Calibri', color: C.rDark }),
        new TextRun({ text: `  ·  ${exp.company}`, size: 17, font: 'Calibri', color: C.rLight }),
      ],
      spacing: { before: 100, after: 22 },
    }));
    out.push(rBody(
      `${exp.location ?? ''}  ·  ${exp.period ?? ''}`,
      { italic: true, size: 16, color: C.rLight }
    ));
    for (const b of exp.bullets ?? []) out.push(rBullet(b));
  }

  // Projects
  out.push(rHead('Selected Projects'));
  for (const id of tailored.projectOrder) {
    const proj = profile.projects?.find((p: any) => p.id === id);
    if (!proj) continue;
    const bullets: string[] = tailored.rewrittenBullets[id] ?? proj.bullets ?? [];

    out.push(new Paragraph({
      children: [
        new TextRun({ text: proj.title, bold: true, size: 20, font: 'Calibri', color: C.rDark }),
        new TextRun({ text: `  ·  ${proj.company ?? proj.client ?? ''}`, size: 17, font: 'Calibri', color: C.rLight }),
      ],
      spacing: { before: 110, after: 22 },
    }));

    if (proj.status) {
      out.push(rBody(proj.status, { italic: true, size: 16, color: C.rLight }));
    }

    for (const b of bullets) out.push(rBullet(b));

    if (proj.tech_stack?.length) {
      out.push(new Paragraph({
        children: [
          new TextRun({ text: 'Stack  ', bold: true, size: 15, font: 'Calibri', color: C.rMid }),
          new TextRun({ text: proj.tech_stack.join(', '), size: 15, font: 'Calibri', color: C.rLight }),
        ],
        spacing: { after: 80 },
      }));
    }
  }

  // Achievements
  if (profile.achievements?.length) {
    out.push(rHead('Achievements'));
    for (const a of profile.achievements.slice(0, 3)) out.push(rBullet(a));
  }

  return out;
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function generateVisualResumeDOCX(
  profile: any,
  tailored: TailoredResume,
  parsedJD: ParsedJD,
  photoPath?: string
): Promise<string> {
  const leftContent  = buildLeft(profile, photoPath);
  const rightContent = buildRight(profile, tailored);

  const table = new Table({
    width: { size: AVAIL_W, type: WidthType.DXA },
    // Remove all outer table borders
    borders: {
      top:     NO_BORDER,
      bottom:  NO_BORDER,
      left:    NO_BORDER,
      right:   NO_BORDER,
    },
    rows: [
      new TableRow({
        children: [
          // ── Left: dark navy sidebar ──────────────────────────────────────
          new TableCell({
            width: { size: LEFT_W, type: WidthType.DXA },
            shading: { fill: C.sidebar, type: ShadingType.CLEAR, color: 'auto' },
            borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
            margins: { top: 280, bottom: 280, left: 280, right: 260 },
            verticalAlign: VerticalAlign.TOP,
            children: leftContent,
          }),
          // ── Right: white content column ──────────────────────────────────
          new TableCell({
            width: { size: RIGHT_W, type: WidthType.DXA },
            shading: { fill: 'FFFFFF', type: ShadingType.CLEAR, color: 'auto' },
            borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
            margins: { top: 280, bottom: 280, left: 300, right: 220 },
            verticalAlign: VerticalAlign.TOP,
            children: rightContent,
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      children: [table],
    }],
  });

  const co = sanitize(parsedJD.company);
  const ro = sanitize(parsedJD.role);
  const suffix = photoPath ? '_Photo' : '';
  const outPath = path.join(process.cwd(), 'output', `${co}_${ro}_Visual${suffix}_Timothy.docx`);

  fs.writeFileSync(outPath, await Packer.toBuffer(doc));
  return outPath;
}
