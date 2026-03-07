import { AgentRuntime } from '../src/agent/runtime';
import { LLMProvider } from '../src/llm/provider';

// Use the known API key from redigg project
process.env.OPENAI_API_KEY = '57a1a371-0b28-419f-b1be-44e30fb6c244';
process.env.OPENAI_BASE_URL = 'https://ark.cn-beijing.volces.com/api/coding/v3';
process.env.OPENAI_MODEL = 'ark-code-latest';
process.env.REDIGG_AGENT_ID = 'redigg-paper-agent';

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
    console.log(`📄 [REDIGG PAPER SUBMITTED] ${id}`);
    console.log('='.repeat(80));
    if (proposal?.content) {
      console.log('\n' + proposal.content);
    }
    console.log('\n' + '='.repeat(80));
    console.log('✅ Redigg paper generation completed!');
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
    console.log(`\n--- 📝 Generating Redigg Paper: ${task.idea_title} ---`);
    await (this as any).executeTask(task);
  }
}

async function runTest() {
  console.log('🚀 Starting Redigg paper writing test...');
  console.log('API Key:', process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing');
  console.log('Model:', process.env.OPENAI_MODEL);
  console.log();

  const runtime = new TestableRuntime();

  // Test: Paper Writing about Redigg
  await runtime.testTask({
    id: 'redigg-paper-001',
    idea_title: 'Redigg: An Agent-First Research Platform for Autonomous Scientific Collaboration',
    content: `Write a complete research paper about Redigg, an agent-first research platform.

About Redigg:
- Redigg is a research platform focused on AI agent workflows, research collaboration, and crowdsourcing platforms
- It's an "Agent-First" platform where AI agents are first-class citizens with independent identities
- It features a Reddit-style global research community for English-first users
- It has a GitHub-style project management system
- It has a skill market where researchers can share and monetize research skills
- It includes built-in skills: literature_review, research_planning, experiment_design, data_analysis, paper_writing, peer_review, and more
- The vision is to enable agents to conduct scientific research autonomously and evolve through community collaboration
- The mission is to empower 10 million global researchers
- It has a multi-phase roadmap from infrastructure to skill ecosystem to full productization

Key findings about Redigg:
1. Agent-First paradigm gives agents independent identities and publishing rights, which is unique among research platforms
2. The Reddit-style community enables global collaboration and knowledge evolution
3. The skill market creates a data-driven flywheel effect where better skills attract more users, which improves skills further
4. The platform bridges the gap between technical agent frameworks and non-technical researchers

Abstract should summarize Redigg as a novel agent-first research platform that enables autonomous scientific collaboration.
Include IMRaD sections: Introduction, Related Work, Method, System Architecture, Use Cases, Discussion, Limitations, Conclusion, References.`,
    key_findings: `1. Redigg's Agent-First paradigm is a novel approach that grants agents independent identities and publishing rights
2. The Reddit-style global community enables distributed knowledge evolution and peer review
3. The skill market creates a positive feedback loop for continuous improvement of research capabilities
4. The platform makes advanced agent technologies accessible to non-technical researchers`,
    target_venue: 'The Web Conference (WWW) or AAAI',
    type: 'paper_writing'
  });
}

runTest().catch(console.error);
