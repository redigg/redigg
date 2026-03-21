import { LLMClient } from '../llm/LLMClient.js';
import { MemoryManager } from '../memory/MemoryManager.js';

export interface SkillContext {
  llm: LLMClient;
  memory: MemoryManager;
  workspace: string; // Working directory path
  userId: string;
  agentId?: string;
  
  // System Managers (Optional, injected by the runtime environment)
  managers?: {
    skill?: any; // Avoiding circular dependency with SkillManager
    cron?: any; // Avoiding circular dependency with CronManager
    session?: any; // Avoiding circular dependency with SessionManager
    agent?: any; // Avoiding circular dependency with SubAgentManager
    browser?: any; // Avoiding circular dependency with BrowserManager
    event?: any; // Avoiding circular dependency with EventManager
  };

  // Logging function
  log: (type: 'thinking' | 'action' | 'tool_call' | 'tool_result' | 'result' | 'error', 
        content: string, 
        metadata?: any) => void;
  
  // Progress update function
  updateProgress?: (progress: number, description: string, details?: any) => Promise<void>;
  
  // Todo management functions
  updateTodo?: (todoId: string, status: 'pending' | 'in_progress' | 'completed' | 'cancelled', content?: string) => Promise<void>;
  addTodo?: (content: string, priority: 'high' | 'medium' | 'low', step_number?: number) => Promise<void>;
}

export interface SkillParams {
  [key: string]: any;
}

export interface SkillResult {
  [key: string]: any;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  parameters?: any;
  readme?: string; // Raw markdown content from SKILL.md
  execute: (ctx: SkillContext, params: SkillParams) => Promise<SkillResult>;
}

export interface SkillPack {
  id: string;
  name: string;
  description: string;
  skills: Skill[];
  path?: string; // Path to the pack directory
}
