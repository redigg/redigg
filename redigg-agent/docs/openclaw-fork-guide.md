# 基于 OpenClaw 二次开发指南

**日期**: 2026-03-07  
**目标**: 打造 Redigg 定制化 OpenClaw  
**原则**: 最小改动，最大复用

---

## 一、二次开发策略

### 策略选择

| 策略 | 说明 | 优点 | 缺点 | 推荐度 |
|------|------|------|------|--------|
| **Fork 仓库** | Fork openclaw/openclaw | 完全控制 | 合并更新困难 | ⭐⭐⭐ |
| **NPM 包扩展** | 继承@openclaw/agent | 易于更新 | 定制能力有限 | ⭐⭐⭐⭐ |
| **插件系统** | 开发 OpenClaw 插件 | 解耦清晰 | 功能受限 | ⭐⭐ |
| **配置定制** | 仅修改配置 | 最简单 | 能力最弱 | ⭐ |

### 推荐方案：**NPM 包扩展 + 配置定制**

**理由**:
- ✅ 易于更新（OpenClaw 升级时受益）
- ✅ 定制能力强（可扩展核心）
- ✅ 解耦清晰（Redigg 代码独立）
- ✅ 社区友好（可贡献回 OpenClaw）

---

## 二、项目结构

### 2.1 推荐结构

```
redigg-agent/                    # 你的项目
├── package.json
├── tsconfig.json
│
├── src/                         # 你的代码
│   ├── agent/
│   │   └── RediggAgent.ts      # 扩展 OpenClaw Agent
│   ├── memory/                  # 自研模块
│   │   ├── MemoryManager.ts
│   │   └── ...
│   └── index.ts
│
├── config/
│   └── redigg.config.json       # Redigg 配置
│
└── scripts/
    └── setup.ts                 # 初始化脚本
```

### 2.2 依赖关系

```json
{
  "name": "@redigg/agent",
  "version": "1.0.0",
  "dependencies": {
    "@openclaw/agent": "^2026.3.3",
    "@openclaw/gateway": "^2026.3.3",
    "better-sqlite3": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## 三、具体步骤

### 3.1 第一步：初始化项目

```bash
# 创建项目目录
mkdir redigg-agent
cd redigg-agent

# 初始化 npm 项目
npm init -y

# 安装 OpenClaw 核心包
npm install @openclaw/agent @openclaw/gateway

# 安装开发依赖
npm install -D typescript @types/node

# 安装自定义依赖
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

### 3.2 第二步：配置 TypeScript

**文件**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 3.3 第三步：扩展 OpenClaw Agent

**文件**: `src/agent/RediggAgent.ts`

```typescript
import { Agent, AgentOptions, Message } from '@openclaw/agent';
import { MemoryManager } from '../memory/MemoryManager';

export interface RediggAgentOptions extends AgentOptions {
  memoryEnabled?: boolean;
  memoryDbPath?: string;
}

export class RediggAgent extends Agent {
  private memoryManager: MemoryManager;
  private memoryEnabled: boolean;
  
  constructor(options: RediggAgentOptions) {
    super(options);
    this.memoryEnabled = options.memoryEnabled ?? true;
    
    if (this.memoryEnabled) {
      this.memoryManager = new MemoryManager(options.memoryDbPath);
    }
  }
  
  /**
   * 重写 handleQuery 方法，添加记忆功能
   */
  async handleQuery(query: string, userId: string): Promise<string> {
    // 1. 加载记忆（如果启用）
    if (this.memoryEnabled) {
      const memory = await this.memoryManager.getMemory(userId);
      
      // 2. 注入记忆到上下文
      query = this.enrichQueryWithMemory(query, memory);
    }
    
    // 3. 调用父类处理
    const response = await super.handleQuery(query, userId);
    
    // 4. 保存历史（如果启用）
    if (this.memoryEnabled) {
      await this.memoryManager.addHistory(userId, {
        queryId: this.generateQueryId(),
        query,
        response,
        timestamp: Date.now()
      });
    }
    
    return response;
  }
  
  /**
   * 注入记忆到查询
   */
  private enrichQueryWithMemory(query: string, memory: any): string {
    const recentHistory = memory.history?.slice(0, 3) || [];
    const historyContext = recentHistory.map((h: any) => 
      `用户曾问：${h.query}`
    ).join('\n');
    
    const preferences = memory.preferences || {};
    const preferencesContext = `
      用户偏好:
      - 输出格式：${preferences.outputFormat || 'markdown'}
      - 引用风格：${preferences.citationStyle || 'APA'}
      - 研究领域：${preferences.researchFields?.join(', ') || '未指定'}
    `;
    
    return `${preferencesContext}\n\n历史对话:\n${historyContext}\n\n当前查询:\n${query}`;
  }
  
  private generateQueryId(): string {
    return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 获取记忆管理器（用于外部访问）
   */
  getMemoryManager(): MemoryManager | null {
    return this.memoryEnabled ? this.memoryManager : null;
  }
}
```

