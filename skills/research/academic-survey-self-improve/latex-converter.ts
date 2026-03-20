import type { Paper } from '../../../src/skills/lib/ScholarTool.js';
import type { FinalSurvey, SurveyFigure, SurveyOutline } from './types.js';
import { normalizeAuthorList, normalizeBibliographyVenue, normalizeMarkdownHeadings, stripManualHeadingNumbering } from './utils.js';

/**
 * Escape special LaTeX characters in plain text.
 */
function escapeLatex(text: string): string {
  return text
    .replace(/\u2014/g, '---')   // em-dash
    .replace(/\u2013/g, '--')    // en-dash
    .replace(/\u2018|\u2019/g, "'") // smart single quotes
    .replace(/\u201C|\u201D/g, '"') // smart double quotes
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

  // Escape LaTeX special chars in the body text (includes Unicode dash conversion)
  protected_ = escapeLatex(protected_);

  // Convert inline markdown
  protected_ = convertInlineMarkdown(protected_);

  // Restore citation markers after all transformations
  protected_ = protected_.replace(/CITEPLACEHOLDER(\d+)ENDCITE/g, (_match, idx) => {
    return `[${citations[Number(idx)]}]`;
  });

  return protected_;
}

interface MarkdownTopLevelSection {
  title: string;
  content: string;
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  А: 'A', а: 'a', Б: 'B', б: 'b', В: 'V', в: 'v', Г: 'G', г: 'g', Д: 'D', д: 'd',
  Е: 'E', е: 'e', Ё: 'E', ё: 'e', Ж: 'Zh', ж: 'zh', З: 'Z', з: 'z', И: 'I', и: 'i',
  Й: 'Y', й: 'y', К: 'K', к: 'k', Л: 'L', л: 'l', М: 'M', м: 'm', Н: 'N', н: 'n',
  О: 'O', о: 'o', П: 'P', п: 'p', Р: 'R', р: 'r', С: 'S', с: 's', Т: 'T', т: 't',
  У: 'U', у: 'u', Ф: 'F', ф: 'f', Х: 'Kh', х: 'kh', Ц: 'Ts', ц: 'ts', Ч: 'Ch', ч: 'ch',
  Ш: 'Sh', ш: 'sh', Щ: 'Shch', щ: 'shch', Ъ: '', ъ: '', Ы: 'Y', ы: 'y', Ь: '', ь: '',
  Э: 'E', э: 'e', Ю: 'Yu', ю: 'yu', Я: 'Ya', я: 'ya'
};

function stripAbstractKeywords(content: string): string {
  return content
    .replace(/\n+(?:\*\*Keywords(?:\*\*:|:\*\*)|Keywords:)[\s\S]*$/i, '')
    .trim();
}

