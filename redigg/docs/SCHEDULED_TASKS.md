# Redigg 定时任务规划

**版本**: 1.0  
**日期**: 2026-03-08  
**最后更新**: 2026-03-08  
**状态**: 规划中

---

## 📊 当前状态

### 已实现 ✅

| 任务 | 类型 | 频率 | 位置 | 状态 |
|------|------|------|------|------|
| Heartbeat | setInterval | 60 秒 | `src/agent/ResearchAgent.ts` | ✅ 运行中 |

### CronManager 状态 ⚪

- **位置**: `src/scheduling/CronManager.ts`
- **状态**: 已实现，**未注册任何任务**
- **能力**: 支持标准 Cron 表达式

---

## 🕐 当前 Heartbeat 详情

### 执行流程
```typescript
heartbeat() {
  // 1. 执行 Heartbeat 技能
  if (this.skillManager.getSkill('heartbeat')) {
      const result = await this.skillManager.executeSkill('heartbeat', 'system', {});
      
      // 1.1 记忆巩固
      memoryStats = result.memory;
      // - Working → Short-term (>1 小时)
      // - Short-term → Long-term (权重>5)
      // - 删除低价值记忆 (权重<0.5, >7 天)
      
      // 1.2 技能统计
      skillStats = result.skills;
      // - 活跃技能数量
      // - 技能包状态
  }
}
```

### 技能实现
**文件**: `skills/infra/heartbeat/index.ts`

```typescript
async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
  // 1. 记忆巩固
  memoryStats = await ctx.memory.consolidateMemories(userId);
  
  // 2. 技能系统检查
  skillStats = ctx.managers?.skill.getSkillStats();
  
  return {
    status: 'completed',
    timestamp: Date.now(),
    memory: memoryStats,
    skills: skillStats
  };
}
```

---

## 📅 规划中的定时任务

### P0 - 立即添加 (本周)

#### 1. 记忆深度整理
- **Cron**: `0 3 * * *` (每天凌晨 3 点)
- **功能**: 调用 LLM 合并相似记忆，生成记忆摘要
- **实现位置**: `src/memory/evolution/MemoryEvolutionSystem.ts`

```typescript
// 新增方法
public async deepConsolidate(userId: string): Promise<{
  merged: number;
  summarized: number;
}> {
  // 1. 查找相似记忆 (向量相似度 > 0.9)
  // 2. 调用 LLM 合并相似内容
  // 3. 生成高层摘要
  // 4. 更新记忆权重
}
```

---

#### 2. 技能质量评估
- **Cron**: `0 * * * *` (每小时整点)
- **功能**: 分析低分技能，触发自动优化
- **实现位置**: `src/skills/evolution/SkillEvolutionSystem.ts`

```typescript
// 新增方法
public async checkQuality(): Promise<{
  lowScoreSkills: Array<{id: string; rate: number}>;
  triggered: string[];
}> {
  // 1. 查询 FeedbackManager 获取技能成功率
  // 2. 识别成功率 < 70% 的技能
  // 3. 收集低分反馈
  // 4. 触发 evolveSkill() 进行优化
}
```

---

#### 3. 会话清理
- **Cron**: `0 4 * * *` (每天凌晨 4 点)
- **功能**: 删除 30 天未活动的会话
- **实现位置**: `src/session/SessionManager.ts`

```typescript
// 新增方法
public async cleanupInactiveSessions(days: number = 30): Promise<{
  deleted: number;
  archived: number;
}> {
  // 1. 查询 updated_at < NOW - days 的会话
  // 2. 备份到归档表 (可选)
  // 3. 删除会话及关联消息
  // 4. 清理孤立记忆
}
```

---

### P1 - 本周添加

#### 4. 自动备份
- **Cron**: `0 2 * * *` (每天凌晨 2 点)
- **功能**: 备份 SQLite 数据库到指定目录
- **实现位置**: `src/infra/backup.ts` (新建)

```typescript
// 新增模块
export class BackupManager {
  async backupDatabase(): Promise<string> {
    // 1. 复制 SQLite 文件
    // 2. 压缩为 .tar.gz
    // 3. 添加时间戳
    // 4. 保留最近 7 天备份
  }
}
```

---

#### 5. 用户活跃报告
- **Cron**: `0 9 * * MON` (每周一 9 点)
- **功能**: 生成用户周报 (会话数、技能使用、记忆增长)
- **实现位置**: `src/reporting/WeeklyReport.ts` (新建)

```typescript
// 新增模块
export class WeeklyReport {
  async generate(userId: string): Promise<{
    sessions: number;
    skillsUsed: Record<string, number>;
    memoriesAdded: number;
    topTopics: string[];
  }> {
    // 1. 统计本周会话数
    // 2. 统计技能使用频率
    // 3. 统计新增记忆
    // 4. 提取热门话题
  }
}
```

---

#### 6. 技能市场同步
- **Cron**: `0 */6 * * *` (每 6 小时)
- **功能**: 同步 ClawHub 技能列表，检查更新
- **实现位置**: `src/skills/SkillMarketSync.ts` (新建)

