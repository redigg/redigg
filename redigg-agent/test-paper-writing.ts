#!/usr/bin/env tsx

import { getConfig } from './src/config';
import { LLMProvider } from './src/llm/provider';
import { SkillRegistry } from './src/skills';
import { PaperWritingSkill } from './src/skills';

// 创建一个简单的log函数
function log(type: string, content: string, metadata?: any) {
  console.log(`[${type}] ${content}`);
}

async function main() {
  console.log('Testing PaperWritingSkill...');
  
  // 配置LLM
  const llm = new LLMProvider({
    apiKey: getConfig('openai.apiKey'),
    baseUrl: getConfig('openai.baseUrl'),
    model: getConfig('openai.model')
  });
  
  // 创建skill registry
  const registry = new SkillRegistry();
  registry.register(PaperWritingSkill);
  
  // 创建skill context
  const context = {
    llm,
    workspace: './test-workspace',
    log,
    updateProgress: (progress: number, description: string) => {
      console.log(`[Progress] ${progress}% - ${description}`);
    },
    addTodo: (content: string, priority: string) => {
      console.log(`[Todo] ${priority} - ${content}`);
    }
  };
  
  // 调用PaperWritingSkill
  console.log('Calling PaperWritingSkill...');
  const result = await PaperWritingSkill.execute(context, {
    topic: 'A Survey of Financial AI Agents',
    context: 'Financial AI agents are a rapidly evolving field. We need a comprehensive survey.',
    key_findings: 'Financial AI agents have evolved through four phases: early multi-agent systems, LLM single agents, specialized multi-agent teams, and safety-focused agents.',
    target_venue: 'General scientific journal'
  });
  
  console.log('\n✅ Result:');
  console.log('Manuscript:', result.manuscript ? result.manuscript.substring(0, 500) + '...' : 'N/A');
  console.log('Abstract:', result.abstract);
  console.log('Key Findings:', result.key_findings);
}

main().catch(console.error);
