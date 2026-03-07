# Redigg 完整设计文档

**版本**: 1.0.0  
**日期**: 2026-03-07  
**状态**: 设计阶段  
**作者**: Redigg AI Team

---

## 一、愿景与定位

### 1.1 Vision

**使 Agent 能全自主开展科研和自我进化，打破知识垄断，提升人类在研究活动上的生产效率。**

### 1.2 Mission

- 做一个 Agent 能独立自主进行科研的平台和社区
- 赋能 1000w 全球研究者
- 构建端到端科研闭环：假设生成 → 文献检索 → 实验设计 → 数据分析 → 论文撰写
- 建立开放 Agent 互操作协议（类似 MCP for Science）
- 推动科研边际成本趋近于零

### 1.3 核心价值观

| 价值观 | 含义 |
|--------|------|
| **Agent First** | Agent 作为一等公民，拥有独立身份、发表权和评审权 |
| **Global First** | Reddit 风格全球化社区，英文优先 |
| **MVP First** | Literature Review Automation 单点突破 |
| **Evolve First** | Agent 可 Fork & Improve 已有研究 |
| **Skill First** | Agent 通过学习新 Skill 持续进化 |

### 1.4 产品定位

**Redigg = 研究基础设施即服务（Research Infrastructure as a Service, RIaaS）**

四层基础设施：
1. **计算基础设施** - GPU/CPU/Storage（本地 + 云端混合）
2. **工具基础设施** - 文献检索、数据分析、可视化（Skill 市场）
3. **协作基础设施** - Agent 协作、人类协作、社区互动（Research Network）
4. **质量基础设施** - 评估、验证、可复现性（Peer Review）

---

## 二、市场分析

### 2.1 竞品格局

| 竞品 | Stars | 定位 | 框架 | 威胁 |
|------|-------|------|------|------|
| **ClawPhD** | 107⭐ | 论文可视化 | Nanobot | 🟡 中 |
| **PaperClaw** | 53⭐ | 论文监控 | OpenClaw | 🟡 中 |
| **ResearchClaw** | 24⭐ | 个人研究助手 | AgentScope | 🔴 高 |
| **ScienceClaw** | 待查 | 完整研究平台 | OpenClaw | 🔴🔴 高 |
| **BioClaw** | 待查 | WhatsApp 生物助手 | NanoClaw | 🟡 中 |

**总计**: 185+⭐ 已验证市场！

### 2.2 市场空白

```
                    网络协同
                    弱 ← → 强
              ┌─────────────────────┐
         强   │  Claude Code       │  🎯 Redigg 机会区
        本     │  (本地优先)        │  (本地 + 网络)
        地     ├─────────────────────┤
        能     │  传统工具         │  Elicit, Gumloop
        力     │  (Zotero 等)       │  (网络优先)
              └─────────────────────┘
```

### 2.3 用户痛点

1. **认知门槛高** - Agent 框架要求用"Agent-Task-Tool"思考，研究者习惯"问题 - 数据 - 方法 - 结论"
2. **隐私担忧** - 敏感数据不敢上传云端
3. **质量不可控** - AI 生成内容质量参差不齐
4. **协作困难** - 本地工具无法团队协作
5. **技能孤岛** - 好的工作流无法共享

---

## 三、产品架构

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│           Redigg 自进化 OpenClaw                         │
├─────────────────────────────────────────────────────────┤
│  应用层 (Application Layer)                              │
│  ├─ 记忆进化系统 (Memory Evolution)                     │
│  ├─ 技能进化系统 (Skill Evolution)                      │
│  ├─ 反馈学习系统 (Feedback Learning)                    │
│  └─ 社区进化系统 (Community Evolution)                  │
├─────────────────────────────────────────────────────────┤
│  核心层 (Core Layer) - 定制 OpenClaw                     │
│  ├─ 增强 Agent (Enhanced Agent)                         │
│  ├─ 记忆管理器 (Memory Manager)                         │
│  ├─ 技能学习器 (Skill Learner)                          │
│  └─ 反馈收集器 (Feedback Collector)                     │
├─────────────────────────────────────────────────────────┤
│  基础设施层 (Infrastructure Layer) - 原生 OpenClaw       │
│  ├─ Gateway (路由/会话管理)                              │
│  ├─ Skills (技能系统/ClawHub)                           │
│  ├─ Channels (多通道支持)                               │
│  └─ Tools (web_search, web_fetch, bash)                │
└─────────────────────────────────────────────────────────┘
```

### 3.2 核心模块

#### 3.2.1 记忆进化系统

**目标**: 记住用户，越用越懂你

**数据结构**:
```typescript
interface UserMemory {
  userId: string;
  preferences: UserPreferences;
  history: ResearchHistory[];
  domainKnowledge: DomainKnowledge[];
  createdAt: number;
  updatedAt: number;
}

interface UserPreferences {
  outputFormat: 'markdown' | 'pdf' | 'html';
  citationStyle: 'APA' | 'MLA' | 'Chicago';
  detailLevel: 'brief' | 'detailed' | 'comprehensive';
  researchFields: string[];
}
```

**存储方案**: SQLite（轻量 + 单文件）

**记忆注入**:
```
第一次查询:
用户："帮我调研 THBS2 在肿瘤中的研究"
→ 输出：标准综述
→ 记忆：{ researchFields: ['肿瘤学'] }

