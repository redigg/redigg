import { v4 as uuidv4 } from 'uuid';
import { SQLiteStorage } from '../storage/sqlite.js';

export interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'log' | 'plan' | 'todo' | 'stats' | 'session_title' | 'error';
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
  status: 'active' | 'running' | 'stopped';
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

  public appendEvent(sessionId: string, type: string, content: any): number {
    const db = this.storage.getDb();
    const payload = content === undefined ? null : JSON.stringify(content);
    const result = db.prepare(`
      INSERT INTO session_events (session_id, type, content)
      VALUES (?, ?, ?)
    `).run(sessionId, type, payload);

    const id = Number(result.lastInsertRowid);
    const keep = 5000;
    db.prepare(`
      DELETE FROM session_events
      WHERE session_id = ?
        AND id < (
          SELECT id FROM session_events
          WHERE session_id = ?
          ORDER BY id DESC
          LIMIT 1 OFFSET ?
        )
    `).run(sessionId, sessionId, keep);

    return id;
  }

  public getEventsSince(sessionId: string, afterId: number, limit: number = 1000): Array<{ id: number; type: string; content: any }> {
    const db = this.storage.getDb();
    const rows = db.prepare(`
      SELECT id, type, content
      FROM session_events
      WHERE session_id = ? AND id > ?
      ORDER BY id ASC
      LIMIT ?
    `).all(sessionId, afterId, limit) as any[];

    return rows.map((row) => ({
      id: Number(row.id),
      type: String(row.type),
      content: row.content ? JSON.parse(row.content) : undefined
    }));
  }

  private loadSessions() {
    try {
      const db = this.storage.getDb();
      const rows = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all() as any[];
      
      for (const row of rows) {
        const messages = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC').all(row.id) as any[];
        
        const meta = row.metadata ? JSON.parse(row.metadata) : {};

        const session: Session = {
          id: row.id,
          userId: row.user_id,
          title: row.title,
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at),
          status: meta.status || row.status || 'active',
          metadata: meta,
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
      title: title || 'New Chat',
      messages: [],
      created_at: new Date(),
      updated_at: new Date(),
      status: 'active',
    };
    
    // Save to DB
    try {
      const db = this.storage.getDb();
      // Ensure status column exists or add migration (assuming it might not exist yet, but for now let's just use metadata or assume column added)
      // Since I can't easily migrate DB schema here without more context, I'll store status in metadata for persistence if column doesn't exist
      // But user asked to persist it. Let's try to add it to SQL.
      // If SQL fails, we catch error.
      
      // Actually, let's just use metadata for 'status' to avoid schema migration issues for now if possible?
      // No, let's try to use a proper field if I could, but `metadata` is safer for now.
      // Wait, `Session` interface has `status`.
      // Let's modify `loadSessions` to read from metadata if column missing?
      // Or just assume I can add column?
      // Given I am an agent, I should probably stick to `metadata` for `status` if I can't guarantee schema change.
      // BUT, I already modified the interface.
      
      // Let's check if I can modify the table.
      // The `SQLiteStorage` likely initializes the table.
      // I don't see `SQLiteStorage` code.
      
      // Let's assume I can store it in metadata for persistence, but keep it as a first-class property in memory.
      // Or I can add a quick migration in `createSession` or `constructor`.
      
      // Let's just update the INSERT to include status if the column exists, or fallback.
      // Actually, safest bet is to store it in `metadata` in DB, but expose as `status` in object.
      
      // Reverting the SQL change idea. Let's store in metadata for DB persistence.
      const metadata = { status: 'active' };
      
      db.prepare(`
        INSERT INTO sessions (id, user_id, title, created_at, updated_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        session.id, 
        session.userId, 
        session.title, 
        session.created_at.toISOString(), 
        session.updated_at.toISOString(),
        JSON.stringify(metadata)
      );
      this.sessions.set(session.id, session);
      this.activeSessions.set(userId, session.id);
    } catch (e) {
      console.error('Failed to persist session:', e);
    }

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
        const result = insertMsg.run(
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

  public deleteAllSessions(userId: string): { deleted: number; sessionIds: string[] } {
    const sessionIds = this.getUserSessions(userId).map(s => s.id);
    const deleted = sessionIds.length;

    if (deleted === 0) {
      return { deleted: 0, sessionIds: [] };
    }

    for (const id of sessionIds) {
      this.sessions.delete(id);
    }
    this.activeSessions.delete(userId);

    try {
      const db = this.storage.getDb();
      const tx = db.transaction(() => {
        db.prepare('DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)').run(userId);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
      });
      tx();
    } catch (e) {
      console.error('Failed to delete all sessions from DB:', e);
    }

    return { deleted, sessionIds };
  }

  public stopSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'stopped';
      session.updated_at = new Date();
      
      // Update DB
      try {
          const db = this.storage.getDb();
          const metadata = { ...session.metadata, status: 'stopped' };
          session.metadata = metadata;
          
          db.prepare('UPDATE sessions SET updated_at = ?, metadata = ? WHERE id = ?')
            .run(session.updated_at.toISOString(), JSON.stringify(metadata), sessionId);
      } catch (e) {
          console.error('Failed to stop session:', e);
      }
    }
  }

  public setSessionStatus(sessionId: string, status: Session['status']) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      session.updated_at = new Date();
      
      // Update DB
      try {
          const db = this.storage.getDb();
          const metadata = { ...session.metadata, status };
          session.metadata = metadata;
          
          db.prepare('UPDATE sessions SET updated_at = ?, metadata = ? WHERE id = ?')
            .run(session.updated_at.toISOString(), JSON.stringify(metadata), sessionId);
      } catch (e) {
          console.error('Failed to set session status:', e);
      }
    }
  }

  public isSessionStopped(sessionId: string): boolean {
      const session = this.sessions.get(sessionId);
      return session ? session.status === 'stopped' : false;
  }

  public activateSession(sessionId: string) {
      const session = this.sessions.get(sessionId);
      if (session) {
          session.status = 'active';
          // Persist if needed
          try {
              const db = this.storage.getDb();
              const metadata = { ...session.metadata, status: 'active' };
              session.metadata = metadata;
              db.prepare('UPDATE sessions SET metadata = ? WHERE id = ?')
                .run(JSON.stringify(metadata), sessionId);
          } catch(e) {}
      }
  }
}
