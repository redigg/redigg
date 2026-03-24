# Nexus - 科研上下文中枢

> Redigg 的"大脑"，管理全生命周期的科研信息。

## 是什么

Nexus 是 Redigg 的上下文中枢，负责：

- **索引** - 文献、笔记、项目的元数据
- **追踪** - 阅读状态、项目进度、任务队列
- **关联** - 知识图谱、引用网络
- **推荐** - 主动推送、智能提醒

## 不是什么

Nexus **不**执行任务：
- 不存 PDF 原文（那是 Zotero 的事）
- 不编辑笔记（那是 Obsidian 的事）
- 不写论文（那是 Overleaf 的事）

Nexus 是"大脑"，让执行层（Research）知道该做什么。

## 架构

```
┌─────────────────────────────────────────────────────┐
│                     Nexus                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  Core   │ │Connectors│ │  Graph  │ │Scheduler│   │
│  │ 索引引擎 │ │ 工具连接 │ │ 知识图谱 │ │ 推荐调度 │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
    ▼                  ▼                  ▼
┌─────────┐       ┌─────────┐       ┌─────────┐
│ Zotero  │       │Obsidian │       │Overleaf │
│ 文献管理 │       │ 知识库  │       │ 写作    │
└─────────┘       └─────────┘       └─────────┘
```

## 模块说明

### `core/` - 核心引擎

- `models.ts` - 数据模型定义
- `indexer.ts` - 索引引擎
- `api.ts` - API 接口
- `storage.ts` - 存储层

### `connectors/` - 工具连接器

- `base.ts` - 连接器基类
- `zotero.ts` - Zotero 连接
- `obsidian.ts` - Obsidian 连接
- `arxiv.ts` - arXiv 连接

### `graph/` - 知识图谱

- `relations.ts` - 关系定义
- `builder.ts` - 图谱构建
- `query.ts` - 图谱查询

### `scheduler/` - 推荐调度

- `recommender.ts` - 推荐引擎
- `notifier.ts` - 通知推送
- `tasks.ts` - 任务队列

## 快速开始

```typescript
import { Nexus } from './nexus';

// 初始化 Nexus
const nexus = new Nexus();

// 连接工具
await nexus.connect('zotero', { apiKey: 'xxx' });
await nexus.connect('obsidian', { vaultPath: '/path/to/vault' });

// 索引文献
await nexus.index();

// 查询
const papers = await nexus.search('RLHF 论文');

// 获取推荐
const recommendations = await nexus.recommend();

// 更新状态
await nexus.updatePaperStatus('arxiv:2301.12345', { read: true });
```

## API

### 搜索

```typescript
nexus.search(query: string): Promise<SearchResult>
```

返回：论文、笔记、项目的混合结果。

### 项目状态

```typescript
nexus.getProjectStatus(projectId: string): Promise<ProjectStatus>
```

返回：项目进度、待读论文、下一步建议。

### 推荐

```typescript
nexus.recommend(): Promise<Recommendation[]>
```

返回：每日推荐、智能提醒、工作流建议。

### 状态更新

```typescript
nexus.updatePaperStatus(paperId: string, status: PaperStatus): Promise<void>
```

## 数据模型

### Paper

```typescript
interface Paper {
  id: string;                    // redigg:paper:xxx
  externalIds: {
    doi?: string;
    arxiv?: string;
    zoteroKey?: string;
  };
  metadata: {
    title: string;
    authors: string[];
    year: number;
    abstract?: string;
  };
  local: {
    zoteroKey?: string;
    zoteroCollection?: string;
    pdfPath?: string;
    obsidianNote?: string;
  };
  status: {
    read: boolean;
    hasNotes: boolean;
    citedByMe: boolean;
  };
  projects: string[];
  tags: string[];
}
```

### Project

```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'completed';
  papers: string[];
  notes: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

## 与 Research 的关系

```
用户请求
    │
    ▼
Research (执行)
    │
    ├── 查询上下文 ──▶ Nexus
    │                      │
    │◀───── 返回上下文 ────┘
    │
    ├── 执行任务
    │
    └── 更新状态 ────▶ Nexus
```

Research 是"手脚"，Nexus 是"大脑"。

## 开发状态

- [ ] Core: 数据模型
- [ ] Core: 索引引擎
- [ ] Core: API 接口
- [ ] Connectors: Zotero
- [ ] Connectors: Obsidian
- [ ] Graph: 关系定义
- [ ] Scheduler: 推荐引擎

---

*Part of [Redigg](https://github.com/redigg/redigg)*