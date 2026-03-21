import { ScholarTool } from '../skills/01-literature/paper-search/ScholarTool.js';
import { retrieveSurveyPapers } from '../skills/research/academic-survey-self-improve/retriever.js';

const topic = process.argv.slice(2).join(' ').trim() || 'LLM agents for scientific discovery';

const ctx: any = {
  llm: null,
  memory: null,
  workspace: process.cwd(),
  userId: 'e2e',
  log: (type: string, content: string) => {
    if (type === 'action') {
      process.stdout.write(`${content}\n`);
    }
  },
  updateProgress: async (_p: number, _d: string, meta: any) => {
    if (meta?.todos) {
      process.stdout.write(`${JSON.stringify(meta.todos)}\n`);
    }
  }
};

const outline: any = {
  title: 'Survey',
  abstractDraft: '',
  taxonomy: [],
  topicProfile: {
    originalTopic: topic,
    normalizedTopic: topic.toLowerCase(),
    anchorTerms: ['llm', 'agent', 'scientific', 'discovery'],
    aliasPhrases: ['autonomous scientific discovery'],
    intentFacets: ['survey', 'system'],
    preferredPaperTypes: ['survey', 'system'],
    sectionFacets: { s1: ['system'] }
  },
  sections: [
    {
      id: 's1',
      title: 'Systems',
      description: 'Systems for scientific discovery.',
      searchQueries: ['scientific discovery agent', 'research agent workflow'],
      targetWordCount: 500,
      focusFacets: ['system']
    }
  ]
};

const scholar = new ScholarTool({ enabled: false });
const seed = await scholar.searchPapers(topic, 3, { timeoutMs: 20000 });
await retrieveSurveyPapers(scholar, topic, outline, seed, {
  sectionLimit: 4,
  perQueryLimit: 6,
  queryConcurrency: 2,
  queryTimeoutMs: 20000,
  context: ctx
});

