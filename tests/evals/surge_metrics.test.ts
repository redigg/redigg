import { describe, expect, it } from 'vitest';
import {
  rougeLF1,
  rougeNF1,
  structuralSimilarity,
  citationRecall,
  vocabularyDiversity,
  computeSurgeMetrics
} from '../../src/evals/survey-benchmark/metrics.js';

describe('ROUGE-L', () => {
  it('should return 1.0 for identical texts', () => {
    const text = 'The quick brown fox jumps over the lazy dog';
    expect(rougeLF1(text, text)).toBeCloseTo(1.0, 2);
  });

  it('should return 0 for completely different texts', () => {
    expect(rougeLF1('alpha beta gamma', 'one two three')).toBe(0);
  });

  it('should return a partial score for overlapping texts', () => {
    const candidate = 'The quick brown fox jumps';
    const reference = 'The quick red fox leaps over the lazy dog';
    const score = rougeLF1(candidate, reference);
    expect(score).toBeGreaterThan(0.2);
    expect(score).toBeLessThan(0.9);
  });
});

describe('ROUGE-2', () => {
  it('should return 1.0 for identical texts', () => {
    const text = 'The quick brown fox jumps over the lazy dog';
    expect(rougeNF1(text, text, 2)).toBeCloseTo(1.0, 2);
  });

  it('should be lower than ROUGE-L for partially overlapping texts', () => {
    const candidate = 'The quick brown fox jumps';
    const reference = 'The quick red fox leaps over the lazy dog';
    const rougeL = rougeLF1(candidate, reference);
    const rouge2 = rougeNF1(candidate, reference, 2);
    expect(rouge2).toBeLessThanOrEqual(rougeL);
  });
});

describe('structural similarity', () => {
  it('should match all headings when present', () => {
    const markdown = '## Background\n\nText\n\n## Methods\n\nText\n\n## Evaluation\n\nText';
    const result = structuralSimilarity(markdown, ['Background', 'Methods', 'Evaluation']);
    expect(result.score).toBe(1.0);
    expect(result.missingHeadings).toHaveLength(0);
  });

  it('should report missing headings', () => {
    const markdown = '## Background\n\nText\n\n## Methods\n\nText';
    const result = structuralSimilarity(markdown, ['Background', 'Methods', 'Evaluation', 'Challenges']);
    expect(result.score).toBe(0.5);
    expect(result.missingHeadings).toEqual(expect.arrayContaining(['evaluation', 'challenges']));
  });
});

describe('citation recall', () => {
  it('should return 1.0 when all paragraphs are cited', () => {
    const markdown = 'Some long enough paragraph with evidence from multiple sources and a citation [1].\n\nAnother detailed paragraph discussing the topic in depth with citation [2].';
    expect(citationRecall(markdown)).toBe(1.0);
  });

  it('should return 0.5 when half the paragraphs lack citations', () => {
    const markdown = 'A paragraph with enough words to be counted as a real paragraph and a citation [1].\n\nA paragraph with enough words to be counted as real but without any citation reference.';
    expect(citationRecall(markdown)).toBe(0.5);
  });
});

describe('vocabulary diversity', () => {
  it('should be higher for diverse text', () => {
    const diverse = 'The quick brown fox jumps over the lazy dog while cats sleep';
    const repetitive = 'the the the the the the the the the the';
    expect(vocabularyDiversity(diverse)).toBeGreaterThan(vocabularyDiversity(repetitive));
  });
});

describe('computeSurgeMetrics', () => {
  it('should compute composite without reference text', () => {
    const markdown = '## Background\n\nSome text with citation [1].\n\n## Methods\n\nMore text with detailed discussion of methods and approaches [2].';
    const metrics = computeSurgeMetrics(markdown, ['Background', 'Methods', 'Evaluation']);
    expect(metrics.rougeL).toBe(0);
    expect(metrics.structuralSimilarity).toBeGreaterThan(0.5);
    expect(metrics.composite).toBeGreaterThan(0);
  });

  it('should include ROUGE scores when reference text is provided', () => {
    const markdown = '## Background\n\nAI agents enable scientific research.\n\n## Methods\n\nDeep learning methods are used [1].';
    const reference = '## Background\n\nAI agents enable scientific research.\n\n## Methods\n\nDeep learning techniques are employed.';
    const metrics = computeSurgeMetrics(markdown, ['Background', 'Methods'], reference);
    expect(metrics.rougeL).toBeGreaterThan(0.5);
    expect(metrics.rouge2).toBeGreaterThan(0);
    expect(metrics.composite).toBeGreaterThan(0);
  });
});
