# Redigg V2 快速启动指南

**目标**: 2 小时内完成核心功能升级

---

## 🚀 第一步：启用向量搜索 (30 分钟)

### 1.1 检查 sqlite-vec 安装
```bash
cd redigg
npm list sqlite-vec  # 应该已安装
```

### 1.2 修改 Memory 表结构
编辑 `src/storage/sqlite.ts`:

```typescript
// 添加向量扩展
db.loadExtension('sqlite-vec');

// 创建向量索引
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS memory_vec 
  USING vec0(
    embedding float[1536]
  )
`);
```

### 1.3 添加 Embedding 生成
创建 `src/utils/embedding.ts`:

```typescript
import OpenAI from 'openai';

export class EmbeddingGenerator {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async generate(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  }
}
```

### 1.4 更新 MemoryManager
修改 `src/memory/MemoryManager.ts`:

```typescript
// 添加记忆时生成 embedding
public async addMemory(..., content: string) {
  const embedding = await this.embeddingGenerator.generate(content);
  // 存储到 memory_vec 表
}

// 向量搜索
public async vectorSearch(userId: string, query: string, limit: number = 5) {
  const queryEmbedding = await this.embeddingGenerator.generate(query);
  // 使用 sqlite-vec 进行相似度搜索
}
```

---

## 🧠 第二步：实现 Planner (45 分钟)

### 2.1 创建 Planner 模块
创建 `src/planner/Planner.ts`:

```typescript
import { LLMClient } from '../llm/LLMClient.js';
import { SkillManager } from '../skills/SkillManager.js';

export interface Plan {
  goal: string;
  steps: PlanStep[];
}

export interface PlanStep {
  id: string;
  skill: string;
  params: Record<string, any>;
  dependsOn?: string[];
}

export class Planner {
  constructor(
    private llm: LLMClient,
    private skillManager: SkillManager
  ) {}

  async createPlan(goal: string, context: string): Promise<Plan> {
    const availableSkills = this.skillManager.getAllSkills()
      .map(s => `- ${s.id}: ${s.description}`)
      .join('\n');

    const prompt = `
      Goal: ${goal}
      Context: ${context}
      
      Available Skills:
      ${availableSkills}
      
      Create a step-by-step plan to achieve the goal.
      Each step should use one skill.
      
      Output JSON format:
      {
        "goal": "...",
        "steps": [
          {
            "id": "step1",
            "skill": "skill_id",
            "params": {...},
            "dependsOn": []
          }
        ]
      }
    `;

    const response = await this.llm.chat([
      { role: 'system', content: 'You are a task planner.' },
      { role: 'user', content: prompt }
    ]);

    return JSON.parse(response.content);
  }

  async executePlan(plan: Plan, userId: string): Promise<any> {
    const results: Record<string, any> = {};
    
    for (const step of plan.steps) {
      // 等待依赖完成
      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          if (!results[dep]) {
            throw new Error(`Dependency ${dep} not completed`);
          }
        }
      }

      // 执行技能
      const skill = this.skillManager.getSkill(step.skill);
      if (!skill) {
        throw new Error(`Skill ${step.skill} not found`);
      }

      // 注入依赖结果到参数
      const params = this.injectDependencies(step.params, results);
      
      const result = await skill.execute({
        llm: this.llm,
        // ... context
      }, params);

      results[step.id] = result;
    }

    return results;
  }

  private injectDependencies(params: any, results: Record<string, any>): any {
    // 将 {{step1.result}} 替换为实际结果
    // 实现模板替换逻辑
    return params;
  }
}
```

### 2.2 集成到 ResearchAgent
修改 `src/agent/ResearchAgent.ts`:

```typescript
import { Planner } from '../planner/Planner.js';

export class ResearchAgent {
  private planner: Planner;

  constructor(...) {
    this.planner = new Planner(llm, skillManager);
  }

  async chat(userId: string, message: string) {
    // 1. 判断是否需要规划
    const needsPlanning = await this.shouldPlan(message);
    
    if (needsPlanning) {
      // 2. 创建计划
      const plan = await this.planner.createPlan(message, context);
      
      // 3. 执行计划
      const results = await this.planner.executePlan(plan, userId);
      
      // 4. 综合结果生成回复
      return this.synthesizeResults(results);
    }

    // 原有逻辑...
  }
}
```

---

## 📊 第三步：添加反馈收集 (30 分钟)

### 3.1 创建 Feedback 表
编辑 `src/storage/sqlite.ts`:

```typescript
db.exec(`
  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    message_id TEXT,
    score INTEGER,
    type TEXT,
    metadata TEXT,
    created_at TEXT
  )
`);
```

### 3.2 创建 FeedbackManager
创建 `src/feedback/FeedbackManager.ts`:

```typescript
export class FeedbackManager {
  async addFeedback(sessionId: string, messageId: string, score: number) {
    // 存储反馈
  }

  async getSkillStats(skillId: string) {
    // 计算技能成功率
  }

  async getLowScoreFeedbacks(limit: number = 10) {
    // 获取低分反馈用于分析
  }
}
```

### 3.3 Web 端添加评分组件
编辑 `web/src/components/chat/message.tsx`:

```tsx
// 在 assistant 消息下方添加评分按钮
<div className="feedback-buttons">
  <button onClick={() => onFeedback(1)}>⭐</button>
  <button onClick={() => onFeedback(2)}>⭐⭐</button>
  <button onClick={() => onFeedback(3)}>⭐⭐⭐</button>
  <button onClick={() => onFeedback(4)}>⭐⭐⭐⭐</button>
  <button onClick={() => onFeedback(5)}>⭐⭐⭐⭐⭐</button>
</div>
```

---

## ✅ 验证清单

### 向量搜索
- [ ] 添加记忆时生成 embedding
- [ ] 向量搜索返回相关结果
- [ ] 搜索结果优于关键词匹配

### Planner
- [ ] 能正确分解多步任务
- [ ] 技能执行顺序正确
- [ ] 依赖注入正常工作

### 反馈系统
- [ ] 用户可以评分
- [ ] 反馈存储到数据库
- [ ] 能查询低分反馈

---

## 🐛 常见问题

### Q: sqlite-vec 加载失败
```bash
# 确保安装了 sqlite-vec
npm install sqlite-vec

# 检查 Node 版本 >= 22
node --version
```

### Q: Embedding API 调用失败
```bash
# 检查 .env 配置
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
```

### Q: Planner 生成的 JSON 解析失败
```typescript
// 添加容错处理
const jsonStr = content.match(/\{[\s\S]*\}/)?.[0];
return JSON.parse(jsonStr);
```

---

## 📚 下一步

完成以上三步后，你将拥有:
- ✅ 语义记忆搜索
- ✅ 多步任务规划
- ✅ 用户反馈收集

然后可以继续:
- 技能质量评估
- 自动技能优化
- 社区同步机制

---

**Good Luck!** 🦎
