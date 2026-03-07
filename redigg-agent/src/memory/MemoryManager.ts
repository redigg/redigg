import { SQLiteStorage } from './storage/SQLiteStorage';
import { UserMemory, UserPreferences, ResearchHistory, DomainKnowledge } from './types';

/**
 * 记忆管理器
 */
export class MemoryManager {
  private storage: SQLiteStorage;
  private cache: Map<string, UserMemory> = new Map();
  
  constructor(dbPath?: string) {
    this.storage = new SQLiteStorage(dbPath);
  }
  
  /**
   * 获取用户记忆
   */
  async getMemory(userId: string): Promise<UserMemory> {
    // 先查缓存
    const cached = this.cache.get(userId);
    if (cached) return cached;
    
    // 再查数据库
    let memory = this.storage.loadMemory(userId);
    
    // 新用户创建默认记忆
    if (!memory) {
      memory = this.createDefaultMemory(userId);
      this.storage.saveMemory(memory);
    }
    
    this.cache.set(userId, memory);
    return memory;
  }
  
  /**
   * 更新用户偏好
   */
  async updatePreferences(userId: string, prefs: Partial<UserPreferences>): Promise<void> {
    const memory = await this.getMemory(userId);
    memory.preferences = { ...memory.preferences, ...prefs };
    memory.updatedAt = Date.now();
    this.storage.saveMemory(memory);
    this.cache.set(userId, memory);
  }
  
  /**
   * 添加历史记录
   */
  async addHistory(userId: string, history: ResearchHistory): Promise<void> {
    this.storage.addHistory(userId, history);
    
    // 更新缓存
    const memory = this.cache.get(userId);
    if (memory) {
      memory.history.unshift(history);
      memory.history = memory.history.slice(0, 100);  // 只保留最近 100 条
      memory.updatedAt = Date.now();
      this.cache.set(userId, memory);
    }
  }
  
  /**
   * 更新反馈
   */
  async updateFeedback(queryId: string, feedback: number): Promise<void> {
    // TODO: 实现反馈更新
    console.log(`更新反馈：${queryId} - ${feedback}星`);
  }
  
  /**
   * 获取最近历史
   */
  async getRecentHistory(userId: string, limit: number = 5): Promise<ResearchHistory[]> {
    const memory = await this.getMemory(userId);
    return memory.history.slice(0, limit);
  }
  
  /**
   * 创建默认记忆
   */
  private createDefaultMemory(userId: string): UserMemory {
    return {
      userId,
      preferences: {
        outputFormat: 'markdown',
        citationStyle: 'APA',
        detailLevel: 'comprehensive',
        researchFields: []
      },
      history: [],
      domainKnowledge: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }
  
  /**
   * 关闭存储
   */
  close() {
    this.storage.close();
  }
}
