import { EventEmitter } from 'eventemitter3';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('EventManager');

export type EventType = 
    | 'agent:start' 
    | 'agent:stop' 
    | 'agent:idle'
    | 'memory:added'
    | 'memory:updated'
    | 'memory:deleted'
    | 'command:executed'
    | 'skill:executed';

export interface EventPayloads {
    'agent:start': { userId: string };
    'agent:stop': { userId: string };
    'agent:idle': { userId: string };
    'memory:added': { id: string, content: string, type: string };
    'memory:updated': { id: string, content: string };
    'memory:deleted': { id: string };
    'command:executed': { command: string, result: any };
    'skill:executed': { skillId: string, result: any };
}

export class EventManager {
    private emitter: EventEmitter;

    constructor() {
        this.emitter = new EventEmitter();
    }

    public on<K extends keyof EventPayloads>(event: K, listener: (payload: EventPayloads[K]) => void): void {
        this.emitter.on(event, listener);
    }

    public off<K extends keyof EventPayloads>(event: K, listener: (payload: EventPayloads[K]) => void): void {
        this.emitter.off(event, listener);
    }

    public emit<K extends keyof EventPayloads>(event: K, payload: EventPayloads[K]): void {
        logger.debug(`Event emitted: ${event}`, payload);
        this.emitter.emit(event, payload);
    }
}
