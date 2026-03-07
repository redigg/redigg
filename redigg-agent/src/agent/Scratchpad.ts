import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

type ScratchpadEntryType = 'init' | 'thinking' | 'tool_call' | 'tool_result' | 'result' | 'error';

export interface ScratchpadEntry {
  type: ScratchpadEntryType;
  timestamp: string;
  content: string;
  metadata?: any;
}

export class Scratchpad {
  private basePath: string;
  private currentFile: string | null = null;
  private entries: ScratchpadEntry[] = [];

  constructor() {
    this.basePath = path.join(homedir(), '.redigg', 'scratchpad');
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  /**
   * 开始新的 Scratchpad session
   */
  startSession(): string {
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19);
    const random = Math.random().toString(36).slice(2, 14);
    const filename = `${timestamp}_${random}.jsonl`;
    this.currentFile = path.join(this.basePath, filename);
    this.entries = [];

    console.log(`[Scratchpad] Started new session: ${filename}`);

    return filename;
  }

  /**
   * 记录条目
   */
  log(
    type: ScratchpadEntryType,
    content: string,
    metadata?: any
  ): void {
    if (!this.currentFile) {
      this.startSession();
    }

    const entry: ScratchpadEntry = {
      type,
      timestamp: new Date().toISOString(),
      content,
      metadata
    };

    this.entries.push(entry);

    // 追加到文件
    if (this.currentFile) {
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.currentFile, line, 'utf-8');
    }
  }

  /**
   * 记录 init
   */
  logInit(query: string, metadata?: any): void {
    this.log('init', query, metadata);
  }

  /**
   * 记录 thinking
   */
  logThinking(content: string, metadata?: any): void {
    this.log('thinking', content, metadata);
  }

  /**
   * 记录 tool_call
   */
  logToolCall(toolName: string, args: any, metadata?: any): void {
    const content = `Calling tool: ${toolName}`;
    this.log('tool_call', content, { toolName, args, ...metadata });
  }

  /**
   * 记录 tool_result
   */
  logToolResult(toolName: string, result: any, llmSummary?: string, metadata?: any): void {
    const content = llmSummary || `Tool result: ${toolName}`;
    this.log('tool_result', content, { toolName, result, ...metadata });
  }

  /**
   * 记录 result
   */
  logResult(content: string, metadata?: any): void {
    this.log('result', content, metadata);
  }

  /**
   * 记录 error
   */
  logError(error: Error | string, metadata?: any): void {
    const content = error instanceof Error ? error.message : error;
    this.log('error', content, { error, ...metadata });
  }

  /**
   * 获取当前 session 的所有条目
   */
  getEntries(): ScratchpadEntry[] {
    return [...this.entries];
  }

  /**
   * 获取当前文件路径
   */
  getCurrentFile(): string | null {
    return this.currentFile;
  }

  /**
   * 列出所有 Scratchpad 文件
   */
  listSessions(): string[] {
    if (!fs.existsSync(this.basePath)) {
      return [];
    }

    const files = fs.readdirSync(this.basePath)
      .filter(file => file.endsWith('.jsonl'))
      .sort()
      .reverse();

    return files;
  }

  /**
   * 加载指定的 Scratchpad 文件
   */
  loadSession(filename: string): ScratchpadEntry[] {
    const filePath = path.join(this.basePath, filename);
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');

    return lines
      .filter(line => line.trim().length > 0)
      .map(line => JSON.parse(line));
  }
}