### 3.4 第四步：实现记忆管理器

**文件**: `src/memory/MemoryManager.ts`

```typescript
import Database from 'better-sqlite3';

export interface UserPreferences {
  outputFormat: 'markdown' | 'pdf' | 'html';
  citationStyle: 'APA' | 'MLA' | 'Chicago';
  detailLevel: 'brief' | 'detailed' | 'comprehensive';
  researchFields: string[];
}

export interface ResearchHistory {
  queryId: string;
  query: string;
  response: string;
  timestamp: number;
  feedback?: number;
}

export interface UserMemory {
  userId: string;
  preferences: UserPreferences;
  history: ResearchHistory[];
  createdAt: number;
  updatedAt: number;
}

export class MemoryManager {
  private db: Database.Database;
  private cache: Map<string, UserMemory> = new Map();
  
  constructor(dbPath: string = './data/redigg-memory.db') {
    // 确保目录存在
    const fs = require('fs');
    const path = require('path');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    this.db = new Database(dbPath);
    this.initSchema();
  }
  
  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_memories (
        user_id TEXT PRIMARY KEY,
        preferences TEXT,
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
  
  async getMemory(userId: string): Promise<UserMemory> {
    // 先查缓存
    const cached = this.cache.get(userId);
    if (cached) return cached;
    
    // 再查数据库
    const stmt = this.db.prepare('SELECT * FROM user_memories WHERE user_id = ?');
    const row = stmt.get(userId) as any;
    
    let memory: UserMemory;
    if (!row) {
      // 新用户创建默认记忆
      memory = this.createDefaultMemory(userId);
      this.saveMemory(memory);
    } else {
      memory = {
        userId: row.user_id,
        preferences: JSON.parse(row.preferences),
        history: this.getHistory(userId),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }
    
    this.cache.set(userId, memory);
    return memory;
  }
  
  async updatePreferences(userId: string, prefs: Partial<UserPreferences>): Promise<void> {
    const memory = await this.getMemory(userId);
    memory.preferences = { ...memory.preferences, ...prefs };
    memory.updatedAt = Date.now();
    this.saveMemory(memory);
  }
  
  async addHistory(userId: string, history: ResearchHistory): Promise<void> {
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
    const updateStmt = this.db.prepare(`
      UPDATE user_memories SET updated_at = ? WHERE user_id = ?
    `);
    updateStmt.run(Date.now(), userId);
    
    // 更新缓存
    const memory = this.cache.get(userId);
    if (memory) {
      memory.history.unshift(history);
      memory.history = memory.history.slice(0, 100);  // 只保留最近 100 条
      memory.updatedAt = Date.now();
    }
  }
  
  async getRecentHistory(userId: string, limit: number = 5): Promise<ResearchHistory[]> {
    const memory = await this.getMemory(userId);
    return memory.history.slice(0, limit);
  }
  
  private saveMemory(memory: UserMemory): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_memories 
      (user_id, preferences, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(
      memory.userId,
      JSON.stringify(memory.preferences),
      memory.createdAt,
      memory.updatedAt
    );
  }
  
  private getHistory(userId: string, limit: number = 100): ResearchHistory[] {
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
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }
  
  close() {
    this.db.close();
  }
}
```

### 3.5 第五步：创建入口文件

**文件**: `src/index.ts`

