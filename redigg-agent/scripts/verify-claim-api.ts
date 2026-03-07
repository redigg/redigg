#!/usr/bin/env node
import { RediggClient } from '../src/api/client';

async function main() {
  const client = new RediggClient();
  
  console.log('=== API Endpoint Verification ===');
  
  try {
    console.log('1. GET /api/agent/tasks');
    const tasks = await client.getTasks();
    console.log(`   Success: ${tasks.success}`);
    console.log(`   Tasks: ${tasks.data?.length || 0}`);
    
    if (tasks.data && tasks.data.length > 0) {
      const task = tasks.data[0];
      
      console.log(`\n2. GET /api/agent/tasks/${task.id}`);
      // Note: API doesn't expose single task endpoint, but we can check claim response
      
      console.log(`\n3. POST /api/agent/tasks/${task.id}/claim`);
      const claim = await client.claimTask(task.id);
      console.log(`   Success: ${claim.success}`);
      
      if (claim.success) {
        console.log(`   Data:`, claim);
        // You might want to check if claim includes any task info here
      }
    }
  } catch (error: any) {
    console.error('Error:', error.response?.data || error);
  }
}

main();
