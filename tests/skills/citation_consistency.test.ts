import { describe, expect, it } from 'vitest';
import { checkCitationConsistency, stripGhostCitations } from '../../skills/research/academic-survey-self-improve/utils.js';

describe('checkCitationConsistency', () => {
  it('should report fully consistent citations', () => {
    const markdown = 'Foo [1] bar [2] baz [3].';
    const result = checkCitationConsistency(markdown, 3);

    expect(result.isConsistent).toBe(true);
    expect(result.ghostCitations).toEqual([]);
    expect(result.orphanReferences).toEqual([]);
    expect(result.usedCitations).toEqual([1, 2, 3]);
  });

  it('should detect ghost citations', () => {
    const markdown = 'Foo [1] bar [5] baz [99].';
    const result = checkCitationConsistency(markdown, 3);

    expect(result.ghostCitations).toEqual([5, 99]);
    expect(result.usedCitations).toEqual([1]);
    expect(result.isConsistent).toBe(false);
  });

  it('should detect orphan references', () => {
    const markdown = 'Only cite [1] and [3].';
    const result = checkCitationConsistency(markdown, 4);

    expect(result.orphanReferences).toEqual([2, 4]);
    expect(result.usedCitations).toEqual([1, 3]);
    expect(result.isConsistent).toBe(false);
  });

  it('should handle no citations at all', () => {
    const markdown = 'No citations here.';
    const result = checkCitationConsistency(markdown, 3);

    expect(result.ghostCitations).toEqual([]);
    expect(result.orphanReferences).toEqual([1, 2, 3]);
    expect(result.usedCitations).toEqual([]);
    expect(result.isConsistent).toBe(false);
  });

  it('should handle zero references', () => {
    const markdown = 'Hallucinated [1] citation.';
    const result = checkCitationConsistency(markdown, 0);

    expect(result.ghostCitations).toEqual([1]);
    expect(result.orphanReferences).toEqual([]);
    expect(result.isConsistent).toBe(false);
  });
});

describe('stripGhostCitations', () => {
  it('should remove out-of-range citations', () => {
    const markdown = 'Foo [1] bar [5] baz [2].';
    const result = stripGhostCitations(markdown, 3);

    expect(result).toBe('Foo [1] bar baz [2].');
  });

  it('should preserve all valid citations', () => {
    const markdown = 'Foo [1] bar [2] baz [3].';
    const result = stripGhostCitations(markdown, 3);

    expect(result).toBe('Foo [1] bar [2] baz [3].');
  });

  it('should handle adjacent ghost citations', () => {
    const markdown = 'Claim [1][99][2].';
    const result = stripGhostCitations(markdown, 2);

    expect(result).toBe('Claim [1][2].');
  });
});
