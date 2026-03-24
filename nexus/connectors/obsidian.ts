/**
 * Obsidian Connector
 * 
 * 连接 Obsidian 知识库
 * 
 * 配置选项：
 * - vaultPath: Obsidian vault 路径
 */

import { BaseConnector, ConnectorFetchResult, ConnectorConfig } from './base';
import { Note, Paper } from '../core/models';
import * as fs from 'fs';
import * as path from 'path';

interface ObsidianConfig extends ConnectorConfig {
  vaultPath: string;
}

interface ParsedMarkdown {
  frontmatter: Record<string, any>;
  content: string;
  wikilinks: string[];
  tags: string[];
}

export class ObsidianConnector extends BaseConnector {
  private vaultPath: string;
  private initialized = false;
  
  constructor(config: ObsidianConfig) {
    super('obsidian', config);
    this.vaultPath = config.vaultPath;
  }
  
  async initialize(): Promise<boolean> {
    try {
      // 检查 vault 路径是否存在
      const exists = fs.existsSync(this.vaultPath);
      if (!exists) {
        console.error(`[Obsidian] Vault path does not exist: ${this.vaultPath}`);
        return false;
      }
      
      // 检查是否是 Obsidian vault（存在 .obsidian 目录）
      const isObsidianVault = fs.existsSync(
        path.join(this.vaultPath, '.obsidian')
      );
      
      if (!isObsidianVault) {
        console.warn(`[Obsidian] Path may not be an Obsidian vault: ${this.vaultPath}`);
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('[Obsidian] Initialization failed:', error);
      return false;
    }
  }
  
  async testConnection(): Promise<boolean> {
    return fs.existsSync(this.vaultPath);
  }
  
  async fetch(): Promise<ConnectorFetchResult> {
    const notes: Note[] = [];
    
    if (!this.initialized) {
      console.warn('[Obsidian] Connector not initialized');
      return { notes };
    }
    
    try {
      // 递归扫描所有 .md 文件
      const mdFiles = this.scanMarkdownFiles(this.vaultPath);
      
      for (const filePath of mdFiles) {
        try {
          const note = this.parseMarkdownFile(filePath);
          notes.push(note);
        } catch (error) {
          console.error(`[Obsidian] Error parsing ${filePath}:`, error);
        }
      }
      
      console.log(`[Obsidian] Fetched ${notes.length} notes`);
    } catch (error) {
      console.error('[Obsidian] Fetch error:', error);
    }
    
    return { notes };
  }
  
  private scanMarkdownFiles(dir: string): string[] {
    const files: string[] = [];
    
    const scan = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        // 跳过 .obsidian 目录和其他隐藏目录
        if (entry.name.startsWith('.')) {
          continue;
        }
        
        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    };
    
    scan(dir);
    return files;
  }
  
  private parseMarkdownFile(filePath: string): Note {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(this.vaultPath, filePath);
    
    const parsed = this.parseMarkdown(content);
    
    // 从 frontmatter 或标题推断关联论文
    const relatedPapers = this.extractRelatedPapers(parsed);
    
    return {
      id: `redigg:note:obsidian:${Buffer.from(relativePath).toString('base64')}`,
      source: 'obsidian',
      path: relativePath,
      title: this.extractTitle(parsed, relativePath),
      relatedPapers,
      concepts: this.extractConcepts(parsed),
      frontmatter: parsed.frontmatter,
      createdAt: this.getFileCreatedTime(filePath),
      updatedAt: this.getFileModifiedTime(filePath),
    };
  }
  
  private parseMarkdown(content: string): ParsedMarkdown {
    const result: ParsedMarkdown = {
      frontmatter: {},
      content,
      wikilinks: [],
      tags: [],
    };
    
    // 解析 frontmatter
    if (content.startsWith('---\n')) {
      const endIndex = content.indexOf('\n---\n', 4);
      if (endIndex !== -1) {
        const frontmatterStr = content.slice(4, endIndex);
        result.frontmatter = this.parseFrontmatter(frontmatterStr);
        result.content = content.slice(endIndex + 5);
      }
    }
    
    // 提取 wikilinks [[xxx]]
    const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
    let match;
    while ((match = wikilinkRegex.exec(result.content)) !== null) {
      result.wikilinks.push(match[1].split('|')[0].split('#')[0]);
    }
    
    // 提取 tags #xxx
    const tagRegex = /#([a-zA-Z0-9_-]+)/g;
    while ((match = tagRegex.exec(result.content)) !== null) {
      result.tags.push(match[1]);
    }
    
    return result;
  }
  
  private parseFrontmatter(str: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = str.split('\n');
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        
        // 简单解析，支持字符串和数组
        if (value.startsWith('[') && value.endsWith(']')) {
          result[key] = value
            .slice(1, -1)
            .split(',')
            .map(s => s.trim().replace(/^['"]|['"]$/g, ''));
        } else {
          result[key] = value.replace(/^['"]|['"]$/g, '');
        }
      }
    }
    
    return result;
  }
  
  private extractTitle(parsed: ParsedMarkdown, filePath: string): string {
    // 1. 从 frontmatter 获取
    if (parsed.frontmatter.title) {
      return parsed.frontmatter.title;
    }
    
    // 2. 从第一个 # 标题获取
    const headingMatch = parsed.content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1];
    }
    
    // 3. 使用文件名
    return path.basename(filePath, '.md');
  }
  
  private extractRelatedPapers(parsed: ParsedMarkdown): string[] {
    const papers: string[] = [];
    
    // 从 frontmatter 获取
    if (parsed.frontmatter.papers) {
      const papersValue = parsed.frontmatter.papers;
      if (Array.isArray(papersValue)) {
        papers.push(...papersValue);
      }
    }
    
    // 从 wikilinks 推断（可能包含论文引用）
    for (const link of parsed.wikilinks) {
      // 简单启发式：如果链接看起来像论文名
      if (link.includes('arxiv') || link.includes('paper') || link.includes('@')) {
        papers.push(link);
      }
    }
    
    return papers;
  }
  
  private extractConcepts(parsed: ParsedMarkdown): string[] {
    // 使用 tags 作为概念
    return parsed.tags;
  }
  
  private getFileCreatedTime(filePath: string): Date {
    try {
      const stats = fs.statSync(filePath);
      return stats.birthtime;
    } catch {
      return new Date();
    }
  }
  
  private getFileModifiedTime(filePath: string): Date {
    try {
      const stats = fs.statSync(filePath);
      return stats.mtime;
    } catch {
      return new Date();
    }
  }
  
  override getStatus() {
    return {
      name: this.name,
      enabled: this.isEnabled(),
      initialized: this.initialized,
    };
  }
}