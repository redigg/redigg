import { AgentRuntime } from '../src/agent/runtime';
import { RediggClient } from '../src/api/client';
import { LLMProvider } from '../src/llm/provider';

process.env.REDIGG_AGENT_ID = process.env.REDIGG_AGENT_ID || 'agent-1';

// Mock Client to intercept calls
const mockClient = {
  isAuthenticated: () => true,
  heartbeat: async () => true,
  getTasks: async () => ({ data: [] }), // No polling tasks
  claimTask: async (id: string) => ({ success: true }),
  getAgentSkills: async (_agentId: string) => ([
    {
      agent_id: 'agent-1',
      skill_id: 'research-checklist',
      enabled: true,
      skill: {
        id: 'research-checklist',
        name: 'Research Checklist',
        description: 'A checklist-driven research execution skill',
        version: '1.0.0',
      },
    },
  ]),
  getSkillRaw: async (skillId: string) => `# ${skillId}

## Goal
Turn rough problem statements into clear research action plans.

## Output
Return concise markdown that includes assumptions, risks, and next steps.
`,
  uploadLog: async (_researchId: string, _stepNumber: number, _logEntry: any) => true,
  updateProgress: async (_researchId: string, _progress: number, _description: string, _details?: any) => true,
  updateTodo: async (_researchId: string, _todoId: string, _status: string, _content?: string) => true,
  addTodo: async (_researchId: string, _content: string, _priority: string, _stepNumber?: number) => true,
  submitTask: async (id: string, result: any, proposal: any) => {
    console.log(`\n[MockClient] Submitted Task ${id}:`);
    if (proposal) {
      console.log('Proposal Summary:', proposal.summary);
      console.log('Proposal Content Length:', proposal.content.length);
    }
    if (result.reply) {
      console.log('Reply:', result.reply);
    }
    if (result.review) {
      console.log('Review Content Length:', result.review.length);
    }
    return { success: true };
  },
  connectSSE: () => ({
    addEventListener: () => {},
    onerror: () => {},
    close: () => {}
  })
};

// Mock LLM to prevent real API calls
class MockLLMProvider {
  async generateCompletion(messages: any[]) {
    for (const msg of messages) {
      if (msg.content && (
          msg.content.toLowerCase().includes("literature review") || 
          (msg.content.toLowerCase().includes("genomics") && msg.content.toLowerCase().includes("transformer"))
      )) {
        return {
          content: "# Applications of Transformer Models in Genomics\n\n## Abstract\nTransformers have revolutionized NLP and are now being applied to...\n\n### Key Findings\n- A novel self-attention mechanism improves prediction accuracy.\n- Transfer learning from pre-trained models reduces computational cost.\n\n## Methodologies\nCommon approaches include:\n1. Fine-tuning on DNA sequence datasets\n2. Multi-task learning across omics data types\n\n## Research Gaps\nLimited work on non-coding RNA regions and rare variants.\n\n## References\n1. AlQuraishi M. (2021) Protein folding with transformers.\n2. Zeng J. et al. (2022) Genomic sequence modeling with CNN-Transformer hybrid architectures."
        };
      } else if (msg.content && (
          msg.content.toLowerCase().includes("peer review") || 
          (msg.content.toLowerCase().includes("review") && msg.content.toLowerCase().includes("rna"))
      )) {
        return {
          content: "# Review: A Novel Approach to RNA Folding\n\n## Summary\nThis proposal introduces a new DL architecture for RNA secondary structure prediction.\n\n## Strengths\n- Comprehensive benchmarking on public datasets.\n- The approach integrates thermodynamic constraints.\n- Detailed error analysis provided.\n\n## Weaknesses\n- No comparison with state-of-the-art transformer methods.\n- No performance metrics on pseudoknot prediction.\n\n## Novelty Assessment\nConceptually similar to existing works, but the integration of constraints is a strength.\n\n## Feasibility\nHighly feasible given recent progress in the field.\n\n## Decision\n**Major Revision**: Address the comparison and pseudoknot limitations."
        };
      }
    }
    return {
      content: "Sorry, I can't help with that right now."
    };
  }
}

// Access private method for testing
class TestableRuntime extends AgentRuntime {
  constructor() {
    super();
    (this as any).client = mockClient;
    (this as any).llm = new MockLLMProvider();
  }

  public async testTask(task: any) {
    console.log(`\n--- Testing Task: ${task.idea_title} [Type: ${task.type || 'auto'}] ---`);
    await (this as any).executeTask(task);
  }
}

async function runTest() {
  const runtime = new TestableRuntime();
  (runtime as any).loadSkillMarketPromptSkills && await (runtime as any).loadSkillMarketPromptSkills();

  // Test 1: Literature Review
  await runtime.testTask({
    id: 'test-task-1',
    idea_title: 'Applications of Transformer Models in Genomics',
    type: 'literature_review'
  });

  // Test 2: Peer Review
  await runtime.testTask({
    id: 'test-task-2',
    idea_title: 'Review: A Novel Approach to RNA Folding',
    content: 'We propose a new deep learning architecture for predicting RNA secondary structure...',
    type: 'peer_review'
  });

  // Test 3: Research Planning
  await runtime.testTask({
    id: 'test-task-3',
    idea_title: 'Build a research roadmap for multimodal biomedical foundation models',
    content: 'Need milestones, risks, and evaluation metrics',
    type: 'research_planning'
  });

  // Test 4: Experiment Design
  await runtime.testTask({
    id: 'test-task-4',
    idea_title: 'Experiment design for retrieval-augmented scientific QA',
    content: 'Need baselines, ablation, and statistical testing',
    type: 'experiment_design'
  });

  // Test 5: Data Analysis
  await runtime.testTask({
    id: 'test-task-5',
    idea_title: 'Analyze benchmark results of three LLM agents',
    content: 'agent_a: 72.3, agent_b: 68.9, agent_c: 74.1; variance unknown',
    type: 'data_analysis'
  });

  // Test 6: Paper Writing
  await runtime.testTask({
    id: 'test-task-6',
    idea_title: 'Draft a paper on agentic literature review automation',
    content: 'Include IMRaD sections, limitations, and references',
    type: 'paper_writing'
  });

  // Test 7: Dynamic prompt skill from Skill API
  await runtime.testTask({
    id: 'test-task-7',
    idea_title: 'Create a research execution checklist for clinical LLM evaluation',
    content: 'Need assumptions, risks, milestones',
    type: 'skill:research-checklist'
  });
}

runTest().catch(console.error);
