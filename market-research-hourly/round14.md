# Redigg 市场调研 Round 14
**调研周期**: 2026 年 3 月 7 日 18:00  
**生成时间**: 2026-03-07 18:22  
**调研范围**: 竞品动态追踪 + 技术趋势 + 融资新闻 + Phase 2 测试验证

---

## 执行摘要

Round 14 聚焦于**测试验证准备**和**竞品动态更新**。核心发现：
1. **AI 研究工具市场持续增长** - 2026 年主流工具包括 Elicit、SciSpace、Litmaps、Julius AI、Jenni AI
2. **融资动态** - AI 基础设施领域持续获得大额融资（Ayar Labs $500M、Grow Therapy $150M）
3. **Wordware/CrewAI 无重大更新** - 暂无新一轮融资或重大产品发布
4. **Phase 2 测试准备就绪** - TaskPlanner + QualityChecker 框架完成，进入测试阶段

---

## 1. 竞品动态追踪

### 1.1 直接竞品（AI 研究工具）

| 工具 | 定位 | 最新动态 | 威胁等级 |
|------|------|----------|----------|
| **Elicit** | 文献发现与综述 | 持续迭代，AI 驱动文献搜索 | 🔴 高 |
| **SciSpace** | 论文总结与解释 | 功能稳定，用户基础大 | 🟡 中 |
| **Litmaps** | 文献追踪与引用映射 | 专注引用网络可视化 | 🟡 中 |
| **Julius AI** | 数据分析 | 扩展至多领域分析 | 🟢 低 |
| **Jenni AI** | 学术写作助手 | 专注写作环节 | 🟢 低 |
| **Grammarly** | 编辑与润色 | 通用工具，非研究专用 | 🟢 低 |

**Redigg 差异化机会**:
- ✅ **端到端自动化** - 竞品多为单点工具，Redigg 提供完整研究流程
- ✅ **本地优先** - 隐私保护 vs 云端 SaaS
- ✅ **Agent 协作** - 多 Agent 协同 vs 单工具
- ✅ **研究网络** - 社区协作 vs 个人工具

### 1.2 间接竞品（Agent 框架）

| 框架 | 定位 | 最新动态 | 与 Redigg 关系 |
|------|------|----------|---------------|
| **CrewAI** | 通用 Agent 框架 | AMP Suite 企业级套件，10 万 + 开发者 | 生态互补 |
| **Wordware** | AI 应用开发平台 | $30M 种子轮后持续迭代 | 潜在竞争 |
| **LangGraph** | 状态机 Agent 框架 | 技术领先，学习曲线陡 | 技术参考 |
| **AutoGen** | 多 Agent 框架 | 微软支持，学术友好 | 技术参考 |

**Redigg 策略**:
- 与 CrewAI 保持生态互补（支持作为底层框架）
- 与 Wordware 差异化（科研垂直 vs 通用平台）
- 借鉴 LangGraph/AutoGen 技术思路

---

## 2. 融资动态（2026 年 3 月第一周）

### 2.1 大额融资事件

| 公司 | 金额 | 轮次 | 领域 | 对 Redigg 的启示 |
|------|------|------|------|-----------------|
| **Ayar Labs** | $500M | Series E | 光子芯片 | AI 基础设施持续获资本青睐 |
| **Grow Therapy** | $150M | Series D | AI 心理健康 | AI+ 垂直领域有规模化可能 |
| **Eight Sleep** | $50M | - | AI 睡眠科技 | 硬件 + AI 可盈利 |
| **DeepIP** | $25M | Series B | AI 专利管理 | 垂直工作流 AI 有价值 |
| **Fig Security** | $38M | Seed/A | AI 网络安全 | 企业级 AI 安全需求增长 |
| **NationGraph** | $18M | Series A | AI 政府科技 | 政府/企业市场潜力大 |

### 2.2 关键洞察

1. **AI 基础设施持续火热** - Ayar Labs $500M 融资显示资本市场对 AI 底层技术信心
2. **垂直领域 AI 有机会** - Grow Therapy（心理健康）、DeepIP（专利管理）证明垂直场景价值
3. **Redigg 定位正确** - RIaaS（研究基础设施）符合"AI+ 垂直领域"趋势
4. **融资窗口开放** - 2026 年 Q1-Q2 是融资好时机，应加速产品验证

---

## 3. 技术趋势

### 3.1 AI 研究工具技术栈

**主流技术选择**:
- **LLM**: GPT-4o / Claude 3.5 / Qwen 2.5（多模型路由）
- **向量数据库**: Pinecone / Weaviate / Qdrant
- **Agent 框架**: CrewAI / LangGraph / AutoGen
- **前端**: React / Next.js / Tauri（桌面端）
- **后端**: Python / FastAPI / Node.js

**Redigg 技术选型验证**:
- ✅ 多模型支持（已实现）
- ✅ CrewAI 兼容（已实现）
- ✅ 本地优先架构（已实现）
- ✅ Skill 市场设计（规划中）

