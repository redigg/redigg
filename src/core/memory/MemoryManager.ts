import { SQLiteStorage } from '../../infra/storage/sqlite.js';
import { v4 as uuidv4 } from 'uuid';

export interface Memory {
  id: string;
  user_id: string;
  type: 'preference' | 'fact' | 'context' | 'paper' | 'experiment';
  content: string;
  metadata?: any;
  weight: number;
  created_at: string;
  updated_at: string;
}

export class MemoryManager {
  private storage: SQLiteStorage;

  constructor(storage: SQLiteStorage) {
    this.storage = storage;
  }

  public async addMemory(
    userId: string, 
    type: Memory['type'], 
    content: string, 
    metadata?: any,
    weight: number = 1.0
  ): Promise<Memory> {
    const db = this.storage.getDb();
    const id = uuidv4();
    const metadataStr = metadata ? JSON.stringify(metadata) : null;
    
    const stmt = db.prepare(`
      INSERT INTO memories (id, user_id, type, content, metadata, weight)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, userId, type, content, metadataStr, weight);

    return this.getMemory(id);
  }

  public async addPaper(userId: string, title: string, authors: string[], url?: string, summary?: string): Promise<Memory> {
    const content = `Paper: ${title} by ${authors.join(', ')}`;
    const metadata = {
      subtype: 'paper',
      title,
      authors,
      url,
      summary
    };
    return this.addMemory(userId, 'paper', content, metadata);
  }

  private parseRow(row: any): Memory {
    if (!row) return row;
    return {
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  public async getMemory(id: string): Promise<Memory> {
    const db = this.storage.getDb();
    const stmt = db.prepare('SELECT * FROM memories WHERE id = ?');
    const row = stmt.get(id);
    if (!row) throw new Error(`Memory with id ${id} not found`);
    return this.parseRow(row);
  }

  public async getUserMemories(userId: string, type?: string): Promise<Memory[]> {
    const db = this.storage.getDb();
    let query = 'SELECT * FROM memories WHERE user_id = ?';
    const params: any[] = [userId];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    query += ' ORDER BY weight DESC, created_at DESC';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    return rows.map(this.parseRow);
  }

  public async updateMemoryWeight(id: string, delta: number): Promise<void> {
    const db = this.storage.getDb();
    const stmt = db.prepare('UPDATE memories SET weight = weight + ? WHERE id = ?');
    stmt.run(delta, id);
  }

  public async searchMemories(userId: string, query: string, limit: number = 5): Promise<Memory[]> {
    const db = this.storage.getDb();
    
    // Simple keyword matching for MVP
    // In a real implementation, this would use vector similarity search or FTS5
    const stmt = db.prepare(`
      SELECT * FROM memories 
      WHERE user_id = ? 
      AND content LIKE ? 
      ORDER BY weight DESC, created_at DESC 
      LIMIT ?
    `);
    
    const searchTerm = `%${query}%`;
    const rows = stmt.all(userId, searchTerm, limit);
    return rows.map(this.parseRow);
  }

  // Format memories for LLM context injection
  public async getFormattedMemories(userId: string, query?: string): Promise<string> {
    let memories: Memory[];
    
    if (query) {
      memories = await this.searchMemories(userId, query);
      // If no relevant memories found, fallback to recent high-weight memories
      if (memories.length === 0) {
        memories = await this.getUserMemories(userId);
        memories = memories.slice(0, 5);
      }
    } else {
      memories = await this.getUserMemories(userId);
      memories = memories.slice(0, 10);
    }

    if (memories.length === 0) return '';

    return memories.map(m => `- [${m.type.toUpperCase()}] ${m.content} (weight: ${m.weight})`).join('\n');
  }

  // Example of Memory Evolution logic: consolidating preferences
  public async consolidatePreferences(userId: string): Promise<void> {
    // This would involve LLM to summarize preferences, but for now just a placeholder
    console.log(`Consolidating preferences for user ${userId}...`);
  }
}
