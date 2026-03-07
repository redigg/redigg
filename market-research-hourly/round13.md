# Redigg 市场调研 Round 13
**调研周期**: 2026 年 3 月 7 日 17:00  
**生成时间**: 2026-03-07 17:22  
**调研范围**: Round 12 执行优先级追踪 + Phase 2 开发聚焦

---

## 执行摘要

Round 13 聚焦于**执行导向**，将 Round 12 的战略洞察转化为具体的开发任务和验证指标。核心关注：
1. **Phase 2 剩余功能实现路径** - 智能任务规划 + 自反思的技术方案
2. **文献综述 Agent 模板 MVP** - 30 分钟输出综述的端到端流程设计
3. **种子用户计划执行细节** - 邀请制流程、筛选标准、时间表

---

## 1. Phase 2 开发状态追踪

### 当前进度：70% → 目标 85%（本小时）

| 模块 | 状态 | 进度 | 本小时目标 |
|------|------|------|-----------|
| Scratchpad 记录 | ✅ 完成 | 100% | 维持 |
| 安全特性（循环检测/步骤限制） | ✅ 完成 | 100% | 维持 |
| 智能任务规划 | 🟡 进行中 | 40% | 推进到 60% |
| 自验证/自反思 | 🟡 进行中 | 30% | 推进到 50% |
| 评估套件 | ⚪ 未开始 | 0% | 设计方案 |

### 智能任务规划 - 技术方案

**参考对象**: dexter (垂类 Agent)、CrewAI AMP Suite

**核心能力**:
1. **查询理解** - 识别研究任务类型（文献综述/实验设计/数据分析/论文写作）
2. **步骤分解** - 将复杂查询分解为可执行的 Skill 调用序列
3. **动态调整** - 根据中间结果调整后续步骤

**实现方案**:
```typescript
interface TaskPlan {
  taskId: string;
  originalQuery: string;
  taskType: 'literature_review' | 'experiment_design' | 'data_analysis' | 'paper_writing';
  steps: TaskStep[];
  currentStep: number;
  status: 'planning' | 'executing' | 'completed' | 'failed';
}

interface TaskStep {
  stepId: string;
  description: string;
  skillId: string;
  input: Record<string, any>;
  output?: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  retryCount: number;
}
```

**本小时交付**:
- [ ] 创建 `src/agent/TaskPlanner.ts`
- [ ] 实现任务类型识别逻辑
- [ ] 实现步骤分解算法
- [ ] 单元测试

### 自验证/自反思 - 技术方案

**参考对象**: Anthropic 的 self-reflection 模式、dexter 的 quality check

**核心能力**:
1. **步骤后检查** - 每个 Skill 执行后验证输出质量
2. **迭代改进** - 如果质量不达标，自动重试或调整方法
3. **最终验证** - 任务完成后整体质量评估

**实现方案**:
```typescript
interface QualityCheck {
  stepId: string;
  criteria: QualityCriterion[];
  passed: boolean;
  feedback: string;
  suggestedAction: 'accept' | 'retry' | 'adjust_and_retry' | 'escalate';
}

interface QualityCriterion {
  name: string;
  description: string;
  checkType: 'completeness' | 'accuracy' | 'relevance' | 'format';
  threshold: number; // 0-1
}
```

**本小时交付**:
- [ ] 创建 `src/agent/QualityChecker.ts`
- [ ] 定义文献综述场景的质量标准
- [ ] 实现 LLM-as-judge 评估逻辑
- [ ] 集成到 RediggAgent 执行流程

---

## 2. 文献综述 Agent 模板 - MVP 设计

### 端到端流程

```
用户输入研究问题
    ↓
TaskPlanner 识别为 literature_review
    ↓
自动分解为步骤:
  1. arxiv_search: 搜索相关论文
  2. paper_summarizer: 提取关键论文摘要
  3. citation_graph: 构建引用网络
  4. synthesis: 综合撰写综述
    ↓
每个步骤后 QualityChecker 验证
    ↓
最终输出结构化文献综述
    ↓
Peer Review 环节（可选人工审核）
```

