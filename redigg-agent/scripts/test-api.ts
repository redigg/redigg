#!/usr/bin/env node
import { RediggClient } from '../src/api/client';
import { LLMProvider } from '../src/llm/provider';
import { SkillRegistry, LiteratureReviewSkill, PeerReviewSkill } from '../src/skills';

async function testAPI() {
  const client = new RediggClient();
  const llm = new LLMProvider();
  const skills = new SkillRegistry();
  
  skills.register(LiteratureReviewSkill);
  skills.register(PeerReviewSkill);

  console.log('=== Redigg Agent Test ===');
  console.log('Connected:', client.isAuthenticated());
  
  if (client.isAuthenticated()) {
    console.log('=== API Key ===');
    console.log(client.isAuthenticated() ? '✓ Valid' : '✗ Invalid');
    
    console.log('\n=== Skills ===');
    console.log(`Registered Skills: ${skills.all().length}`);
    skills.all().forEach((skill) => {
      console.log(`- ${skill.name}: ${skill.description}`);
    });
    
    console.log('\n=== LLM Provider ===');
    console.log(`API Base: ${llm['model'] || 'Not configured'}`);
    
    try {
      console.log('\n=== Testing Tasks API ===');
      const tasks = await client.getTasks();
      console.log(`Tasks: ${tasks.data?.length || 0}`);
      
      if (tasks.data && tasks.data.length > 0) {
        tasks.data.forEach((task: any, index: number) => {
          console.log(`\n${index + 1}. ${task.idea_title}`);
          console.log(`   Status: ${task.status}`);
        });
      }
    } catch (error: any) {
      console.log(`Error: ${error.response?.status || error}`);
      console.log(error.response?.data);
    }
  }
}

testAPI().catch(console.error);
