import type { Paper } from '../../../src/skills/lib/ScholarTool.js';

export function parseJsonObject<T>(content: string): T | null {
  try {
    const trimmed = content.trim();
    if (!trimmed) return null;

    const withoutFence = trimmed.startsWith('```')
      ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
      : trimmed;

    const match = withoutFence.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    const jsonStr = match ? match[0] : withoutFence;
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

export function normalizeText(content: string): string {
  return content.replace(/\r\n/g, '\n').trim();
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'section';
}

export function dedupePapers(papers: Paper[]): Paper[] {
  const seen = new Map<string, Paper>();

  for (const paper of papers) {
    const key = buildPaperKey(paper);
    if (!seen.has(key)) {
      seen.set(key, paper);
    }
  }

  return Array.from(seen.values());
}

export function buildPaperKey(paper: Paper): string {
  return `${paper.url || ''}::${paper.title.toLowerCase()}`;
}

export function countWords(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

export function scorePaperForSection(paper: Paper, keywords: string[]): number {
  const haystack = `${paper.title} ${paper.summary}`.toLowerCase();
  const score = keywords.reduce((acc, keyword) => {
    if (!keyword) return acc;
    const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = haystack.match(new RegExp(escaped, 'g'));
    return acc + (matches?.length || 0);
  }, 0);

  return score + (paper.year || 0) / 10000;
}
