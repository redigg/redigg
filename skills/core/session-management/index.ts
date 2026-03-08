import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';
import { SessionManager } from '../../../src/session/SessionManager.js';

export default class SessionSkill implements Skill {
  id = 'session_management';
  name = 'Session Management';
  description = 'Manage chat sessions and history';
  tags = ['system', 'session', 'history'];

  private static manager: SessionManager | null = null;

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const operation = params.operation || 'get_history';
    
    // Prioritize context-injected manager, fallback to static (legacy support)
    const manager = ctx.managers?.session || SessionSkill.manager || new SessionManager();
    
    // We need to know the current session context.
    const userId = ctx.userId;
    let sessionId = params.sessionId;

    // Resolve session
    if (!sessionId) {
        // Use the manager instance we resolved
        const session = manager.getOrCreateActiveSession(userId);
        sessionId = session.id;
    }

    ctx.log('thinking', `Performing session operation: ${operation} for session ${sessionId}`);

    try {
      switch (operation) {
        case 'list_sessions':
           const activeSession = manager.getActiveSession(userId);
           return { 
               sessions: activeSession ? [{ id: activeSession.id, created: activeSession.created_at }] : [] 
           };

        case 'get_history':
          const limit = params.limit || 10;
          const history = manager.getHistory(sessionId, limit);
          return { 
              sessionId,
              history: history.map(m => ({ role: m.role, content: m.content, time: m.timestamp })) 
          };

        case 'clear_history':
          manager.clearHistory(sessionId);
          ctx.log('tool_result', `Cleared history for session ${sessionId}`);
          return { success: true, message: 'Session history cleared.' };

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      ctx.log('error', `Session operation failed: ${error}`);
      throw error;
    }
  }
  
  // Helper to inject manager (called by Agent)
  public static setManager(manager: SessionManager) {
      SessionSkill.manager = manager;
  }
}
