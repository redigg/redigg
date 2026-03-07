import { AgentRuntime } from '../src/agent/runtime';
import { LLMProvider } from '../src/llm/provider';

// Use the known API key from redigg project
process.env.OPENAI_API_KEY = '57a1a371-0b28-419f-b1be-44e30fb6c244';
process.env.OPENAI_BASE_URL = 'https://ark.cn-beijing.volces.com/api/coding/v3';
process.env.OPENAI_MODEL = 'ark-code-latest';
process.env.REDIGG_AGENT_ID = 'test-agent-1';

// Mock Client to intercept calls (we don't need real Redigg API)
const mockClient = {
  isAuthenticated: () => true,
  heartbeat: async () => true,
  getTasks: async () => ({ data: [] }),
  claimTask: async (id: string) => ({ success: true }),
  getAgentSkills: async (_agentId: string) => ([]),
  getSkillRaw: async (skillId: string) => '',
  uploadLog: async (_researchId: string, _stepNumber: number, _logEntry: any) => true,
  updateProgress: async (_researchId: string, _progress: number, _description: string, _details?: any) => true,
  updateTodo: async (_researchId: string, _todoId: string, _status: string, _content?: string) => true,
  addTodo: async (_researchId: string, _content: string, _priority: string, _stepNumber?: number) => true,
  submitTask: async (id: string, result: any, proposal: any) => {
    console.log(`\n=== [Task ${id} Submitted] ===`);
    if (proposal?.summary) {
      console.log('Summary:', proposal.summary);
    }
    if (proposal?.content) {
      console.log('\nContent Preview:', proposal.content.slice(0, 500), '...');
    }
    if (result?.reply) {
      console.log('\nReply:', result.reply.slice(0, 500), '...');
    }
    console.log('=' .repeat(50));
    return { success: true };
  },
  connectSSE: () => ({
    addEventListener: () => {},
    onerror: () => {},
    close: () => {}
  })
};

// Use real LLM
class TestableRuntime extends AgentRuntime {
  constructor() {
    super();
    (this as any).client = mockClient;
    (this as any).llm = new LLMProvider();
  }

  public async testTask(task: any) {
    console.log(`\n--- Testing Task: ${task.idea_title} [Type: ${task.type || 'auto'}] ---`);
    await (this as any).executeTask(task);
  }
}

async function runTest() {
  console.log('🚀 Starting real LLM test...');
  console.log('API Key configured:', !!process.env.OPENAI_API_KEY);
  console.log('Base URL:', process.env.OPENAI_BASE_URL);
  console.log('Model:', process.env.OPENAI_MODEL);
  console.log();

  const runtime = new TestableRuntime();

  // Test 1: Peer Review (doesn't need Scholar API)
  console.log('Test 1: Peer Review');
  await runtime.testTask({
    id: 'real-test-1',
    idea_title: 'Review: Transformer-based Protein Folding',
    content: `We propose a new transformer architecture for protein 3D structure prediction.

Key features:
- Novel attention mechanism that captures long-range interactions
- Pre-trained on UniRef50 dataset
- Fine-tuned on CASP14 targets
- Achieves state-of-the-art performance on several benchmarks`,
    type: 'peer_review'
  });

  // Test 2: Research Planning
  console.log('\nTest 2: Research Planning');
  await runtime.testTask({
    id: 'real-test-2',
    idea_title: 'Research plan for multi-agent scientific collaboration',
    content: 'Need a 6-month research plan with milestones, risks, and evaluation metrics. Focus on multi-agent systems for collaborative research.',
    type: 'research_planning'
  });

  // Test 3: Experiment Design
  console.log('\nTest 3: Experiment Design');
  await runtime.testTask({
    id: 'real-test-3',
    idea_title: 'Experiment design for comparing agent architectures',
    content: 'Design an experiment to compare three agent architectures (tool-use, fixed skill chain, dynamic orchestration) on research tasks. Include baselines, ablations, and statistical testing.',
    type: 'experiment_design'
  });

  console.log('\n✅ All tests completed!');
}

runTest().catch(console.error);
