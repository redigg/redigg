import fs from 'fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PdfGeneratorSkill from '../../skills/research/pdf-generator/index.ts';
import { normalizePdfSourceContent, parseAcademicMarkdown } from '../../skills/research/pdf-generator/renderer.ts';
import type { SkillContext } from '../../src/skills/types.js';

describe('pdf_generator renderer', () => {
  it('should normalize literature review wrapper content into paper-like markdown', () => {
    const source = `Here is a literature review on "AI Agent for Scientific Research":\n\n# A Survey of AI Agent for Scientific Research\n\n## Abstract\n\nThis survey reviews agentic systems.\n\n## Background and Scope\n\nA grounded section.\n\n## Review Summary\n\nOverall score: 82/100\n\n- Add stronger benchmark analysis\n\n**Sources:**\n- [Paper A](https://example.com/a) (2024)\n- [Paper B](https://example.com/b) (2025)`;

    const normalized = normalizePdfSourceContent('Literature Review on AI Agent for Scientific Research', source);
    expect(normalized.startsWith('# A Survey of AI Agent for Scientific Research')).toBe(true);
    expect(normalized).toContain('## References');
    expect(normalized).not.toContain('## Review Summary');
    expect(normalized).not.toContain('Here is a literature review');
  });

  it('should parse academic markdown into structured sections and references', () => {
    const parsed = parseAcademicMarkdown(
      'Literature Review on AI Agent for Scientific Research',
      `# A Survey of AI Agent for Scientific Research\n\n## Abstract\n\nThis survey reviews agentic systems.\n\n## Background and Scope\n\nAgents are increasingly used for research automation.\n\n## Evaluation and Benchmarks\n\n- Benchmark coverage\n- Benchmark gaps\n\n## References\n\n1. Paper A. Venue, 2024. https://example.com/a\n2. Paper B. Venue, 2025. https://example.com/b`
    );

    expect(parsed.title).toBe('A Survey of AI Agent for Scientific Research');
    expect(parsed.abstractText).toContain('agentic systems');
    expect(parsed.sections.map((section) => section.title)).toEqual(expect.arrayContaining([
      'Background and Scope',
      'Evaluation and Benchmarks',
      'References'
    ]));
    expect(parsed.referenceItems).toHaveLength(2);
  });
});

describe('PdfGeneratorSkill', () => {
  const generatedFiles: string[] = [];

  afterEach(() => {
    for (const file of generatedFiles.splice(0)) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
  });

  it('should generate a non-empty academic-style PDF', async () => {
    const skill = new PdfGeneratorSkill();
    const context: SkillContext = {
      llm: {} as any,
      memory: {} as any,
      workspace: '/tmp',
      userId: 'test-user',
      log: vi.fn()
    };

    const result = await skill.execute(context, {
      title: 'Literature Review on AI Agent for Scientific Research',
      author: 'Redigg AI Research',
      content: `Here is a literature review on "AI Agent for Scientific Research":\n\n# A Survey of AI Agent for Scientific Research\n\n## Abstract\n\nThis survey reviews representative systems, benchmarks, and open challenges.\n\n## Background and Scope\n\nAI agents for scientific research integrate reasoning, tooling, and workflow orchestration.\n\n## Core Methods\n\nAgentic systems combine planning, retrieval, and execution.\n\n## References\n\n1. Paper A. Venue, 2024. https://example.com/a`
    });

    expect(result.success).toBe(true);
    expect(result.file_path).toBeTruthy();
    expect(fs.existsSync(result.file_path)).toBe(true);
    expect(fs.statSync(result.file_path).size).toBeGreaterThan(2500);
    expect(result.formatted_output).toContain('[Download PDF]');
    generatedFiles.push(result.file_path);
  });
});
