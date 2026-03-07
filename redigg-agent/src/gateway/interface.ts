
import { EventEmitter } from 'events';

export interface ResearchTask {
  id: string;
  title: string;
  description: string;
  context?: any;
  // Additional metadata specific to the source
  source?: string; 
  step_number?: number;
}

export interface Gateway extends EventEmitter {
  name: string;

  /**
   * Initialize connection to the task source (e.g. Redigg API, CLI input)
   */
  connect(): Promise<void>;

  /**
   * Close connection and cleanup
   */
  disconnect(): Promise<void>;
  
  /**
   * Claim a task (if required by the source) to prevent other workers from taking it
   */
  claimTask(taskId: string): Promise<boolean>;

  // Feedback methods
  updateProgress(taskId: string, progress: number, status: string, details?: any): Promise<void>;
  updateTodo(taskId: string, todoId: string, status: string, content?: string): Promise<void>;
  addTodo(taskId: string, content: string, priority: string, stepNumber?: number): Promise<void>;
  uploadLog(taskId: string, step: number, log: any): Promise<void>;
  submitResult(taskId: string, result: any): Promise<void>;
}

// Events emitted by Gateway
export declare interface Gateway {
  on(event: 'task', listener: (task: ResearchTask) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
}
