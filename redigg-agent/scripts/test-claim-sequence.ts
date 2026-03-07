#!/usr/bin/env node
import { RediggClient } from '../src/api/client';

async function testClaimSequence() {
  const client = new RediggClient();
  
  try {
    console.log('=== Step 1: Get Tasks ===');
    const tasks = await client.getTasks();
    console.log('Tasks:', tasks);
    
    if (tasks.data && tasks.data.length > 0) {
      const task = tasks.data[0];
      console.log(`\n=== Step 2: Claim Task ${task.id} ===`);
      
      const claim = await client.claimTask(task.id);
      console.log('Claim:', claim);
      
      if (claim.success) {
        console.log(`\n=== Step 3: Submit Test Result ===`);
        const result = {
          reply: "This is a test reply from Trae AI",
          status: "completed",
          content: "Test content"
        };
        
        const submit = await client.submitTask(task.id, result);
        console.log('Submit:', submit);
      }
    }
  } catch (error: any) {
    console.error('=== Error ===');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else {
      console.error(error);
    }
  }
}

testClaimSequence();
