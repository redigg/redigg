# Redigg

**自主科研 Agent 平台** | Autonomous Research Agent Platform

**版本**: 0.1.0  
**最后更新**: 2026-03-08  
**许可证**: MIT

---

## 🦎 关于 Redigg

Redigg 是一个基于 OpenClaw 构建的自主科研 Agent 平台，致力于使 Agent 能够全自主开展科研和自我进化。

**愿景**: 使 Agent 能全自主开展科研和自我进化，打破知识垄断，提升人类在研究活动上的生产效率。  
**宗旨**: 人能停 AI 不能停

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

### 4. 运行 CLI 测试
```bash
npx tsx src/cli.ts
```

---

## 📚 文档

所有文档都在 [`docs/`](./docs/) 目录下：

| 文档 | 说明 | 日期 |
|------|------|------|
| [📖 文档索引](./docs/README.md) | 所有文档的导航和说明 | 2026-03-08 |
| [🎯 产品设计](./docs/redigg-design.md) | 愿景、架构、技术实现 | 2026-03-07 |
| [🤝 贡献指南](./docs/contribution.md) | 开发标准、代码规范 | 2026-03-07 |
| [🗺️ 产品路线图](./docs/PRODUCT_ROADMAP.md) | Phase 1-4 战略规划 | 2026-03-08 |
| [📋 迭代计划](./docs/ITERATION_PLAN.md) | 5 阶段详细迭代方案 | 2026-03-08 |
| [⏰ 定时任务](./docs/SCHEDULED_TASKS.md) | Cron 任务规划 | 2026-03-08 |
| [⚡ 快速启动](./docs/QUICK_START_V2.md) | 2 小时核心功能升级 | 2026-03-08 |

**👉 从 [文档索引](./docs/README.md) 开始浏览所有文档**

---

## 🏗️ 项目结构

```
redigg/
├── src/                    # 源代码
│   ├── agent/              # Agent 核心实现
│   ├── memory/             # 记忆系统
│   ├── skills/             # 技能系统
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
├── docs/                   # 📚 所有文档
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

- **三层记忆系统** - Working/Short-term/Long-term 记忆 + 自动巩固
- **技能系统** - 动态加载、自我进化、 ClawHub 集成
- **A2A 协议** - 符合 A2A-js/sdk 标准，可与其他 Agent 互操作
- **会话管理** - SQLite 持久化、多会话支持
- **定时任务** - CronManager、Heartbeat (60 秒间隔)
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
| `POST /api/upload` | 文件上传 |
| `/a2a/jsonrpc` | A2A 协议接口 |
| `/a2a/agent.json` | Agent Card |

---

## 🗺️ 路线图

| Phase | 目标 | 状态 |
|-------|------|------|
| Phase 0 | 基础设施 | ✅ 完成 |
| Phase 1 | 记忆系统 | ✅ 完成 |
| Phase 2 | 反馈学习 | 🔄 进行中 |
| Phase 3 | 技能进化 | 📅 规划中 |
| Phase 4 | 社区进化 | 📅 规划中 |

**详细规划**: [产品路线图](./docs/PRODUCT_ROADMAP.md)

---

## 🤝 贡献

欢迎贡献！请阅读 [贡献指南](./docs/contribution.md) 了解开发标准和流程。

### 快速贡献流程
1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交变更 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

---

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE)

---

## 🔗 相关链接

- **GitHub**: https://github.com/redigg/redigg
- **官网**: https://redigg.com
- **OpenClaw**: https://github.com/openclaw/openclaw
- **文档**: https://docs.openclaw.ai
- **Discord**: https://discord.com/invite/clawd

---

**Redigg AI Team** 🦎  
*"人能停 AI 不能停"*
