/**
 * Base Connector
 * 
 * 所有连接器的基类，定义统一的接口
 */

import { Paper, Note, Project } from '../core/models';

export interface ConnectorFetchResult {
  papers?: Paper[];
  notes?: Note[];
  projects?: Project[];
}

export interface ConnectorConfig {
  enabled?: boolean;
  [key: string]: any;
}

export abstract class BaseConnector {
  protected config: ConnectorConfig;
  protected name: string;
  
  constructor(name: string, config: ConnectorConfig = {}) {
    this.name = name;
    this.config = config;
  }
  
  /**
   * 连接器名称
   */
  getName(): string {
    return this.name;
  }
  
  /**
   * 检查连接器是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled !== false;
  }
  
  /**
   * 初始化连接（验证配置、建立连接）
   */
  abstract initialize(): Promise<boolean>;
  
  /**
   * 获取数据（全量）
   */
  abstract fetch(): Promise<ConnectorFetchResult>;
  
  /**
   * 增量获取数据（可选实现）
   */
  async fetchIncremental(since: Date): Promise<ConnectorFetchResult> {
    // 默认实现：调用全量获取
    return this.fetch();
  }
  
  /**
   * 测试连接
   */
  abstract testConnection(): Promise<boolean>;
  
  /**
   * 获取连接器状态
   */
  getStatus(): {
    name: string;
    enabled: boolean;
    initialized: boolean;
  } {
    return {
      name: this.name,
      enabled: this.isEnabled(),
      initialized: false, // 子类可以覆盖
    };
  }
}