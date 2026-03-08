import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QualityManager } from '../../src/quality/QualityManager.js';
import { MockLLMClient } from '../../src/llm/LLMClient.js';

describe('QualityManager', () => {
  let qualityManager: QualityManager;
  let llm: MockLLMClient;

  beforeEach(() => {
    llm = new MockLLMClient();
    qualityManager = new QualityManager(llm);
  });

  it('should evaluate a high quality response', async () => {
    const report = {
      score: 95,
      reasoning: 'Excellent summary.',
      suggestions: [],
      passed: true
    };

    vi.spyOn(llm, 'chat').mockResolvedValue({
      content: JSON.stringify(report)
    });

    const result = await qualityManager.evaluateTask(
      'Summarize photosynthesis',
      'Photosynthesis is the process by which green plants...',
      { papersCount: 5 }
    );

    expect(result.score).toBe(95);
    expect(result.passed).toBe(true);
  });

  it('should evaluate a low quality response', async () => {
    const report = {
      score: 40,
      reasoning: 'Too short and missing key details.',
      suggestions: ['Add chemical equation'],
      passed: false
    };

    vi.spyOn(llm, 'chat').mockResolvedValue({
      content: JSON.stringify(report)
    });

    const result = await qualityManager.evaluateTask(
      'Summarize photosynthesis',
      'Plants make food.',
      { papersCount: 1 }
    );

    expect(result.score).toBe(40);
    expect(result.passed).toBe(false);
    expect(result.suggestions).toContain('Add chemical equation');
  });

  it('should handle invalid JSON from LLM', async () => {
    vi.spyOn(llm, 'chat').mockResolvedValue({
      content: 'This is not JSON'
    });

    const result = await qualityManager.evaluateTask('Task', 'Result');

    expect(result.passed).toBe(false);
    expect(result.reasoning).toContain('Evaluation failed');
  });
});
