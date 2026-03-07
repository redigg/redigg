import { RediggClient } from '../api/client';
import { getConfig } from '../config';

type AgentStatus = 'disconnected' | 'connecting' | 'connected' | 'idle' | 'busy' | 'error';

export interface AgentConfig {
  name: string;
}

export interface ConnectOptions {
  apiKey: string;
  endpoint?: string;
}

export interface Task {
  id: string;
  [key: string]: any;
}

export interface TaskResult {
  success: boolean;
  [key: string]: any;
}

export class RediggAgent {
  private config: AgentConfig;
  private apiKey: string | null = null;
  private client: RediggClient;
  private status: AgentStatus = 'disconnected';
  private currentTask: Task | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private taskHandler: ((task: Task) => Promise<TaskResult>) | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private consecutiveErrors = 0;
  private statusChangeHandlers: ((status: AgentStatus) => void)[] = [];
  private currentStep = 0;
  private maxSteps = 50; // 最大步骤限制，防止 runaway 执行
  private stepHistory: string[] = []; // 步骤历史，用于循环检测

  constructor(config: AgentConfig) {
    this.config = config;
    this.client = new RediggClient();
  }

  /**
   * 连接到 Redigg 平台
   */
  async connect(options: ConnectOptions): Promise<void> {
    if (this.status !== 'disconnected') {
      throw new Error('Agent already connected or connecting');
    }

    this.status = 'connecting';
    this.apiKey = options.apiKey;
    this.reconnectAttempts = 0;
    this.consecutiveErrors = 0;
    this.emitStatusChange(this.status);

    console.log(`[RediggAgent] Connecting...`);

    try {
      // 验证连接
      await this.validateConnection();
      this.status = 'connected';
      this.emitStatusChange(this.status);
      console.log(`[RediggAgent] Connected as ${this.config.name}`);

      // 尝试 WebSocket 连接，如果失败则回退到轮询
      try {
        await this.connectWebSocket();
      } catch (wsError) {
        console.warn('[RediggAgent] WebSocket connection failed, falling back to polling:', wsError);
        this.startPolling();
      }

      this.status = 'idle';
      this.emitStatusChange(this.status);
    } catch (error) {
      this.status = 'error';
      this.emitStatusChange(this.status);
      console.error('[RediggAgent] Connection failed:', error);
      throw error;
    }
  }

  /**
   * 验证连接
   */
  private async validateConnection(): Promise<void> {
    // 验证 API key
    if (!this.apiKey || this.apiKey.length === 0) {
      throw new Error('Invalid API key');
    }
    // 这里可以添加实际的 API 验证
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * 连接 WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    // TODO: 实现 WebSocket 连接
    console.log('[RediggAgent] WebSocket connection would be here');
    // 暂时抛出错误，回退到轮询
    throw new Error('WebSocket not implemented yet');
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.status = 'disconnected';
    this.emitStatusChange(this.status);

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    console.log('[RediggAgent] Disconnected');
  }

  /**
   * 监听新任务
   */
  onTask(handler: (task: Task) => Promise<TaskResult>): void {
    this.taskHandler = handler;
    console.log('[RediggAgent] Task handler registered');
  }

  /**
   * 监听状态变更
   */
  onStatusChange(handler: (status: AgentStatus) => void): void {
    this.statusChangeHandlers.push(handler);
  }

  /**
   * 触发状态变更事件
   */
  private emitStatusChange(status: AgentStatus): void {
    for (const handler of this.statusChangeHandlers) {
      try {
        handler(status);
      } catch (error) {
        console.error('[RediggAgent] Status change handler error:', error);
      }
    }
  }

  /**
   * 记录错误
   */
  private recordError(): void {
    this.consecutiveErrors++;
  }

  /**
   * 重置错误计数
   */
  private resetErrors(): void {
    this.consecutiveErrors = 0;
  }

  /**
   * 开始轮询任务（WebSocket 失败时的回退方案）
   */
  private startPolling(): void {
    if (this.pollInterval) {
      return;
    }

    console.log('[RediggAgent] Starting task polling (fallback)...');

    this.pollInterval = setInterval(async () => {
      if (!this.isConnected() || !this.taskHandler || this.status === 'busy') {
        return;
      }

      try {
        // 模拟获取任务
        const tasks = await this.fetchTasks();

        for (const task of tasks) {
          await this.handleNewTask(task);
        }

        this.resetErrors();
      } catch (error) {
        this.recordError();
        console.error('[RediggAgent] Error polling tasks:', error);

        // 如果连续错误太多，尝试重连
        if (this.consecutiveErrors >= 3) {
          console.warn('[RediggAgent] Too many consecutive errors, attempting reconnect...');
          await this.attemptReconnect();
        }
      }
    }, 5000); // 每 5 秒轮询一次
  }

