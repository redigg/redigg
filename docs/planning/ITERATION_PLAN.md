# Redigg 迭代研究计划

**版本**: 1.0  
**日期**: 2026-03-08  
**最后更新**: 2026-03-08  
**目标**: 基于产品愿景，制定可执行的迭代路线

---

## 📊 当前状态评估

### 已完成 ✅

| 模块 | 状态 | 说明 |
|------|------|------|
| 记忆系统 | Phase 1 完成 | 三层记忆 + 自动巩固 |
| 会话管理 | 完成 | SQLite 持久化 |
| 技能系统 | Phase 2 基础 | 技能加载/执行/进化 |
| A2A 网关 | 完成 | 符合 A2A 协议 |
| Web 前端 | 完成 | React + Vite |

### 待实现 ❌

| 模块 | 优先级 | 说明 |
|------|--------|------|
| 反馈学习系统 | P0 | 从用户反馈中学习改进 |
| 向量记忆搜索 | P0 | 语义检索替代 LIKE 查询 |
| 智能意图识别 | P0 | LLM 规划替代关键词匹配 |
| 技能质量评估 | P1 | 技能调用成功率追踪 |
| 社区同步机制 | P2 | 与 Redigg.com 数据同步 |

---

## 🎯 迭代路线

### Iteration 1: 记忆增强 (1-2 周)

**目标**: 让记忆系统真正"懂用户"

#### 1.1 向量搜索集成
```typescript
// 当前：基于关键词 LIKE 查询
const memories = await this.searchMemories(userId, query);

// 目标：语义向量搜索
const memories = await this.vectorSearch(userId, embedding, threshold);
```

**技术方案**:
- 使用 `sqlite-vec` 扩展 (已安装但未使用)
- 为每条记忆生成 embedding 存储
- 查询时计算余弦相似度

**实现步骤**:
1. 修改 `Memory` 表结构，添加 `embedding` 字段
2. 集成 embedding 生成 (OpenAI text-embedding-3-small)
3. 重写 `searchMemories` 使用向量相似度
4. 混合检索：向量 + 关键词 + 权重

#### 1.2 记忆类型扩展
```typescript
type MemoryType = 
  | 'preference'    // 用户偏好
  | 'fact'          // 事实信息
  | 'context'       // 上下文
  | 'paper'         // 论文
  | 'experiment'    // 实验记录 ← 新增
  | 'hypothesis'    // 研究假设 ← 新增
  | 'skill_usage'   // 技能使用记录 ← 新增
```

#### 1.3 记忆可视化
- Web 端展示记忆时间线
- 记忆权重变化图表
- 手动编辑/删除记忆

---

### Iteration 2: 意图识别增强 (2-3 周)

**目标**: 从关键词匹配升级到 LLM 规划

#### 2.1 当前问题
```typescript
// 当前实现：简单关键词匹配
if (lowerMsg.includes('literature review')) {
    return this.executeLiteratureReview(...);
}
```

**问题**:
- 无法理解复杂意图
- 无法处理多步任务
- 无法动态组合技能

#### 2.2 解决方案：Planner 模块
```typescript
interface Plan {
    goal: string;
    steps: PlanStep[];
    context: Record<string, any>;
}

interface PlanStep {
    id: string;
    skill: string;
    params: Record<string, any>;
    dependsOn?: string[];
}
```

**实现步骤**:
1. 设计 Planner Prompt 模板
2. LLM 生成任务分解计划
3. 执行引擎按步骤执行
4. 错误处理与重试机制

#### 2.3 示例流程
```
用户: "帮我分析这个领域的研究趋势，然后写个综述"

Plan:
1. literature_review(topic="领域名称") → 获取论文列表
2. code_analysis(operation="extract_trends", papers=step1.result) → 分析趋势
3. paper_writing(type="review", data=step2.result) → 生成综述
```

---

### Iteration 3: 反馈学习系统 (2-3 周)

**目标**: 实现"越用越聪明"的自进化能力

#### 3.1 反馈收集
```typescript
interface Feedback {
    sessionId: string;
    messageId: string;
    score: 1 | 2 | 3 | 4 | 5;  // 用户评分
    type: 'explicit' | 'implicit';
    metadata: {
        duration: number;
        tokens: number;
        skillUsed: string;
        userAction?: 'copy' | 'share' | 'ignore';
    };
}
```

