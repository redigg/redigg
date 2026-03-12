import { SQLiteStorage } from '../storage/sqlite.js';
import { v4 as uuidv4 } from 'uuid';

export interface Memory {
  id: string;
  user_id: string;
  type: 'preference' | 'fact' | 'context' | 'paper' | 'experiment' | 'page_index' | 'page_index_node';
  tier: 'working' | 'short_term' | 'long_term';
  content: string;
  metadata?: any;
  weight: number;
  last_accessed_at: string;
  created_at: string;
  updated_at: string;
  parent_id?: string;
  index_path?: string;
}

export class MemoryManager {
  public storage: SQLiteStorage;

  constructor(storage: SQLiteStorage) {
    this.storage = storage;
    try {
        if (this.storage && typeof this.storage.getDb === 'function') {
            this.initializeSchema();
        }
    } catch (e) {
        // Ignore initialization errors in test/mock envs
    }
  }

  private initializeSchema() {
    if (!this.storage || typeof this.storage.getDb !== 'function') return;
    try {
        const db = this.storage.getDb();
        // Add new columns if not exist (simple migration)
        try {
            db.prepare('ALTER TABLE memories ADD COLUMN tier TEXT DEFAULT "working"').run();
        } catch (e) {}
        try {
            db.prepare('ALTER TABLE memories ADD COLUMN last_accessed_at TEXT').run();
        } catch (e) {}
        try {
            db.prepare('ALTER TABLE memories ADD COLUMN parent_id TEXT').run();
        } catch (e) {}
        try {
            db.prepare('ALTER TABLE memories ADD COLUMN index_path TEXT').run();
        } catch (e) {}
    } catch (e) {
        // Ignore DB connection errors
    }
  }

  public async addMemory(
    userId: string, 
    type: Memory['type'], 
    content: string, 
    metadata?: any,
    weight: number = 1.0,
    tier: Memory['tier'] = 'working',
    parentId?: string
  ): Promise<Memory> {
    const db = this.storage.getDb();
    const id = uuidv4();
    const metadataStr = metadata ? JSON.stringify(metadata) : null;
    const now = new Date().toISOString();
    
    // Calculate index_path
    let indexPath = id;
    if (parentId) {
        try {
            const parent = await this.getMemory(parentId);
            if (parent && parent.index_path) {
                indexPath = `${parent.index_path}/${id}`;
            } else {
                 // Fallback if parent has no path or not found (though should be found)
                 indexPath = `${parentId}/${id}`;
            }
        } catch (e) {
            // Parent might not exist or error
        }
    }

    const stmt = db.prepare(`
      INSERT INTO memories (id, user_id, type, tier, content, metadata, weight, last_accessed_at, created_at, updated_at, parent_id, index_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, userId, type, tier, content, metadataStr, weight, now, now, now, parentId || null, indexPath);

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
    return this.addMemory(userId, 'paper', content, metadata, 1.0, 'long_term');
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

  public async searchMemories(
    userId: string, 
    query: string, 
    options: {
      limit?: number,
      type?: Memory['type'],
      tier?: Memory['tier']
    } = {}
  ): Promise<Memory[]> {
    const db = this.storage.getDb();
    const limit = options.limit || 5;
    
    let sql = `
      SELECT * FROM memories 
      WHERE user_id = ? 
      AND content LIKE ?
    `;
    const params: any[] = [userId, `%${query}%`];

    if (options.type) {
      sql += ' AND type = ?';
      params.push(options.type);
    }

    if (options.tier) {
      sql += ' AND tier = ?';
      params.push(options.tier);
    }

    sql += ' ORDER BY weight DESC, created_at DESC LIMIT ?';
    params.push(limit);
    
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params);
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
  public async updateMemoryTier(id: string, tier: Memory['tier']): Promise<void> {
    const db = this.storage.getDb();
    const now = new Date().toISOString();
    db.prepare('UPDATE memories SET tier = ?, updated_at = ? WHERE id = ?').run(tier, now, id);
  }
  
  public async deleteMemory(id: string): Promise<void> {
    const db = this.storage.getDb();
    db.prepare('DELETE FROM memories WHERE id = ?').run(id);
  }

  public async getMemoriesByTier(userId: string, tier: Memory['tier']): Promise<Memory[]> {
    const db = this.storage.getDb();
    const rows = db.prepare('SELECT * FROM memories WHERE user_id = ? AND tier = ? ORDER BY weight DESC').all(userId, tier);
    return rows.map(this.parseRow);
  }

  // Consolidate memories: Working -> Short-term -> Long-term
  // Logic: 
  // 1. Working memory items older than 1 hour move to Short-term
  // 2. Short-term items with high weight (> 5) move to Long-term
  // 3. Short-term items with low weight (< 0.5) and old (> 7 days) are pruned (deleted)
  public async consolidateMemories(userId: string): Promise<{ moved: number, promoted: number, pruned: number }> {
    const db = this.storage.getDb();
    const now = new Date();
    
    let stats = { moved: 0, promoted: 0, pruned: 0 };

    // 1. Working -> Short-term (if > 1 hour old)
    // Actually, let's relax this. Working memory is for current session context.
    // Maybe we just keep last N items as working, rest move to short-term?
    // Or time-based is fine.
    
    // NEW: Auto-archive very old working/short-term memories to a history file or delete?
    // Let's implement a simple cleanup:
    // If we have too many memories, summarize or delete old ones.
    
    const workingMemories = await this.getMemoriesByTier(userId, 'working');
    // Log working memories stats if any
    if (workingMemories.length > 0) {
        console.log(`[Memory] Active working memories for ${userId}: ${workingMemories.length}`);
    }

    for (const mem of workingMemories) {
        const age = now.getTime() - new Date(mem.created_at).getTime();
        if (age > 60 * 60 * 1000) {
            console.log(`[Memory] Moving ${mem.id} to short-term`);
            await this.updateMemoryTier(mem.id, 'short_term');
            stats.moved++;
        }
    }

    // 2. Short-term -> Long-term (if weight > 3) - Lower threshold for promotion
    const shortTermMemories = await this.getMemoriesByTier(userId, 'short_term');
    
    // Sort by age (oldest first) to process history
    shortTermMemories.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    for (const mem of shortTermMemories) {
        if (mem.weight >= 3) { // Lowered from 5
            console.log(`[Memory] Promoting ${mem.id} to long-term (high importance)`);
            await this.updateMemoryTier(mem.id, 'long_term');
            stats.promoted++;
        } else {
            // Pruning check
            const age = now.getTime() - new Date(mem.created_at).getTime();
            // Prune if older than 3 days and low weight (was 7 days)
            if (mem.weight < 1.0 && age > 3 * 24 * 60 * 60 * 1000) {
                 console.log(`[Memory] Pruning low-value memory ${mem.id}`);
                 await this.deleteMemory(mem.id);
                 stats.pruned++;
            }
        }
    }
    
    // 3. Clean up Long-term if too many? (Maybe keep max 100?)
    // For now, let's keep it simple.
    
    return stats;
  }

  public async consolidatePreferences(userId: string): Promise<void> {
    // This would involve LLM to summarize preferences, but for now just a placeholder
    console.log(`Consolidating preferences for user ${userId}...`);
  }
}
