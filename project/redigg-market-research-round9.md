# Redigg.com 市场调研报告 - 第九轮

**调研日期**: 2026年3月6日  
**调研轮次**: 第九轮  
**调研重点**: 研发推进策略分析、Phase 1执行计划、redigg-agent最新进展

---

## 一、研发推进核心策略总结

基于对 `updated-execution-plan.md`、`phase1-detailed-plan.md` 和 `redigg-agent` 最新代码的分析，我们总结出 Redigg 研发推进的核心策略：

### 1.1 核心原则：单点突破，但展示生态潜力

**Phase 1 (0-3个月) 核心目标**：
1. **Literature Review Automation做到极致** - 质量达到或超过Elicit
2. **展示生态潜力** - 用户理解"skill"的概念，对未来感到兴奋
3. **建立种子用户社区** - 50-100个活跃的种子用户
4. **技术基础设施** - skill.md协议v1.0，模块化架构

**成功标准**：
| 指标 | 目标值 |
|------|--------|
| Literature Review质量 | 达到或超过Elicit |
| 用户满意度 | 4.0/5.0以上 |
| 种子用户数量 | 50-100 |
| 活跃用户比例 | 30%以上 |
| skill.md协议 | v1.0完成 |
| 开发者兴趣 | 至少10个开发者表达兴趣 |

---

### 1.2 第1周（当前周）：基础建设

**时间**: 2026年3月4日 - 2026年3月10日  
**目标**: 建立基础，启动核心开发

#### 任务清单

- [x] skill.md协议v1.0草案
- [x] Literature Review skill示例
- [x] Phase 1详细计划和里程碑
- [ ] 内部项目管理机制建立
- [ ] 技术架构初步设计
- [ ] 种子用户画像定义
- [ ] 早期反馈渠道建立

#### 交付物

- skill.md协议v1.0草案
- Literature Review skill示例
- Phase 1详细计划
- 项目管理机制文档
- 技术架构初步设计
- 种子用户画像

---

## 二、redigg-agent 最新代码分析

### 2.1 已实现的核心功能

基于对 `redigg-agent/src/index.ts` 的分析，redigg-agent 已经实现了以下核心功能：

| 命令 | 功能 | 状态 |
|------|------|------|
| `redigg init` | 交互式设置向导（配置API key等） | ✅ |
| `redigg status` | 检查agent状态和配置 | ✅ |
| `redigg config` | 管理配置（get/set） | ✅ |
| `redigg login` | 登录Redigg | ✅ |
| `redigg register` | 注册新agent | ✅ |
| `redigg tasks` | 列出可用任务 | ✅ |
| `redigg workspace` | Workspace管理（create/list） | ✅ |
| `redigg research` | Research管理（create/list） | ✅ |
| `redigg chat` | 启动交互式会话（REPL） | ✅ |
| `redigg run` | 运行JSON文件定义的任务 | ✅ |
| `redigg serve` | 启动被动工作模式 | ✅ |

### 2.2 技术架构概览

```
redigg-agent/
├── src/
│   ├── index.ts                    # CLI入口
│   ├── config/                     # 配置系统
│   │   ├── index.ts
│   │   └── workspace.ts
│   ├── agent/                      # Agent核心
│   │   ├── runtime.ts
│   │   └── profile.ts
│   ├── workspace/                  # Workspace系统
│   │   └── index.ts
│   ├── api/                        # API客户端
│   │   └── client.ts
│   ├── gateway/                    # Gateway接口
│   │   ├── interface.ts
│   │   └── redigg.ts
│   ├── cli/                        # CLI工具
│   │   └── interactive.ts
│   └── skills/                     # 技能系统
│       └── index.ts
├── docs/                           # 文档
│   ├── architecture.md
│   ├── cli-design.md
│   └── refactoring-plan.md
├── TODO.md                         # 待办事项
└── .env                            # 环境变量
```

### 2.3 新增的文档和计划

redigg-agent 新增了以下重要文档：

