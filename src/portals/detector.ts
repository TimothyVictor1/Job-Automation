import { Page } from 'playwright';

export type PortalType = 'linkedin' | 'teamtailor' | 'greenhouse' | 'lever' | 'workday' | 'generic';

export function detectPortalFromUrl(url: string): PortalType {
  const u = url.toLowerCase();
  if (u.includes('linkedin.com')) return 'linkedin';
  if (u.includes('teamtailor.com') || u.includes('.teamtailor.')) return 'teamtailor';
  if (u.includes('greenhouse.io') || u.includes('boards.greenhouse')) return 'greenhouse';
  if (u.includes('lever.co')) return 'lever';
  if (u.includes('myworkdayjobs.com') || u.includes('workday.com')) return 'workday';
  return 'generic';
}

export async function detectPortal(url: string, page: Page): Promise<PortalType> {
  const fromUrl = detectPortalFromUrl(url);
  if (fromUrl !== 'generic') return fromUrl;

  // Fingerprint from page HTML for custom-domain portals
  const html = await page.content();
  const lower = html.toLowerCase();

  if (lower.includes('teamtailor') || lower.includes('job_application[name]')) return 'teamtailor';
  if (lower.includes('greenhouse') || lower.includes('grnh.se')) return 'greenhouse';
  if (lower.includes('lever.co') || lower.includes('lever-apply')) return 'lever';
  if (lower.includes('linkedin.com') || lower.includes('easy apply')) return 'linkedin';

  return 'generic';
}
