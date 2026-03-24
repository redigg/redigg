/**
 * Zotero Connector
 * 
 * 连接 Zotero 文献管理工具
 * 
 * 配置选项：
 * - apiKey: Zotero API Key
 * - userId: Zotero User ID
 * - baseUrl: API 基础 URL（可选，默认官方 API）
 */

import { BaseConnector, ConnectorFetchResult, ConnectorConfig } from './base';
import { Paper } from '../core/models';

interface ZoteroConfig extends ConnectorConfig {
  apiKey: string;
  userId: string;
  baseUrl?: string;
}

interface ZoteroItem {
  key: string;
  data: {
    title?: string;
    creators?: Array<{ firstName?: string; lastName?: string; name?: string }>;
    date?: string;
    abstractNote?: string;
    DOI?: string;
    arxivId?: string;
    url?: string;
    itemType: string;
  };
  links?: {
    enclosure?: {
      href: string;
      type: string;
    };
  };
}

export class ZoteroConnector extends BaseConnector {
  private baseUrl: string;
  private initialized = false;
  
  constructor(config: ZoteroConfig) {
    super('zotero', config);
    this.baseUrl = config.baseUrl || 'https://api.zotero.org';
  }
  
  async initialize(): Promise<boolean> {
    try {
      const isValid = await this.testConnection();
      this.initialized = isValid;
      return isValid;
    } catch (error) {
      console.error('[Zotero] Initialization failed:', error);
      return false;
    }
  }
  
  async testConnection(): Promise<boolean> {
    const config = this.config as ZoteroConfig;
    if (!config.apiKey || !config.userId) {
      return false;
    }
    
    try {
      const response = await fetch(
        `${this.baseUrl}/users/${config.userId}/collections?limit=1`,
        {
          headers: {
            'Zotero-API-Key': config.apiKey,
          },
        }
      );
      return response.ok;
    } catch (error) {
      return false;
    }
  }
  
  async fetch(): Promise<ConnectorFetchResult> {
    const config = this.config as ZoteroConfig;
    const papers: Paper[] = [];
    
    if (!config.apiKey || !config.userId) {
      return { papers };
    }
    
    try {
      // 获取所有条目
      const response = await fetch(
        `${this.baseUrl}/users/${config.userId}/items?limit=100`,
        {
          headers: {
            'Zotero-API-Key': config.apiKey,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Zotero API error: ${response.status}`);
      }
      
      const items: ZoteroItem[] = await response.json();
      
      for (const item of items) {
        // 只处理学术文献类型
        if (!this.isAcademicItem(item.data.itemType)) {
          continue;
        }
        
        const paper = this.convertToPaper(item);
        papers.push(paper);
      }
      
      console.log(`[Zotero] Fetched ${papers.length} papers`);
    } catch (error) {
      console.error('[Zotero] Fetch error:', error);
    }
    
    return { papers };
  }
  
  private isAcademicItem(itemType: string): boolean {
    const academicTypes = [
      'journalArticle',
      'conferencePaper',
      'thesis',
      'report',
      'preprint',
    ];
    return academicTypes.includes(itemType);
  }
  
  private convertToPaper(item: ZoteroItem): Paper {
    const data = item.data;
    
    // 解析作者
    const authors = (data.creators || []).map(creator => {
      if (creator.name) return creator.name;
      return `${creator.firstName || ''} ${creator.lastName || ''}`.trim();
    });
    
    // 解析年份
    const year = data.date ? parseInt(data.date.match(/\d{4}/)?.[0] || '0') : 0;
    
    return {
      id: `redigg:paper:zotero:${item.key}`,
      externalIds: {
        doi: data.DOI,
        arxiv: data.arxivId,
        zoteroKey: item.key,
      },
      metadata: {
        title: data.title || 'Untitled',
        authors,
        year,
        abstract: data.abstractNote,
        url: data.url,
      },
      local: {
        zoteroKey: item.key,
        pdfPath: item.links?.enclosure?.href,
      },
      status: {
        read: false,
        hasNotes: false,
        citedByMe: false,
      },
      projects: [],
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  
  override getStatus() {
    return {
      name: this.name,
      enabled: this.isEnabled(),
      initialized: this.initialized,
    };
  }
}