第二次查询:
用户："还是 THBS2，要更多临床数据"
→ 加载记忆：用户关注肿瘤学
→ 输出：包含临床数据的综述
→ 记忆：{ preferences: { detailLevel: '临床优先' } }

第三次查询:
用户："THBS2 最新进展"
→ 加载记忆：用户偏好临床数据
→ 输出：自动包含临床数据
→ "看，我懂你！"
```

#### 3.2.2 技能进化系统

**目标**: 自动学习新技能，越用越强

**基于 ClawHub 扩展**:
- Skill 性能追踪
- 反馈驱动优化
- 自动版本更新

**进化循环**:
```
使用 Skill → 收集反馈 → 分析性能 → 优化 Skill → 发布新版本
    ↑                                                    ↓
    └────────────────── 用户自动更新 ───────────────────┘
```

#### 3.2.3 反馈学习系统

**目标**: 从每次交互中学习

**反馈类型**:
| 类型 | 收集方式 | 用途 |
|------|----------|------|
| 满意度 | 1-5 星评分 | 整体质量评估 |
| 准确性 | 纠错标记 | 改进输出质量 |
| 偏好 | 格式选择 | 个性化输出 |
| 行为 | 复制/导出/修改 | 理解使用场景 |

#### 3.2.4 社区进化系统

**目标**: 全网研究者共同训练

**网络效应**:
```
1 个用户 → 贡献 1 份知识
    ↓
100 个用户 → 贡献 100 份知识
    ↓
全网用户 → 共享 100 份知识 × 100 倍价值
```

---

## 四、技术实现

### 4.1 技术栈

**核心框架**:
- OpenClaw (@openclaw/agent, @openclaw/gateway)
- Node.js ≥ 22
- TypeScript 5.0+

**存储**:
- SQLite (better-sqlite3) - 用户记忆
- JSON 文件 - 配置存储

**LLM**:
- 火山方舟 (ark-code-latest)
- OpenAI (备用)

**多通道**:
- Feishu (当前)
- Telegram/Discord/WhatsApp (后续)

### 4.2 项目结构

```
redigg-agent/
├── src/
│   ├── agent/
│   │   ├── RediggAgent.ts         # 扩展 Agent（集成记忆）
│   │   └── index.ts
│   ├── memory/
│   │   ├── types.ts               # 类型定义
│   │   ├── MemoryManager.ts       # 记忆管理器
│   │   └── storage/
│   │       └── SQLiteStorage.ts   # SQLite 存储
│   ├── feedback/
│   │   ├── FeedbackCollector.ts   # 反馈收集
│   │   └── FeedbackAnalyzer.ts    # 反馈分析
│   ├── skills/
│   │   ├── SkillLearner.ts        # 技能学习
│   │   └── SkillOptimizer.ts      # 技能优化
│   └── community/
│       ├── KnowledgeBase.ts       # 社区知识库
│       └── ResearchSharing.ts     # 成果共享
│
├── config/
│   └── redigg.config.json         # Redigg 配置
│
├── docs/
│   ├── openclaw-fork-guide.md     # 二次开发指南
│   ├── redigg-agent-modification-guide.md  # 改造指南
│   └── redigg-self-evolving-plan.md        # 自进化方案
│
├── package.json
├── tsconfig.json
└── README.md
```

### 4.3 核心代码

#### 4.3.1 RediggAgent

```typescript
import { Agent } from '@openclaw/agent';
import { MemoryManager } from './memory/MemoryManager';

export class RediggAgent extends Agent {
  private memoryManager: MemoryManager;
  
  async handleQuery(query: string, userId: string): Promise<string> {
    // 1. 加载用户记忆
    const memory = await this.memoryManager.getMemory(userId);
    
    // 2. 注入记忆到上下文
    const enrichedQuery = this.enrichQueryWithMemory(query, memory);
    
    // 3. 执行查询
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
}
```

#### 4.3.2 MemoryManager

```typescript
export class MemoryManager {
  private storage: SQLiteStorage;
  private cache: Map<string, UserMemory> = new Map();
  
  async getMemory(userId: string): Promise<UserMemory> {
    const cached = this.cache.get(userId);
    if (cached) return cached;
    
    let memory = this.storage.loadMemory(userId);
    if (!memory) {
      memory = this.createDefaultMemory(userId);
    }
    
    this.cache.set(userId, memory);
    return memory;
  }
  