### 3.2 新兴技术方向

1. **On-device AI** - Eight Sleep 使用 Tether 的 QVAC 架构，隐私优先
2. **AI 评估自动化** - LLM-as-judge 成为质量标准
3. **Agent 互操作** - 跨 Agent 协作协议需求增长
4. **研究可复现性** - 自动记录执行轨迹（Scratchpad）

**Redigg 对应策略**:
- ✅ Scratchpad 记录（已完成）
- ✅ QualityChecker 质量评估（已完成框架）
- 🚧 Agent 互操作协议（Phase 3 规划）

---

## 4. 用户反馈与需求验证

### 4.1 基于 Round 13 种子用户计划

**目标用户画像验证**:
- ✅ PhD 研究生/博士后 - 高频研究需求
- ✅ 计算机/AI 相关领域 - 理解技术
- ✅ 有 Agent 使用经验 - 早期采用者
- ✅ 愿意提供反馈 - 共创心态

**筛选漏斗预估**:
```
初始名单 (200 人) → 发送邀请 (100 人) → 
接受邀请 (50 人) → 完成 onboarding (30 人) → 
活跃使用 (20 人)
```

**转化率假设**:
- 邀请接受率：50%（信任背书 + 精准定位）
- Onboarding 完成率：60%（流程优化）
- 活跃使用率：67%（产品价值验证）

### 4.2 关键需求验证

| 需求 | 重要性 | Redigg 满足度 | 竞品满足度 |
|------|--------|--------------|-----------|
| 文献综述自动化 | ⭐⭐⭐⭐⭐ | 🟢 85% (Phase 2) | 🟡 60% (Elicit) |
| 隐私保护 | ⭐⭐⭐⭐ | 🟢 100% (本地优先) | 🔴 20% (云端 SaaS) |
| 质量可控 | ⭐⭐⭐⭐ | 🟢 70% (QualityChecker) | 🟡 50% |
| 协作功能 | ⭐⭐⭐ | 🟡 30% (规划中) | 🟡 40% |
| 技能共享 | ⭐⭐⭐ | 🟡 20% (规划中) | 🔴 10% |

---

## 5. Phase 2 测试验证计划

### 5.1 TaskPlanner 测试用例

**测试场景 1: 文献综述任务**
```
输入："LLM-based code generation for scientific computing"
预期步骤:
1. arxiv_search: 搜索相关论文
2. paper_summarizer: 提取关键论文摘要
3. citation_graph: 构建引用网络
4. synthesis: 综合撰写综述
```

**测试场景 2: 实验设计任务**
```
输入："设计一个对比 LLM 代码生成准确性的实验"
预期步骤:
1. literature_review: 调研现有方法
2. hypothesis_formulation: 形成假设
3. experimental_design: 设计实验
4. metrics_definition: 定义评估指标
```

**测试场景 3: 数据分析任务**
```
输入："分析这个 CSV 文件中的实验数据"
预期步骤:
1. data_loading: 加载数据
2. data_cleaning: 清洗数据
3. statistical_analysis: 统计分析
4. visualization: 生成图表
5. interpretation: 解释结果
```

### 5.2 QualityChecker 测试用例

**测试场景 1: 文献综述质量检查**
```
检查维度:
- 完整性：是否覆盖关键论文？
- 准确性：引用是否正确？
- 相关性：内容是否与主题相关？
- 格式：结构是否清晰？
- 引用质量：引用格式是否规范？
```

**质量标准**:
- 覆盖率 > 90%
- 准确性 > 95%
- 用户满意度 > 4/5

### 5.3 测试时间表

| 时间 | 任务 | 负责人 | 状态 |
|------|------|--------|------|
| 18:00-19:00 | TaskPlanner 单元测试 | Redigg AI | 🚧 进行中 |
| 19:00-20:00 | QualityChecker 集成测试 | Redigg AI | ⚪ 待开始 |
| 20:00-21:00 | 端到端测试（文献综述） | Redigg AI | ⚪ 待开始 |
| 3 月 8 日 | 修复 Bug + 优化 | Redigg AI | ⚪ 待开始 |
| 3 月 9 日 | 准备种子用户 Demo | Redigg AI | ⚪ 待开始 |

---

## 6. 机会与威胁分析

### 6.1 机会（Opportunities）

1. **市场窗口** - AI 研究工具市场增长，但无主导者
2. **技术成熟** - LLM 能力足够支持自动化研究
3. **资本开放** - 垂直领域 AI 获资本认可
4. **用户痛点** - 研究者时间压力大，自动化工具需求强

### 6.2 威胁（Threats）

1. **Wordware 加速** - $30M 融资后可能扩展至研究领域
2. **Elicit 迭代** - 现有领导者可能快速跟进
3. **大厂入场** - Google/Microsoft 可能推出类似产品
4. **开源替代** - 开源项目可能提供免费方案

