// Redigg Agent 记忆系统类型定义

/**
 * 用户偏好配置
 */
export interface UserPreferences {
  /** 输出格式 */
  outputFormat: 'markdown' | 'pdf' | 'html';
  /** 引用风格 */
  citationStyle: 'APA' | 'MLA' | 'Chicago';
  /** 详细程度 */
  detailLevel: 'brief' | 'detailed' | 'comprehensive';
  /** 研究领域 */
  researchFields: string[];
}

/**
 * 研究历史查询记录
 */
export interface ResearchHistory {
  /** 查询 ID */
  queryId: string;
  /** 查询内容 */
  query: string;
  /** 响应内容 */
  response: string;
  /** 时间戳 */
  timestamp: number;
  /** 反馈评分 (1-5 星) */
  feedback?: number;
}

/**
 * 领域知识
 */
export interface DomainKnowledge {
  /** 领域名称 */
  field: string;
  /** 关键论文 ID 列表 */
  keyPapers: string[];
  /** 关键概念列表 */
  keyConcepts: string[];
  /** 最后更新时间 */
  lastUpdated: number;
}

/**
 * 用户完整记忆
 */
export interface UserMemory {
  /** 用户 ID */
  userId: string;
  /** 用户偏好 */
  preferences: UserPreferences;
  /** 研究历史 */
  history: ResearchHistory[];
  /** 领域知识 */
  domainKnowledge: DomainKnowledge[];
  /** 创建时间 */
  createdAt: number;
  /** 最后更新时间 */
  updatedAt: number;
}
