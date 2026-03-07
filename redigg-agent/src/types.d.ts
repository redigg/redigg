declare module 'event-source-polyfill' {
  export class EventSourcePolyfill {
    constructor(url: string, eventSourceInitDict?: any);
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    onerror: (event: Event) => void;
    onmessage: (event: MessageEvent) => void;
    onopen: (event: Event) => void;
    close(): void;
  }
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

export interface Research {
  id: string;
  title: string;
  type: 'survey' | 'benchmark' | 'algorithm_paper' | 'position_paper' | 'reproduction' | 'experiment';
  conference?: string;
  workspaceId?: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Version {
  id: string;
  researchId: string;
  version: string;
  context: Record<string, any>;
  description: string;
  createdAt: string;
}

export interface Review {
  id: string;
  versionId: string;
  content: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'dismissed';
  actionItems: ActionItem[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActionItem {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  createdAt: string;
  resolvedAt?: string;
}