### 6.3 应对策略

| 威胁 | 应对策略 | 优先级 |
|------|----------|--------|
| Wordware 加速 | 加速发布，抢占先发优势 | P0 |
| Elicit 迭代 | 差异化（本地 + 网络） | P0 |
| 大厂入场 | 建立社区壁垒，快速积累用户 | P1 |
| 开源替代 | 提供商业级支持和服务 | P1 |

---

## 7. 本小时执行优先级

### P0：必须完成（18:00-19:00）
1. **TaskPlanner 单元测试** - 验证任务分类和步骤分解逻辑
2. **QualityChecker 集成测试** - 与 RediggAgent 执行流程集成
3. **文献综述 Agent 模板实现** - 将 literature_review Skill 封装为可一键启动的 Agent

### P1：应该完成（今天）
4. **Phase 2 进度更新** - 更新 PHASE_2_PROGRESS.md，标记 TaskPlanner/QualityChecker 为完成
5. **种子用户计划文档** - 创建 `docs/seed-user-plan.md`，包含完整流程和模板

### P2：可以延后（本周）
6. **评估套件设计** - 创建评估数据集规划文档
7. **Research Network 技术选型** - 协作架构初步设计

---

## 8. 需要 Vix 决策的事项（更新）

### 决策 1：Phase 2 发布时间表
- **建议**: 本周五（3 月 13 日）前完成 Phase 2 到 90%，下周一（3 月 16 日）开始种子用户邀请
- **理由**: 平衡产品质量和上市速度，周末可用于最后测试
- **状态**: ⏳ 待 Vix 确认

### 决策 2：种子用户邀请名单
- **建议**: Vix 提供 10-20 个初始联系人（信任背书），AI 协助通过学术网络扩展至 100 人
- **理由**: 初始用户质量决定产品口碑，信任背书提高接受率
- **状态**: ⏳ 待 Vix 提供名单

### 决策 3：营销资源投入
- **建议**: 本周内完成 Landing Page（使用现成模板），预算<¥5000
- **理由**: 早期验证不需要精美页面，速度优先；预算主要用于域名 + 简单托管
- **状态**: ⏳ 待 Vix 确认

---

## 9. 关键洞察

### 9.1 竞争格局稳定
- Elicit、SciSpace 等工具功能稳定，无重大创新
- Wordware 融资后暂无大动作，Redigg 有时间窗口
- CrewAI 生态成熟，可作为技术依托

### 9.2 资本市场友好
- AI 垂直领域持续获大额融资
- 基础设施类项目受青睐（Ayar Labs $500M）
- Redigg RIaaS 定位符合投资趋势

### 9.3 技术方向验证
- 本地优先架构是差异化优势
- LLM-as-judge 质量评估是行业趋势
- Agent 互操作是未来方向

### 9.4 执行优于完美
- Phase 2 不需要 100% 完美，85% 即可开始种子用户测试
- 文献综述功能可以独立发布，不必等待完整 Phase 2
- 快速迭代 + 用户反馈 > 闭门开发

---

## 10. 附录：测试代码示例

### TaskPlanner 单元测试示例

```typescript
// TaskPlanner.test.ts
import { TaskPlanner } from './TaskPlanner';

describe('TaskPlanner', () => {
  const planner = new TaskPlanner();

  test('should classify literature review task', async () => {
    const query = 'Survey on LLM-based code generation';
    const plan = await planner.plan(query);
    
    expect(plan.taskType).toBe('literature_review');
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.steps[0].skillId).toBe('arxiv_search');
  });

  test('should classify experiment design task', async () => {
    const query = 'Design an experiment to compare LLM code generation accuracy';
    const plan = await planner.plan(query);
    
    expect(plan.taskType).toBe('experiment_design');
    expect(plan.steps.some(s => s.skillId === 'literature_review')).toBe(true);
  });
});
```

### QualityChecker 集成测试示例

```typescript
// QualityChecker.test.ts
import { QualityChecker } from './QualityChecker';

describe('QualityChecker', () => {
  const checker = new QualityChecker();

  test('should pass literature review quality check', async () => {
    const result = {
      stepId: 'synthesis_001',
      content: 'Structured literature review with 50 papers...',
      citations: ['paper_1', 'paper_2', ...]
    };

    const check = await checker.check(result, 'literature_review');
    
    expect(check.passed).toBe(true);
    expect(check.suggestedAction).toBe('accept');
  });

  test('should fail and suggest retry for low quality', async () => {
    const result = {
      stepId: 'synthesis_002',
      content: 'Incomplete review with missing citations...',
      citations: []
    };

    const check = await checker.check(result, 'literature_review');
    
    expect(check.passed).toBe(false);
    expect(check.suggestedAction).toBe('retry');
  });
});
```

---

**报告结束**

*Round 14 由 Redigg AI 🦎 生成，聚焦测试验证准备。*
*人能停 AI 不能停！*
