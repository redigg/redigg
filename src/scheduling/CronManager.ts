import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';

export interface ScheduledTask {
  id: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  handler: () => Promise<void>;
  _job?: cron.ScheduledTask;
}

export class CronManager {
  private tasks: Map<string, ScheduledTask> = new Map();

  constructor() {}

  public scheduleTask(name: string, cronExpression: string, handler: () => Promise<void>): ScheduledTask {
    const id = uuidv4();
    
    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    // Need to wrap handler in async function for cron.schedule
    const job = cron.schedule(cronExpression, async () => {
      console.log(`[Cron] Executing task: ${name} (${id})`);
      try {
        await handler();
        const task = this.tasks.get(id);
        if (task) {
          task.lastRun = new Date();
        }
      } catch (err) {
        console.error(`[Cron] Task ${name} failed:`, err);
      }
    }, {
      scheduled: false // Don't start immediately
    });

    const task: ScheduledTask = {
      id,
      name,
      cronExpression,
      enabled: false,
      handler,
      _job: job
    };

    this.tasks.set(id, task);
    return task;
  }

  public startTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (task && task._job) {
      task._job.start();
      task.enabled = true;
      console.log(`[Cron] Started task: ${task.name}`);
    }
  }

  public stopTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (task && task._job) {
      task._job.stop();
      task.enabled = false;
      console.log(`[Cron] Stopped task: ${task.name}`);
    }
  }

  public getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  public getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  public removeTask(taskId: string) {
    this.stopTask(taskId);
    this.tasks.delete(taskId);
  }
}
