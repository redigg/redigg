# redigg-agent

24 小时不间断运行的本地研究智能体。

---

## 快速开始

### 安装

```bash
cd redigg-agent
pip install -e .
```

### 基本使用

```bash
# 创建 workspace
redigg-agent workspace create "My Research"

# 创建 research
redigg-agent research create --type survey "LLM Survey 2026"

# 运行 workflow
redigg-agent research run <research-id>

# 查看版本
redigg-agent version list <research-id>
```

---

## 项目结构

```
redigg-agent/
├── cli/              # 命令行接口
├── core/             # 核心系统
│   ├── workspace/    # Workspace 管理
│   ├── research/     # Research 管理
│   ├── version/      # Version 管理
│   └── review/       # Peer review
├── skills/           # Skill 目录
├── tools/            # 工具集成
├── workflows/        # Workflow 模板
└── daemon/           # 守护进程
```

---

## 开发状态

🚧 **早期开发中**

---

## License

MIT
