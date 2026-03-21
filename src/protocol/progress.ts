export type AgentProgressEventType =
  | 'token'
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'log'
  | 'segment'
  | 'plan'
  | 'todo'
  | 'stats'
  | 'session_title'
  | 'done'
  | 'error';

export type AgentProgressHandler = (type: AgentProgressEventType, content: any) => void;