**收集方式**:
- 显式：⭐⭐⭐⭐⭐ 评分按钮
- 隐式：用户复制/分享/忽略行为

#### 3.2 反馈分析
```typescript
class FeedbackAnalyzer {
    // 分析低分原因
    async analyzeLowScore(feedback: Feedback): Promise<{
        category: 'accuracy' | 'completeness' | 'speed' | 'relevance';
        suggestion: string;
    }>
    
    // 聚合技能质量分
    getSkillSuccessRate(skillId: string): number
}
```

#### 3.3 反馈驱动改进
```typescript
// 技能质量低于阈值时触发优化
if (skillSuccessRate < 0.7) {
    await skillEvolutionSystem.evolveSkill(
        intent: `Improve ${skillId} success rate`,
        feedback: lowScoreFeedbacks
    );
}
```

---

### Iteration 4: 技能市场 (3-4 周)

**目标**: 建立技能生态，支持技能共享

#### 4.1 技能打包
```typescript
interface SkillPackage {
    id: string;
    name: string;
    version: string;
    author: string;
    skills: string[];
    dependencies: string[];
    downloadUrl: string;
    rating: number;
    installs: number;
}
```

#### 4.2 技能安装
```bash
# CLI 命令
redigg skill install @redigg/data-analysis
redigg skill search "literature review"
redigg skill publish ./my-skill
```

#### 4.3 技能沙箱
- 权限隔离 (文件/网络/系统)
- 资源限制 (CPU/内存/时间)
- 安全审计 (代码扫描)

---

### Iteration 5: 科研增强与社区进化 (4-6 周)
**目标**: 实现完全自主科研

#### 5.1 增强 Survey Skill
- 深度调研、绘图、制表

#### 5.2 扩展技能生态
- 接入 Coding Agent (Cursor, Claude Code)
- 接入科研基建

#### 5.3 多 Agent 协同
- 7x24 小时自主科研
- 任务分发与结果聚合

#### 5.4 社区进化
- 技能市场、联邦学习

---

## 📈 关键指标 (KPIs)

| 指标 | 当前 | 目标 (3 个月) |
|------|------|---------------|
| 记忆检索准确率 | ~60% (关键词) | >90% (向量) |
| 意图识别成功率 | ~70% | >95% |
| 技能调用成功率 | ~85% | >95% |
| 用户满意度 | - | >4.5/5 |
| 技能数量 | 15+ | 50+ |
| 活跃用户 | - | 100+ |

---

## 🔧 技术债务

### 需重构
1. **意图识别** - 从关键词 → LLM Planner
2. **记忆搜索** - 从 LIKE → 向量检索
3. **错误处理** - 统一错误处理机制
4. **日志系统** - 结构化日志 + 可观测性

### 需补充
1. **单元测试** - 当前覆盖率 ~40% → 目标 80%
2. **API 文档** - OpenAPI/Swagger
3. **部署脚本** - Docker + K8s
4. **监控告警** - Prometheus + Grafana

---

## 📅 时间线

```
2026-03  ████████░░░░░░░░░░░░  Iteration 1: 记忆增强
2026-04  ░░░░████████░░░░░░░░  Iteration 2: 意图识别
2026-05  ░░░░░░░░████████░░░░  Iteration 3: 反馈学习
2026-06  ░░░░░░░░░░░░████████  Iteration 4: 技能市场
2026-07+ ████████░░░░░░░░░░░░  Iteration 5: 社区进化
```

---

## 🎯 下一步行动

### 本周 (2026-03-08 ~ 03-15)
- [ ] 集成 sqlite-vec 向量搜索
- [ ] 设计 Planner Prompt 模板
- [ ] 添加用户反馈 UI 组件

### 下周 (2026-03-15 ~ 03-22)
- [ ] 完成记忆 embedding 生成
- [ ] 实现基础 Planner 模块
- [ ] 建立反馈数据收集

---

## 📚 参考资料
- [A2A 协议规范](https://github.com/a2a-js/sdk)
- [sqlite-vec](https://github.com/asg017/sqlite-vec)
- [LangGraph Planner 模式](https://langchain-ai.github.io/langgraph/)

---

**Redigg AI Team** 🦎  
*"人能停 AI 不能停"*
