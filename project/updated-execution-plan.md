# Redigg 更新执行计划

**日期**: 2026年3月4日  
**更新内容**: 整合 todo + research 版本/workspace/类型系统  
**基于**: future-work-priorities.md + 新 todo 列表

---

## 一、新增核心任务（高优先级）

### 1.1 技能市场重构

**目标**: skill 应该 follow skill guide，有文件目录，包含一批脚本

**具体任务**:
- [ ] 研究 OpenClaw skill guide 规范
- [ ] 设计 skill 文件目录结构
- [ ] 开发第一批示范 skill 脚本
- [ ] 建立 skill 质量标准和审核流程
- [ ] 重构 skill 市场架构

**成功标准**:
- skill 目录结构清晰，符合最佳实践
- 有 5-10 个高质量示范 skill
- skill 可以独立运行和测试

---

### 1.2 Agent 核心价值：Workflow + Skill

**目标**: 设定一套高质量的工作模版和技能，先手工搭建，再用 evomap 做进化

**具体任务**:
- [ ] 设计高质量的 workflow 模板库
- [ ] 手工搭建第一批 workflow + skill 组合
- [ ] 开发 workflow 编辑器和组合工具
- [ ] 研究 evomap 进化机制
- [ ] 用 evomap 对 workflow + skill 进行进化

**成功标准**:
- 有 10+ 高质量 workflow 模板
- workflow + skill 组合可以实际使用
- evomap 进化机制生效，质量持续提升

---

### 1.3 Redigg Agent 命令行工具

**目标**: 类似 Claude Code 的命令行工具，能够在本地运行，自行配置一系列工具

**具体任务**:
- [ ] 设计 redigg-agent CLI 架构
- [ ] 开发基础 CLI 框架
- [ ] 集成 Overleaf 工具
- [ ] 集成 Zotero 工具
- [ ] 集成 arXiv 工具
- [ ] 开发本地配置系统
- [ ] 编写 CLI 使用文档

**成功标准**:
- redigg-agent 可以在本地安装和运行
- 支持 Overleaf/Zotero/arXiv 等工具集成
- 配置系统灵活易用
- 文档完整

---

### 1.4 场景迭代与验证

**目标**: 挑选合适的场景进行迭代，优先 AI 研究相关场景

**具体任务**:
- [ ] 选择优先场景：
  - [ ] Survey（文献综述）
  - [ ] Agentic Research（智能体研究）
  - [ ] Test Time（测试阶段研究）
- [ ] 为每个场景设计专门的 workflow
- [ ] 开发场景专用 skill
- [ ] 在实际研究中进行验证
- [ ] 收集反馈，快速迭代

**成功标准**:
- 3 个优先场景都有完整的 workflow + skill
- 在实际研究中验证通过
- 用户反馈积极，效率提升明显

---

### 1.5 质量保障：Peer Review Agent

**目标**: 将 peer review agent 的能力集成到 redigg agent 中，在 paper writing runtime 下做自进化

**具体任务**:
- [ ] 设计 peer review agent 架构
- [ ] 开发 peer review skill
- [ ] 集成到 paper writing workflow
- [ ] 设计自进化反馈循环
- [ ] 实现 runtime 下的持续优化
- [ ] 建立 review 质量评估标准

**成功标准**:
- peer review agent 可以独立工作
- 在 paper writing 过程中自动提供 review
- 自进化机制生效，质量持续提升
- review 质量达到或超过人工水平

---

### 1.6 Research 版本系统

**目标**: Research 应该有版本的概念，按 step 做完之后，还可以继续创建新的版本重新推进，之前的 context 是保留的

**具体任务**:
- [ ] 设计 research 版本数据模型
- [ ] 实现版本创建和管理功能
- [ ] 实现 context 保留和继承机制
- [ ] 设计版本 diff 和对比功能
- [ ] 实现版本回滚功能

**成功标准**:
- 可以创建新版本，保留之前的 context
- 版本之间可以对比和 diff
- 可以回滚到之前的版本
- 用户体验流畅，理解清晰

