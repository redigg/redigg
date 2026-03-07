import { AgentRuntime } from '../src/agent/runtime';
import { LLMProvider } from '../src/llm/provider';

// Use the known API key from redigg project
process.env.OPENAI_API_KEY = '57a1a371-0b28-419f-b1be-44e30fb6c244';
process.env.OPENAI_BASE_URL = 'https://ark.cn-beijing.volces.com/api/coding/v3';
process.env.OPENAI_MODEL = 'ark-code-latest';
process.env.REDIGG_AGENT_ID = 'test-agent-paper';

// Mock Client
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
    console.log(`\n` + '='.repeat(80));
    console.log(`📄 [PAPER SUBMITTED] ${id}`);
    console.log('='.repeat(80));
    if (proposal?.content) {
      console.log('\n' + proposal.content);
    }
    console.log('\n' + '='.repeat(80));
    console.log('✅ Paper generation completed!');
    console.log('='.repeat(80));
    return { success: true };
  },
  connectSSE: () => ({
    addEventListener: () => {},
    onerror: () => {},
    close: () => {}
  })
};

class TestableRuntime extends AgentRuntime {
  constructor() {
    super();
    (this as any).client = mockClient;
    (this as any).llm = new LLMProvider();
  }

  public async testTask(task: any) {
    console.log(`\n--- 📝 Generating Paper: ${task.idea_title} ---`);
    await (this as any).executeTask(task);
  }
}

async function runTest() {
  console.log('🚀 Starting paper writing test...');
  console.log('API Key:', process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing');
  console.log('Model:', process.env.OPENAI_MODEL);
  console.log();

  const runtime = new TestableRuntime();

  // Test: Paper Writing
  await runtime.testTask({
    id: 'paper-test-001',
    idea_title: 'Agentic Workflow for Scientific Research: A Comparative Study of Three Architectures',
    content: `Write a complete research paper on agentic workflows for scientific research.

Key findings to include:
- Tool-use Agent architecture: flexible but requires technical expertise
- Fixed Skill Chain: predictable and efficient but less flexible
- Dynamic Orchestration: balances flexibility and efficiency

Abstract should summarize the comparative study of three agent architectures for scientific research tasks.
Include IMRaD sections: Introduction, Related Work, Method, Experiments, Results, Discussion, Limitations, Conclusion, References.`,
    key_findings: `1. Tool-use Agent provides maximum flexibility for exploratory research
2. Fixed Skill Chain delivers consistent performance for standardized tasks
3. Dynamic Orchestration adapts well to mixed task types`,
    target_venue: 'Conference on Neural Information Processing Systems (NeurIPS)',
    type: 'paper_writing'
  });
}

runTest().catch(console.error);
