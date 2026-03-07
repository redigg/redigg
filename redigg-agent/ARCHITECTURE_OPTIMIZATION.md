# Redigg Agent 架构优化分析

**日期**: 2026年3月4日  
**基于**: evowork-v0/agent-sdk + 现有 redigg-agent 架构

---

## 一、现有架构分析

### 1.1 evowork-v0/agent-sdk 架构亮点

✅ **清晰的 Agent 类设计**
- `EvoworkAgent` 单一职责，封装所有 agent 逻辑
- 状态机管理：`disconnected` | `connecting` | `connected` | `idle` | `busy` | `error`

✅ **双模式连接**
- WebSocket 优先（实时推送）
- Polling 回退（WebSocket 失败时）
- 自动重连机制（指数退避）

✅ **任务处理机制**
- 回调模式：`onTask(callback)`
- 超时控制（5 分钟默认）
- 结果提交带重试（指数退避）

✅ **清晰的类型定义**
- `AgentConfig`、`ConnectOptions`、`Task`、`TaskResult`
- TypeScript 类型安全

---

### 1.2 现有 redigg-agent 架构分析

✅ **已有的好东西**
- 完整的 CLI（register, login, config, agent, start）
- Agent Runtime（任务循环、SSE、心跳）
- 10个内置 Skills
- Skill Market 同步
- MCP 支持
- Semantic Scholar API 支持
- Workspace/Research 本地管理（刚添加）

⚠️ **可以优化的地方**
1. **Agent 类设计**：可以更清晰地封装 agent 逻辑
2. **连接管理**：可以借鉴 evowork 的双模式 + 自动重连
3. **状态管理**：可以更清晰的状态机
4. **任务处理**：可以更清晰的任务回调 + 超时 + 重试机制
5. **错误处理**：可以更健壮的错误处理和恢复

---

## 二、架构优化建议

### 2.1 核心架构重构

#### 方案 1：引入 RediggAgent 类

```typescript
// src/agent/RediggAgent.ts

type AgentStatus = 'disconnected' | 'connecting' | 'connected' | 'idle' | 'busy' | 'error';

export class RediggAgent {
  private config: AgentConfig;
  private apiKey: string | null = null;
  private client: RediggClient;
  private status: AgentStatus = 'disconnected';
  private currentTask: any = null;
  private ws: EventSourcePolyfill | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private taskHandler: ((task: any) => Promise<any>) | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
    this.client = new RediggClient();
  }

  async connect(options: ConnectOptions): Promise<void> {
    // 类似 evowork 的连接逻辑
  }

  onTask(handler: (task: any) => Promise<any>): void {
    this.taskHandler = handler;
  }

  async start(): Promise<void> {
    // 启动 agent，处理任务
  }

  disconnect(): void {
    // 断开连接
  }

  // ... 其他方法
}
```

---

### 2.2 连接管理优化

#### 双模式连接（WebSocket + Polling）

```typescript
// src/agent/connection.ts

export class ConnectionManager {
  private ws: EventSourcePolyfill | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  async connect(): Promise<void> {
    try {
      await this.connectWebSocket();
    } catch (error) {
      console.warn('WebSocket failed, falling back to polling:', error);
      this.startPolling();
    }
  }

  private async connectWebSocket(): Promise<void> {
    // WebSocket 连接逻辑 + 自动重连
  }

  private startPolling(): void {
    // Polling 回退逻辑
  }

  disconnect(): void {
    // 清理连接
  }
}
```

---

### 2.3 状态管理优化

#### 清晰的状态机

```typescript
// src/agent/status.ts

export type AgentStatus = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'idle'
  | 'busy'
  | 'error';

export interface AgentState {
  status: AgentStatus;
  currentTask: Task | null;
  connectedAt: Date | null;
  lastHeartbeatAt: Date | null;
  consecutiveErrors: number;
}

export class StateManager {
  private state: AgentState = {
    status: 'disconnected',
    currentTask: null,
    connectedAt: null,
    lastHeartbeatAt: null,
    consecutiveErrors: 0
  };

  getState(): AgentState {
    return { ...this.state };
  }

  transitionTo(status: AgentStatus): void {
    this.state.status = status;
    this.emit('statusChanged', status);
  }

  setCurrentTask(task: Task | null): void {
    this.state.currentTask = task;
  }

  recordError(): void {
    this.state.consecutiveErrors++;
  }

  resetErrors(): void {
    this.state.consecutiveErrors = 0;
  }

  private emit(event: string, data: any): void {
    // 事件通知
  }
}
```

---

### 2.4 任务处理优化

#### 任务处理 + 超时 + 重试

```typescript
// src/agent/task-processor.ts

export class TaskProcessor {
  private defaultTimeout = 5 * 60 * 1000; // 5 分钟
  private maxSubmitRetries = 3;

  async processTask(
    task: Task,
    handler: (task: Task) => Promise<TaskResult>
  ): Promise<void> {
    try {
      const result = await this.executeWithTimeout(
        () => handler(task),
        this.defaultTimeout
      );

      await this.submitResultWithRetry(task.id, result);
    } catch (error) {
      console.error('Task failed:', error);
      await this.submitErrorResult(task.id, error);
    }
  }

  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    // 带超时的执行
  }

  private async submitResultWithRetry(
    taskId: string,
    result: TaskResult,
    maxRetries = this.maxSubmitRetries
  ): Promise<void> {
    // 带重试的结果提交（指数退避）
  }

  private async submitErrorResult(
    taskId: string,
    error: any
  ): Promise<void> {
    // 提交错误结果
  }
}
```

---

## 三、分阶段实施计划

### Phase 1: 核心类重构（1-2天）
- [ ] 创建 `RediggAgent` 类
- [ ] 重构连接管理（双模式 + 自动重连）
- [ ] 实现状态管理（状态机）

### Phase 2: 任务处理优化（2-3天）
- [ ] 实现任务处理器（超时 + 重试）
- [ ] 优化错误处理和恢复
- [ ] 改进日志和监控

### Phase 3: 集成和测试（1-2天）
- [ ] 集成到现有 CLI
- [ ] 端到端测试
- [ ] 性能优化

---

## 四、保持不变的部分

✅ 不需要修改的部分：
- 现有的 CLI 命令结构
- 内置 Skills（10个）
- Skill Market 同步
- MCP 支持
- Semantic Scholar API 支持
- Workspace/Research 本地管理（刚添加）
- 配置管理

---

## 五、总结

**核心优化点**：
1. 更清晰的 `RediggAgent` 类设计
2. 双模式连接（WebSocket + Polling）+ 自动重连
3. 清晰的状态机管理
4. 更健壮的任务处理（超时 + 重试）
5. 更好的错误处理和恢复

**保持兼容性**：
- 保留所有现有功能
- 渐进式重构，不破坏现有功能
- 可以分阶段实施

---

**下一步**: 确认优化方向，开始 Phase 1 实施。
