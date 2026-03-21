import { Skill, SkillContext, SkillParams, SkillResult } from '../../../types.js';
import { CronManager } from '../../../../scheduling/CronManager.js';
import { SkillManager } from '../../../SkillManager.js';

export default class SchedulingSkill implements Skill {
  id = 'scheduling';
  name = 'Scheduling';
  description = 'Schedule and manage automated tasks (cron)';
  tags = ['system', 'cron', 'tasks'];

  private static cronManager: CronManager | null = null;
  private static skillManager: SkillManager | null = null;

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const operation = params.operation || 'list_tasks';

    // Prioritize context-injected managers, fallback to static (legacy support)
    const cron = ctx.managers?.cron || SchedulingSkill.cronManager;
    const skillMgr = ctx.managers?.skill || SchedulingSkill.skillManager;

    if (!cron) {
        // Last resort fallback
        if (!SchedulingSkill.cronManager) {
             SchedulingSkill.cronManager = new CronManager();
        }
        // return this.execute(ctx, params); // Recursion risk if logic fails
    }
    const finalCron = cron || SchedulingSkill.cronManager; // Should be set by now

    ctx.log('thinking', `Performing scheduling operation: ${operation}`);

    try {
      switch (operation) {
        case 'list_tasks':
          const tasks = finalCron.getAllTasks();
          return { 
              tasks: tasks.map((t: any) => ({ 
                  id: t.id, 
                  name: t.name, 
                  cron: t.cronExpression, 
                  enabled: t.enabled,
                  lastRun: t.lastRun 
              })) 
          };

        case 'schedule_task':
          const name = params.name;
          const cronExp = params.cron;
          const skillId = params.skill;
          const skillParams = params.params || {};

          if (!name || !cronExp || !skillId) throw new Error('Name, cron, and skill are required');
          
          if (!skillMgr) {
               throw new Error('SkillManager not available. Cannot execute scheduled tasks.');
          }

          const task = finalCron.scheduleTask(name, cronExp, async () => {
              console.log(`[ScheduledTask:${name}] Executing skill ${skillId}...`);
              try {
                  await skillMgr.executeSkill(
                      skillId,
                      'scheduled-task', // generic user id for system tasks
                      skillParams,
                      (type: any, content: any) => console.log(`[ScheduledTask:${name}] [${type}] ${content}`)
                  );
              } catch (e) {
                  console.error(`[ScheduledTask:${name}] Failed:`, e);
              }
          });
          
          finalCron.startTask(task.id);
          
          ctx.log('tool_result', `Scheduled task '${name}' (${task.id})`);
          return { success: true, taskId: task.id, message: 'Task scheduled and started.' };

        case 'remove_task':
          const taskId = params.taskId;
          if (!taskId) throw new Error('TaskId is required');
          finalCron.removeTask(taskId);
          ctx.log('tool_result', `Removed task ${taskId}`);
          return { success: true, message: 'Task removed.' };

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      ctx.log('error', `Scheduling operation failed: ${error}`);
      throw error;
    }
  }

  public static setManagers(cron: CronManager, skill: SkillManager) {
      SchedulingSkill.cronManager = cron;
      SchedulingSkill.skillManager = skill;
  }
}
