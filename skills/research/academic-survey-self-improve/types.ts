import type { Paper } from '../../../src/skills/lib/ScholarTool.js';

export interface OutlineSection {
  id: string;
  title: string;
  description: string;
  searchQueries: string[];
  targetWordCount: number;
}

export interface SurveyOutline {
  title: string;
  abstractDraft: string;
  taxonomy: string[];
  sections: OutlineSection[];
}

export interface RetrievalResult {
  papers: Paper[];
  papersBySection: Record<string, Paper[]>;
  searchMetadata: {
    queryCount: number;
    totalHits: number;
    deduplicatedCount: number;
  };
}

export interface SectionDraft {
  sectionId: string;
  title: string;
  content: string;
  paperCount: number;
  citations: number[];
}

export interface SectionReview {
  sectionId: string;
  score: number;
  strengths: string[];
  issues: string[];
  suggestions: string[];
  rewriteApplied: boolean;
}

export interface SurveyQualityReport {
  overallScore: number;
  sectionReviews: SectionReview[];
  strengths: string[];
  issues: string[];
  suggestions: string[];
}

export interface FinalSurvey {
  title: string;
  markdown: string;
  sections: SectionDraft[];
  wordCount: number;
  citationCount: number;
}
