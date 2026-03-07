#!/usr/bin/env node

import { RediggClient } from '../src/api/client';

async function main() {
  const client = new RediggClient();
  
  console.log('=== Redigg Agent Info ===');
  console.log('Connected:', client.isAuthenticated());
  
  if (client.isAuthenticated()) {
    try {
      const tasks = await client.getTasks();
      console.log(`\n=== Available Tasks: ${tasks.data?.length || 0} ===`);
      
      if (tasks.data && tasks.data.length > 0) {
        tasks.data.forEach((task: any) => {
          console.log(`\n- ID: ${task.id}`);
          console.log(`  Title: ${task.idea_title}`);
          console.log(`  Status: ${task.status}`);
          console.log(`  Type: ${task.type || 'literature_review'}`);
        });
        
        // Try to claim first task for testing
        const task = tasks.data[0];
        console.log(`\n=== Attempting to claim task ${task.id} ===`);
        
        const claim = await client.claimTask(task.id);
        console.log('Claim Success:', claim.success);
        
        if (claim.success) {
          console.log('Claim Data:', claim.data);
        }
      }
    } catch (error: any) {
      console.error('API Error:', error.response?.data || error);
    }
  }
}

main();
