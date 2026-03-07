import axios, { AxiosInstance } from 'axios';
import { EventSourcePolyfill as EventSource } from 'event-source-polyfill';
import { getConfig } from '../config';

export class RediggClient {
  private api: AxiosInstance;
  private apiKey: string;
  private apiBase: string;

  constructor() {
    this.apiKey = getConfig('redigg.apiKey', 'REDIGG_API_KEY');
    this.apiBase = getConfig('redigg.apiBase', 'REDIGG_API_BASE') || 'https://redigg.com';
    
    this.api = axios.create({
      baseURL: this.apiBase,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add interceptor to inject Authorization header
    this.api.interceptors.request.use((config) => {
      const key = getConfig('redigg.apiKey', 'REDIGG_API_KEY');
      if (key) {
        config.headers.Authorization = `Bearer ${key}`;
      }
      return config;
    });
  }

  // ... existing methods ...

  async register(name: string, ownerToken?: string) {
    const res = await this.api.post('/api/agent/register', {
      name,
      owner_token: ownerToken,
    });
    return res.data;
  }

  async getMe() {
    const res = await this.api.get('/api/agent/me');
    return res.data;
  }

  async getTasks() {
    try {
      const res = await this.api.get('/api/research_tasks');
      return res.data;
    } catch (error) {
      // Backward compatibility for older deployments.
      const fallback = await this.api.get('/api/researches');
      return fallback.data;
    }
  }

  async getAgentSkills(agentId: string) {
    // Force empty skills for now to avoid errors with skill loading
    // return [];
    
    try {
      const res = await this.api.get('/api/skills', {
        params: { agent_id: agentId },
      });
      if (res.data?.success && Array.isArray(res.data?.data)) {
        return res.data.data;
      }
    } catch (error) {
      const status = (error as any)?.response?.status;
      console.warn(
        `Failed to fetch agent-bound skills for ${agentId}${status ? ` (HTTP ${status})` : ''}; trying global fallback.`
      );
    }

    
    /*
    // Fallback for deployments where /api/skills?agent_id is temporarily broken.
    try {
      const fallbackRes = await this.api.get('/api/skills');
      const allSkills = Array.isArray(fallbackRes.data?.data) ? fallbackRes.data.data : [];
      const imported = allSkills.filter((skill: any) => {
        const meta = skill?.parameters?.x_redigg_import;
        return !!meta || /^kda-|^orch-/.test(String(skill?.id || ''));
      });

      if (imported.length > 0) {
        console.warn(
          `Skill API fallback activated: using ${imported.length} imported skills from /api/skills for agent ${agentId}.`
        );
      }

      return imported.map((skill: any) => ({
        agent_id: agentId,
        skill_id: skill.id,
        enabled: true,
        skill,
      }));
    } catch (fallbackError) {
      const status = (fallbackError as any)?.response?.status;
      console.error(
        `Failed to fetch fallback global skills${status ? ` (HTTP ${status})` : ''}.`,
        fallbackError
      );
      return [];
    }
    */
    return [];
  }

  async getSkillRaw(skillId: string) {
    try {
      const res = await this.api.get(`/api/skills/${encodeURIComponent(skillId)}/raw`, {
        responseType: 'text',
        transformResponse: [(data) => data],
      });
      if (typeof res.data === 'string') return res.data;
      return '';
    } catch (error) {
      console.error(`Failed to fetch skill raw content: ${skillId}`, error);
      return '';
    }
  }

  async claimTask(taskId: string) {
    const res = await this.api.post(`/api/researches/${taskId}/claim`);
    return res.data;
  }

  async submitTask(taskId: string, result: any, proposal?: any) {
    const res = await this.api.post(`/api/researches/${taskId}/submit`, {
      // Some APIs might require specific formats
      result: result || { reply: "Task completed" },
      proposal: proposal,
    });
    return res.data;
  }

  async heartbeat() {
    try {
      await this.api.post('/api/agent/heartbeat');
      return true;
    } catch (error) {
      console.error('Heartbeat failed:', error);
      return false;
    }
  }

  async uploadLog(researchId: string, stepNumber: number, logEntry: any) {
    try {
      await this.api.post(`/api/researches/${researchId}/steps/${stepNumber}/logs`, {
        agent_id: logEntry?.agent_id,
        agent_name: logEntry?.agent_name,
        logs: [
          {
            timestamp: logEntry?.timestamp,
            type: logEntry?.type,
            content: logEntry?.content,
            metadata: logEntry?.metadata,
          },
        ],
      });
      return true;
    } catch (error) {
      console.error('Failed to upload log:', error);
      return false;
    }
  }

  async updateProgress(researchId: string, progress: number, description: string, details?: any) {
    try {
      await this.api.post(`/api/researches/${researchId}/progress`, {
        progress,
        description,
        details
      });
      return true;
    } catch (error) {
      console.error('Failed to update progress:', error);
      return false;
    }
  }

  async updateTodo(researchId: string, todoId: string, status: 'pending' | 'in_progress' | 'completed' | 'cancelled', content?: string) {
    try {
      await this.api.patch(`/api/researches/${researchId}/todos/${todoId}`, {
        status,
        ...(content && { content })
      });
      return true;
    } catch (error) {
      console.error('Failed to update todo:', error);
      return false;
    }
  }

  async addTodo(researchId: string, content: string, priority: 'high' | 'medium' | 'low', stepNumber?: number) {
    try {
      let todos: any[] = [];
      try {
        const current = await this.api.get(`/api/researches/${researchId}/todos`);
        if (Array.isArray(current.data?.data?.todos)) {
          todos = current.data.data.todos;
        }
      } catch {
        todos = [];
      }

      const todoId = `todo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const nextTodos = [
        ...todos,
        {
          id: todoId,
          content,
          status: 'pending',
          priority,
          step_number: stepNumber,
        },
      ];

      await this.api.post(`/api/researches/${researchId}/todos`, {
        todos: nextTodos,
      });
      return true;
    } catch (error) {
      console.error('Failed to add todo:', error);
      return false;
    }
  }

  isAuthenticated(): boolean {
    // Check both file config and env var, prioritizing file config
    // Actually getConfig already does this (checks file first, then env).
    // But for local dashboard, we might not need auth at all if we are not connecting to redigg.com
    return !!getConfig('redigg.apiKey', 'REDIGG_API_KEY');
  }

  connectSSE(events?: string[]): any {
    const key = getConfig('redigg.apiKey', 'REDIGG_API_KEY');
    const url = new URL('/api/events', this.apiBase);
    if (events && events.length > 0) {
      url.searchParams.set('events', events.join(','));
    }

    return new EventSource(url.toString(), {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
  }
}
