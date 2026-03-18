import type { SkillContext } from '../../../src/skills/types.js';
import type { SectionDraft, SurveyFigure, SurveyOutline } from './types.js';
import { normalizeText, parseJsonObject } from './utils.js';

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

Generate a clean tree/hierarchy diagram showing the survey's organizational structure.

Return ONLY valid JSON:
{
  "tikz": "\\\\begin{tikzpicture}[...] ... \\\\end{tikzpicture}",
  "mermaid": "graph TD\\n  A[Topic] --> B[Section1]\\n  ...",
  "caption": "Taxonomy of ..."
}

CRITICAL TikZ layout rules (you MUST follow ALL of these):
- Use \\node with explicit (x,y) coordinates — do NOT rely on automatic positioning
- Every node MUST have: text width=3cm, align=center, minimum height=0.8cm
- Horizontal spacing between sibling nodes: at least 3.5cm center-to-center
- Vertical spacing between levels: at least 1.8cm
- Root node at (0,0), children spread evenly below
- Max 3 levels deep, max 8 leaf nodes
- For font size, use font=\\small or font=\\footnotesize as a NODE OPTION (e.g. \\node[font=\\small, ...])
- NEVER put \\footnotesize or \\small directly as a node option without font= prefix
- Use \\draw[->, >=stealth] for arrows — NO dashed criss-crossing lines
- Do NOT use \\matrix, forest, or child syntax — use explicit \\node and \\draw only
- Do NOT use \\n for line breaks — use \\\\\\\\ inside node text
- Keep total diagram width under 14cm and height under 10cm
- Node labels must be SHORT (max 3 words per line, max 2 lines)

Mermaid requirements:
- Use 'graph TD' (top-down) layout
- Use descriptive short labels (max 25 chars)
- Max 12 nodes`;

  try {
    const response = await context.llm.chat([
      { role: 'system', content: 'You generate clean, well-spaced academic TikZ and Mermaid diagrams. Every node must have explicit coordinates with generous spacing. Never let nodes overlap. Return only valid JSON.' },
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
        mermaidCode: parsed.mermaid
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
    workflow: `Create a LEFT-TO-RIGHT workflow/pipeline diagram with 3-5 boxes connected by arrows in a single horizontal row. Each box is one step.`,
    comparison: `Create a simple TABLE-STYLE comparison. Use a grid of nodes arranged in rows and columns with clear spacing. Show 3-4 items compared across 2-3 dimensions.`,
    timeline: `Create a horizontal timeline with 3-5 events placed left-to-right along a single line, with labels above/below alternating.`
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

CRITICAL TikZ layout rules (you MUST follow ALL of these):
- Use \\node with explicit (x,y) coordinates — do NOT rely on automatic positioning
- Every node MUST have: text width=2.5cm, align=center, minimum height=0.7cm
- Horizontal spacing between nodes: at least 3.5cm center-to-center
- Vertical spacing between rows: at least 2cm
- For font size, use font=\\small or font=\\footnotesize as a NODE OPTION (e.g. \\node[font=\\small, ...])
- NEVER put \\footnotesize or \\small directly as a node option without font= prefix
- Use \\draw[->, >=stealth, thick] for arrows
- Do NOT use \\matrix, \\foreach with complex expressions, or child syntax
- Do NOT use \\n for line breaks in text — use \\\\\\\\ instead
- Do NOT use \\checkmark — use $\\bullet$ or text instead
- Keep total width under 14cm, height under 8cm
- Max 12 nodes total
- Node labels: max 3 words per line, max 2 lines per node
- For comparison figures: use a clean grid with row/column headers, NO criss-crossing lines
- For workflow figures: single horizontal chain of boxes with arrows, NO branching
- For timelines: nodes along a single horizontal line

Mermaid rules:
- Use appropriate graph direction (TD/LR)
- Short labels (max 25 chars per node)
- Max 10 nodes`;

  try {
    const response = await context.llm.chat([
      { role: 'system', content: 'You generate clean, well-spaced academic TikZ and Mermaid diagrams. Every node must have explicit coordinates with generous spacing. Never let nodes overlap. Return only valid JSON.' },
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
        mermaidCode: parsed.mermaid
      };
    }
  } catch {
    // Non-critical
  }
  return null;
}
