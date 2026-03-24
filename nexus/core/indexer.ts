/**
 * Nexus Indexer
 * 
 * 核心索引引擎：负责从各种连接器收集数据并建立索引
 */

import { 
  Paper, 
  Note, 
  Project, 
  ConnectorConfig,
  SearchResult 
} from './models';
import { BaseConnector } from '../connectors/base';

export class NexusIndexer {
  private connectors: Map<string, BaseConnector> = new Map();
  private papersIndex: Map<string, Paper> = new Map();
  private notesIndex: Map<string, Note> = new Map();
  private projectsIndex: Map<string, Project> = new Map();
  
  /**
   * 注册连接器
   */
  registerConnector(name: string, connector: BaseConnector): void {
    this.connectors.set(name, connector);
  }
  
  /**
   * 执行全量索引
   */
  async indexAll(): Promise<{
    papers: number;
    notes: number;
    projects: number;
  }> {
    let papersCount = 0;
    let notesCount = 0;
    let projectsCount = 0;
    
    for (const [name, connector] of this.connectors) {
      console.log(`[Nexus] Indexing from ${name}...`);
      
      try {
        const data = await connector.fetch();
        
        // 合并论文
        for (const paper of data.papers || []) {
          this.papersIndex.set(paper.id, paper);
          papersCount++;
        }
        
        // 合并笔记
        for (const note of data.notes || []) {
          this.notesIndex.set(note.id, note);
          notesCount++;
        }
        
        // 合并项目
        for (const project of data.projects || []) {
          this.projectsIndex.set(project.id, project);
          projectsCount++;
        }
        
        console.log(`[Nexus] Indexed from ${name}: ${data.papers?.length || 0} papers, ${data.notes?.length || 0} notes`);
      } catch (error) {
        console.error(`[Nexus] Error indexing from ${name}:`, error);
      }
    }
    
    return {
      papers: papersCount,
      notes: notesCount,
      projects: projectsCount,
    };
  }
  
  /**
   * 增量索引（只同步变化的部分）
   */
  async indexIncremental(since: Date): Promise<{
    papers: number;
    notes: number;
  }> {
    let papersCount = 0;
    let notesCount = 0;
    
    for (const [name, connector] of this.connectors) {
      if (!connector.fetchIncremental) continue;
      
      try {
        const data = await connector.fetchIncremental(since);
        
        for (const paper of data.papers || []) {
          this.papersIndex.set(paper.id, paper);
          papersCount++;
        }
        
        for (const note of data.notes || []) {
          this.notesIndex.set(note.id, note);
          notesCount++;
        }
      } catch (error) {
        console.error(`[Nexus] Error incremental indexing from ${name}:`, error);
      }
    }
    
    return { papers: papersCount, notes: notesCount };
  }
  
  /**
   * 搜索
   */
  async search(query: string, options?: {
    types?: ('paper' | 'note' | 'project')[];
    limit?: number;
  }): Promise<SearchResult> {
    const types = options?.types || ['paper', 'note', 'project'];
    const limit = options?.limit || 50;
    const queryLower = query.toLowerCase();
    
    const papers: Paper[] = [];
    const notes: Note[] = [];
    const projects: Project[] = [];
    
    // 搜索论文
    if (types.includes('paper')) {
      for (const paper of this.papersIndex.values()) {
        if (
          paper.metadata.title.toLowerCase().includes(queryLower) ||
          paper.metadata.authors.some(a => a.toLowerCase().includes(queryLower)) ||
          paper.metadata.abstract?.toLowerCase().includes(queryLower) ||
          paper.tags.some(t => t.toLowerCase().includes(queryLower))
        ) {
          papers.push(paper);
          if (papers.length >= limit) break;
        }
      }
    }
    
    // 搜索笔记
    if (types.includes('note')) {
      for (const note of this.notesIndex.values()) {
        if (
          note.title?.toLowerCase().includes(queryLower) ||
          note.path.toLowerCase().includes(queryLower) ||
          note.concepts?.some(c => c.toLowerCase().includes(queryLower))
        ) {
          notes.push(note);
          if (notes.length >= limit) break;
        }
      }
    }
    
    // 搜索项目
    if (types.includes('project')) {
      for (const project of this.projectsIndex.values()) {
        if (
          project.name.toLowerCase().includes(queryLower) ||
          project.description?.toLowerCase().includes(queryLower)
        ) {
          projects.push(project);
          if (projects.length >= limit) break;
        }
      }
    }
    
    return {
      papers,
      notes,
      projects,
      total: papers.length + notes.length + projects.length,
      query,
    };
  }
  
  /**
   * 获取论文
   */
  getPaper(id: string): Paper | undefined {
    return this.papersIndex.get(id);
  }
  
  /**
   * 获取所有论文
   */
  getAllPapers(): Paper[] {
    return Array.from(this.papersIndex.values());
  }
  
  /**
   * 获取项目
   */
  getProject(id: string): Project | undefined {
    return this.projectsIndex.get(id);
  }
  
  /**
   * 获取所有项目
   */
  getAllProjects(): Project[] {
    return Array.from(this.projectsIndex.values());
  }
  
  /**
   * 更新论文状态
   */
  updatePaperStatus(id: string, updates: Partial<Paper['status']>): boolean {
    const paper = this.papersIndex.get(id);
    if (!paper) return false;
    
    paper.status = { ...paper.status, ...updates };
    paper.updatedAt = new Date();
    return true;
  }
  
  /**
   * 添加论文
   */
  addPaper(paper: Paper): void {
    this.papersIndex.set(paper.id, paper);
  }
  
  /**
   * 获取统计信息
   */
  getStats(): {
    papers: number;
    notes: number;
    projects: number;
    connectors: number;
  } {
    return {
      papers: this.papersIndex.size,
      notes: this.notesIndex.size,
      projects: this.projectsIndex.size,
      connectors: this.connectors.size,
    };
  }
}