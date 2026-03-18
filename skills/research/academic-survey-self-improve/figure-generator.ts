import type { SkillContext } from '../../../src/skills/types.js';
import type { SectionDraft, SurveyFigure, SurveyOutline } from './types.js';
import { normalizeText, parseJsonObject } from './utils.js';

/**
 * Validate and fix Mermaid code:
 * - Find all nodes that are referenced in edges but never defined with a label
 * - Remove edges that reference undefined nodes
 */
function sanitizeMermaid(mermaid: string): string {
  const lines = mermaid.split('\n');
  const defined = new Set<string>();

  // First pass: collect all defined node IDs (nodes with labels like A[...], B{...}, C(...))
  for (const line of lines) {
    const matches = line.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\s*[\[{(]/g);
    for (const match of matches) {
      defined.add(match[1]);
    }
  }

  // If no nodes defined at all, return as-is
  if (defined.size === 0) return mermaid;

  // Second pass: filter out edge lines referencing undefined node IDs
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    // Only check edge lines
    if (!trimmed.includes('-->') && !trimmed.includes('---') && !trimmed.includes('-.->')) {
      return true;
    }
    // Extract node IDs referenced in this edge line
    const nodeRefs = Array.from(trimmed.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\b/g))
      .map((m) => m[1])
      .filter((id) => /^[A-Za-z][A-Za-z0-9_]*$/.test(id));
    // If any referenced ID is not defined, drop this edge
    for (const id of nodeRefs) {
      if (!defined.has(id) && id !== 'TD' && id !== 'LR' && id !== 'BT' && id !== 'RL') {
        return false;
      }
    }
    return true;
  });

  return filtered.join('\n');
}

/**
 * Generate figures for survey sections based on their content and template kind.
 * Produces both TikZ (for LaTeX) and Mermaid (for markdown) representations.
 */
export async function generateSurveyFigures(
  context: SkillContext | null,
  outline: SurveyOutline,
  sections: SectionDraft[]
): Promise<SurveyFigure[]> {
  if (!context) return [];

  const figures: SurveyFigure[] = [];

  // Generate taxonomy/overview figure for the whole survey
  const taxonomyFigure = await generateTaxonomyFigure(context, outline);
  if (taxonomyFigure) figures.push(taxonomyFigure);

  // Generate section-specific figures
  for (const section of sections) {
    const figure = await generateSectionFigure(context, outline, section);
    if (figure) figures.push(figure);
  }

  return figures;
}

async function generateTaxonomyFigure(
  context: SkillContext,
  outline: SurveyOutline
): Promise<SurveyFigure | null> {
  const sectionTitles = outline.sections.map((s) => s.title);
  const prompt = `Generate a taxonomy diagram for a survey titled "${outline.title}".

The survey has these sections: ${sectionTitles.join(', ')}
Keywords: ${outline.taxonomy.join(', ')}

Generate a tree/hierarchy diagram showing the survey's organizational structure.

Return ONLY valid JSON:
{
  "tikz": "\\\\begin{tikzpicture}[...] ... \\\\end{tikzpicture}",
  "mermaid": "graph TD\\n  A[Topic] --> B[Section1]\\n  ...",
  "caption": "Taxonomy of ..."
}

TikZ requirements:
- Use the 'forest' package style or simple tikz tree
- Use \\node, \\draw for a clean tree diagram
- Max 3 levels deep
- Keep it compact (fit in one column)

Mermaid requirements:
- Use 'graph TD' (top-down) layout
- Use descriptive short labels
- Max 15 nodes`;

  try {
    const response = await context.llm.chat([
      { role: 'system', content: 'You generate academic diagram code. Return only valid JSON.' },
      { role: 'user', content: prompt }
    ]);
    const parsed = parseJsonObject<{ tikz?: string; mermaid?: string; caption?: string }>(normalizeText(response.content));
    if (parsed?.tikz && parsed?.mermaid) {
      return {
        sectionId: '_taxonomy',
        figureType: 'taxonomy',
        caption: parsed.caption || `Taxonomy of ${outline.title}`,
        label: 'fig:taxonomy',
        tikzCode: parsed.tikz,
        mermaidCode: sanitizeMermaid(parsed.mermaid)
      };
    }
  } catch {
    // Non-critical
  }
  return null;
}

async function generateSectionFigure(
  context: SkillContext,
  outline: SurveyOutline,
  section: SectionDraft
): Promise<SurveyFigure | null> {
  // Only generate figures for certain section types
  const figureTypes: Record<string, string> = {
    methods: 'workflow',
    benchmark: 'comparison',
    systems: 'comparison',
    background: 'timeline'
  };

  const figType = figureTypes[section.templateKind];
  if (!figType) return null;

  const evidenceSummary = section.evidenceCards
    .slice(0, 5)
    .map((card) => `[${card.citation}] ${card.title} (${card.year}) - ${card.keyContribution}`)
    .join('\n');

  const typeInstructions: Record<string, string> = {
    workflow: `Create a workflow/pipeline diagram showing the main methodological steps or architectural components described in this section. Use boxes connected by arrows.`,
    comparison: `Create a comparison chart or matrix diagram. Show 3-5 key items being compared across 2-3 dimensions using a structured layout.`,
    timeline: `Create a timeline diagram showing the evolution of key developments mentioned in this section. Place items chronologically.`
  };

  const prompt = `Generate a figure for a survey section titled "${section.title}" (type: ${section.templateKind}).

${typeInstructions[figType]}

Evidence cards for this section:
${evidenceSummary}

Return ONLY valid JSON:
{
  "tikz": "\\\\begin{tikzpicture}[...] ... \\\\end{tikzpicture}",
  "mermaid": "graph LR\\n  ...",
  "caption": "Description of the figure"
}

TikZ rules:
- Use basic tikz (nodes, arrows, rectangles, rounded corners)
- Do NOT use external packages beyond tikz and pgfplots
- Keep compact, single-column width
- Use \\small or \\footnotesize for text
- Escape special chars properly

Mermaid rules:
- Use appropriate graph direction (TD/LR)
- Short labels (max 30 chars per node)
- Max 12 nodes`;

  try {
    const response = await context.llm.chat([
      { role: 'system', content: 'You generate academic diagram code. Return only valid JSON.' },
      { role: 'user', content: prompt }
    ]);
    const parsed = parseJsonObject<{ tikz?: string; mermaid?: string; caption?: string }>(normalizeText(response.content));
    if (parsed?.tikz && parsed?.mermaid) {
      return {
        sectionId: section.sectionId,
        figureType: figType as SurveyFigure['figureType'],
        caption: parsed.caption || `Overview of ${section.title}`,
        label: `fig:${section.sectionId}`,
        tikzCode: parsed.tikz,
        mermaidCode: sanitizeMermaid(parsed.mermaid)
      };
    }
  } catch {
    // Non-critical
  }
  return null;
}
