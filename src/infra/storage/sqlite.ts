import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export class SQLiteStorage {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const defaultPath = path.join(process.cwd(), 'data', 'redigg.db');
    const finalPath = dbPath || defaultPath;

    // Ensure directory exists
    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(finalPath);
    this.init();
  }

  private init() {
    // Initialize Memory Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL, -- 'preference', 'fact', 'context', 'paper', 'experiment'
        content TEXT NOT NULL,
        metadata TEXT, -- JSON string for structured data (e.g. paper details, URLs)
        weight REAL DEFAULT 1.0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
    `);

    // Simple migration for existing tables (if any)
    try {
      this.db.exec(`ALTER TABLE memories ADD COLUMN metadata TEXT`);
    } catch (e) {
      // Ignore error if column already exists
    }
    
    console.log('SQLite Storage initialized.');
  }

  public getDb(): Database.Database {
    return this.db;
  }

  public close() {
    this.db.close();
  }
}
