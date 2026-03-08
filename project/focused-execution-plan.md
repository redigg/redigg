# Redigg 聚焦执行计划

**日期**: 2026年3月4日  
**核心目标**: 能 24 不间断运行的本地研究智能体  
**聚焦**: redigg-agent 迭代

---

## 🎯 核心理念

> **核心还是 redigg-agent 的迭代，第一个里程碑应该是能 24 不间断运行的本地的研究智能体。**

---

## 📋 第一个里程碑：24 小时不间断运行的本地研究智能体

### 里程碑目标
**M0**: redigg-agent v0.1 - 能 24 小时不间断运行的本地研究智能体

### 交付物
- ✅ redigg-agent CLI 工具
- ✅ 本地 workspace 管理
- ✅ 基础 research 类型（survey）
- ✅ 基础 version 系统
- ✅ 基础 peer review（agent 主动发起）
- ✅ 集成 Overleaf/Zotero/arXiv
- ✅ 24 小时不间断运行的能力

---

## 🗓️ 分阶段执行计划

### Phase 0: 最小可行智能体（1-2周）

**目标**: 快速拿出能跑的版本，先实现核心功能

#### Week 1: CLI + Workspace + 基础功能
- [ ] 设计并实现 redigg-agent CLI 基础框架
- [ ] 实现本地 workspace 管理（创建、列出、切换）
- [ ] 实现基础 research 创建（survey 类型）
- [ ] 集成 arXiv 工具（文献搜索）
- [ ] 实现最简单的 workflow 执行

#### Week 2: Version + Review + 24小时运行
- [ ] 实现基础 version 系统（创建新版本，保留 context）
- [ ] 实现 agent 主动发起 peer review
- [ ] 集成 Zotero 工具（文献管理）
- [ ] 集成 Overleaf 工具（论文写作）
- [ ] 实现 24 小时不间断运行的守护进程
- [ ] 端到端测试：创建 survey → 执行 → 生成 version → peer review

---

### Phase 1: 功能完善（3-4周）

**目标**: 完善功能，提升体验

#### Week 3: 类型系统 + 编排方式
- [ ] 实现完整的 research 类型系统（survey/benchmark/algorithm paper）
- [ ] 实现会议类型选择（nips/iclr/icml/kdd）
- [ ] 实现编排方式选择（固定/动态/混合）
- [ ] 优化 workflow 执行引擎

#### Week 4: Skill 体系 + 质量保障
- [ ] 设计 skill 目录结构（遵循 skill guide）
- [ ] 开发第一批示范 skill（literature review, peer review）
- [ ] 实现 skill 加载和执行
- [ ] 完善 peer review 反馈管理
- [ ] 性能优化，确保 24 小时稳定运行

---

### Phase 2: 场景验证（5-8周）

**目标**: 在实际研究场景中验证和迭代

#### Week 5-6: Survey 场景深度打磨
- [ ] 优化 survey workflow
- [ ] 在实际 survey 研究中测试
- [ ] 收集反馈，快速迭代
- [ ] 优化 user experience

#### Week 7-8: 更多场景
- [ ] Benchmark 场景
- [ ] Algorithm paper 场景
- [ ] 持续优化稳定性

---

## 🏗️ 技术架构（聚焦版）

### 核心模块

```
redigg-agent/
├── cli/
│   └── main.py                 # CLI 入口
├── daemon/                     # 守护进程（24小时运行）
│   └── agentd.py
├── core/
│   ├── workspace/              # Workspace 管理
│   ├── research/               # Research 管理
│   ├── version/                # Version 管理
│   └── review/                 # Peer review
├── skills/                     # Skill 目录
├── tools/                      # 工具集成
│   ├── arxiv.py
│   ├── zotero.py
│   └── overleaf.py
└── workflows/                  # Workflow 模板
```

### 最小可行数据模型

```python
# Workspace
{
  "id": "ws_xxx",
  "name": "My Research",
  "path": "~/.redigg/workspaces/my-research"
}

# Research
{
  "id": "res_xxx",
  "type": "survey",
  "title": "LLM Survey 2026",
  "workspace_id": "ws_xxx"
}

# Version
{
  "id": "ver_xxx",
  "research_id": "res_xxx",
  "version": "v1",
  "context": {...},  # 保留的 context
  "created_at": "2026-03-04T18:00:00Z"
}

# Review
{
  "id": "rev_xxx",
  "version_id": "ver_xxx",
  "content": "...",  # review 内容
  "status": "pending",  # pending/resolved
  "created_at": "2026-03-04T18:05:00Z"
}
```

---

## 🎯 立即行动清单（今天）

- [ ] 设计 redigg-agent CLI 最简接口
- [ ] 搭建项目基础结构
- [ ] 实现 workspace 管理（创建、列出）
- [ ] 实现 research 创建（survey 类型）
- [ ] 集成 arXiv 基础搜索

---

## 📊 成功标准（M0）

- ✅ redigg-agent 可以安装和运行
- ✅ 可以创建 workspace 和 research
- ✅ 可以创建 version，保留 context
- ✅ Agent 主动发起 peer review
- ✅ 集成 arXiv/Zotero/Overleaf
- ✅ 24 小时不间断运行（守护进程）
- ✅ 端到端流程跑通

---

**核心聚焦**: redigg-agent 迭代 → 24 小时不间断运行的本地研究智能体！

---

**编制**: OpenClaw Assistant  
**日期**: 2026年3月4日
