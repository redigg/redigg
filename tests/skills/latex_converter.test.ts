import { describe, it, expect } from 'vitest';
import { convertToLatex } from '../../skills/research/academic-survey-self-improve/latex-converter.js';
import type { FinalSurvey, SurveyOutline } from '../../skills/research/academic-survey-self-improve/types.js';
import type { Paper } from '../../src/skills/lib/ScholarTool.js';

function makeOutline(): SurveyOutline {
  return {
    title: 'A Survey of AI Agents for Scientific Research',
    abstractDraft: 'This survey examines AI agents designed for scientific research tasks.',
    taxonomy: ['Task-based agents', 'Tool-using agents', 'Multi-agent systems'],
    sections: [
      {
        id: 'background',
        title: 'Background and Evolution',
        description: 'Historical context',
        searchQueries: ['AI agents history'],
        targetWordCount: 300
      },
      {
        id: 'methods',
        title: 'Methods and Architectures',
        description: 'Technical approaches',
        searchQueries: ['AI agent architectures'],
        targetWordCount: 400
      }
    ]
  };
}

function makePapers(): Paper[] {
  return [
    {
      title: 'ChemCrow: Augmenting LLMs with Chemistry Tools',
      authors: ['Bran, A.', 'Cox, S.'],
      year: 2024,
      url: 'https://arxiv.org/abs/2304.05376',
      summary: 'An LLM agent for chemistry.',
      journal: 'Nature Machine Intelligence',
      source: 'arxiv'
    },
    {
      title: 'SciAgent: A Multi-Agent Framework',
      authors: ['Zhang, Y.'],
      year: 2025,
      url: 'https://arxiv.org/abs/2501.12345',
      summary: 'Multi-agent scientific research.',
      journal: 'arXiv preprint',
      source: 'arxiv'
    }
  ];
}

function makeFinalSurvey(): FinalSurvey {
  return {
    title: 'A Survey of AI Agents for Scientific Research',
    markdown: `# A Survey of AI Agents for Scientific Research

## Abstract

This survey examines AI agents designed for scientific research tasks.

**Keywords**: Task-based agents, Tool-using agents, Multi-agent systems

## Introduction

AI agents increasingly support scientific workflows by combining planning, retrieval, and tool use [1].

## Background and Evolution

AI agents have evolved significantly [1]. Recent work by Bran et al. demonstrates chemistry-specific tool use [1].

## Methods and Architectures

Multi-agent frameworks like SciAgent [2] enable collaborative research workflows. The use of **specialized tools** is a key pattern.

## Conclusion

These systems continue to expand the scope of scientific automation.`,
    sections: [
      {
        sectionId: 'background',
        title: 'Background and Evolution',
        templateKind: 'background',
        content: '## Background and Evolution\n\nDraft-only background text that should not drive the LaTeX body [1].',
        paperCount: 1,
        citations: [1],
        evidenceCards: [],
        claimAlignments: []
      },
      {
        sectionId: 'methods',
        title: 'Methods and Architectures',
        templateKind: 'methods',
        content: '## Methods and Architectures\n\nDraft-only methods text with **draft-only tools** that should be ignored [2].',
        paperCount: 1,
        citations: [2],
        evidenceCards: [],
        claimAlignments: []
      }
    ],
    referencedPapers: makePapers(),
    wordCount: 200,
    citationCount: 2,
    citationConsistency: {
      ghostCitations: [],
      orphanReferences: [],
      isConsistent: true
    }
  };
}

