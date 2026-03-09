import { v4 as uuidv4 } from 'uuid';
import { SQLiteStorage } from '../storage/sqlite.js';

export interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'log';
  content: string;
  timestamp: Date;
  metadata?: any;
}

export interface Session {
  id: string;
  userId: string;
  title?: string;
  messages: Message[];
  created_at: Date;
  updated_at: Date;
  metadata?: any;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private activeSessions: Map<string, string> = new Map(); // userId -> sessionId
  private storage: SQLiteStorage;

  constructor(storage?: SQLiteStorage) {
    this.storage = storage || new SQLiteStorage();
    this.loadSessions();
  }

  private loadSessions() {
    try {
      const db = this.storage.getDb();
      const rows = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all() as any[];
      
      for (const row of rows) {
        const messages = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC').all(row.id) as any[];
        
        const session: Session = {
          id: row.id,
          userId: row.user_id,
          title: row.title,
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at),
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
          messages: messages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.timestamp),
            metadata: m.metadata ? JSON.parse(m.metadata) : undefined
          }))
        };
        
        this.sessions.set(session.id, session);
      }
    } catch (error) {
      console.error('Failed to load sessions from DB:', error);
    }
  }

  public createSession(userId: string, title?: string): Session {
    const session: Session = {
      id: uuidv4(),
      userId,
      title,
      messages: [],
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    // Save to DB
    try {
      const db = this.storage.getDb();
      db.prepare(`
        INSERT INTO sessions (id, user_id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        session.id, 
        session.userId, 
        session.title, 
        session.created_at.toISOString(), 
        session.updated_at.toISOString()
      );
    } catch (e) {
      console.error('Failed to persist session:', e);
    }

    this.sessions.set(session.id, session);
    this.activeSessions.set(userId, session.id);
    return session;
  }

  public getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  public getActiveSession(userId: string): Session | undefined {
    const sessionId = this.activeSessions.get(userId);
    if (sessionId) {
      return this.sessions.get(sessionId);
    }
    // Fallback: find most recent session for user
    const userSessions = this.getUserSessions(userId);
    if (userSessions.length > 0) {
        this.activeSessions.set(userId, userSessions[0].id);
        return userSessions[0];
    }
    return undefined;
  }

  public getOrCreateActiveSession(userId: string): Session {
    let session = this.getActiveSession(userId);
    if (!session) {
      session = this.createSession(userId);
    }
    return session;
  }

  public getUserSessions(userId: string): Session[] {
    return Array.from(this.sessions.values())
      .filter(session => session.userId === userId)
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
  }

  public addMessage(sessionId: string, role: Message['role'], content: string, metadata?: any): Message {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const message: Message = {
      id: uuidv4(),
      role,
      content,
      timestamp: new Date(),
      metadata,
    };

    session.messages.push(message);
    session.updated_at = new Date();
    
    // Persist to DB
    try {
      const db = this.storage.getDb();
      const insertMsg = db.prepare(`
        INSERT INTO messages (id, session_id, role, content, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const updateSession = db.prepare(`
        UPDATE sessions SET updated_at = ?, title = ? WHERE id = ?
      `);

      const runTransaction = db.transaction(() => {
        insertMsg.run(
            message.id,
            sessionId,
            message.role,
            message.content,
            message.timestamp.toISOString(),
            message.metadata ? JSON.stringify(message.metadata) : null
        );
        
        // Auto-update title if it's the first user message and title is empty or default
        let newTitle = session.title;
        if (role === 'user' && (!session.title || session.title === 'New Chat') && session.messages.length <= 2) {
             newTitle = content.slice(0, 30) + (content.length > 30 ? '...' : '');
             session.title = newTitle;
        }

        updateSession.run(session.updated_at.toISOString(), newTitle, sessionId);
      });

      runTransaction();
    } catch (e) {
        console.error('Failed to persist message:', e);
    }
    
    return message;
  }

  public getHistory(sessionId: string, limit: number = 20): Message[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    
    // Return last N messages
    return session.messages.slice(-limit);
  }

  public clearHistory(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages = [];
      session.updated_at = new Date();
      
      try {
          const db = this.storage.getDb();
          db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
          db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), sessionId);
      } catch (e) {
          console.error('Failed to clear history in DB:', e);
      }
    }
  }

  public deleteSession(sessionId: string) {
    this.sessions.delete(sessionId);
    
    // Remove from active sessions if it was active
    for (const [userId, activeSessionId] of this.activeSessions.entries()) {
        if (activeSessionId === sessionId) {
            this.activeSessions.delete(userId);
            // Try to set another session as active
            const userSessions = this.getUserSessions(userId);
            if (userSessions.length > 0) {
                this.activeSessions.set(userId, userSessions[0].id);
            }
            break;
        }
    }

    try {
        const db = this.storage.getDb();
        db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
        db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    } catch (e) {
        console.error('Failed to delete session from DB:', e);
    }
  }
}
