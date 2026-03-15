import type { Paper } from '../../../src/skills/lib/ScholarTool.js';

export interface TopicProfile {
  originalTopic: string;
  normalizedTopic: string;
  anchorTerms: string[];
  aliasPhrases: string[];
  intentFacets: string[];
  preferredPaperTypes: string[];
  sectionFacets: Record<string, string[]>;
}

export interface ExpandedQuery {
  query: string;
  facet: string;
  weight: number;
  source: 'base' | 'alias' | 'facet' | 'section' | 'fallback';
}

export interface OutlineSection {
  id: string;
  title: string;
  description: string;
  searchQueries: string[];
  targetWordCount: number;
  focusFacets?: string[];
  queryPlan?: ExpandedQuery[];
}

export interface SurveyOutline {
  title: string;
  abstractDraft: string;
  taxonomy: string[];
  sections: OutlineSection[];
  topicProfile?: TopicProfile;
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

export interface EvidenceCard {
  citation: number;
  title: string;
  year: number;
  source?: Paper['source'];
  paperTypeSignals: string[];
  evidenceFocus: string[];
  keyContribution: string;
  groundedClaim: string;
  limitationHint: string;
}

export interface ClaimAlignment {
  claim: string;
  citations: number[];
  evidenceTitles: string[];
}

export interface SectionDraft {
  sectionId: string;
  title: string;
  content: string;
  paperCount: number;
  citations: number[];
  evidenceCards: EvidenceCard[];
  claimAlignments: ClaimAlignment[];
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