describe('LaTeX Converter', () => {
  it('generates valid LaTeX document structure', () => {
    const latex = convertToLatex(makeOutline(), makeFinalSurvey(), makePapers());

    expect(latex).toContain('\\documentclass');
    expect(latex).toContain('\\begin{document}');
    expect(latex).toContain('\\end{document}');
    expect(latex).toContain('\\maketitle');
    expect(latex).toContain('\\begin{abstract}');
    expect(latex).toContain('\\end{abstract}');
  });

  it('includes running header with fancyhdr', () => {
    const latex = convertToLatex(makeOutline(), makeFinalSurvey(), makePapers());

    expect(latex).toContain('\\usepackage{fancyhdr}');
    expect(latex).toContain('\\pagestyle{fancy}');
    expect(latex).toContain('\\fancyhead[L]');
    expect(latex).toContain('\\fancyhead[R]');
  });

  it('uses compact bibliography', () => {
    const latex = convertToLatex(makeOutline(), makeFinalSurvey(), makePapers());

    expect(latex).toContain('\\small');
    expect(latex).toContain('\\setlength{\\itemsep}');
  });

  it('includes title and abstract', () => {
    const latex = convertToLatex(makeOutline(), makeFinalSurvey(), makePapers());

    expect(latex).toContain('A Survey of AI Agents for Scientific Research');
    expect(latex).toContain('This survey examines AI agents');
  });

  it('includes keywords after abstract', () => {
    const latex = convertToLatex(makeOutline(), makeFinalSurvey(), makePapers());

    expect(latex).toContain('\\textbf{Keywords:}');
    expect(latex).toContain('Task-based agents');
  });

  it('strips markdown keywords from abstract before rendering LaTeX', () => {
    const latex = convertToLatex(makeOutline(), makeFinalSurvey(), makePapers());

    expect(latex.match(/Keywords/g) || []).toHaveLength(1);
  });

  it('includes body sections', () => {
    const latex = convertToLatex(makeOutline(), makeFinalSurvey(), makePapers());

    expect(latex).toContain('\\section{Background and Evolution}');
    expect(latex).toContain('\\section{Methods and Architectures}');
  });

  it('preserves citation markers', () => {
    const latex = convertToLatex(makeOutline(), makeFinalSurvey(), makePapers());

    expect(latex).toContain('[1]');
    expect(latex).toContain('[2]');
  });

  it('converts bold markdown to LaTeX textbf', () => {
    const latex = convertToLatex(makeOutline(), makeFinalSurvey(), makePapers());

    expect(latex).toContain('\\textbf{specialized tools}');
  });

  it('prefers assembled markdown over draft section content for body sections', () => {
    const latex = convertToLatex(makeOutline(), makeFinalSurvey(), makePapers());

    expect(latex).toContain('chemistry-specific tool use');
    expect(latex).toContain('\\textbf{specialized tools}');
    expect(latex).not.toContain('draft-only background text');
    expect(latex).not.toContain('draft-only tools');
  });

  it('includes bibliography with papers', () => {
    const latex = convertToLatex(makeOutline(), makeFinalSurvey(), makePapers());

    expect(latex).toContain('\\begin{thebibliography}');
    expect(latex).toContain('\\bibitem{ref1}');
    expect(latex).toContain('\\bibitem{ref2}');
    expect(latex).toContain('ChemCrow');
    expect(latex).toContain('SciAgent');
  });

  it('includes conclusion section', () => {
    const latex = convertToLatex(makeOutline(), makeFinalSurvey(), makePapers());

    expect(latex).toContain('\\section{Conclusion}');
  });

  it('strips manual letter labels from subsection headings', () => {
    const finalSurvey = makeFinalSurvey();
    finalSurvey.markdown = `# A Survey of AI Agents for Scientific Research

## Abstract

This survey examines AI agents designed for scientific research tasks.

## Introduction

### (a) Background

AI agents increasingly support scientific workflows by combining planning, retrieval, and tool use [1].

## Background and Evolution

AI agents have evolved significantly [1].

## Conclusion

These systems continue to expand the scope of scientific automation.`;
    const latex = convertToLatex(makeOutline(), finalSurvey, makePapers());

    expect(latex).toContain('\\subsection{Background}');
    expect(latex).not.toContain('\\subsection{(a) Background}');
  });

  it('preserves non-latin author names through transliteration in bibliography', () => {
    const papers: Paper[] = [
      {
        title: 'DORA AI Scientist',
        authors: ['Владимир Наумов', 'Diana Zagirova'],
        year: 2025,
        url: 'https://example.com/dora',
        summary: 'A multi-agent virtual research team.',
        journal: 'Preprint',
        source: 'openalex'
      }
    ];
    const latex = convertToLatex(makeOutline(), makeFinalSurvey(), papers);

    expect(latex).toContain('Vladimir Naumov');
    expect(latex).not.toContain('\\bibitem{ref1} , Diana Zagirova');
  });

  it('escapes special LaTeX characters', () => {
    const outline = makeOutline();
    const finalSurvey = makeFinalSurvey();
    finalSurvey.markdown = finalSurvey.markdown.replace(
      'This survey examines AI agents designed for scientific research tasks.',
      'Testing 100% accuracy & special chars like $10 cost.'
    );
    const latex = convertToLatex(outline, finalSurvey, makePapers());

    expect(latex).toContain('100\\%');
    expect(latex).toContain('\\&');
    expect(latex).toContain('\\$10');
  });
});