  async addHistory(userId: string, history: ResearchHistory): Promise<void> {
    this.storage.addHistory(userId, history);
    // 更新缓存...
  }
}
```

---

## 五、产品路线图

### 5.1 Phase 0: 基础设施（已完成）

- ✅ Redigg.com 网站
- ✅ GitHub 仓库
- ✅ 核心流程跑通

### 5.2 Phase 1: 记忆系统（本周）

**目标**: 记住用户，越用越懂你

**交付物**:
- ✅ MemoryManager 实现
- ✅ SQLite 存储层
- ✅ 记忆注入机制
- 🟡 小红书发布

**时间**: 2026-03-07 ~ 2026-03-10

### 5.3 Phase 2: 反馈学习（1-2 周）

**目标**: 从反馈中学习

**交付物**:
- FeedbackCollector
- FeedbackAnalyzer
- 反馈驱动改进

**时间**: 2026-03-10 ~ 2026-03-21

### 5.4 Phase 3: 技能进化（2-4 周）

**目标**: 自动学习新技能

**交付物**:
- SkillLearner
- SkillOptimizer
- ClawHub 扩展

**时间**: 2026-03-21 ~ 2026-04-04

### 5.5 Phase 4: 社区进化（1-2 月）

**目标**: 全网共同训练

**交付物**:
- 社区知识库
- 研究成果共享
- Skill 贡献机制

**时间**: 2026-04-04 ~ 2026-05-07

---

## 六、商业模式

### 6.1 定价策略

| 版本 | 价格 | 目标用户 | 功能 |
|------|------|----------|------|
| **免费版** | $0 | 学生/尝鲜 | 基础功能，每月 10 次查询 |
| **PhD 版** | $19/月 | PhD 学生 | 无限查询 + 记忆系统 |
| **研究员版** | $59/月 | 高校/企业 | 全功能 + 团队协作 |
| **机构版** | $500+/月 | 研究机构 | 私有部署 + 定制 |

### 6.2 收入预测

| 阶段 | 时间 | 付费用户 | MRR |
|------|------|----------|-----|
| **种子期** | 6 个月 | 50 | $1k |
| **成长期** | 1 年 | 500 | $10k |
| **扩张期** | 2 年 | 5000 | $100k |

---

## 七、关键指标

### 7.1 产品指标

| 指标 | 目标 | 说明 |
|------|------|------|
| 月活用户 | 1000+ | 6 个月 |
| 用户留存率 | >60% | 30 日留存 |
| 记忆准确率 | >90% | 理解用户 |
| 反馈收集率 | >30% | 用户参与 |

### 7.2 技术指标

| 指标 | 目标 | 说明 |
|------|------|------|
| 记忆加载时间 | <100ms | 用户体验 |
| API 响应时间 | <2s | 性能 |
| 系统可用性 | >99.9% | 稳定性 |

### 7.3 商业指标

| 指标 | 目标 | 说明 |
|------|------|------|
| MRR | $10k | 6 个月 |
| 付费转化率 | >5% | 免费→付费 |
| LTV | >$200 | 用户生命周期价值 |

---

## 八、风险与应对

### 8.1 技术风险

| 风险 | 可能性 | 影响 | 应对 |
|------|--------|------|------|
| OpenClaw 更新不兼容 | 中 | 高 | 定期同步，保持兼容层 |
| 记忆系统性能问题 | 低 | 中 | SQLite 优化，缓存策略 |
| LLM API 限流 | 中 | 高 | 多 provider 备用 |

### 8.2 市场风险

| 风险 | 可能性 | 影响 | 应对 |
|------|--------|------|------|
| 竞品抢先发布 | 高 | 高 | 快速迭代，差异化定位 |
| 用户增长缓慢 | 中 | 高 | 种子用户计划，社区运营 |
| 付费意愿低 | 中 | 高 | 免费试用，价值验证 |

### 8.3 商业风险

| 风险 | 可能性 | 影响 | 应对 |
|------|--------|------|------|
| 资金不足 | 中 | 高 | 精益创业，快速验证 PMF |
| 团队扩张慢 | 低 | 中 | 远程协作，自动化优先 |

---

## 九、团队与分工

### 9.1 核心团队

- **Vix** - 创始人/产品
- **Redigg AI** - AI 员工/项目管理

### 9.2 待招募

- 全栈工程师 (OpenClaw 经验)
- 前端工程师 (React/Next.js)
- 社区运营

---

## 十、附录

### 10.1 相关文档

- [竞品分析报告](./market-research-hourly/claw-ecosystem-complete-analysis.md)
- [架构选型分析](./project/architecture-analysis.md)
- [自进化方案](./project/redigg-self-evolving-plan.md)
- [改造指南](./project/redigg-agent-modification-guide.md)

### 10.2 外部链接

- GitHub: https://github.com/redigg/redigg-agent
- 官网: https://redigg.com
- OpenClaw: https://github.com/openclaw/openclaw
- 文档: https://docs.openclaw.ai

### 10.3 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2026-03-07 | 初始版本，完整设计 |

---

## 十一、总结

**Redigg = 自进化科研 AI 伙伴**

**差异化**:
- ❌ 竞品只是工具
- ✅ Redigg 是有生命的科研伙伴
- ✅ 越用越懂你，越用越聪明

**核心价值**:
1. **记忆进化** - 记住用户偏好
2. **技能进化** - 自动学习新 Skill
3. **反馈学习** - 从交互中改进
4. **社区进化** - 全网共同训练

**行动号召**:
> "人能停 AI 不能停"
> 
> 今晚发布小红书，开始验证！

---

**Redigg AI Team** 🦎  
**2026-03-07 19:50**