```typescript
export { RediggAgent, RediggAgentOptions } from './agent/RediggAgent';
export { MemoryManager, UserPreferences, ResearchHistory, UserMemory } from './memory/MemoryManager';

// 快捷创建函数
import { RediggAgent, RediggAgentOptions } from './agent/RediggAgent';

export function createRediggAgent(options: RediggAgentOptions): RediggAgent {
  return new RediggAgent(options);
}

// 默认配置
export const defaultOptions: RediggAgentOptions = {
  name: 'Redigg Agent',
  version: '1.0.0',
  description: '自进化科研 AI 伙伴',
  memoryEnabled: true,
  memoryDbPath: './data/redigg-memory.db'
};
```

### 3.6 第六步：创建配置文件

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
    "collectAfterResponse": true,
    "delayMs": 5000
  },
  "openclaw": {
    "gateway": {
      "enabled": true,
      "port": 3000
    },
    "channels": {
      "telegram": {
        "enabled": false
      },
      "discord": {
        "enabled": false
      },
      "feishu": {
        "enabled": true
      }
    }
  }
}
```

### 3.7 第七步：创建启动脚本

**文件**: `scripts/start.ts`

```typescript
import { createRediggAgent, defaultOptions } from '../src';
import { Gateway } from '@openclaw/gateway';

async function main() {
  // 1. 创建 Redigg Agent
  const agent = createRediggAgent({
    ...defaultOptions,
    model: 'dashscope-coding/qwen3.5-plus'
  });
  
  // 2. 创建 Gateway
  const gateway = new Gateway({
    port: 3000,
    agent
  });
  
  // 3. 启动服务
  await gateway.start();
  
  console.log('🦎 Redigg Agent 已启动！');
  console.log('📍 Gateway 运行在 http://localhost:3000');
  
  // 优雅退出
  process.on('SIGINT', async () => {
    console.log('\n正在关闭...');
    await gateway.stop();
    process.exit(0);
  });
}

main().catch(console.error);
```

### 3.8 第八步：更新 package.json

**文件**: `package.json`

```json
{
  "name": "@redigg/agent",
  "version": "1.0.0",
  "description": "自进化科研 AI 伙伴 - 基于 OpenClaw",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "start": "ts-node scripts/start.ts",
    "dev": "ts-node-dev --respawn scripts/start.ts",
    "test": "jest",
    "clean": "rm -rf dist"
  },
  "keywords": [
    "redigg",
    "ai",
    "research",
    "openclaw",
    "agent"
  ],
  "author": "Redigg Team",
  "license": "MIT",
  "dependencies": {
    "@openclaw/agent": "^2026.3.3",
    "@openclaw/gateway": "^2026.3.3",
    "better-sqlite3": "^9.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0",
    "ts-node-dev": "^2.0.0"
  }
}
```

---

## 四、测试验证

### 4.1 单元测试

**文件**: `test/memory.test.ts`

```typescript
import { MemoryManager } from '../src/memory/MemoryManager';

describe('MemoryManager', () => {
  let mm: MemoryManager;
  
  beforeEach(() => {
    mm = new MemoryManager('./test-memory.db');
  });
  
  afterEach(() => {
    mm.close();
  });
  
  it('应该创建默认记忆', async () => {
    const memory = await mm.getMemory('user123');
    
    expect(memory.userId).toBe('user123');
    expect(memory.preferences.outputFormat).toBe('markdown');
    expect(memory.history).toEqual([]);
  });
  
  it('应该更新偏好', async () => {
    await mm.updatePreferences('user123', {
      researchFields: ['肿瘤学', '生物标志物']
    });
    
    const memory = await mm.getMemory('user123');
    expect(memory.preferences.researchFields).toContain('肿瘤学');
  });
  
  it('应该添加历史', async () => {
    await mm.addHistory('user123', {
      queryId: 'q1',
      query: '测试查询',
      response: '测试回答',
      timestamp: Date.now()
    });
    
    const history = await mm.getRecentHistory('user123');
    expect(history.length).toBe(1);
    expect(history[0].query).toBe('测试查询');
  });
});
```

### 4.2 集成测试

**文件**: `test/integration.test.ts`

```typescript
import { createRediggAgent } from '../src';

