# Redigg Agent

**自主科研 Agent 核心代码** | Autonomous Research Agent Core

**版本**: 0.1.0  
**最后更新**: 2026-03-08  
**许可证**: MIT

---

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 添加你的 API 密钥
```

### 3. 启动开发服务器
```bash
npm run dev
```

### 4. 运行测试
```bash
npm test
```

---

## 🏗️ 项目结构

```
redigg/
├── src/                    # 核心源代码
│   ├── agent/              # Agent 实现
│   ├── memory/             # 记忆系统
│   ├── skills/             # 技能管理
│   ├── gateway/            # A2A 网关
│   ├── session/            # 会话管理
│   ├── scheduling/         # 定时任务
│   └── utils/              # 工具函数
├── skills/                 # 技能模块
│   ├── core/               # 核心技能
│   ├── infra/              # 基础设施技能
│   └── research/           # 科研技能
├── web/                    # Web 前端 (React + Vite)
├── tests/                  # 测试文件
├── package.json
└── README.md
```

---

## 🔧 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | Node.js ≥ 22, TypeScript 5.0+ |
| 存储 | SQLite (better-sqlite3 + sqlite-vec) |
| LLM | OpenAI API (兼容 Claude/Qwen/Kimi) |
| 协议 | A2A, JSON-RPC, REST, SSE |
| 前端 | React + Vite + TypeScript |
| 测试 | Vitest |

---

## 🎯 核心功能

- **三层记忆系统** - Working/Short-term/Long-term + 自动巩固
- **技能系统** - 动态加载、自我进化
- **A2A 协议** - 符合 A2A-js/sdk 标准
- **会话管理** - SQLite 持久化
- **定时任务** - CronManager、Heartbeat
- **Web 仪表盘** - React 前端、SSE 流式聊天

---

## 📡 API 端点

| 端点 | 功能 |
|------|------|
| `POST /api/chat` | 简单聊天 |
| `GET /api/chat/stream` | SSE 流式聊天 |
| `GET /api/skills` | 获取技能列表 |
| `GET /api/memories` | 获取用户记忆 |
| `GET /api/sessions` | 获取会话列表 |
| `/a2a/jsonrpc` | A2A 协议接口 |

---

## 📚 文档

项目完整文档在 **workspace 根目录** 的 `docs-redigg/` 文件夹：

- 📖 [文档索引](../docs-redigg/README.md)
- 🎯 [产品设计](../docs-redigg/redigg-design.md)
- 🤝 [贡献指南](../docs-redigg/contribution.md)
- 🗺️ [产品路线图](../docs-redigg/PRODUCT_ROADMAP.md)
- 📋 [迭代计划](../docs-redigg/ITERATION_PLAN.md)
- ⏰ [定时任务](../docs-redigg/SCHEDULED_TASKS.md)
- ⚡ [快速启动](../docs-redigg/QUICK_START_V2.md)

---

## 🔗 相关链接

- **GitHub**: https://github.com/redigg/redigg
- **官网**: https://redigg.com

---

**Redigg AI Team** 🦎  
*"人能停 AI 不能停"*