  /**
   * 获取任务（模拟）
   */
  private async fetchTasks(): Promise<Task[]> {
    // TODO: 实际调用 API 获取任务
    return [];
  }

  /**
   * 重置步骤计数
   */
  private resetSteps(): void {
    this.currentStep = 0;
    this.stepHistory = [];
  }

  /**
   * 记录步骤（用于循环检测）
   */
  private recordStep(stepDescription: string): boolean {
    this.currentStep++;

    // 检查步骤限制
    if (this.currentStep > this.maxSteps) {
      console.error(`[RediggAgent] Step limit exceeded: ${this.currentStep} > ${this.maxSteps}`);
      return false;
    }

    // 检查循环检测
    const stepKey = stepDescription.slice(0, 100); // 取前100字符作为key
    const recentHistory = this.stepHistory.slice(-10); // 检查最近10步
    const loopCount = recentHistory.filter(s => s === stepKey).length;

    if (loopCount >= 3) {
      console.error(`[RediggAgent] Loop detected: step "${stepKey}" repeated ${loopCount} times`);
      return false;
    }

    this.stepHistory.push(stepKey);
    return true;
  }

  /**
   * 处理新任务
   */
  private async handleNewTask(task: Task): Promise<void> {
    if (!this.taskHandler) {
      console.warn('[RediggAgent] No task handler registered');
      return;
    }

    if (this.status === 'busy') {
      console.warn('[RediggAgent] Agent busy, skipping task');
      return;
    }

    this.status = 'busy';
    this.currentTask = task;
    this.resetSteps(); // 重置步骤计数
    this.emitStatusChange(this.status);

    try {
      console.log(`[RediggAgent] Executing task: ${task.id}`);

      // 记录第一步
      if (!this.recordStep(`Start task: ${task.id}`)) {
        throw new Error('Step limit exceeded or loop detected at start');
      }

      // 执行任务（带超时）
      const result = await this.executeWithTimeout(
        () => this.taskHandler!(task),
        5 * 60 * 1000 // 5 分钟超时
      );

      // 记录完成步骤
      this.recordStep(`Complete task: ${task.id}`);

      // 提交结果（带重试）
      await this.submitResultWithRetry(task.id, result);

      console.log(`[RediggAgent] Task completed: ${task.id}`);
      this.resetErrors();
    } catch (error) {
      console.error(`[RediggAgent] Task failed: ${task.id}`, error);
      this.recordError();

      // 提交错误结果
      try {
        await this.submitResultWithRetry(task.id, {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      } catch (submitError) {
        console.error('[RediggAgent] Failed to submit error result:', submitError);
      }
    } finally {
      this.status = 'idle';
      this.currentTask = null;
      this.emitStatusChange(this.status);
    }
  }

  /**
   * 带超时的执行
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Task execution timed out'));
      }, timeoutMs);
    });

    try {
      return await Promise.race([fn(), timeoutPromise]);
    } finally {
      if (timeoutId!) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * 提交结果（带重试）
   */
  private async submitResultWithRetry(
    taskId: string,
    result: TaskResult,
    maxRetries = 3
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[RediggAgent] Submitting result for task ${taskId} (attempt ${attempt}/${maxRetries})...`);

        // TODO: 实际调用 API 提交结果
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log(`[RediggAgent] Result submitted for task ${taskId}`);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`[RediggAgent] Submit failed (attempt ${attempt}/${maxRetries}):`, lastError);

        if (attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt - 1); // 指数退避
          console.log(`[RediggAgent] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Failed to submit result after retries');
  }

  /**
   * 尝试重连
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[RediggAgent] Max reconnect attempts reached');
      this.status = 'error';
      this.emitStatusChange(this.status);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[RediggAgent] Attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);

    await new Promise(resolve => setTimeout(resolve, delay));

    // 尝试重连
    try {
      this.status = 'connecting';
      this.emitStatusChange(this.status);

      await this.validateConnection();

      this.status = 'idle';
      this.reconnectAttempts = 0;
      this.resetErrors();
      this.emitStatusChange(this.status);

      console.log('[RediggAgent] Reconnected successfully');
    } catch (error) {
      console.error('[RediggAgent] Reconnect failed:', error);
      // 继续尝试重连
      await this.attemptReconnect();
    }
  }

  /**
   * 获取 Agent 配置
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * 获取当前状态
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.status === 'connected' || this.status === 'idle' || this.status === 'busy';
  }

  /**
   * 获取当前任务
   */
  getCurrentTask(): Task | null {
    return this.currentTask;
  }

  /**
   * 获取连续错误计数
   */
  getConsecutiveErrors(): number {
    return this.consecutiveErrors;
  }
}
