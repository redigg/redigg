import type { Paper } from '../../../src/skills/lib/ScholarTool.js';
import type { FinalSurvey, SectionDraft, SurveyOutline } from './types.js';

/**
 * Escape special LaTeX characters in plain text.
 */
function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/[&%$#_{}]/g, (ch) => `\\${ch}`)
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

/**
 * Convert inline markdown to LaTeX:
 * - **bold** → \textbf{bold}
 * - *italic* → \textit{italic}
 * - [N] citations → \cite-style markers (kept as-is for numeric style)
 * - `code` → \texttt{code}
 */
function convertInlineMarkdown(text: string): string {
  let result = text;

  // Bold: **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}');
  result = result.replace(/__(.+?)__/g, '\\textbf{$1}');

  // Italic: *text* or _text_ (but not inside \textbf)
  result = result.replace(/(?<![\\])\*(.+?)\*/g, '\\textit{$1}');
  result = result.replace(/(?<![\\])_(.+?)_/g, '\\textit{$1}');

  // Inline code: `code`
  result = result.replace(/`(.+?)`/g, '\\texttt{$1}');

  // Markdown links: [text](url) → text\footnote{\url{url}}
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1\\footnote{\\url{$2}}');

  return result;
}

/**
 * Convert a markdown paragraph to LaTeX, handling escaping and inline formatting.
 * Citation markers [N] are preserved as-is (numeric bibliography style).
 */
function convertParagraph(text: string): string {
  // First extract citation markers to protect them (use placeholder without LaTeX special chars)
  const citations: string[] = [];
  let protected_ = text.replace(/\[(\d+(?:,\s*\d+)*)\]/g, (_match, nums) => {
    const idx = citations.length;
    citations.push(nums);
    return `CITEPLACEHOLDER${idx}ENDCITE`;
  });

  // Escape LaTeX special chars in the body text
  protected_ = escapeLatex(protected_);

  // Convert inline markdown
  protected_ = convertInlineMarkdown(protected_);

  // Restore citation markers after all transformations
  protected_ = protected_.replace(/CITEPLACEHOLDER(\d+)ENDCITE/g, (_match, idx) => {
    return `[${citations[Number(idx)]}]`;
  });

  return protected_;
}

/**
 * Convert a full markdown section body to LaTeX blocks.
 */
/**
 * Check if a line is a Markdown table separator (e.g. |---|---|---|)
 */
function isTableSeparator(line: string): boolean {
  return /^\|[\s:?-]+(\|[\s:?-]+)+\|?\s*$/.test(line.trim());
}

/**
 * Check if a line is a Markdown table row (starts with |)
 */
function isTableRow(line: string): boolean {
  return /^\|.+\|/.test(line.trim());
}

/**
 * Parse Markdown table cells from a row
 */
function parseTableCells(row: string): string[] {
  return row.trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/**
 * Convert a Markdown table (header + separator + body rows) to LaTeX tabular.
 */
function convertMarkdownTable(tableLines: string[]): string {
  if (tableLines.length < 3) return tableLines.map(convertParagraph).join('\n');

  const headerCells = parseTableCells(tableLines[0]);
  const colCount = headerCells.length;
  const colSpec = headerCells.map(() => 'l').join(' ');

  const output: string[] = [];
  output.push('\\begin{table}[h]');
  output.push('\\centering');
  output.push(`\\begin{tabular}{${colSpec}}`);
  output.push('\\toprule');

  // Header row
  output.push(headerCells.map((cell) => `\\textbf{${convertParagraph(cell)}}`).join(' & ') + ' \\\\');
  output.push('\\midrule');

  // Body rows (skip separator at index 1)
  for (let i = 2; i < tableLines.length; i++) {
    if (!isTableRow(tableLines[i])) continue;
    const cells = parseTableCells(tableLines[i]);
    // Pad or truncate to match header column count
    const normalized = Array.from({ length: colCount }, (_, j) => cells[j] || '');
    output.push(normalized.map((cell) => convertParagraph(cell)).join(' & ') + ' \\\\');
  }

  output.push('\\bottomrule');
  output.push('\\end{tabular}');
  output.push('\\end{table}');

  return output.join('\n');
}

function convertSectionBody(content: string, sectionTitle: string): string {
  // Remove the ## heading line if present
  let body = content.replace(new RegExp(`^##\\s+${escapeRegexStr(sectionTitle)}\\s*\\n+`, 'm'), '');
  body = body.trim();

  const lines = body.split('\n');
  const output: string[] = [];
  let inList = false;
  let listType: 'itemize' | 'enumerate' | null = null;
  let tableBuffer: string[] = [];

  const flushList = () => {
    if (inList && listType) {
      output.push(`\\end{${listType}}`);
      inList = false;
      listType = null;
    }
  };

  const flushTable = () => {
    if (tableBuffer.length > 0) {
      output.push(convertMarkdownTable(tableBuffer));
      tableBuffer = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Table detection: accumulate consecutive table rows
    if (isTableRow(line) || (tableBuffer.length > 0 && isTableSeparator(line))) {
      flushList();
      tableBuffer.push(line);
      continue;
    }

    // If we were accumulating a table and hit a non-table line, flush
    if (tableBuffer.length > 0) {
      flushTable();
    }

    if (!line) {
      flushList();
      output.push('');
      continue;
    }

    // Bullet list item
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      if (!inList || listType !== 'itemize') {
        flushList();
        output.push('\\begin{itemize}');
        inList = true;
        listType = 'itemize';
      }
      output.push(`  \\item ${convertParagraph(bulletMatch[1])}`);
      continue;
    }

    // Numbered list item
    const numberedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (numberedMatch) {
      if (!inList || listType !== 'enumerate') {
        flushList();
        output.push('\\begin{enumerate}');
        inList = true;
        listType = 'enumerate';
      }
      output.push(`  \\item ${convertParagraph(numberedMatch[1])}`);
      continue;
    }

    // Sub-heading (### level)
    const subHeadingMatch = line.match(/^###\s+(.*)$/);
    if (subHeadingMatch) {
      flushList();
      output.push(`\\subsection{${escapeLatex(subHeadingMatch[1])}}`);
      continue;
    }

    // Regular paragraph line
    flushList();
    output.push(convertParagraph(line));
  }

  flushList();
  flushTable();
  return output.join('\n');
}

function escapeRegexStr(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format a paper reference in LaTeX bibliography style.
 */
function formatReference(paper: Paper, index: number): string {
  const authors = Array.isArray(paper.authors) && paper.authors.length > 0
    ? escapeLatex(paper.authors.join(', '))
    : 'Unknown Authors';
  const title = escapeLatex(paper.title);
  const venue = escapeLatex(paper.journal || 'Unknown venue');
  const year = paper.year || 'n.d.';
  const url = paper.url ? `\\url{${paper.url}}` : '';

  return `\\bibitem{ref${index + 1}} ${authors}. \\textit{${title}}. ${venue}, ${year}. ${url}`;
}

/**
 * Convert a FinalSurvey to a complete LaTeX document string.
 */
export function convertToLatex(
  outline: SurveyOutline,
  finalSurvey: FinalSurvey,
  papers: Paper[]
): string {
  const title = escapeLatex(outline.title);
  const abstractText = convertParagraph(outline.abstractDraft);

  // Short title for running header (truncate at 60 chars)
  const shortTitle = outline.title.length > 60
    ? escapeLatex(outline.title.slice(0, 57) + '...')
    : title;

  const preamble = `\\documentclass[11pt,a4paper]{article}

% Packages
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{times}
\\usepackage[margin=1in]{geometry}
\\usepackage{fancyhdr}
\\usepackage{hyperref}
\\usepackage{url}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{amsmath}
\\usepackage{enumitem}

\\hypersetup{
  colorlinks=true,
  linkcolor=blue,
  citecolor=blue,
  urlcolor=blue
}

% Running header
\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[L]{\\small\\textit{${shortTitle}}}
\\fancyhead[R]{\\small\\thepage}
\\renewcommand{\\headrulewidth}{0.4pt}
\\fancypagestyle{plain}{\\fancyhf{}\\fancyfoot[C]{\\small\\thepage}\\renewcommand{\\headrulewidth}{0pt}}

\\title{${title}}
\\author{Redigg AI Research}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{abstract}
${abstractText}
\\end{abstract}

\\noindent\\textbf{Keywords:} ${outline.taxonomy.map((item) => escapeLatex(item)).join(', ')}
\\bigskip

\\tableofcontents
\\newpage
`;

  // Introduction — extract from assembled markdown if available
  const introFromMarkdown = extractIntroductionFromMarkdown(finalSurvey.markdown);
  const introSection = introFromMarkdown
    ? `\\section{Introduction}\n${convertSectionBody(introFromMarkdown, 'Introduction')}`
    : '';

  // Body sections
  const bodySections = finalSurvey.sections.map((section) => {
    const sectionTitle = escapeLatex(section.title);
    const body = convertSectionBody(section.content, section.title);
    return `\\section{${sectionTitle}}\n${body}`;
  }).join('\n\n');

  // Conclusion — extract from assembled markdown if available
  const conclusionFromMarkdown = extractConclusionFromMarkdown(finalSurvey.markdown);
  const conclusionBody = conclusionFromMarkdown
    ? convertSectionBody(conclusionFromMarkdown, 'Conclusion')
    : convertParagraph(generateConclusionText(outline, finalSurvey.sections.map((s) => s.title)));
  const conclusionSection = `\\section{Conclusion}\n${conclusionBody}`;

  // References — use \small and reduced item separation to avoid trailing blank space
  const references = papers.map((paper, index) => formatReference(paper, index)).join('\n\n');
  const referencesSection = `{\\small
\\setlength{\\itemsep}{2pt}
\\setlength{\\parsep}{0pt}
\\begin{thebibliography}{${papers.length}}
${references}
\\end{thebibliography}
}`;

  return `${preamble}
${introSection ? introSection + '\n\n' : ''}${bodySections}

${conclusionSection}

${referencesSection}

\\end{document}
`;
}

function extractIntroductionFromMarkdown(markdown: string): string | null {
  const match = markdown.match(/## Introduction\s*\n+([\s\S]*?)(?=\n## )/);
  if (!match || !match[1] || match[1].trim().length < 30) return null;
  return match[1].trim();
}

function extractConclusionFromMarkdown(markdown: string): string | null {
  const match = markdown.match(/## Conclusion\s*\n+([\s\S]*?)(?=\n## |\n*$)/);
  if (!match || !match[1] || match[1].trim().length < 30) return null;
  return match[1].trim();
}

function generateConclusionText(outline: SurveyOutline, sectionTitles: string[]): string {
  const sectionList = sectionTitles.map((t) => t.replace(/^##\s*/, '')).join(', ');
  return `This survey has examined ${outline.title.replace(/^A Survey of /i, '').toLowerCase()} through the lenses of ${sectionList.toLowerCase()}. The field continues to advance rapidly, with emerging systems demonstrating increasing autonomy in scientific workflows. Key open challenges include improving reliability, ensuring ethical deployment, and developing comprehensive evaluation frameworks. Future work should prioritize bridging the gap between narrow task automation and truly open-ended scientific discovery.`;
}
