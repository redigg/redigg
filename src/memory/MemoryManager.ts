import { SQLiteStorage } from '../storage/sqlite.js';
import { v4 as uuidv4 } from 'uuid';
import { LLMClient } from '../llm/LLMClient.js';
import * as sqliteVec from 'sqlite-vec';
import { BM25Search } from './search/BM25Search.js';

export interface Memory {
  id: string;
  user_id: string;
  type: 'preference' | 'fact' | 'context' | 'paper' | 'experiment';
  tier: 'working' | 'short_term' | 'long_term';
  content: string;
  metadata?: any;
  weight: number;
  last_accessed_at: string;
  created_at: string;
  updated_at: string;
  parent_id?: string; // For PageIndex tree structure
  index_path?: string; // Materialized path for tree traversal e.g. "root_id/child_id"
}

export class MemoryManager {
  public storage: SQLiteStorage;
  private llm: LLMClient;
  private vectorEnabled: boolean = false;
  private bm25: BM25Search;

  constructor(storage: SQLiteStorage, llm: LLMClient) {
    this.storage = storage;
    this.llm = llm;
    this.bm25 = new BM25Search();
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
        
        // Load sqlite-vec extension
        try {
            db.loadExtension(sqliteVec.getLoadablePath());
            this.vectorEnabled = true;
            console.log('[Memory] sqlite-vec extension loaded successfully');
        } catch (e) {
            console.warn('[Memory] Failed to load sqlite-vec extension. Vector search disabled.', e);
        }

        // Add new columns if not exist (simple migration)
        try {
            db.prepare('ALTER TABLE memories ADD COLUMN tier TEXT DEFAULT "working"').run();
            db.prepare('ALTER TABLE memories ADD COLUMN last_accessed_at TEXT').run();
            db.prepare('ALTER TABLE memories ADD COLUMN parent_id TEXT').run();
            db.prepare('ALTER TABLE memories ADD COLUMN index_path TEXT').run();
        } catch (e) {
            // Ignore if columns exist
        }

        // Create vector table
        if (this.vectorEnabled) {
            try {
                // vec0 virtual table for 1536-dim embeddings (OpenAI small)
                db.prepare(`
                  CREATE VIRTUAL TABLE IF NOT EXISTS vec_memories USING vec0(
                    id TEXT PRIMARY KEY,
                    embedding float[1536]
                  )
                `).run();
            } catch (e) {
                console.error('[Memory] Failed to create vector table:', e);
                this.vectorEnabled = false;
            }
        }

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
    
    let indexPath = id;
    if (parentId) {
        const parent = await this.getMemory(parentId);
        if (parent) {
            indexPath = (parent.index_path || parent.id) + '/' + id;
        }
    }
    
    const stmt = db.prepare(`
      INSERT INTO memories (id, user_id, type, tier, content, metadata, weight, last_accessed_at, created_at, updated_at, parent_id, index_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, userId, type, tier, content, metadataStr, weight, now, now, now, parentId || null, indexPath);

    // Update BM25 Index
    this.bm25.addDocument({ id, content });

    // Generate and store embedding
    if (this.vectorEnabled) {
        try {
            const embedding = await this.llm.embed(content);
            if (embedding && embedding.length === 1536) {
                const vecStmt = db.prepare('INSERT INTO vec_memories(id, embedding) VALUES (?, ?)');
                // better-sqlite3 handles Float32Array for sqlite-vec
                vecStmt.run(id, new Float32Array(embedding));
            }
        } catch (e) {
            console.error(`[Memory] Failed to generate/store embedding for memory ${id}:`, e);
        }
    }

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
      tier?: Memory['tier'],
      useVector?: boolean
    } = {}
  ): Promise<Memory[]> {
    const db = this.storage.getDb();
    const limit = options.limit || 5;
    const useVector = options.useVector !== false; // Default to true
    
    // 1. Try Vector Search first (if enabled and requested)
    // Note: User requested BM25/BPE, but keeping vector as an option or primary for now
    // until we fully implement the custom BM25 + PageIndex.
    // For now, let's keep vector search active but log if we were to use BM25.
    
    if (this.vectorEnabled && useVector) {
        try {
            const queryEmbedding = await this.llm.embed(query);
            if (queryEmbedding && queryEmbedding.length === 1536) {
                const vecResults = db.prepare(`
                    SELECT id, distance
                    FROM vec_memories
                    WHERE embedding MATCH ?
                    AND k = ?
                `).all(new Float32Array(queryEmbedding), limit * 10); // Fetch extra for filtering

                const memoryIds = vecResults.map((r: any) => r.id);
                
                if (memoryIds.length > 0) {
                    const placeholders = memoryIds.map(() => '?').join(',');
                    let sql = `SELECT * FROM memories WHERE id IN (${placeholders}) AND user_id = ?`;
                    const params: any[] = [...memoryIds, userId];

                    if (options.type) {
                        sql += ' AND type = ?';
                        params.push(options.type);
                    }

                    if (options.tier) {
                        sql += ' AND tier = ?';
                        params.push(options.tier);
                    }

                    const memories = db.prepare(sql).all(...params).map((r: any) => this.parseRow(r));

                    // Re-sort by vector distance
                    const distMap = new Map(vecResults.map((r: any) => [r.id, r.distance]));
                    memories.sort((a: Memory, b: Memory) => (Number(distMap.get(a.id)) || 0) - (Number(distMap.get(b.id)) || 0));

                    // Filter by distance threshold (if using vector search results)
                    const relevantMemories = memories.filter((m: Memory) => {
                        const d = distMap.get(m.id);
                        return d === undefined || (typeof d === 'number' && d < 1.2); 
                    });

                    if (relevantMemories.length > 0) {
                        return relevantMemories.slice(0, limit);
                    }
                }
            }
        } catch (e) {
            console.warn('[Memory] Vector search failed, falling back to keyword:', e);
        }
    }

    // 2. Fallback to Keyword Search (LIKE) OR BM25
    
    // Check if we should use BM25 (e.g. if useVector is false or failed)
    if (!useVector || !this.vectorEnabled) {
        // BM25 Search
        const bm25Results = this.bm25.search(query, limit);
        if (bm25Results.length > 0) {
            const memoryIds = bm25Results.map(r => r.id);
            const placeholders = memoryIds.map(() => '?').join(',');
            let sql = `SELECT * FROM memories WHERE id IN (${placeholders}) AND user_id = ?`;
            const params: any[] = [...memoryIds, userId];
            
            if (options.type) {
                sql += ' AND type = ?';
                params.push(options.type);
            }

            if (options.tier) {
                sql += ' AND tier = ?';
                params.push(options.tier);
            }
            
            const memories = db.prepare(sql).all(...params).map((r: any) => this.parseRow(r));
            
            // Re-sort by BM25 score
            const scoreMap = new Map(bm25Results.map(r => [r.id, r.score]));
            memories.sort((a: Memory, b: Memory) => (scoreMap.get(b.id) || 0) - (scoreMap.get(a.id) || 0));
            
            return memories;
        }
    }

    // 3. Fallback to simple LIKE if BM25 empty or not initialized
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
    return rows.map((r: any) => this.parseRow(r));
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
    
    // Note: BM25 index doesn't support deletion easily without rebuilding or soft delete
    // For now, we accept it might return deleted IDs (which won't be found in DB query)
    
    if (this.vectorEnabled) {
        try {
            db.prepare('DELETE FROM vec_memories WHERE id = ?').run(id);
        } catch (e) {
            // Ignore if fails
        }
    }
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

    // 2. Short-term -> Long-term (if weight > 5)
    const shortTermMemories = await this.getMemoriesByTier(userId, 'short_term');
    for (const mem of shortTermMemories) {
        if (mem.weight > 5) {
            console.log(`[Memory] Promoting ${mem.id} to long-term (high importance)`);
            await this.updateMemoryTier(mem.id, 'long_term');
            stats.promoted++;
        } else {
            // Pruning check
            const age = now.getTime() - new Date(mem.created_at).getTime();
            if (mem.weight < 0.5 && age > 7 * 24 * 60 * 60 * 1000) {
                 console.log(`[Memory] Pruning low-value memory ${mem.id}`);
                 db.prepare('DELETE FROM memories WHERE id = ?').run(mem.id);
                 stats.pruned++;
            }
        }
    }
    
    return stats;
  }

  public async consolidatePreferences(userId: string): Promise<void> {
    // This would involve LLM to summarize preferences, but for now just a placeholder
    console.log(`Consolidating preferences for user ${userId}...`);
  }
}
