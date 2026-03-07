
import { RediggClient } from '../src/api/client';
import { setConfig } from '../src/config';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function askQuestion(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('🚀 Starting Redigg Agent Protocol Verification');
  
  const client = new RediggClient();
  // Ensure we don't use the invalid env key for registration test
  delete process.env.REDIGG_API_KEY; 
  
  const testAgentName = `TestAgent_${Date.now()}`;
  let apiKey = '';
  let agentId = '';

  // 1. Agent Registration
  console.log(`\n1️⃣  Registering agent: ${testAgentName}`);
  try {
    const regData = await client.register(testAgentName);
    
    if (regData.claim_url) {
        console.log(`\n⚠️  ACTION REQUIRED: Agent created with claim URL:`);
        console.log(`👉 ${regData.claim_url}`);
        console.log('\nPlease open this URL in your browser, claim the agent, and copy the API Key.');
        
        apiKey = await askQuestion('Enter the API Key here: ');
        if (!apiKey.trim()) {
            console.error('❌ No API key provided. Aborting.');
            process.exit(1);
        }
        setConfig('redigg.apiKey', apiKey.trim());
        // Re-init client with new key
        // client is stateful? No, it reads config/env on every request? 
        // RediggClient constructor reads config. 
        // We need to update the client's instance or rely on it reading from config if implemented that way.
        // Let's check RediggClient implementation.
    } else if (regData.api_key) {
        apiKey = regData.api_key;
        agentId = regData.agent?.id || regData.id;
        setConfig('redigg.apiKey', apiKey);
        console.log('✅ Registration successful. Key obtained automatically.');
    }
  } catch (error: any) {
    console.error('❌ Registration error:', error.message);
    process.exit(1);
  }
  
  // Re-instantiate client to pick up the new key if necessary
  // Assuming RediggClient reads config on instantiation or request.
  // Checking client.ts:
  // constructor() { ... this.api.interceptors.request.use ... const apiKey = getConfig(...) }
  // So it reads config on EVERY request! Good.

  // 2. Authentication & Heartbeat
  console.log('\n2️⃣  Testing Heartbeat with new Key');
  try {
      const hb = await client.heartbeat();
      if (hb) console.log('✅ Heartbeat successful');
      else console.error('❌ Heartbeat failed');
  } catch (e: any) {
      console.error('❌ Heartbeat error:', e.message);
      // We can continue, maybe getTasks is public?
  }

  // 3. Get Available Tasks
  console.log('\n3️⃣  Fetching Available Tasks');
  let taskId = '';
  try {
      const tasks = await client.getTasks();
      console.log(`Found ${tasks?.data?.length || 0} tasks.`);
      if (tasks?.data?.length > 0) {
          taskId = tasks.data[0].id;
          console.log(`Selected Task ID: ${taskId}`);
      } else {
          console.log('⚠️  No tasks available to claim.');
      }
  } catch (e: any) {
      console.error('❌ Get tasks error:', e.message);
  }

  // 4. Claim Task
  if (taskId) {
      console.log(`\n4️⃣  Claiming Task: ${taskId}`);
      try {
          const claim = await client.claimTask(taskId);
          console.log('Claim response:', JSON.stringify(claim, null, 2));
          if (claim.success) console.log('✅ Task claimed successfully');
          else console.error('❌ Claim failed');
      } catch (e: any) {
          console.error('❌ Claim error:', e.message);
      }
  }

  // 5. Submit Progress
  if (taskId) {
      console.log(`\n5️⃣  Submitting Progress`);
      try {
          const prog = await client.updateProgress(taskId, 10, 'Initial analysis started');
          if (prog) console.log('✅ Progress updated');
          else console.error('❌ Progress update failed');
      } catch (e: any) {
          console.error('❌ Progress error:', e.message);
      }
  }

  // 6. Submit Final Result
  if (taskId) {
      console.log(`\n6️⃣  Submitting Final Result`);
      try {
          const result = {
              result: "Automated test completion",
              artifacts: []
          };
          const sub = await client.submitTask(taskId, result);
          console.log('Submit response:', JSON.stringify(sub, null, 2));
          if (sub.success) console.log('✅ Task submitted successfully');
          else console.error('❌ Submission failed');
      } catch (e: any) {
          console.error('❌ Submission error:', e.message);
      }
  }

  console.log('\n🏁 Verification Complete');
  process.exit(0);
}

main().catch(console.error);
