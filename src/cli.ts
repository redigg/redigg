import { createInterface } from 'readline';
import { MemoryManager } from './memory/MemoryManager.js';
import { SQLiteStorage } from './storage/sqlite.js';
import { ResearchAgent } from './agent/ResearchAgent.js';
import { MemoryEvolutionSystem } from './memory/evolution/MemoryEvolutionSystem.js';
import { MockLLMClient, LLMClient, LLMResponse } from './llm/LLMClient.js';
import chalk from 'chalk';
import ora from 'ora';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config({ override: true });

// Real OpenAI Client
class OpenAIClient implements LLMClient {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, baseURL?: string, model?: string) {
    this.openai = new OpenAI({ 
      apiKey,
      baseURL: baseURL || 'https://api.openai.com/v1'
    });
    this.model = model || 'gpt-3.5-turbo';
  }

  async complete(prompt: string): Promise<LLMResponse> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
    });
    return { content: response.choices[0].message.content || '' };
  }

  async chat(messages: { role: string; content: string }[]): Promise<LLMResponse> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: messages as any,
    });
    return { content: response.choices[0].message.content || '' };
  }
}
// Extended Mock LLM for CLI Demo
class DemoLLMClient extends MockLLMClient {
  async chat(messages: { role: string; content: string }[]): Promise<LLMResponse> {
    const lastMsg = messages[messages.length - 1].content;
    const systemMsg = messages.find(m => m.role === 'system')?.content || '';

    // Simulate Memory Extraction based on keywords
    if (systemMsg.includes('You are a memory extraction system')) {
      const userMsgLower = lastMsg.toLowerCase();
      const memories = [];
      
      if (userMsgLower.includes('my name is')) {
        const name = lastMsg.split('is')[1].trim();
        memories.push({ type: 'fact', content: `User's name is ${name}` });
      }
      if (userMsgLower.includes('interested in')) {
        const interest = lastMsg.split('in')[1].trim();
        memories.push({ type: 'preference', content: `User is interested in ${interest}` });
      }
      if (userMsgLower.includes('read paper')) {
        const title = lastMsg.split('paper')[1].trim();
        memories.push({ 
          type: 'paper', 
          content: `Paper: ${title}`,
          metadata: { title, authors: ['Unknown'], summary: 'Extracted from demo chat' }
        });
      }

      return { content: JSON.stringify({ memories }) };
    }

    // Simulate Agent Response
    if (systemMsg.includes('User Context & Preferences')) {
        let reply = `I received your message: "${lastMsg}".`;
        
        // Check if context influenced the response
        if (systemMsg.includes('User\'s name is')) {
            const nameMatch = systemMsg.match(/User's name is (.*?)( \(|$)/);
            if (nameMatch) {
                reply = `Hello ${nameMatch[1]}! ${reply}`;
            }
        }
        
        if (systemMsg.includes('User is interested in')) {
            const interestMatch = systemMsg.match(/User is interested in (.*?)( \(|$)/);
            if (interestMatch) {
                reply += ` I see you are still working on ${interestMatch[1]}.`;
            }
        }
        
        if (systemMsg.includes('Paper:')) {
             reply += ` I've noted that paper in your library.`;
        }

        return { content: reply };
    }

    return { content: 'Mock response' };
  }
}

async function main() {
  console.log(chalk.green.bold('🦎 Redigg CLI - Autonomous Research Agent'));
  console.log(chalk.gray('Initializing system...'));

  const storage = new SQLiteStorage();
  const memoryManager = new MemoryManager(storage);

  let llm: LLMClient;
  if (process.env.OPENAI_API_KEY) {
    console.log(chalk.blue('Using Real OpenAI API'));
    console.log(chalk.gray(`Base URL: ${process.env.OPENAI_BASE_URL || 'Default'}`));
    console.log(chalk.gray(`Model: ${process.env.OPENAI_MODEL || 'Default'}`));
    
    llm = new OpenAIClient(
      process.env.OPENAI_API_KEY!,
      process.env.OPENAI_BASE_URL,
      process.env.OPENAI_MODEL
    );
  } else {
    console.log(chalk.yellow('Using Mock LLM (Demo Mode)'));
    llm = new DemoLLMClient();
  }

  const memoryEvo = new MemoryEvolutionSystem(memoryManager, llm);
  const agent = new ResearchAgent(memoryManager, memoryEvo, llm);

  const userId = 'cli-user';

  // Support one-shot execution from command line arguments
  if (process.argv.length > 2) {
    const input = process.argv.slice(2).join(' ');
    console.log(chalk.cyan(`\nYou: ${input}`));
    try {
      const spinner = ora('Thinking...').start();
      const response = await agent.chat(userId, input, (type, content) => {
        if (type === 'log') {
          spinner.text = content.toString();
        }
      });
      spinner.stop();
      console.log(chalk.green('Agent:'), response);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
    }
    storage.close();
    return;
  }

  console.log(chalk.blue('System ready! Type "exit" to quit.'));
  console.log(chalk.yellow('Try saying: "My name is Alice" or "I am interested in cancer research"'));

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = () => {
    rl.question(chalk.cyan('\nYou: '), async (input) => {
      const lower = input.toLowerCase().trim();
      
      if (lower === 'exit') {
        rl.close();
        storage.close();
        return;
      }
      
      if (lower === '/memories') {
        const memories = await memoryManager.getUserMemories(userId);
        console.log(chalk.yellow('\n=== Your Memories ==='));
        memories.forEach(m => console.log(`[${m.type}] ${m.content}`));
        setTimeout(ask, 100); // Small delay to prevent input overlap
        return;
      }
      
      if (lower === '/papers') {
        const papers = await memoryManager.getUserMemories(userId, 'paper');
        console.log(chalk.yellow('\n=== Your Papers ==='));
        papers.forEach(p => {
          const meta = p.metadata || {};
          console.log(`- ${meta.title || p.content} (URL: ${meta.url || 'N/A'})`);
        });
        setTimeout(ask, 100);
        return;
      }

      try {
        const spinner = ora('Thinking...').start();
        const response = await agent.chat(userId, input, (type, content) => {
          if (type === 'log') {
            spinner.text = content.toString();
          }
        });
        spinner.stop();
        console.log(chalk.green('Agent:'), response);
      } catch (error) {
        console.error(chalk.red('Error:'), error);
      }
      
      // Wait a bit for async memory evolution logs to appear
      setTimeout(ask, 1000);
    });
  };

  ask();
}

main().catch(console.error);
