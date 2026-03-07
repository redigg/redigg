#!/usr/bin/env node
import { RediggClient } from '../src/api/client';
import { LLMProvider } from '../src/llm/provider';
import { SkillRegistry, LiteratureReviewSkill, PeerReviewSkill } from '../src/skills';

async function diagnostic() {
  console.log('=== Redigg Agent Diagnostics ===');
  
  const client = new RediggClient();
  const llm = new LLMProvider();
  const skills = new SkillRegistry();
  
  skills.register(LiteratureReviewSkill);
  skills.register(PeerReviewSkill);
  
  try {
    // Test configuration
    console.log('=== Configuration ===');
    console.log('Connected:', client.isAuthenticated());
    
    if (!client.isAuthenticated()) {
      console.error('❌ Not authenticated. Please run:');
      console.error('   redigg login <YOUR_API_KEY>');
      console.error('or');
      console.error('   redigg register <AGENT_NAME>');
      process.exit(1);
    }
    
    console.log('✅ Authenticated');
    
    // Test skills
    console.log('\n=== Skills ===');
    const registeredSkills = skills.list();
    console.log(`Registered: ${registeredSkills.length}`);
    
    if (registeredSkills.length > 0) {
      registeredSkills.forEach((skill: any, index: number) => {
        console.log(`${index + 1}. ${skill.name}: ${skill.description}`);
      });
    } else {
      console.error('❌ No skills registered');
    }
    
    // Test API
    console.log('\n=== API ===');
    try {
      const tasks = await client.getTasks();
      console.log(`Tasks: ${tasks.data?.length || 0}`);
      if (tasks.data && tasks.data.length > 0) {
        tasks.data.forEach((task: any, index: number) => {
          console.log(`${index + 1}. ${task.idea_title} (${task.status})`);
        });
      }
    } catch (error: any) {
      console.error(`❌ Tasks API: ${error.response?.status || error}`);
    }
    
    console.log('\n=== LLM Provider ===');
    const providerKeys = Object.getOwnPropertyNames(llm);
    const hasConfig = providerKeys.some(key => 
      llm[key as keyof LLMProvider] && 
      typeof llm[key as keyof LLMProvider] === 'string'
    );
    
    if (hasConfig) {
      console.log('✅ Configured');
    } else {
      console.error('❌ Not configured');
    }
    
    console.log('\n✅ Diagnostics complete');
    console.log('Use "redigg start" to run the agent');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

diagnostic().catch((error) => {
  console.error('Error running diagnostics:', error);
  process.exit(1);
});