### 输入/输出规范

**输入**:
```json
{
  "topic": "LLM-based code generation for scientific computing",
  "constraints": {
    "timeLimit": 30, // minutes
    "maxPapers": 50,
    "yearRange": [2020, 2026],
    "includeCode": true
  }
}
```

**输出**:
```json
{
  "summary": "执行摘要（500 字）",
  "sections": [
    {
      "title": "研究背景",
      "content": "...",
      "citations": ["paper_1", "paper_2"]
    },
    // ... 更多章节
  ],
  "keyPapers": [...],
  "researchGaps": [...],
  "suggestedNextSteps": [...],
  "metadata": {
    "executionTime": 1847, // seconds
    "papersAnalyzed": 47,
    "qualityScore": 0.87
  }
}
```

### 质量标准

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 覆盖率 | >90% 关键论文 | 与人工标注对比 |
| 准确性 | >95% 引用正确 | LLM-as-judge + 抽样人工 |
| 时效性 | <30 分钟 | 端到端执行时间 |
| 用户满意度 | >4/5 | 用户评分 |

---

## 3. 种子用户计划 - 执行细节

### 邀请制流程设计

**阶段 1：准备（本周）**
- [ ] 定义种子用户筛选标准
- [ ] 准备邀请邮件模板
- [ ] 设置 onboarding 流程
- [ ] 准备反馈收集机制

**阶段 2：邀请（下周）**
- [ ] 发送第一批邀请（20 人）
- [ ] 收集 onboarding 反馈
- [ ] 优化流程
- [ ] 发送第二批邀请（80 人）

**阶段 3：运营（持续）**
- [ ] 每周收集使用反馈
- [ ] 每月举办用户访谈
- [ ] 建立用户社区（Discord/微信群）

### 种子用户筛选标准

**目标画像**:
-  PhD 研究生/博士后（高频研究需求）
-  计算机/AI 相关领域（理解技术）
-  有 Agent/自动化使用经验（早期采用者）
-  愿意提供详细反馈（共创心态）

**筛选问题**:
1. 当前研究阶段？（PhD 1-2 年/3-4 年/博士后）
2. 每周文献阅读量？（<10 篇/10-30 篇/>30 篇）
3. 是否使用过 AI 研究工具？（Elicit/Scite/Gumloop 等）
4. 是否愿意参与产品共创？（是/否）
5. 可投入的测试时间？（<1h/周，1-3h/周，>3h/周）

**入选标准**:
- ✅ PhD 2 年以上 或 博士后
- ✅ 每周阅读>10 篇文献
- ✅ 有 AI 工具使用经验
- ✅ 愿意投入>1h/周反馈
- ✅ 推荐人背书（可选加分项）

---

## 4. 竞品动态追踪（基于 Round 12 延续）

### Wordware 威胁应对

**最新动态**: $30M 种子轮后预计加速产品迭代

**Redigg 应对策略**:
1. **速度优先** - 2 周内发布文献综述 MVP，抢占先发优势
2. **场景深耕** - 专注科研垂直，不做通用 Agent
3. **本地优先** - 强调隐私保护，与云端 SaaS 差异化
4. **社区建设** - 快速建立中文科研用户社区

### CrewAI 威胁应对

**最新动态**: AMP Suite 企业级套件，10 万 + 开发者

**Redigg 应对策略**:
1. **生态互补** - 支持 CrewAI 作为底层框架，非竞争关系
2. **场景差异化** - CrewAI 通用，Redigg 科研专用
3. **技能市场** - 建立科研 Skill 生态，形成壁垒

---

## 5. 本小时执行优先级

### P0：必须完成（本小时）

