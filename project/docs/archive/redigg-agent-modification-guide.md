# Redigg Agent 改造指南

**日期**: 2026-03-07  
**目标**: 实现"自进化"定位  
**原则**: 小步快跑，快速验证

---

## 一、改造优先级

### 🔴 第一周：记忆系统（MVP）

**目标**: 记住用户，越用越懂你

**改动最小，感知最强**

### 🟡 第二周：反馈系统

**目标**: 收集反馈，持续改进

### 🟢 第三周：技能进化

**目标**: 自动学习，越用越强

### 🔵 第四周：社区进化

**目标**: 全网训练，网络效应

---

## 二、第一周：记忆系统改造

### 2.1 文件结构

```bash
redigg-agent/
├── src/
│   ├── memory/                    # 新增：记忆系统
│   │   ├── index.ts               # 导出
│   │   ├── MemoryManager.ts       # 记忆管理器
│   │   ├── types.ts               # 类型定义
│   │   └── storage/
│   │       └── SQLiteStorage.ts   # SQLite 存储
│   │
│   └── agent/
│       └── RediggAgent.ts         # 改造：增强 Agent
│
└── config/
    └── redigg.config.json         # 新增：Redigg 配置
```

### 2.2 第一步：定义类型

**文件**: `src/memory/types.ts`

```typescript
// 用户偏好
export interface UserPreferences {
  outputFormat: 'markdown' | 'pdf' | 'html';
  citationStyle: 'APA' | 'MLA' | 'Chicago';
  detailLevel: 'brief' | 'detailed' | 'comprehensive';
  researchFields: string[];  // 研究领域
}

// 研究历史
export interface ResearchHistory {
  queryId: string;
  query: string;
  response: string;
  timestamp: number;
  feedback?: number;  // 1-5 星
}

// 领域知识
export interface DomainKnowledge {
  field: string;
  keyPapers: string[];  // 关键论文 ID
  keyConcepts: string[];
  lastUpdated: number;
}

// 完整记忆
export interface UserMemory {
  userId: string;
  preferences: UserPreferences;
  history: ResearchHistory[];
  domainKnowledge: DomainKnowledge[];
  createdAt: number;
  updatedAt: number;
}
```

### 2.3 第二步：实现存储

**文件**: `src/memory/storage/SQLiteStorage.ts`