| 文档 | 内容 | 状态 |
|------|------|------|
| `TODO.md` | Redigg Agent Refactoring Roadmap | ✅ |
| `docs/architecture.md` | 技术架构文档 | ✅ |
| `docs/cli-design.md` | CLI设计参考（Inspired by Claude Code CLI） | ✅ |
| `docs/refactoring-plan.md` | 重构计划 | ✅ |

---

## 三、研发推进路线图详解

### 3.1 Phase 1: 基础建设（0-1个月）

**核心目标**: 建立 redigg-agent CLI、基础 skill 体系、Research 核心系统

#### 第1周：CLI + Workspace 基础
- [x] 设计 redigg-agent CLI 架构
- [x] 开发基础 CLI 框架
- [x] 设计 workspace 数据模型
- [x] 实现 workspace 创建和管理
- [ ] 研究 OpenClaw skill guide

#### 第2周：工具集成 + Research 类型
- [ ] 集成 Overleaf 工具
- [ ] 集成 Zotero 工具
- [ ] 集成 arXiv 工具
- [ ] 设计 research 类型系统
- [ ] 实现 survey/benchmark/algorithm paper 类型模板
- [ ] 实现会议类型选择（nips/iclr/icml/kdd）
- [ ] 编写 CLI 使用文档

#### 第3周：Skill 体系 + 版本系统
- [ ] 设计 skill 文件目录结构
- [ ] 开发第一批示范 skill 脚本
- [ ] 建立 skill 质量标准
- [ ] 定义 skill.md 协议 v1.0
- [ ] 设计 research 版本数据模型
- [ ] 实现版本创建和管理功能
- [ ] 实现 context 保留和继承机制

#### 第4周：Workflow 基础 + Review 系统
- [ ] 设计 workflow 模板库
- [ ] 手工搭建第一批 workflow
- [ ] 开发 workflow 组合工具
- [ ] 集成 Literature Review skill
- [ ] 设计编排方式选择（固定/动态/混合）
- [ ] 设计 version 下的 review 数据模型
- [ ] 实现 agent 主动发起 review 的机制

### 3.2 Phase 2: 场景迭代（1-2个月）

**核心目标**: 在 AI 研究场景中验证和迭代

#### 第5-6周：Survey 场景
- [ ] 设计 Survey 专用 workflow
- [ ] 开发 Survey 专用 skill
- [ ] 在实际研究中验证
- [ ] 收集反馈，快速迭代

#### 第7-8周：Agentic Research 场景
- [ ] 设计 Agentic Research workflow
- [ ] 开发相关 skill
- [ ] 在实际研究中验证
- [ ] 收集反馈，快速迭代

#### 第9-10周：Test Time 场景
- [ ] 设计 Test Time workflow
- [ ] 开发相关 skill
- [ ] 在实际研究中验证
- [ ] 收集反馈，快速迭代

### 3.3 Phase 3: 质量保障与自进化（2-3个月）

**核心目标**: 集成 peer review，建立自进化机制

#### 第11-12周：Peer Review Agent
- [ ] 设计 peer review agent 架构
- [ ] 开发 peer review skill
- [ ] 集成到 paper writing workflow
- [ ] 建立 review 质量评估标准

#### 第13-14周：自进化机制
- [ ] 设计自进化反馈循环
- [ ] 实现 runtime 下的持续优化
- [ ] 研究 evomap 进化机制
- [ ] 用 evomap 对 workflow + skill 进行进化

#### 第15-16周：技能市场重构
- [ ] 重构 skill 市场架构
- [ ] 建立 skill 审核流程
- [ ] 开放 skill 提交（早期测试）
- [ ] 建立 skill 评价和反馈系统

---

## 四、关键里程碑总结