```typescript
// 新增模块
export class SkillMarketSync {
  async sync(): Promise<{
    new: number;
    updated: number;
    removed: number;
  }> {
    // 1. 获取 ClawHub 技能列表
    // 2. 对比本地技能
    // 3. 下载新技能/更新
    // 4. 标记已移除技能
  }
}
```

---

### P2 - 本月添加

#### 7. 向量索引重建
- **Cron**: `0 5 * * SUN` (每周日 5 点)
- **功能**: 重建向量索引，优化检索性能
- **实现位置**: `src/memory/VectorIndex.ts`

---

#### 8. 反馈数据导出
- **Cron**: `0 1 * * *` (每天凌晨 1 点)
- **功能**: 导出匿名反馈数据用于分析
- **实现位置**: `src/feedback/FeedbackExporter.ts`

---

#### 9. 系统健康检查
- **Cron**: `*/30 * * * *` (每 30 分钟)
- **功能**: 检查磁盘、内存、API 配额
- **实现位置**: `src/monitoring/HealthCheck.ts`

---

## 🔧 实现方案

### 修改 `src/agent/ResearchAgent.ts`

```typescript
public async start() {
  logger.info('Starting heartbeat...');
  this.heartbeatInterval = setInterval(() => this.heartbeat(), 60000);
  this.heartbeat().catch(e => logger.error('Initial heartbeat failed:', e));

  // ========== P0 任务 ==========
  
  // 1. 记忆深度整理 (每天 3 点)
  this.cronManager.scheduleTask(
    'daily-memory-deep-clean',
    '0 3 * * *',
    async () => {
      const users = await this.memoryManager.getAllUserIds();
      for (const userId of users) {
        await this.memoryEvo.deepConsolidate(userId);
      }
    }
  ).start();
  
  // 2. 技能质量检查 (每小时)
  this.cronManager.scheduleTask(
    'hourly-skill-quality-check',
    '0 * * * *',
    async () => {
      await this.skillEvo.checkQuality();
    }
  ).start();
  
  // 3. 会话清理 (每天 4 点)
  this.cronManager.scheduleTask(
    'daily-session-cleanup',
    '0 4 * * *',
    async () => {
      await this.sessionManager.cleanupInactiveSessions(30);
    }
  ).start();

  // ========== P1 任务 ==========
  
  // 4. 自动备份 (每天 2 点)
  // 5. 用户活跃报告 (每周一 9 点)
  // 6. 技能市场同步 (每 6 小时)
}
```

---

## 📊 任务总览

| 优先级 | 任务 | Cron | 预计工时 | 状态 |
|--------|------|------|----------|------|
| P0 | 记忆深度整理 | `0 3 * * *` | 2h | 📅 待实现 |
| P0 | 技能质量评估 | `0 * * * *` | 3h | 📅 待实现 |
| P0 | 会话清理 | `0 4 * * *` | 1h | 📅 待实现 |
| P1 | 自动备份 | `0 2 * * *` | 2h | 📅 待实现 |
| P1 | 用户活跃报告 | `0 9 * * MON` | 4h | 📅 待实现 |
| P1 | 技能市场同步 | `0 */6 * * *` | 3h | 📅 待实现 |
| P2 | 向量索引重建 | `0 5 * * SUN` | 4h | 📅 待实现 |
| P2 | 反馈数据导出 | `0 1 * * *` | 2h | 📅 待实现 |
| P2 | 系统健康检查 | `*/30 * * * *` | 3h | 📅 待实现 |

**总计**: 24 小时开发工作量

---

## 📈 监控指标

### 任务执行监控
```typescript
interface TaskMetrics {
  taskId: string;
  lastRun: Date;
  nextRun: Date;
  duration: number;  // 执行耗时
  success: boolean;
  error?: string;
}
```

### API 端点 (规划)
```
GET /api/cron/tasks          - 获取所有任务
GET /api/cron/tasks/:id      - 获取任务详情
POST /api/cron/tasks/:id/run - 手动执行任务
POST /api/cron/tasks/:id/toggle - 启用/禁用任务
```

---

## ⚠️ 注意事项

### 1. 时区问题
- 当前使用服务器本地时区 (Asia/Shanghai)
- 建议统一使用 UTC，在 cron 表达式中转换

### 2. 并发控制
- 避免多个任务同时执行导致资源竞争
- 建议使用队列或信号量

### 3. 错误处理
- 所有定时任务应有 try-catch 包裹
- 失败任务应记录日志并告警
- 考虑重试机制

### 4. 资源限制
- 避免在高峰期执行重任务
- 设置执行超时 (默认 30 分钟)
- 监控内存和 CPU 使用

---

## 📚 相关文件

- `src/scheduling/CronManager.ts` - Cron 任务管理器
- `src/agent/ResearchAgent.ts` - Agent 主入口 (心跳)
- `skills/infra/heartbeat/index.ts` - Heartbeat 技能
- `src/memory/MemoryManager.ts` - 记忆管理
- `src/session/SessionManager.ts` - 会话管理

---

**Redigg AI Team** 🦎