---

### 1.7 Workspace 管理系统

**目标**: 提供一套 workspace，以及相应的管理方式

**具体任务**:
- [ ] 设计 workspace 数据模型
- [ ] 实现 workspace 创建和管理
- [ ] 实现 workspace 权限管理
- [ ] 设计 workspace 模板系统
- [ ] 实现 workspace 导入导出功能

**成功标准**:
- 可以创建和管理多个 workspace
- workspace 权限系统完善
- 可以使用模板创建 workspace
- 可以导入导出 workspace

---

### 1.8 Research 类型系统

**目标**: 在 create research 里，应该有创建不同类型比如 survey / benchmark / algorithm paper；会议类型如 nips / iclr ... ；编排的不同方式等

**具体任务**:
- [ ] 设计 research 类型系统
- [ ] 实现 survey 类型模板
- [ ] 实现 benchmark 类型模板
- [ ] 实现 algorithm paper 类型模板
- [ ] 实现会议类型选择（nips/iclr/icml/kdd 等）
- [ ] 设计编排方式选择（固定流程/动态编排/混合模式）
- [ ] 实现类型模板的可扩展性

**成功标准**:
- 支持多种 research 类型
- 支持多种会议类型
- 支持多种编排方式
- 模板系统可扩展，用户可以自定义

---

### 1.9 Version 下的 Peer Review 反馈

**目标**: Version 下应该有 peer review 的反馈，由 agent 主动发起

**具体任务**:
- [ ] 设计 version 下的 review 数据模型
- [ ] 实现 agent 主动发起 review 的机制
- [ ] 设计 review 反馈的展示界面
- [ ] 实现 review 反馈的回复和讨论
- [ ] 实现 review 反馈的 action item 追踪
- [ ] 设计 review 反馈的历史记录

**成功标准**:
- Agent 在 version 创建后主动发起 review
- Review 反馈清晰展示，易于理解
- 可以回复和讨论 review 反馈
- Action item 可以追踪和管理
- Review 历史完整记录

---

## 二、整合后的执行路线图

### Phase 1: 基础建设（0-1个月）

**核心目标**: 建立 redigg-agent CLI、基础 skill 体系、Research 核心系统

#### 1.1 第1周：CLI + Workspace 基础
- [ ] 设计 redigg-agent CLI 架构
- [ ] 开发基础 CLI 框架
- [ ] 设计 workspace 数据模型
- [ ] 实现 workspace 创建和管理
- [ ] 研究 OpenClaw skill guide

#### 1.2 第2周：工具集成 + Research 类型
- [ ] 集成 Overleaf 工具
- [ ] 集成 Zotero 工具
- [ ] 集成 arXiv 工具
- [ ] 设计 research 类型系统
- [ ] 实现 survey/benchmark/algorithm paper 类型模板
- [ ] 实现会议类型选择（nips/iclr/icml/kdd）
- [ ] 编写 CLI 使用文档

#### 1.3 第3周：Skill 体系 + 版本系统
- [ ] 设计 skill 文件目录结构
- [ ] 开发第一批示范 skill 脚本
- [ ] 建立 skill 质量标准
- [ ] 定义 skill.md 协议 v1.0
- [ ] 设计 research 版本数据模型
- [ ] 实现版本创建和管理功能
- [ ] 实现 context 保留和继承机制

#### 1.4 第4周：Workflow 基础 + Review 系统
- [ ] 设计 workflow 模板库
- [ ] 手工搭建第一批 workflow
- [ ] 开发 workflow 组合工具
- [ ] 集成 Literature Review skill
- [ ] 设计编排方式选择（固定/动态/混合）
- [ ] 设计 version 下的 review 数据模型
- [ ] 实现 agent 主动发起 review 的机制

---

### Phase 2: 场景迭代（1-2个月）

**核心目标**: 在 AI 研究场景中验证和迭代

#### 2.1 第5-6周：Survey 场景
- [ ] 设计 Survey 专用 workflow
- [ ] 开发 Survey 专用 skill
- [ ] 在实际研究中验证
- [ ] 收集反馈，快速迭代

