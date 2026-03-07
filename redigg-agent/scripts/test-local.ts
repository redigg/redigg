import { AgentRuntime } from '../src/agent/runtime';
import { RediggClient } from '../src/api/client';

// Mock Client to intercept calls
const mockClient = {
  isAuthenticated: () => true,
  heartbeat: async () => true,
  getTasks: async () => ({ data: [] }), // No polling tasks
  claimTask: async (id: string) => ({ success: true }),
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

// Access private method for testing
class TestableRuntime extends AgentRuntime {
  constructor() {
    super();
    (this as any).client = mockClient;
  }

  public async testTask(task: any) {
    console.log(`\n--- Testing Task: ${task.idea_title} [Type: ${task.type || 'auto'}] ---`);
    await (this as any).executeTask(task);
  }
}

async function runTest() {
  const runtime = new TestableRuntime();

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
}

runTest().catch(console.error);