1. **TaskPlanner 基础框架** - 创建文件 + 类型定义 + 任务识别逻辑
2. **QualityChecker 设计方案** - 定义质量标准 + 评估流程
3. **种子用户计划文档** - 完成筛选标准 + 流程设计

### P1：应该完成（今天）

4. **TaskPlanner 步骤分解算法** - 实现核心逻辑
5. **文献综述 Agent 模板规范** - 输入/输出/质量标准文档化

### P2：可以延后（本周）

6. **评估套件设计** - 数据集规划 + LLM-as-judge 方案
7. **Research Network 技术选型** - 协作架构设计

---

## 6. 需要 Vix 决策的事项（更新）

### 决策 1：Phase 2 发布时间
- **建议**: 本周五（3 月 13 日）前完成 Phase 2 到 90%，下周一开始种子用户邀请
- **理由**: 平衡产品质量和上市速度

### 决策 2：种子用户邀请名单
- **建议**: Vix 提供 10-20 个初始联系人，AI 协助扩展至 100 人
- **理由**: 信任背书 + 精准定位

### 决策 3：营销资源投入
- **建议**: 本周内完成 Landing Page（可用现成模板），预算<¥5000
- **理由**: 早期验证不需要精美页面，速度优先

---

## 7. 关键洞察

### 7.1 执行优于完美
- Round 12 完成了战略分析，Round 13 必须转向执行
- Phase 2 不需要 100% 完美，85% 即可开始种子用户测试
- 文献综述功能可以独立发布，不必等待完整 Phase 2

### 7.2 种子用户质量>数量
- 100 个高质量种子用户 > 1000 个普通用户
- 早期反馈决定产品方向，必须精选用户
- 邀请制是正确策略，不要为了增长牺牲质量

### 7.3 时间窗口紧迫
- Wordware 融资后预计 3-6 个月内会有大动作
- Redigg 需要在 Q2 前建立科研场景用户基础
- 2 周 MVP → 1 个月种子用户 → 3 个月网络效应

---

## 8. 附录：技术实现细节

### TaskPlanner 伪代码

```typescript
class TaskPlanner {
  async plan(query: string): Promise<TaskPlan> {
    // 1. 任务类型识别
    const taskType = await this.classifyTask(query);
    
    // 2. 获取该类型任务的模板
    const template = this.getTemplate(taskType);
    
    // 3. 根据查询参数填充模板
    const steps = this.instantiateSteps(template, query);
    
    // 4. 返回任务计划
    return {
      taskId: generateId(),
      originalQuery: query,
      taskType,
      steps,
      currentStep: 0,
      status: 'planning'
    };
  }
  
  async classifyTask(query: string): Promise<TaskType> {
    // 使用 LLM 分类
    const prompt = `分类研究任务类型：${query}`;
    // ... LLM 调用
  }
  
  getTemplate(taskType: TaskType): TaskTemplate {
    // 从预定义模板库获取
    return this.templates[taskType];
  }
}
```

### QualityChecker 伪代码

```typescript
class QualityChecker {
  async check(stepResult: any, criteria: QualityCriterion[]): Promise<QualityCheck> {
    const results = [];
    
    for (const criterion of criteria) {
      const score = await this.evaluate(stepResult, criterion);
      results.push({
        name: criterion.name,
        score,
        passed: score >= criterion.threshold
      });
    }
    
    const allPassed = results.every(r => r.passed);
    
    return {
      stepId: stepResult.stepId,
      criteria: results,
      passed: allPassed,
      feedback: this.generateFeedback(results),
      suggestedAction: allPassed ? 'accept' : 'retry'
    };
  }
  
  async evaluate(result: any, criterion: QualityCriterion): Promise<number> {
    // 使用 LLM-as-judge 评估
    const prompt = `评估${criterion.name}: ${result.content}`;
    // ... LLM 调用，返回 0-1 分数
  }
}
```

---

**报告结束**

*Round 13 由 Redigg AI 🦎 生成，聚焦执行落地。*
*人能停 AI 不能停！*
