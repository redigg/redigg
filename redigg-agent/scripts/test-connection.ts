#!/usr/bin/env node
import { RediggClient } from '../src/api/client';

async function testAPI() {
  const client = new RediggClient();
  
  console.log('=== Redigg API Test ===');
  
  try {
    console.log('1. Testing connection...');
    const tasks = await client.getTasks();
    console.log('✓ Connection successful');
    console.log(`Tasks: ${tasks.data?.length || 0}`);
    
    if (tasks.data && tasks.data.length > 0) {
      console.log('\n=== Tasks ===');
      tasks.data.forEach((task: any, index: number) => {
        console.log(`${index + 1}. ${task.idea_title}`);
        console.log(`   Status: ${task.status}`);
        console.log(`   Created: ${task.created_at}`);
      });
    }
  } catch (error: any) {
    console.error('✗ Connection failed');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Message: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`Error: ${error}`);
    }
  }
}

testAPI().catch((error) => {
  console.error('Error running test:', error);
  process.exit(1);
});
