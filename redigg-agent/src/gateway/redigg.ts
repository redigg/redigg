
import { Gateway, ResearchTask } from './interface';
import { EventEmitter } from 'events';
import { RediggClient } from '../api/client';
import { getConfig } from '../config';

export class RediggGateway extends EventEmitter implements Gateway {
  public name = 'redigg';
  private client: RediggClient;
  private running: boolean = false;
  private pollInterval: number = 5000;
  private sseConnection: any = null;

  constructor() {
    super();
    this.client = new RediggClient();
  }

  async connect(): Promise<void> {
    if (!this.client.isAuthenticated()) {
      throw new Error('Not authenticated. Please run "redigg login" first.');
    }
    
    this.running = true;
    this.setupSSE();
    this.startPolling();
  }

  async disconnect(): Promise<void> {
    this.running = false;
    if (this.sseConnection) {
      this.sseConnection.close();
      this.sseConnection = null;
    }
  }

  async claimTask(taskId: string): Promise<boolean> {
    try {
      const res = await this.client.claimTask(taskId);
      return res.success;
    } catch (e) {
      console.error(`Failed to claim task ${taskId}`, e);
      return false;
    }
  }

  async updateProgress(taskId: string, progress: number, status: string, details?: any): Promise<void> {
    await this.client.updateProgress(taskId, progress, status, details);
  }

  async updateTodo(taskId: string, todoId: string, status: string, content?: string): Promise<void> {
    // status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
    await this.client.updateTodo(taskId, todoId, status as any, content);
  }

  async addTodo(taskId: string, content: string, priority: string, stepNumber?: number): Promise<void> {
    // priority: 'high' | 'medium' | 'low'
    await this.client.addTodo(taskId, content, priority as any, stepNumber);
  }

  async uploadLog(taskId: string, step: number, log: any): Promise<void> {
    await this.client.uploadLog(taskId, step, log);
  }

  async submitResult(taskId: string, result: any): Promise<void> {
    const { proposal, ...rest } = result;
    await this.client.submitTask(taskId, rest, proposal);
  }

  private setupSSE() {
    try {
        // RediggClient.connectSSE returns EventSource instance
        const es = this.client.connectSSE(['task.created']);
        this.sseConnection = es;

        es.addEventListener('connected', (e: any) => {
          // console.log('SSE Connected');
        });

        es.addEventListener('task.created', async (e: any) => {
          try {
            const data = JSON.parse(e.data);
            if (data.payload && data.payload.id) {
              await this.processNextTask();
            }
          } catch (err) {
            console.error('Error processing SSE event:', err);
          }
        });

        es.onerror = (err: Event) => {
            // console.error('SSE Error:', err);
        };
    } catch (e) {
        console.error('Failed to setup SSE:', e);
    }
  }

  private async startPolling() {
    while (this.running) {
        try {
            await this.processNextTask();
        } catch (error) {
            console.error('Error in polling loop:', error);
        }
        if (!this.running) break;
        await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
    }
  }

  private async processNextTask() {
    try {
        const tasksWrapper = await this.client.getTasks();
        const tasks = tasksWrapper.data || [];

        if (tasks.length === 0) return;

        const claimableTasks = tasks.filter((task: any) => {
          const status = String(task?.status || '').toLowerCase();
          return !['completed', 'done', 'failed', 'error'].includes(status);
        });

        if (claimableTasks.length === 0) return;

        for (const task of claimableTasks) {
            const researchTask: ResearchTask = {
                id: task.id,
                title: task.idea_title || task.title || 'Untitled',
                description: task.content || task.idea_description || task.description || '',
                context: task,
                source: 'redigg',
                step_number: task.step_number
            };
            
            this.emit('task', researchTask);
        }
    } catch (e) {
        console.error('Failed to fetch tasks:', e);
    }
  }
}