describe('RediggAgent 集成测试', () => {
  it('应该记住用户偏好', async () => {
    const agent = createRediggAgent({
      name: 'Test Agent',
      memoryEnabled: true,
      memoryDbPath: './test-integration.db'
    });
    
    // 第一次查询
    const response1 = await agent.handleQuery(
      '帮我调研 THBS2 在肿瘤中的研究',
      'user123'
    );
    expect(response1).toBeDefined();
    
    // 更新偏好
    const memoryManager = agent.getMemoryManager();
    await memoryManager?.updatePreferences('user123', {
      detailLevel: 'brief'
    });
    
    // 第二次查询
    const response2 = await agent.handleQuery(
      '还是 THBS2',
      'user123'
    );
    expect(response2).toBeDefined();
    
    // 验证记忆被使用
    const memory = await memoryManager?.getMemory('user123');
    expect(memory?.preferences.detailLevel).toBe('brief');
  });
});
```

---

## 五、发布流程

### 5.1 构建

```bash
# 编译 TypeScript
npm run build

# 检查输出
ls -la dist/
```

### 5.2 发布到 NPM（可选）

```bash
# 登录 NPM
npm login

# 发布
npm publish --access public
```

### 5.3 本地使用

```bash
# 链接到本地
npm link

# 在其他项目中使用
npm link @redigg/agent
```

---

## 六、与 OpenClaw 同步

### 6.1 定期更新

```bash
# 检查 OpenClaw 更新
npm outdated @openclaw/agent

# 更新
npm update @openclaw/agent

# 测试
npm test
```

### 6.2 贡献回 OpenClaw

如果发现通用功能，可以 PR 回 OpenClaw：

```bash
# Fork OpenClaw
git clone https://github.com/openclaw/openclaw.git

# 创建分支
git checkout -b feature/memory-system

# 提交代码
git add .
git commit -m "feat: 添加记忆系统支持"

# 推送
git push origin feature/memory-system

# 创建 PR
# https://github.com/openclaw/openclaw/compare
```

---

## 七、项目模板

### 快速开始

```bash
# 克隆模板（待创建）
git clone https://github.com/redigg/redigg-agent-template.git
cd redigg-agent-template

# 安装依赖
npm install

# 配置
cp config/redigg.config.example.json config/redigg.config.json
# 编辑配置文件

# 启动
npm run dev
```

---

## 八、常见问题

### Q1: 为什么要扩展而不是 Fork？

**A**: 
- ✅ 易于更新（OpenClaw 升级时受益）
- ✅ 代码量少（只写差异化部分）
- ✅ 社区友好（可贡献回 OpenClaw）
- ❌ Fork 会导致代码分裂，合并困难

### Q2: 如何保证兼容性？

**A**:
- 遵循 OpenClaw 接口规范
- 只扩展，不修改核心
- 定期测试 OpenClaw 更新
- 使用语义化版本

### Q3: 记忆数据如何备份？

**A**:
```bash
# SQLite 数据库文件
cp ./data/redigg-memory.db ./backup/redigg-memory-$(date +%Y%m%d).db

# 定期备份（cron）
0 2 * * * cp ./data/redigg-memory.db ./backup/redigg-memory-$(date +\%Y\%m\%d).db
```

---

## 九、总结

**二次开发步骤**:
1. ✅ 初始化项目（npm init）
2. ✅ 安装 OpenClaw 依赖
3. ✅ 扩展 RediggAgent
4. ✅ 实现 MemoryManager
5. ✅ 创建配置文件
6. ✅ 编写测试
7. ✅ 构建发布

**核心原则**:
- 最小改动，最大复用
- 只扩展，不修改核心
- 定期同步 OpenClaw 更新
- 贡献通用功能回社区

**时间估算**:
- 今天：项目初始化 + 基础扩展（4 小时）
- 明天：记忆系统实现（4 小时）
- 后天：测试验证（2 小时）

---

**Vix，完整二次开发指南完成！**

**今晚开始**: 项目初始化 + 安装依赖

**时间：19:35，准备开搞！🦎🧬🚀**
