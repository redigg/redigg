/**
 * SurGE output adapter.
 *
 * Converts our survey skill result into the folder structure that
 * SurGE's `src/test_final.py` expects:
 *   baselines/<id>/output/
 *     ├── survey.txt          (plain-text survey body)
 *     ├── structure.json      (hierarchical section tree)
 *     └── citations.json      (list of cited paper identifiers)
 *
 * SurveyBench adapter outputs a similar JSON for their quiz-based eval.
 */

import fs from 'fs';
import path from 'path';
import type { SkillResult } from '../../skills/types.js';

// ── SurGE Format ──────────────────────────────────────────────────────

interface SurgeStructureNode {
  title: string;
  level: number;
  children: SurgeStructureNode[];
}

function extractStructureTree(markdown: string): SurgeStructureNode[] {
  const lines = markdown.split('\n').filter((l) => /^#{1,4}\s/.test(l));
  const root: SurgeStructureNode[] = [];
  const stack: { node: SurgeStructureNode; level: number }[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{1,4})\s+(.*)/);
    if (!match) continue;
    const level = match[1].length;
    const title = match[2].trim();
    const node: SurgeStructureNode = { title, level, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length > 0) {
      stack[stack.length - 1].node.children.push(node);
    } else {
      root.push(node);
    }

    stack.push({ node, level });
  }

  return root;
}

function extractCitations(result: SkillResult): string[] {
  const papers = Array.isArray(result.papers) ? result.papers : [];
  return papers.map((p: any) => {
    // Prefer arXiv ID, fall back to title
    if (typeof p.url === 'string') {
      const arxivMatch = p.url.match(/arxiv\.org\/abs\/(\d+\.\d+)/);
      if (arxivMatch) return arxivMatch[1];
    }
    return String(p.title || '');
  });
}

function stripMarkdownToPlainText(markdown: string): string {
  return markdown
    .replace(/^#{1,4}\s+(.*)$/gm, '\n$1\n')  // headings → plain text
    .replace(/\*\*([^*]+)\*\*/g, '$1')          // bold
    .replace(/\*([^*]+)\*/g, '$1')              // italic
    .replace(/`([^`]+)`/g, '$1')                // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')    // links
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Write survey result in SurGE-compatible format.
 * @returns The output directory path.
 */
export function writeSurgeFormat(result: SkillResult, outputDir: string): string {
  fs.mkdirSync(outputDir, { recursive: true });

  const markdown = String(result.formatted_output || result.summary || '');

  // survey.txt — plain text body
  fs.writeFileSync(
    path.join(outputDir, 'survey.txt'),
    stripMarkdownToPlainText(markdown),
    'utf8'
  );

  // structure.json — hierarchical section tree
  const structure = extractStructureTree(markdown);
  fs.writeFileSync(
    path.join(outputDir, 'structure.json'),
    JSON.stringify(structure, null, 2),
    'utf8'
  );

  // citations.json — list of cited paper identifiers
  const citations = extractCitations(result);
  fs.writeFileSync(
    path.join(outputDir, 'citations.json'),
    JSON.stringify(citations, null, 2),
    'utf8'
  );

  return outputDir;
}

// ── SurveyBench Format ────────────────────────────────────────────────

interface SurveyBenchEntry {
  title: string;
  abstract: string;
  outline: string[];
  sections: { heading: string; content: string }[];
  references: string[];
}

/**
 * Convert survey result to SurveyBench-compatible JSON.
 */
export function toSurveyBenchFormat(result: SkillResult): SurveyBenchEntry {
  const markdown = String(result.formatted_output || result.summary || '');
  const sections: { heading: string; content: string }[] = [];

  // Split by ## headings
  const parts = markdown.split(/^(## .+)$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i].replace(/^## /, '').trim();
    const content = (parts[i + 1] || '').trim();
    if (heading && content) {
      sections.push({ heading, content });
    }
  }

  const abstractSection = sections.find((s) => s.heading.toLowerCase() === 'abstract');
  const outline = sections.map((s) => s.heading);

  const papers = Array.isArray(result.papers) ? result.papers : [];
  const references = papers.map((p: any, i: number) =>
    `[${i + 1}] ${p.authors?.[0] || 'Unknown'} et al. "${p.title}" (${p.year || 'n.d.'})`
  );

  return {
    title: result.outline?.title || result.topic || 'Untitled Survey',
    abstract: abstractSection?.content || '',
    outline,
    sections: sections.filter((s) => s.heading.toLowerCase() !== 'abstract' && s.heading.toLowerCase() !== 'references'),
    references
  };
}

/**
 * Write survey result in SurveyBench-compatible JSON format.
 */
export function writeSurveyBenchFormat(result: SkillResult, outputPath: string): string {
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });

  const entry = toSurveyBenchFormat(result);
  fs.writeFileSync(outputPath, JSON.stringify(entry, null, 2), 'utf8');
  return outputPath;
}
