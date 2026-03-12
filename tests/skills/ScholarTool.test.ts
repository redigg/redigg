import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScholarTool } from '../../src/skills/lib/ScholarTool.js';

const arxivFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2501.00001v1</id>
    <published>2025-01-01T00:00:00Z</published>
    <title>Scientific Research Agents with Tool-Augmented Planning</title>
    <summary>Short arXiv abstract about scientific research agents.</summary>
    <author><name>Alice</name></author>
    <link href="http://arxiv.org/abs/2501.00001v1" rel="alternate" type="text/html" />
    <link title="pdf" href="http://arxiv.org/pdf/2501.00001v1.pdf" rel="related" type="application/pdf" />
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2501.00002v1</id>
    <published>2025-01-02T00:00:00Z</published>
    <title>Benchmarking Scientific Research Agents</title>
    <summary>ArXiv paper focused on evaluating scientific research agents.</summary>
    <author><name>Bob</name></author>
    <link href="http://arxiv.org/abs/2501.00002v1" rel="alternate" type="text/html" />
    <link title="pdf" href="http://arxiv.org/pdf/2501.00002v1.pdf" rel="related" type="application/pdf" />
  </entry>
</feed>`;

describe('ScholarTool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SEMANTIC_SCHOLAR_API_KEY;
  });

  it('should aggregate arXiv and OpenAlex results and merge duplicates', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('export.arxiv.org')) {
        return new Response(arxivFeed, {
          status: 200,
          headers: { 'Content-Type': 'application/atom+xml' }
        });
      }

      if (url.includes('api.openalex.org')) {
        return new Response(JSON.stringify({
          results: [
            {
              display_name: 'Scientific Research Agents with Tool-Augmented Planning',
              publication_year: 2025,
              authorships: [{ author: { display_name: 'Alice' } }, { author: { display_name: 'Carol' } }],
              abstract_inverted_index: {
                Scientific: [0],
                research: [1],
                agents: [2],
                with: [3],
                tool: [4],
                augmented: [5],
                planning: [6],
                improve: [7],
                end: [8],
                to: [9],
                end: [10],
                discovery: [11]
              },
              primary_location: {
                landing_page_url: 'https://doi.org/10.1234/research-agents',
                source: { display_name: 'Nature Machine Intelligence' }
              },
              best_oa_location: {
                landing_page_url: 'https://doi.org/10.1234/research-agents',
                pdf_url: 'https://example.org/research-agents.pdf',
                source: { display_name: 'Nature Machine Intelligence' }
              },
              cited_by_count: 42,
              doi: 'https://doi.org/10.1234/research-agents'
            },
            {
              display_name: 'Scientific Discovery Workflows with Autonomous Agents',
              publication_year: 2024,
              authorships: [{ author: { display_name: 'Dana' } }],
              abstract_inverted_index: {
                Scientific: [0],
                discovery: [1],
                workflows: [2],
                with: [3],
                autonomous: [4],
                agents: [5]
              },
              primary_location: {
                landing_page_url: 'https://doi.org/10.5678/discovery-workflows',
                source: { display_name: 'ICLR' }
              },
              best_oa_location: {
                landing_page_url: 'https://doi.org/10.5678/discovery-workflows',
                pdf_url: 'https://example.org/discovery-workflows.pdf',
                source: { display_name: 'ICLR' }
              },
              cited_by_count: 17,
              doi: 'https://doi.org/10.5678/discovery-workflows'
            }
          ]
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const scholar = new ScholarTool();
    const papers = await scholar.searchPapers('Scientific Research Agents', 3);

    expect(papers).toHaveLength(3);
    expect(papers.map((paper) => paper.title)).toContain('Scientific Research Agents with Tool-Augmented Planning');
    expect(papers.map((paper) => paper.title)).toContain('Benchmarking Scientific Research Agents');
    expect(papers.map((paper) => paper.title)).toContain('Scientific Discovery Workflows with Autonomous Agents');

    const mergedPaper = papers.find((paper) => paper.title === 'Scientific Research Agents with Tool-Augmented Planning');
    expect(mergedPaper?.doi).toBe('10.1234/research-agents');
    expect(mergedPaper?.summary.length || 0).toBeGreaterThan('Short arXiv abstract about scientific research agents.'.length);
    expect(mergedPaper?.citationCount).toBe(42);
    expect(mergedPaper?.pdfUrl).toBe('https://example.org/research-agents.pdf');
    expect(mergedPaper?.authors).toEqual(expect.arrayContaining(['Alice', 'Carol']));
  });

  it('should fall back cleanly when OpenAlex fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('export.arxiv.org')) {
        return new Response(arxivFeed, {
          status: 200,
          headers: { 'Content-Type': 'application/atom+xml' }
        });
      }

      if (url.includes('api.openalex.org')) {
        return new Response('OpenAlex unavailable', { status: 503 });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const scholar = new ScholarTool();
    const papers = await scholar.searchPapers('Scientific Research Agents', 2);

    expect(papers).toHaveLength(2);
    expect(papers.every((paper) => paper.source === 'arxiv')).toBe(true);
  });
});