function extractTopLevelSections(markdown: string): MarkdownTopLevelSection[] {
  const normalized = normalizeMarkdownHeadings(markdown);
  const matches = Array.from(normalized.matchAll(/^##\s+(.+)$/gm));
  const sections: MarkdownTopLevelSection[] = [];

  for (let i = 0; i < matches.length; i++) {
    const title = stripManualHeadingNumbering(matches[i][1]).trim();
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : normalized.length;
    const content = normalized.slice(start, end).trim();
    sections.push({ title, content });
  }

  return sections;
}

function findTopLevelSection(markdown: string, title: string): MarkdownTopLevelSection | null {
  const target = title.trim().toLowerCase();
  return extractTopLevelSections(markdown).find((section) => section.title.trim().toLowerCase() === target) || null;
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
  // Use p{} columns with calculated widths to prevent overflow
  // Reserve ~0.5cm per column for padding, distribute remaining width evenly
  const colWidth = Math.max(1.5, (15 - colCount * 0.5) / colCount);
  const colSpec = headerCells.map(() => `p{${colWidth.toFixed(1)}cm}`).join(' ');

  const output: string[] = [];
  output.push('\\begin{table}[h]');
  output.push('\\centering');
  output.push('\\small');
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
  content = normalizeMarkdownHeadings(content);
  // Remove the ## heading line if present
  let body = content.replace(new RegExp(`^##\\s+${escapeRegexStr(sectionTitle)}\\s*\\n+`, 'm'), '');
  // Strip LLM meta-commentary that sometimes leaks into section content
  body = stripLlmMetaText(body);
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

    // Sub-sub-heading (#### level) → \paragraph
    const subSubHeadingMatch = line.match(/^####\s+(.*)$/);
    if (subSubHeadingMatch) {
      flushList();
      output.push(`\\paragraph{${escapeLatex(stripManualHeadingNumbering(subSubHeadingMatch[1]))}}`);
      continue;
    }

    // Sub-heading (### level)
    const subHeadingMatch = line.match(/^###\s+(.*)$/);
    if (subHeadingMatch) {
      flushList();
      output.push(`\\subsection{${escapeLatex(stripManualHeadingNumbering(subHeadingMatch[1]))}}`);
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
 * Strip mermaid code blocks and their captions from markdown text.
 */
function stripMermaidBlocks(text: string): string {
  return text
    // ```mermaid ... ``` followed by optional *Figure N: caption*
    .replace(/```mermaid[\s\S]*?```\s*\n*(?:\*Figure\s+\d+:[^*]*\*)?/g, '')
    // Catch any remaining bare ```mermaid blocks
    .replace(/```mermaid[\s\S]*?```/g, '')
    .trim();
}

/**
 * Strip LLM meta-commentary that leaks into section drafts.
 * Examples: "Here's the expanded...", "This revision:", "Key improvements:"
 */
function stripLlmMetaText(text: string): string {
  const metaPatterns = [
    // Opening meta-lines: "Here's the ...", "Below is ...", "I've expanded ..."
    /^(?:Here(?:'s| is) (?:the|an|a) (?:expanded|restructured|revised|updated|improved|rewritten)[\s\S]*?:)\s*\n/gm,
    // Trailing self-assessment blocks: "This revision:", "Key improvements:", "Changes made:"
    /\n(?:This (?:revision|version|section|rewrite)|Key (?:improvements|changes)|Changes (?:made|include)|Note:|Summary of changes):[\s\S]*$/gm,
  ];
  let result = text;
  for (const pattern of metaPatterns) {
    result = result.replace(pattern, '\n');
  }
  return result;
}

/**
 * Strip non-Latin characters that may break fonts (Cyrillic, CJK, etc.)
 * and normalize Unicode hyphens to ASCII.
 */
function sanitizeForLatexFont(text: string): string {
  return text
    .replace(/[А-Яа-яЁё]/g, (ch) => CYRILLIC_TO_LATIN[ch] ?? '')
    .replace(/\u2014/g, '---')
    .replace(/\u2013/g, '--')
    .replace(/\u2010|\u2011|\u2012/g, '-')  // Unicode hyphens → ASCII hyphen
    .replace(/[\u0400-\u04FF]+/g, '')        // Strip Cyrillic
    .replace(/[\u4E00-\u9FFF]+/g, '')        // Strip CJK
    .replace(/\s{2,}/g, ' ')                 // Collapse extra spaces
    .trim();
}

function formatReference(paper: Paper, index: number): string {
  const authors = Array.isArray(paper.authors) && paper.authors.length > 0
    ? escapeLatex(
        normalizeAuthorList(paper.authors)
          .map((author) => sanitizeForLatexFont(author))
          .filter(Boolean)
          .join(', ')
      ) || 'Unknown Authors'
    : 'Unknown Authors';
  const title = escapeLatex(sanitizeForLatexFont(paper.title));
  const venue = escapeLatex(sanitizeForLatexFont(normalizeBibliographyVenue(paper)));
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
  papers: Paper[],
  figures?: SurveyFigure[]
): string {
  const title = escapeLatex(outline.title);
  const abstractSection = findTopLevelSection(finalSurvey.markdown, 'Abstract');
  const abstractBody = stripAbstractKeywords(abstractSection?.content || outline.abstractDraft);
  const abstractText = convertParagraph(abstractBody);

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
\\usepackage{amssymb}
\\usepackage{enumitem}
\\usepackage{adjustbox}
\\usepackage{tikz}
\\usetikzlibrary{shapes,arrows,positioning,fit,calc,matrix,backgrounds,decorations.pathreplacing}

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

  const topLevelSections = extractTopLevelSections(finalSurvey.markdown);

  // Introduction — extract from assembled markdown if available
  const introRaw = topLevelSections.find((section) => section.title.toLowerCase() === 'introduction')?.content || null;
  const introFromMarkdown = introRaw ? stripMermaidBlocks(introRaw) : null;
  const introSection = introFromMarkdown
    ? `\\section{Introduction}\n${convertSectionBody(introFromMarkdown, 'Introduction')}`
    : '';

  // Taxonomy figure (if available) — placed after introduction
  const taxonomyFigure = figures?.find((f) => f.sectionId === '_taxonomy');
  const taxonomyFigureLatex = taxonomyFigure
    ? formatTikzFigure(taxonomyFigure)
    : '';

  const excludedTitles = new Set(['abstract', 'introduction', 'conclusion', 'references']);
  const bodyMarkdownSections = topLevelSections.filter((section) => !excludedTitles.has(section.title.toLowerCase()));
  const sectionByTitle = new Map(finalSurvey.sections.map((section) => [section.title.toLowerCase(), section]));

  // Body sections with embedded TikZ figures
  let figCounter = taxonomyFigure ? 2 : 1;
  const bodySections = bodyMarkdownSections.map((section) => {
    const sectionTitle = escapeLatex(section.title);
    // Strip mermaid code blocks from body before converting (they're in LaTeX as TikZ)
    const cleanedContent = stripMermaidBlocks(section.content);
    const body = convertSectionBody(cleanedContent, section.title);
    const matchingDraft = sectionByTitle.get(section.title.toLowerCase());
    const sectionFigure = matchingDraft ? figures?.find((f) => f.sectionId === matchingDraft.sectionId) : undefined;
    const figureBlock = sectionFigure ? `\n\n${formatTikzFigure(sectionFigure, figCounter++)}` : '';
    return `\\section{${sectionTitle}}\n${body}${figureBlock}`;
  }).join('\n\n');

  // Conclusion — extract from assembled markdown if available
  const conclusionFromMarkdown = topLevelSections.find((section) => section.title.toLowerCase() === 'conclusion')?.content || null;
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
${introSection ? introSection + '\n\n' : ''}${taxonomyFigureLatex ? taxonomyFigureLatex + '\n\n' : ''}${bodySections}

${conclusionSection}

${referencesSection}

\\end{document}
`;
}

function generateConclusionText(outline: SurveyOutline, sectionTitles: string[]): string {
  const sectionList = sectionTitles.map((t) => t.replace(/^##\s*/, '')).join(', ');
  return `This survey has examined ${outline.title.replace(/^A Survey of /i, '').toLowerCase()} through the lenses of ${sectionList.toLowerCase()}. The field continues to advance rapidly, with emerging systems demonstrating increasing autonomy in scientific workflows. Key open challenges include improving reliability, ensuring ethical deployment, and developing comprehensive evaluation frameworks. Future work should prioritize bridging the gap between narrow task automation and truly open-ended scientific discovery.`;
}

/**
 * Format a TikZ figure wrapped in a LaTeX figure environment.
 */
function formatTikzFigure(figure: SurveyFigure, figNum?: number): string {
  const label = figure.label || `fig:${figure.sectionId}`;
  const caption = escapeLatex(figure.caption);
  // Sanitize TikZ code: replace Unicode chars that break ptmr8t
  // Also fix LLM-generated \n literals inside node text → LaTeX \\ line break
  let sanitizedTikz = figure.tikzCode
    .replace(/\u2014/g, '---')
    .replace(/\u2013/g, '--')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(new RegExp('\\\\n(?![a-z])', 'g'), '\\\\')
    // Fix \footnotesize/\small/\tiny used as node options (causes stack overflow)
    // e.g. \node[..., \footnotesize] → \node[..., font=\footnotesize]
    .replace(/,\s*\\(footnotesize|small|tiny|scriptsize|normalsize|large)\b/g, ', font=\\$1')
    // Also handle when it's the only or first option
    .replace(/\[\s*\\(footnotesize|small|tiny|scriptsize|normalsize|large)\s*,/g, '[font=\\$1,')
    .replace(/\[\s*\\(footnotesize|small|tiny|scriptsize|normalsize|large)\s*\]/g, '[font=\\$1]');

  // Shrink text width to prevent overlap: 3cm→2cm, 2.5cm→1.8cm
  sanitizedTikz = sanitizedTikz
    .replace(/text width\s*=\s*3cm/g, 'text width=2cm')
    .replace(/text width\s*=\s*2\.5cm/g, 'text width=1.8cm');

  // Use xscale on tikzpicture to uniformly spread ALL coordinates (nodes + draw lines + arrows)
  // This avoids the bug where regex-based node spreading desynchronizes nodes from arrows
  if (sanitizedTikz.includes('\\begin{tikzpicture}[')) {
    if (!/xscale\s*=/.test(sanitizedTikz)) {
      sanitizedTikz = sanitizedTikz.replace('\\begin{tikzpicture}[', '\\begin{tikzpicture}[xscale=1.3, ');
    }
  } else if (sanitizedTikz.includes('\\begin{tikzpicture}')) {
    sanitizedTikz = sanitizedTikz.replace('\\begin{tikzpicture}', '\\begin{tikzpicture}[xscale=1.3]');
  }

  // Wrap TikZ code in figure environment with batchmode to prevent halting on TikZ errors
  // Use adjustbox to scale down if too wide, with max height to prevent page-dominating figures
  return `\\batchmode
\\begin{figure}[htbp]
\\centering
\\begin{adjustbox}{max width=\\columnwidth, max height=0.35\\textheight, keepaspectratio, center}
${sanitizedTikz}
\\end{adjustbox}
\\caption{${caption}}
\\label{${label}}
\\end{figure}
\\scrollmode`;
}