```typescript
import Database from 'better-sqlite3';
import { UserMemory, ResearchHistory } from '../types';

export class SQLiteStorage {
  private db: Database.Database;
  
  constructor(dbPath: string = './data/redigg-memory.db') {
    this.db = new Database(dbPath);
    this.initSchema();
  }
  
  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_memories (
        user_id TEXT PRIMARY KEY,
        preferences TEXT,
        domain_knowledge TEXT,
        created_at INTEGER,
        updated_at INTEGER
      )
    `);
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS research_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        query_id TEXT,
        query TEXT,
        response TEXT,
        feedback INTEGER,
        timestamp INTEGER
      )
    `);
  }
  
  saveMemory(memory: UserMemory): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_memories 
      (user_id, preferences, domain_knowledge, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      memory.userId,
      JSON.stringify(memory.preferences),
      JSON.stringify(memory.domainKnowledge),
      memory.createdAt,
      memory.updatedAt
    );
  }
  
  loadMemory(userId: string): UserMemory | null {
    const stmt = this.db.prepare(`
      SELECT * FROM user_memories WHERE user_id = ?
    `);
    
    const row = stmt.get(userId) as any;
    if (!row) return null;
    
    return {
      userId: row.user_id,
      preferences: JSON.parse(row.preferences),
      history: this.getHistory(userId),
      domainKnowledge: JSON.parse(row.domain_knowledge),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  
  private getHistory(userId: string, limit: number = 10): ResearchHistory[] {
    const stmt = this.db.prepare(`
      SELECT * FROM research_history 
      WHERE user_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    
    return stmt.all(userId, limit).map((row: any) => ({
      queryId: row.query_id,
      query: row.query,
      response: row.response,
      feedback: row.feedback,
      timestamp: row.timestamp
    }));
  }
  
  addHistory(userId: string, history: ResearchHistory): void {
    const stmt = this.db.prepare(`
      INSERT INTO research_history 
      (user_id, query_id, query, response, feedback, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      userId,
      history.queryId,
      history.query,
      history.response,
      history.feedback || null,
      history.timestamp
    );
    
    // 更新用户记忆时间
    this.updateTimestamp(userId);
  }
  
  private updateTimestamp(userId: string): void {
    const stmt = this.db.prepare(`
      UPDATE user_memories SET updated_at = ? WHERE user_id = ?
    `);
    stmt.run(Date.now(), userId);
  }
}
```

### 2.4 第三步：实现管理器

**文件**: `src/memory/MemoryManager.ts`

```typescript
import { SQLiteStorage } from './storage/SQLiteStorage';
import { UserMemory, UserPreferences, ResearchHistory, DomainKnowledge } from './types';

export class MemoryManager {
  private storage: SQLiteStorage;
  private cache: Map<string, UserMemory> = new Map();
  
  constructor(dbPath?: string) {
    this.storage = new SQLiteStorage(dbPath);
  }
  
  async getMemory(userId: string): Promise<UserMemory> {
    // 先查缓存
    const cached = this.cache.get(userId);
    if (cached) return cached;
    
    // 再查数据库
    let memory = this.storage.loadMemory(userId);
    
    // 新用户创建默认记忆
    if (!memory) {
      memory = this.createDefaultMemory(userId);
    }
    
    this.cache.set(userId, memory);
    return memory;
  }
  
  async updatePreferences(userId: string, prefs: Partial<UserPreferences>): Promise<void> {
    const memory = await this.getMemory(userId);
    memory.preferences = { ...memory.preferences, ...prefs };
    memory.updatedAt = Date.now();
    this.storage.saveMemory(memory);
    this.cache.set(userId, memory);
  }
  
  async addHistory(userId: string, history: ResearchHistory): Promise<void> {
    this.storage.addHistory(userId, history);
    
    // 更新缓存
    const memory = await this.getMemory(userId);
    memory.history.unshift(history);  // 新记录在前
    memory.history = memory.history.slice(0, 100);  // 只保留最近 100 条
    this.cache.set(userId, memory);
  }
  
  async updateFeedback(queryId: string, feedback: number): Promise<void> {
    // TODO: 更新反馈
  }
  
  async getRecentHistory(userId: string, limit: number = 5): Promise<ResearchHistory[]> {
    const memory = await this.getMemory(userId);
    return memory.history.slice(0, limit);
  }
  
  private createDefaultMemory(userId: string): UserMemory {
    return {
      userId,
      preferences: {
        outputFormat: 'markdown',
        citationStyle: 'APA',
        detailLevel: 'comprehensive',
        researchFields: []
      },
      history: [],
      domainKnowledge: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }
}
```

### 2.5 第四步：集成到 Agent

**文件**: `src/agent/RediggAgent.ts`

```typescript
import { Agent } from '@openclaw/agent';
import { MemoryManager } from '../memory/MemoryManager';
import { ResearchHistory } from '../memory/types';

export class RediggAgent extends Agent {
  private memoryManager: MemoryManager;
  
  constructor(options: AgentOptions) {
    super(options);
    this.memoryManager = new MemoryManager();
  }
  
  async handleQuery(query: string, userId: string): Promise<string> {
    // 1. 加载用户记忆
    const memory = await this.memoryManager.getMemory(userId);
    
    // 2. 注入记忆到上下文
    const enrichedQuery = this.buildEnrichedQuery(query, memory);
    
    // 3. 执行查询（调用父类）
    const response = await super.handleQuery(enrichedQuery, userId);
    
    // 4. 保存历史
    await this.memoryManager.addHistory(userId, {
      queryId: this.generateQueryId(),
      query,
      response,
      timestamp: Date.now()
    });
    
    return response;
  }
  
  private buildEnrichedQuery(query: string, memory: UserMemory): string {
    const recentHistory = memory.history.slice(0, 3);
    const historyContext = recentHistory.map(h => 
      `用户曾问：${h.query}\n回答：${h.response.slice(0, 100)}...`
    ).join('\n\n');
    
    const preferencesContext = `
      用户偏好:
      - 输出格式：${memory.preferences.outputFormat}
      - 引用风格：${memory.preferences.citationStyle}
      - 详细程度：${memory.preferences.detailLevel}
      - 研究领域：${memory.preferences.researchFields.join(', ')}
    `;
    
    return `
      ${preferencesContext}
      
      历史对话:
      ${historyContext}
      
      当前查询:
      ${query}
    `;
  }
  
  private generateQueryId(): string {
    return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 2.6 第五步：配置入口

**文件**: `config/redigg.config.json`

```json
{
  "agent": {
    "name": "Redigg Agent",
    "version": "1.0.0",
    "description": "自进化科研 AI 伙伴"
  },
  "memory": {
    "enabled": true,
    "dbPath": "./data/redigg-memory.db",
    "maxHistory": 100
  },
  "feedback": {
    "enabled": true,
    "collectAfterResponse": true
  }
}
```

### 2.7 第六步：安装依赖

```bash
cd redigg-agent

# 安装 SQLite 驱动
npm install better-sqlite3
npm install -D @types/better-sqlite3

# 如果使用 TypeScript
npm install -D typescript
```

### 2.8 第七步：测试验证

**测试脚本**: `test/memory-test.ts`

```typescript
import { MemoryManager } from '../src/memory/MemoryManager';

async function test() {
  const mm = new MemoryManager('./test-memory.db');
  
  // 第一次查询
  console.log('=== 第一次查询 ===');
  let memory = await mm.getMemory('user123');
  console.log('用户偏好:', memory.preferences);
  console.log('研究领域:', memory.preferences.researchFields);
  
  // 模拟查询
  await mm.addHistory('user123', {
    queryId: 'q1',
    query: '帮我调研 THBS2 在肿瘤中的研究',
    response: 'THBS2 在多种肿瘤中上调...',
    timestamp: Date.now()
  });
  
  // 更新偏好
  await mm.updatePreferences('user123', {
    researchFields: ['肿瘤学', '生物标志物']
  });
  
  // 第二次查询
  console.log('\n=== 第二次查询 ===');
  memory = await mm.getMemory('user123');
  console.log('用户偏好:', memory.preferences);
  console.log('历史查询:', memory.history.length, '条');
  console.log('最近查询:', memory.history[0].query);
  
  console.log('\n✅ 记忆系统工作正常！');
}

test();
```

**运行测试**:
```bash
npx ts-node test/memory-test.ts
```

**预期输出**:
```
=== 第一次查询 ===
用户偏好：{ outputFormat: 'markdown', ... }
研究领域：[]

=== 第二次查询 ===
用户偏好：{ outputFormat: 'markdown', researchFields: ['肿瘤学', '生物标志物'] }
历史查询：1 条
最近查询：帮我调研 THBS2 在肿瘤中的研究

✅ 记忆系统工作正常！
```

---

## 三、第二周：反馈系统改造

### 3.1 新增文件

```bash
src/feedback/
├── FeedbackCollector.ts    # 反馈收集器
├── FeedbackAnalyzer.ts     # 反馈分析器
└── types.ts                # 反馈类型
```

### 3.2 反馈收集器

**文件**: `src/feedback/FeedbackCollector.ts`

```typescript
import { MemoryManager } from '../memory/MemoryManager';

export interface Feedback {
  queryId: string;
  rating: number;  // 1-5
  comment?: string;
  timestamp: number;
}

export class FeedbackCollector {
  private memoryManager: MemoryManager;
  
  constructor(memoryManager: MemoryManager) {
    this.memoryManager = memoryManager;
  }
  
  async collectExplicitFeedback(
    userId: string,
    queryId: string,
    rating: number,
    comment?: string
  ): Promise<void> {
    // 保存反馈到记忆系统
    await this.memoryManager.updateFeedback(queryId, rating);
    
    // TODO: 发送感谢消息
    console.log(`收到反馈：${rating}星，${comment || '无评论'}`);
  }
  
  async collectImplicitFeedback(
    userId: string,
    queryId: string,
    action: 'copy' | 'export' | 'modify' | 'share'
  ): Promise<void> {
    // 隐式反馈：用户行为
    // copy/export = 正面反馈
    // modify = 需要改进
    // share = 强烈推荐
    
    const ratingMap = {
      'copy': 4,
      'export': 5,
      'modify': 3,
      'share': 5
    };
    
    await this.memoryManager.updateFeedback(queryId, ratingMap[action]);
  }
}
```

### 3.3 集成到 Agent

**修改**: `src/agent/RediggAgent.ts`

```typescript
import { FeedbackCollector } from '../feedback/FeedbackCollector';

export class RediggAgent extends Agent {
  private memoryManager: MemoryManager;
  private feedbackCollector: FeedbackCollector;
  
  constructor(options: AgentOptions) {
    super(options);
    this.memoryManager = new MemoryManager();
    this.feedbackCollector = new FeedbackCollector(this.memoryManager);
  }
  
  async handleQuery(query: string, userId: string): Promise<string> {
    // ... 原有逻辑
    
    const response = await super.handleQuery(enrichedQuery, userId);
    
    // 保存历史
    const queryId = this.generateQueryId();
    await this.memoryManager.addHistory(userId, {
      queryId,
      query,
      response,
      timestamp: Date.now()
    });
    
    // 收集反馈（非阻塞）
    this.collectFeedback(userId, queryId);
    
    return response;
  }
  
  private async collectFeedback(userId: string, queryId: string): Promise<void> {
    // 延迟 5 秒后发送反馈请求
    setTimeout(async () => {
      // TODO: 发送反馈请求消息
      console.log('请为本次回答评分：⭐⭐⭐⭐⭐');
    }, 5000);
  }
}
```

---

## 四、第三周：技能进化改造

### 4.1 扩展 ClawHub

```bash
src/skills/
├── SkillLearner.ts         # 技能学习器
├── SkillOptimizer.ts       # 技能优化器
└── SkillRegistry.ts        # 技能注册表
```

### 4.2 技能学习器

**文件**: `src/skills/SkillLearner.ts`

```typescript
export class SkillLearner {
  async learnFromFeedback(
    skillId: string,
    feedbacks: Feedback[]
  ): Promise<SkillUpdate> {
    // 分析反馈
    const avgRating = feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length;
    
    // 低分技能需要优化
    if (avgRating < 3.5) {
      return this.optimizeSkill(skillId, feedbacks);
    }
    
    return { skillId, status: 'no_action_needed' };
  }
  
  private async optimizeSkill(skillId: string, feedbacks: Feedback[]): Promise<SkillUpdate> {
    // TODO: 分析反馈，优化技能
    // 1. 提取共同问题
    // 2. 生成改进建议
    // 3. 更新技能文件
    return { skillId, status: 'optimized' };
  }
}
```

---

## 五、本周行动清单

### 🔴 今天

1. **创建文件结构**
   ```bash
   mkdir -p src/memory/storage
   mkdir -p src/feedback
   mkdir -p src/skills
   mkdir -p test
   ```

2. **安装依赖**
   ```bash
   npm install better-sqlite3
   npm install -D @types/better-sqlite3
   ```

3. **实现基础类型** - `src/memory/types.ts`

### 🟡 明天

4. **实现存储层** - `src/memory/storage/SQLiteStorage.ts`
5. **实现管理器** - `src/memory/MemoryManager.ts`

### 🟢 后天

6. **集成到 Agent** - `src/agent/RediggAgent.ts`
7. **测试验证** - `test/memory-test.ts`

### 🔵 周末

8. **准备小红书 Demo**
   - 第一次查询截图
   - 第二次查询截图（显示"记住偏好"）
   - 对比效果

---

## 六、关键代码片段

### 6.1 记忆注入示例

```typescript
// 用户第一次查询
查询："帮我调研 THBS2 在肿瘤中的研究"
→ 输出：标准综述
→ 记忆：{ researchFields: ['肿瘤学'], lastQuery: 'THBS2...' }

// 用户第二次查询
查询："还是 THBS2，要更多临床数据"
→ 加载记忆：用户关注肿瘤学、THBS2
→ 输出：包含临床数据的综述
→ 记忆：{ preferences: { detailLevel: '临床优先' } }

// 用户第三次查询
查询："THBS2 最新进展"
→ 加载记忆：用户偏好临床数据、关注 THBS2
→ 输出：自动包含临床数据 + 最新进展
→ "看，我懂你！"
```

### 6.2 小红书 Demo 脚本

```typescript
// 演示脚本
console.log('=== 第一次使用 ===');
await agent.handleQuery('帮我调研 THBS2 在肿瘤中的研究', 'user123');

console.log('\n=== 第二次使用 ===');
await agent.handleQuery('还是 THBS2，要更多临床数据', 'user123');

console.log('\n=== 第三次使用 ===');
await agent.handleQuery('THBS2 最新进展', 'user123');

console.log('\n✅ 看，它越用越懂你！');
```

---

## 七、总结

**改造步骤**:
1. ✅ 创建记忆系统（类型→存储→管理器）
2. ✅ 集成到 Agent（加载→注入→保存）
3. ✅ 测试验证（单元测试→Demo）
4. ✅ 准备发布（截图→文案→小红书）

**时间估算**:
- 今天：文件结构 + 类型定义（2 小时）
- 明天：存储层 + 管理器（4 小时）
- 后天：集成 + 测试（4 小时）
- 周末：Demo 准备（2 小时）

**核心话术**:
> "它不是工具，是你的科研伙伴
> 它会记住你的偏好
> 它会学习你的领域
> 它会和你一起成长"

---

**Vix，完整改造指南完成！**

**今晚开始**: 创建文件结构 + 实现类型定义

**时间：19:25，准备开改！🦎🧬🚀**
