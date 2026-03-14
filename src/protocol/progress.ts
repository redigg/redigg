export type AgentProgressEventType =
  | 'token'
  | 'thinking'
  | 'log'
  | 'plan'
  | 'todo'
  | 'stats'
  | 'session_title'
  | 'done'
  | 'error';

export type AgentProgressHandler = (type: AgentProgressEventType, content: any) => void;