#### 2.2 第7-8周：Agentic Research 场景
- [ ] 设计 Agentic Research workflow
- [ ] 开发相关 skill
- [ ] 在实际研究中验证
- [ ] 收集反馈，快速迭代

#### 2.3 第9-10周：Test Time 场景
- [ ] 设计 Test Time workflow
- [ ] 开发相关 skill
- [ ] 在实际研究中验证
- [ ] 收集反馈，快速迭代

---

### Phase 3: 质量保障与自进化（2-3个月）

**核心目标**: 集成 peer review，建立自进化机制

#### 3.1 第11-12周：Peer Review Agent
- [ ] 设计 peer review agent 架构
- [ ] 开发 peer review skill
- [ ] 集成到 paper writing workflow
- [ ] 建立 review 质量评估标准

#### 3.2 第13-14周：自进化机制
- [ ] 设计自进化反馈循环
- [ ] 实现 runtime 下的持续优化
- [ ] 研究 evomap 进化机制
- [ ] 用 evomap 对 workflow + skill 进行进化

#### 3.3 第15-16周：技能市场重构
- [ ] 重构 skill 市场架构
- [ ] 建立 skill 审核流程
- [ ] 开放 skill 提交（早期测试）
- [ ] 建立 skill 评价和反馈系统

---

### Phase 4: 生态扩展（3-6个月）

**核心目标**: 从单点转向生态系统

#### 4.1 第17-20周：Workflow + Skill 进化
- [ ] 扩展 workflow 模板库（50+）
- [ ] 扩展 skill 库（30+）
- [ ] 优化 evomap 进化机制
- [ ] 建立 workflow + skill 组合市场

#### 4.2 第21-24周：三边市场建设
- [ ] 开放 skill 开发（正式版）
- [ ] 建立完整的 skill 市场
- [ ] 引入 Agent 开发者
- [ ] 引入数据/工具提供者

---

## 三、关键里程碑

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

## 四、技术架构概览

### 4.1 Redigg Agent CLI 架构

```
redigg-agent/
├── cli/                    # 命令行接口
│   ├── main.py
│   ├── commands/
│   │   ├── init.py        # 初始化配置
│   │   ├── workspace.py   # workspace 管理
│   │   ├── research.py    # research 管理
│   │   ├── version.py     # 版本管理
│   │   ├── run.py         # 运行 workflow
│   │   ├── skill.py       # skill 管理
│   │   └── tool.py        # 工具管理
├── config/                 # 配置系统
│   ├── local.py           # 本地配置
│   └── tools.py           # 工具配置
├── core/                   # 核心系统
│   ├── workspace/          # Workspace 系统
│   │   ├── models.py      # Workspace 数据模型
│   │   ├── manager.py     # Workspace 管理器
│   │   └── templates.py   # Workspace 模板
│   ├── research/           # Research 系统
│   │   ├── models.py      # Research 数据模型
│   │   ├── types.py       # Research 类型系统
│   │   ├── templates/     # Research 模板
│   │   │   ├── survey/
│   │   │   ├── benchmark/
│   │   │   └── algorithm-paper/
│   │   └── conferences.py # 会议类型配置
│   ├── version/            # 版本系统
│   │   ├── models.py      # Version 数据模型
│   │   ├── manager.py     # Version 管理器
│   │   ├── context.py     # Context 继承机制
│   │   └── diff.py        # 版本对比功能
│   └── review/             # Review 系统
│       ├── models.py      # Review 数据模型
│       ├── agent.py       # Review Agent
│       ├── feedback.py    # 反馈管理
│       └── action_items.py # Action Item 追踪
├── skills/                 # skill 目录
│   ├── literature-review/
│   │   ├── skill.md       # skill 描述
│   │   ├── main.py        # 主脚本
│   │   └── tests/         # 测试
│   └── peer-review/
│       ├── skill.md
│       └── main.py
├── workflows/              # workflow 模板
│   ├── survey/
│   │   ├── workflow.json  # workflow 定义
│   │   └── README.md
│   ├── benchmark/
│   │   └── workflow.json
│   └── paper-writing/
│       └── workflow.json
├── tools/                  # 工具集成
│   ├── overleaf.py
│   ├── zotero.py
│   └── arxiv.py
└── evolution/              # 进化系统
    ├── evomap.py
    └── feedback-loop.py
```

