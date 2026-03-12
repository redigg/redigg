# Redigg 文档索引

**最后更新**: 2026-03-08  
**维护者**: Redigg AI Team

---

## 📚 文档列表

### 核心文档

| 文档 | 说明 | 日期 | 版本 | 状态 |
|------|------|------|------|------|
| [redigg-design.md](./design/redigg-design.md) | **产品设计文档** - 愿景、架构、技术实现 | 2026-03-07 | v1.1.0 | ✅ 完成 |
| [contribution.md](./guides/contribution.md) | **贡献指南** - 开发标准、代码规范、Git 流程 | 2026-03-07 | v1.1.0 | ✅ 完成 |

### 规划文档

| 文档 | 说明 | 日期 | 版本 | 状态 |
|------|------|------|------|------|
| [PRODUCT_ROADMAP.md](./planning/PRODUCT_ROADMAP.md) | **产品路线图** - Phase 1-4 战略路线、优先级、里程碑 | 2026-03-08 | v1.1.0 | 📅 规划中 |
| [ITERATION_PLAN.md](./planning/ITERATION_PLAN.md) | **迭代计划** - 5 阶段详细迭代方案、技术债务、KPIs | 2026-03-08 | v1.1.0 | 📅 规划中 |
| [SCHEDULED_TASKS.md](./planning/SCHEDULED_TASKS.md) | **定时任务规划** - Cron 任务列表、实现方案、监控指标 | 2026-03-08 | v1.1.0 | 📅 规划中 |

### 开发指南

| 文档 | 说明 | 日期 | 版本 | 状态 |
|------|------|------|------|------|
| [QUICK_START_V2.md](./guides/QUICK_START_V2.md) | **快速启动指南** - 2 小时完成向量搜索+Planner+ 反馈系统 | 2026-03-08 | v1.1.0 | 📝 草稿 |

---

## 📖 文档说明

### redigg-design.md
**产品设计文档** - Redigg 的完整设计说明

**包含内容**:
- 愿景与定位 (Vision/Mission/价值观)
- 市场分析 (竞品格局、用户痛点)
- 产品架构 (系统架构、数据架构、关键流程)
- 技术实现 (技术栈、模块详解)
- 产品路线图 (Phase 0-4)

**适用场景**: 了解产品整体设计、新成员 onboarding、架构决策参考

---

### contribution.md
**贡献指南** - 开发标准和流程规范

**包含内容**:
- 项目概述 (技术栈、目录结构)
- 编码标准 (TypeScript 规范、命名约定)
- Git 工作流 (分支策略、Commit 规范)
- 测试要求
- 开发流程

**适用场景**: 代码贡献、PR 提交、团队协作

---

### PRODUCT_ROADMAP.md
**产品路线图** - 战略层面的产品规划

**包含内容**:
- 四层基础设施 (RIaaS) 说明
- 当前状态 vs 目标状态对比
- Phase 1-4 战略路线
- P0/P1/P2 优先级排序
- 成功指标 (KPIs)
- 实验计划
- 里程碑时间线

**适用场景**: 产品规划、资源分配、进度追踪

---

### ITERATION_PLAN.md
**迭代计划** - 可执行的详细迭代方案

**包含内容**:
- 当前状态评估 (已完成/待实现)
- Iteration 1-5 详细规划 (记忆增强→意图识别→反馈学习→技能市场→社区进化)
- 每个迭代的技术方案、实现步骤
- 技术债务清单
- 时间线和 KPIs
- 本周行动项

**适用场景**: 迭代开发、任务分配、进度管理

---

### SCHEDULED_TASKS.md
**定时任务规划** - Cron 任务和后台作业设计

**包含内容**:
- 当前 Heartbeat 任务说明 (60 秒间隔)
- CronManager 状态 (已实现未启用)
- P0/P1/P2 优先级任务规划 (9 个任务)
  - 记忆深度整理、技能质量评估、会话清理
  - 自动备份、用户活跃报告、技能市场同步
  - 向量索引重建、反馈数据导出、系统健康检查
- 实现方案和代码示例
- 监控指标设计
- 注意事项 (时区、并发、错误处理)

**适用场景**: 定时任务开发、系统运维、监控配置

---

### QUICK_START_V2.md
**快速启动指南** - 2 小时核心功能升级

**包含内容**:
- 第一步：向量搜索集成 (30 分钟)
  - sqlite-vec 配置
  - Embedding 生成
  - MemoryManager 更新
- 第二步：Planner 模块实现 (45 分钟)
  - Planner 类设计
  - 任务分解逻辑
  - 集成到 ResearchAgent
- 第三步：反馈收集添加 (30 分钟)
  - Feedback 表设计
  - FeedbackManager 实现
  - Web 端评分组件
- 验证清单
- 常见问题解答

**适用场景**: 快速原型开发、功能验证、技术预研

---

## 🗂️ 文档结构

```
workspace/
├── redigg/                   # Redigg Agent
│   ├── src/                  # 源代码
│   ├── skills/               # 技能模块
│   ├── web/                  # Web 前端
│   ├── tests/                # 测试文件
│   └── docs/                 # 📚 项目文档
│       ├── README.md         # 文档索引 (从这里开始)
│       ├── design/           # 设计文档
│       │   └── redigg-design.md
│       ├── planning/         # 规划文档
│       │   ├── PRODUCT_ROADMAP.md
│       │   ├── ITERATION_PLAN.md
│       │   └── SCHEDULED_TASKS.md
│       ├── guides/           # 开发指南
│       │   ├── contribution.md
│       │   └── QUICK_START_V2.md
│       └── archive/          # 归档文档
│           └── README_OLD.md
└── ...                       # 其他 workspace 文件
```

---

## 📅 更新日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-03-08 | 创建文档索引，整理所有文档 | Redigg AI |
| 2026-03-08 | 添加定时任务规划、迭代计划、产品路线图、快速启动指南 | Redigg AI |
| 2026-03-07 | 初始文档 (redigg-design.md, contribution.md) | Redigg AI |

---

## 🔗 相关链接

- **GitHub**: https://github.com/redigg/redigg
- **官网**: https://redigg.com
- **OpenClaw 文档**: https://docs.openclaw.ai
- **A2A 协议**: https://github.com/a2a-js/sdk

---

**Redigg AI Team** 🦎  
*"人能停 AI 不能停"*
