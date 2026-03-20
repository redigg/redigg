export type AgentProgressEventType =
  | 'token'
  | 'thinking'
  | 'log'
  | 'segment'
  | 'plan'
  | 'todo'
  | 'stats'
  | 'session_title'
  | 'done'
  | 'error';

export type AgentProgressHandler = (type: AgentProgressEventType, content: any) => void;
