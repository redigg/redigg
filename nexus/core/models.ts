/**
 * Nexus Data Models
 * 
 * 核心数据模型定义：Paper, Project, Note, Task
 */

// ============================================
// Paper - 文献
// ============================================

export interface PaperExternalIds {
  doi?: string;
  arxiv?: string;
  zoteroKey?: string;
  semanticScholar?: string;
  pmid?: string;
}

export interface PaperMetadata {
  title: string;
  authors: string[];
  year: number;
  venue?: string;
  abstract?: string;
  keywords?: string[];
  url?: string;
}

export interface PaperLocal {
  zoteroKey?: string;
  zoteroCollection?: string;
  pdfPath?: string;
  obsidianNote?: string;
  overleafProject?: string;
}

export interface PaperStatus {
  read: boolean;
  readingProgress?: number;  // 0-100
  hasNotes: boolean;
  citedByMe: boolean;
  lastAccessed?: Date;
}

export interface PaperRelations {
  cites?: string[];       // 引用的论文 ID
  citedBy?: string[];     // 被引用的论文 ID
  related?: string[];     // 相关论文 ID
}

export interface Paper {
  id: string;                       // redigg:paper:xxx
  externalIds: PaperExternalIds;
  metadata: PaperMetadata;
  local: PaperLocal;
  status: PaperStatus;
  projects: string[];               // 所属项目 ID
  tags: string[];
  relations?: PaperRelations;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Project - 项目
// ============================================

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface ProjectDeliverable {
  type: 'survey' | 'paper' | 'experiment' | 'presentation';
  status: 'planned' | 'in_progress' | 'completed';
  overleafId?: string;
  localPath?: string;
}

export interface Project {
  id: string;                       // redigg:project:xxx
  name: string;
  description?: string;
  status: ProjectStatus;
  papers: string[];                 // 关联论文 ID
  notes: string[];                  // 关联笔记 ID
  deliverables?: ProjectDeliverable[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Note - 笔记
// ============================================

export interface Note {
  id: string;                       // redigg:note:xxx
  source: 'obsidian' | 'notion' | 'local';
  path: string;
  title?: string;
  relatedPapers: string[];          // 关联论文 ID
  project?: string;                 // 所属项目 ID
  concepts?: string[];              // 提取的概念
  frontmatter?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Task - 任务
// ============================================

export type TaskType = 
  | 'read_paper' 
  | 'write_note' 
  | 'search_papers' 
  | 'update_project'
  | 'custom';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface TaskAction {
  tool: string;                     // 'zotero' | 'obsidian' | 'arxiv'
  action: string;                   // 'open_pdf' | 'create_note' | 'search'
  args?: Record<string, any>;
}

export interface Task {
  id: string;                       // redigg:task:xxx
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  paperId?: string;
  projectId?: string;
  context?: string;                 // 为什么这个任务重要
  suggestedAction?: TaskAction;
  dueDate?: Date;
  createdAt: Date;
  completedAt?: Date;
}

// ============================================
// Recommendation - 推荐
// ============================================

export type RecommendationType = 
  | 'new_paper'           // 新论文
  | 'paper_to_read'       // 待读提醒
  | 'related_paper'       // 相关论文
  | 'concept_note'        // 概念笔记建议
  | 'project_update'      // 项目更新
  | 'citation_alert';     // 引用提醒

export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  paperId?: string;
  projectId?: string;
  reason: string;                   // 为什么推荐
  action?: TaskAction;
  relevanceScore: number;           // 0-1
  createdAt: Date;
}

// ============================================
// Connector - 连接器配置
// ============================================

export type ConnectorType = 'zotero' | 'obsidian' | 'arxiv' | 'overleaf' | 'notion';

export interface ConnectorConfig {
  type: ConnectorType;
  enabled: boolean;
  config: Record<string, any>;
  lastSync?: Date;
  syncStatus?: 'idle' | 'syncing' | 'error';
  error?: string;
}

// ============================================
// Search - 搜索结果
// ============================================

export interface SearchResult {
  papers: Paper[];
  notes: Note[];
  projects: Project[];
  total: number;
  query: string;
}

// ============================================
// Project Status Summary
// ============================================

export interface ProjectStatusSummary {
  projectId: string;
  projectName: string;
  status: ProjectStatus;
  papers: {
    total: number;
    read: number;
    toRead: number;
    hasNotes: number;
  };
  notes: number;
  deliverables: number;
  lastActivity: Date;
  nextActions: Task[];
}