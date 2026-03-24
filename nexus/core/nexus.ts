/**
 * Nexus - 科研上下文中枢
 * 
 * 主入口类，整合索引、连接器、图谱、推荐等功能
 */

import { NexusIndexer } from './core/indexer';
import { BaseConnector } from './connectors/base';
import { 
  Paper, 
  Project, 
  Note, 
  Task, 
  Recommendation,
  SearchResult,
  ProjectStatusSummary,
  ConnectorType,
} from './core/models';

export interface NexusConfig {
  dbPath?: string;
  autoSync?: boolean;
  syncInterval?: number;  // milliseconds
}

export class Nexus {
  private indexer: NexusIndexer;
  private config: NexusConfig;
  private initialized = false;
  
  constructor(config: NexusConfig = {}) {
    this.config = {
      autoSync: true,
      syncInterval: 60 * 60 * 1000, // 1 hour
      ...config,
    };
    this.indexer = new NexusIndexer();
  }
  
  /**
   * 初始化 Nexus
   */
  async initialize(): Promise<boolean> {
    try {
      // 执行初始索引
      await this.indexer.indexAll();
      
      this.initialized = true;
      console.log('[Nexus] Initialized successfully');
      
      // 如果启用自动同步，启动定时器
      if (this.config.autoSync) {
        this.startAutoSync();
      }
      
      return true;
    } catch (error) {
      console.error('[Nexus] Initialization failed:', error);
      return false;
    }
  }
  
  /**
   * 连接工具
   */
  async connect(type: ConnectorType, config: Record<string, any>): Promise<boolean> {
    let connector: BaseConnector | null = null;
    
    switch (type) {
      case 'zotero':
        const { ZoteroConnector } = await import('./connectors/zotero');
        connector = new ZoteroConnector(config);
        break;
      case 'obsidian':
        const { ObsidianConnector } = await import('./connectors/obsidian');
        connector = new ObsidianConnector(config);
        break;
      default:
        console.error(`[Nexus] Unknown connector type: ${type}`);
        return false;
    }
    
    // 初始化连接器
    const success = await connector.initialize();
    if (!success) {
      console.error(`[Nexus] Failed to initialize ${type} connector`);
      return false;
    }
    
    // 注册到索引器
    this.indexer.registerConnector(type, connector);
    console.log(`[Nexus] Connected to ${type}`);
    
    return true;
  }
  
  /**
   * 执行索引
   */
  async index(): Promise<{
    papers: number;
    notes: number;
    projects: number;
  }> {
    return this.indexer.indexAll();
  }
  
  /**
   * 搜索
   */
  async search(query: string): Promise<SearchResult> {
    return this.indexer.search(query);
  }
  
  /**
   * 获取论文
   */
  getPaper(id: string): Paper | undefined {
    return this.indexer.getPaper(id);
  }
  
  /**
   * 获取所有论文
   */
  getAllPapers(): Paper[] {
    return this.indexer.getAllPapers();
  }
  
  /**
   * 获取项目状态
   */
  async getProjectStatus(projectId: string): Promise<ProjectStatusSummary | null> {
    const project = this.indexer.getProject(projectId);
    if (!project) return null;
    
    const papers = project.papers.map(id => this.indexer.getPaper(id)).filter(Boolean) as Paper[];
    
    return {
      projectId: project.id,
      projectName: project.name,
      status: project.status,
      papers: {
        total: papers.length,
        read: papers.filter(p => p.status.read).length,
        toRead: papers.filter(p => !p.status.read).length,
        hasNotes: papers.filter(p => p.status.hasNotes).length,
      },
      notes: project.notes.length,
      deliverables: project.deliverables?.length || 0,
      lastActivity: project.updatedAt,
      nextActions: [], // TODO: 实现推荐逻辑
    };
  }
  
  /**
   * 获取推荐
   */
  async recommend(): Promise<Recommendation[]> {
    // TODO: 实现推荐逻辑
    const recommendations: Recommendation[] = [];
    
    // 示例：推荐未读论文
    const papers = this.getAllPapers();
    for (const paper of papers) {
      if (!paper.status.read && paper.metadata.year >= new Date().getFullYear() - 2) {
        recommendations.push({
          id: `rec:paper:${paper.id}`,
          type: 'paper_to_read',
          title: paper.metadata.title,
          description: `待读论文：${paper.metadata.authors[0] || 'Unknown'} et al. (${paper.metadata.year})`,
          paperId: paper.id,
          reason: '你还没有读过这篇论文',
          relevanceScore: 0.8,
          createdAt: new Date(),
        });
      }
    }
    
    return recommendations.slice(0, 10);
  }
  
  /**
   * 更新论文状态
   */
  async updatePaperStatus(paperId: string, status: Partial<Paper['status']>): Promise<boolean> {
    return this.indexer.updatePaperStatus(paperId, status);
  }
  
  /**
   * 添加论文
   */
  async addPaper(paper: Paper): Promise<void> {
    this.indexer.addPaper(paper);
  }
  
  /**
   * 获取统计信息
   */
  getStats(): {
    papers: number;
    notes: number;
    projects: number;
    connectors: number;
    initialized: boolean;
  } {
    const stats = this.indexer.getStats();
    return {
      ...stats,
      initialized: this.initialized,
    };
  }
  
  /**
   * 启动自动同步
   */
  private startAutoSync(): void {
    setInterval(async () => {
      console.log('[Nexus] Auto-syncing...');
      await this.indexer.indexAll();
    }, this.config.syncInterval);
  }
}

// 导出类型和类
export * from './core/models';
export * from './connectors/base';
export { NexusIndexer } from './core/indexer';