| 里程碑 | 时间 | 交付物 |
|---------|------|--------|
| M1: redigg-agent CLI v0.1 | 第4周 | 可用的 CLI，支持 Overleaf/Zotero/arXiv |
| M2: Workspace 系统 | 第2周 | Workspace 创建、管理、模板系统 |
| M3: Research 类型系统 | 第3周 | 支持 survey/benchmark/algorithm paper，会议类型选择 |
| M4: 版本系统 | 第4周 | 版本创建、context 保留、版本对比 |
| M5: Version 下的 Peer Review | 第4周 | Agent 主动发起 review，反馈管理 |
| M6: 基础 skill 体系 | 第4周 | 10+ 示范 skill，skill.md 协议 v1.0 |
| M7: Survey 场景验证 | 第6周 | Survey workflow + skill，实际验证通过 |
| M8: Agentic Research 场景验证 | 第8周 | Agentic Research workflow + skill |
| M9: Test Time 场景验证 | 第10周 | Test Time workflow + skill |
| M10: Peer Review Agent | 第12周 | peer review skill，集成到 paper writing |
| M11: 自进化机制 | 第14周 | evomap 进化，runtime 持续优化 |
| M12: 技能市场重构 | 第16周 | 新的 skill 市场架构，审核流程 |
| M13: 生态扩展 | 第24周 | 50+ workflow，30+ skill，三边市场运转 |

---

## 五、立即行动清单（本周）

基于当前状态，我们建议立即执行以下任务：

### 5.1 高优先级任务

1. **研究 OpenClaw skill guide 规范**
   - 了解 skill 的最佳实践
   - 设计 skill 文件目录结构
   - 建立 skill 质量标准

2. **设计 redigg-agent CLI 架构**
   - 基于 `docs/cli-design.md` 中的设计
   - 参考 Claude Code CLI 的设计理念
   - 设计全局 flags 和命令结构

3. **搭建 CLI 基础框架**
   - 完善 `redigg init` 命令
   - 完善 `redigg status` 命令
   - 完善 `redigg workspace` 命令
   - 完善 `redigg research` 命令

4. **开发第一个示范 skill（Literature Review）**
   - 基于 `example-literature-review-skill.md`
   - 实现文献检索功能
   - 实现文献分析功能
   - 实现结构化综述生成

5. **选择第一个验证场景（Survey）**
   - 设计 Survey 专用 workflow
   - 开发 Survey 专用 skill
   - 在实际研究中验证

### 5.2 中优先级任务

6. **建立项目管理和进度跟踪机制**
   - 使用 GitHub Projects 或类似工具
   - 每周同步进度
   - 建立问题跟踪机制

7. **技术架构初步设计**
   - 基于 `docs/architecture.md`
   - 设计模块化架构
   - 定义接口和数据模型

8. **种子用户画像定义**
   - 定义目标用户群体
   - 设计用户招募渠道
   - 准备早期反馈机制

---

## 六、风险与应对

| 风险 | 可能性 | 影响 | 应对措施 |
|------|--------|------|----------|
| CLI 开发复杂度超出预期 | 中 | 高 | 先做最小可行版本，逐步增加功能 |
| Skill 质量难以保证 | 高 | 中 | 建立严格的质量标准，先做示范 skill |
| 场景验证找不到合适的测试用户 | 中 | 高 | 我们自己先作为测试用户，内部验证 |
| Peer review 质量达不到人工水平 | 中 | 中 | 先做辅助 review，逐步提升质量 |
| 自进化机制效果不明显 | 中 | 中 | 先建立反馈循环，再优化进化算法 |

---

## 七、总结

基于第九轮市场调研，我们对 Redigg 研发推进策略有了清晰的认识：

**核心策略**：
1. **单点突破，但展示生态潜力** - Phase 1 聚焦 Literature Review Automation，做到极致
2. **分阶段执行** - 4个阶段，16周计划，13个里程碑
3. **以 redigg-agent CLI 为核心** - 建立完整的 CLI、Workspace、Research、Version、Review 系统
4. **场景验证** - 在 Survey、Agentic Research、Test Time 三个场景中验证
5. **自进化机制** - 集成 Peer Review Agent，建立 evomap 进化机制

**立即行动**：
1. 研究 OpenClaw skill guide 规范
2. 设计 redigg-agent CLI 架构
3. 搭建 CLI 基础框架
4. 开发第一个示范 skill（Literature Review）
5. 选择第一个验证场景（Survey）
6. 建立项目管理和进度跟踪机制

---

**编制**: OpenClaw Research Agent  
**日期**: 2026年3月6日  
**核心结论**: 以 redigg-agent CLI 为核心，分阶段执行，单点突破，展示生态潜力！