### 4.2 Workspace 目录结构

```
workspaces/
├── my-research-workspace/
│   ├── workspace.json      # Workspace 配置
│   ├── researches/         # Research 列表
│   │   ├── survey-llm-2026/
│   │   │   ├── research.json  # Research 配置
│   │   │   ├── versions/       # 版本列表
│   │   │   │   ├── v1/
│   │   │   │   │   ├── version.json
│   │   │   │   │   ├── context/  # Version context
│   │   │   │   │   ├── outputs/  # 输出文件
│   │   │   │   │   └── reviews/  # Peer review
│   │   │   │   │       ├── review-1.json
│   │   │   │   │       └── review-2.json
│   │   │   │   └── v2/
│   │   │   └── artifacts/      # 持久化文件
│   │   └── benchmark-vision/
│   └── assets/            # Workspace 资源
```

### 4.3 Research 类型系统

```python
# Research 类型
ResearchType = Enum(
    "SURVEY",           # 文献综述
    "BENCHMARK",        # 基准测试
    "ALGORITHM_PAPER",  # 算法论文
    "POSITION_PAPER",   # 观点论文
    "REPRODUCTION",     # 复现研究
    "EXPERIMENT"         # 实验研究
)

# 会议类型
ConferenceType = Enum(
    "NIPS",      # NeurIPS
    "ICLR",      # ICLR
    "ICML",      # ICML
    "KDD",       # KDD
    "CVPR",      # CVPR
    "ACL",       # ACL
    "AAAI",      # AAAI
    "CUSTOM"     # 自定义
)

# 编排方式
OrchestrationMode = Enum(
    "FIXED_CHAIN",    # 固定流程
    "DYNAMIC",        # 动态编排
    "HYBRID",         # 混合模式
    "AGENTIC"         # 完全智能体
)
```

### 4.2 Skill 目录结构（遵循 Skill Guide）

```
skill-name/
├── skill.md                # Skill 描述文档（必需）
├── main.py                 # 主执行脚本（必需）
├── requirements.txt        # 依赖（可选）
├── config.json             # 默认配置（可选）
├── examples/               # 使用示例
│   ├── example1.py
│   └── example2.py
├── tests/                  # 测试
│   ├── test_basic.py
│   └── test_edge_cases.py
└── assets/                 # 资源文件（可选）
    └── ...
```

---

## 五、风险与应对

| 风险 | 可能性 | 影响 | 应对措施 |
|------|--------|------|----------|
| CLI 开发复杂度超出预期 | 中 | 高 | 先做最小可行版本，逐步增加功能 |
| Skill 质量难以保证 | 高 | 中 | 建立严格的质量标准，先做示范 skill |
| 场景验证找不到合适的测试用户 | 中 | 高 | 我们自己先作为测试用户，内部验证 |
| Peer review 质量达不到人工水平 | 中 | 中 | 先做辅助 review，逐步提升质量 |
| 自进化机制效果不明显 | 中 | 中 | 先建立反馈循环，再优化进化算法 |

---

## 六、立即行动清单（本周）

- [ ] 研究 OpenClaw skill guide 规范
- [ ] 设计 redigg-agent CLI 架构
- [ ] 搭建 CLI 基础框架
- [ ] 设计 skill 文件目录结构
- [ ] 开发第一个示范 skill（Literature Review）
- [ ] 选择第一个验证场景（Survey）
- [ ] 建立项目管理和进度跟踪机制

---

**编制**: OpenClaw Research Agent  
**日期**: 2026年3月4日  
**核心结论**: 以 redigg-agent CLI 为核心，建立 workflow + skill 体系，在 AI 研究场景中验证，集成 peer review 实现自进化！
