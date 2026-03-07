import Database from 'better-sqlite3';
import { UserMemory, ResearchHistory } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SQLite 记忆存储
 */
export class SQLiteStorage {
  private db: Database.Database;
  
  constructor(dbPath: string = './data/redigg-memory.db') {
    // 确保目录存在
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    this.db = new Database(dbPath);
    this.initSchema();
  }
  
  /**
   * 初始化数据库表
   */
  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_memories (
        user_id TEXT PRIMARY KEY,
        preferences TEXT,
        domain_knowledge TEXT,
        created_at INTEGER,
        updated_at INTEGER
      )
    `);
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS research_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        query_id TEXT,
        query TEXT,
        response TEXT,
        feedback INTEGER,
        timestamp INTEGER
      )
    `);
  }
  
  /**
   * 保存用户记忆
   */
  saveMemory(memory: UserMemory): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_memories 
      (user_id, preferences, domain_knowledge, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      memory.userId,
      JSON.stringify(memory.preferences),
      JSON.stringify(memory.domainKnowledge),
      memory.createdAt,
      memory.updatedAt
    );
  }
  
  /**
   * 加载用户记忆
   */
  loadMemory(userId: string): UserMemory | null {
    const stmt = this.db.prepare('SELECT * FROM user_memories WHERE user_id = ?');
    const row = stmt.get(userId) as any;
    
    if (!row) return null;
    
    return {
      userId: row.user_id,
      preferences: JSON.parse(row.preferences),
      history: this.getHistory(userId),
      domainKnowledge: JSON.parse(row.domain_knowledge),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  
  /**
   * 获取研究历史
   */
  getHistory(userId: string, limit: number = 100): ResearchHistory[] {
    const stmt = this.db.prepare(`
      SELECT * FROM research_history 
      WHERE user_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    
    return stmt.all(userId, limit).map((row: any) => ({
      queryId: row.query_id,
      query: row.query,
      response: row.response,
      feedback: row.feedback,
      timestamp: row.timestamp
    }));
  }
  
  /**
   * 添加历史记录
   */
  addHistory(userId: string, history: ResearchHistory): void {
    const stmt = this.db.prepare(`
      INSERT INTO research_history 
      (user_id, query_id, query, response, feedback, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      userId,
      history.queryId,
      history.query,
      history.response,
      history.feedback || null,
      history.timestamp
    );
    
    // 更新用户记忆时间
    this.updateTimestamp(userId);
  }
  
  /**
   * 更新时间戳
   */
  private updateTimestamp(userId: string): void {
    const stmt = this.db.prepare(`
      UPDATE user_memories SET updated_at = ? WHERE user_id = ?
    `);
    stmt.run(Date.now(), userId);
  }
  
  /**
   * 关闭数据库连接
   */
  close() {
    this.db.close();
  }
}
