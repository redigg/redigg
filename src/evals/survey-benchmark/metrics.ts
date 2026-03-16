/**
 * Text-quality metrics aligned with SurGE / SurveyBench evaluation protocols.
 * These are local approximations — full SurGE evaluation requires their ground truth corpus.
 */

// ── ROUGE-L Proxy ─────────────────────────────────────────────────────
// Longest Common Subsequence based F1, same formula as ROUGE-L

function lcsLength(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  // Space-optimized: only keep two rows
  let prev = new Array(n + 1).fill(0);
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }

  return prev[n];
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
}

/**
 * ROUGE-L F1 score between candidate and reference texts.
 * Returns a value in [0, 1].
 */
export function rougeLF1(candidate: string, reference: string): number {
  const candTokens = tokenize(candidate);
  const refTokens = tokenize(reference);

  if (candTokens.length === 0 || refTokens.length === 0) return 0;

  const lcs = lcsLength(candTokens, refTokens);
  const precision = lcs / candTokens.length;
  const recall = lcs / refTokens.length;

  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

// ── N-gram Overlap (ROUGE-N proxy) ────────────────────────────────────

function getNgrams(tokens: string[], n: number): Map<string, number> {
  const ngrams = new Map<string, number>();
  for (let i = 0; i <= tokens.length - n; i++) {
    const gram = tokens.slice(i, i + n).join(' ');
    ngrams.set(gram, (ngrams.get(gram) || 0) + 1);
  }
  return ngrams;
}

/**
 * ROUGE-N F1 between candidate and reference.
 */
export function rougeNF1(candidate: string, reference: string, n: number = 2): number {
  const candTokens = tokenize(candidate);
  const refTokens = tokenize(reference);
  const candNgrams = getNgrams(candTokens, n);
  const refNgrams = getNgrams(refTokens, n);

  let overlap = 0;
  for (const [gram, count] of candNgrams) {
    overlap += Math.min(count, refNgrams.get(gram) || 0);
  }

  const candTotal = Math.max(1, Array.from(candNgrams.values()).reduce((a, b) => a + b, 0));
  const refTotal = Math.max(1, Array.from(refNgrams.values()).reduce((a, b) => a + b, 0));

  const precision = overlap / candTotal;
  const recall = overlap / refTotal;

  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

// ── Structural Similarity ─────────────────────────────────────────────
// Compares heading structure between generated survey and a reference

export interface StructuralSimilarityResult {
  score: number; // 0-1
  matchedHeadings: string[];
  missingHeadings: string[];
  extraHeadings: string[];
}

function extractHeadings(markdown: string): string[] {
  return markdown
    .split('\n')
    .filter((line) => /^#{1,3}\s/.test(line))
    .map((line) => line.replace(/^#+\s*/, '').trim().toLowerCase());
}

export function structuralSimilarity(candidate: string, referenceHeadings: string[]): StructuralSimilarityResult {
  const candHeadings = extractHeadings(candidate);
  const refNorm = referenceHeadings.map((h) => h.toLowerCase());

  const matched: string[] = [];
  const missing: string[] = [];

  for (const ref of refNorm) {
    if (candHeadings.some((ch) => ch.includes(ref) || ref.includes(ch))) {
      matched.push(ref);
    } else {
      missing.push(ref);
    }
  }

  const extra = candHeadings.filter(
    (ch) => !refNorm.some((ref) => ch.includes(ref) || ref.includes(ch))
  );

  const score = refNorm.length > 0 ? matched.length / refNorm.length : 0;

  return {
    score,
    matchedHeadings: matched,
    missingHeadings: missing,
    extraHeadings: extra
  };
}

// ── Citation Recall ───────────────────────────────────────────────────
// What fraction of body paragraphs contain at least one citation?

export function citationRecall(markdown: string): number {
  const paragraphs = markdown
    .split(/\n\n+/)
    .filter((p) => p.trim().length > 50 && !p.trim().startsWith('#') && !p.trim().startsWith('- '));

  if (paragraphs.length === 0) return 0;

  const cited = paragraphs.filter((p) => /\[\d+\]/.test(p));
  return cited.length / paragraphs.length;
}

// ── Diversity Score ───────────────────────────────────────────────────
// Vocabulary diversity: type-token ratio (TTR) on first 500 tokens

export function vocabularyDiversity(text: string): number {
  const tokens = tokenize(text).slice(0, 500);
  if (tokens.length === 0) return 0;
  const types = new Set(tokens);
  return types.size / tokens.length;
}

// ── Aggregate SurGE-style metrics ─────────────────────────────────────

export interface SurgeStyleMetrics {
  rougeL: number;
  rouge2: number;
  structuralSimilarity: number;
  citationRecall: number;
  vocabularyDiversity: number;
  composite: number; // weighted average
}

/**
 * Compute SurGE-style metrics for a generated survey.
 * If no reference text is available, ROUGE scores will be 0
 * and composite will be based on structural/citation/diversity only.
 */
export function computeSurgeMetrics(
  generatedMarkdown: string,
  referenceHeadings: string[],
  referenceText?: string
): SurgeStyleMetrics {
  const rougeL = referenceText ? rougeLF1(generatedMarkdown, referenceText) : 0;
  const rouge2 = referenceText ? rougeNF1(generatedMarkdown, referenceText, 2) : 0;
  const struct = structuralSimilarity(generatedMarkdown, referenceHeadings);
  const citRecall = citationRecall(generatedMarkdown);
  const vocabDiv = vocabularyDiversity(generatedMarkdown);

  // Composite: when reference is available, weight ROUGE heavily (SurGE style)
  // When no reference, weight structure + citation + diversity
  const hasReference = Boolean(referenceText);
  const composite = hasReference
    ? rougeL * 0.30 + rouge2 * 0.20 + struct.score * 0.20 + citRecall * 0.20 + vocabDiv * 0.10
    : struct.score * 0.40 + citRecall * 0.40 + vocabDiv * 0.20;

  return {
    rougeL,
    rouge2,
    structuralSimilarity: struct.score,
    citationRecall: citRecall,
    vocabularyDiversity: vocabDiv,
    composite
  };
}
