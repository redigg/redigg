# Redigg Agent 更新开发计划

**日期**: 2026年3月4日  
**基于**: 
- agents.md (Agent 指导)
- agentskills.io (Skill 指导)
- https://github.com/anthropics/skills (示例 Skills)
- https://github.com/virattt/dexter (垂类 Agent 参考)
- evowork-v0/agent-sdk (Agent SDK)
- 现有 redigg-agent 架构

---

## 一、核心参考资源总结

### 1.1 agents.md - Agent 指导
- **AGENTS.md**: 为 Agent 提供的 README，包含：
  - 项目概述
  - 构建和测试命令
  - 代码风格指南
  - 测试说明
  - 安全考虑

### 1.2 agentskills.io - Skill 指导
- **Agent Skills**: 文件夹格式的技能，包含指令、脚本和资源
- **核心原则**:
  - 可重用的程序知识
  - 跨多个 Agent 产品部署
  - 版本控制的组织知识
- **支持**: 被 60k+ 开源项目使用

### 1.3 dexter - 垂类 Agent 参考
- **定位**: 专门用于金融研究的 autonomous agent
- **核心能力**:
  - 智能任务规划（自动分解复杂查询）
  - 自主执行（选择和执行正确的工具）
  - 自验证（检查自己的工作，迭代直到完成）
  - 实时金融数据访问
  - 安全特性（循环检测 + 步骤限制）
- **技术栈**: Bun runtime + OpenAI + Financial Datasets API + Exa (Web Search)
- **特色**: Scratchpad（记录所有 tool calls）、LangSmith 评估、WhatsApp 集成

---

## 二、Redigg Agent 定位

**核心定位**: 研究领域的垂类 Agent（类似 dexter，但针对科学研究）

**核心能力**（基于参考资源）:
1. ✅ 连接 Redigg.com 平台（现有）
2. ✅ 10个内置 Skills（现有）
3. ✅ Skill Market 同步（现有）
4. ✅ MCP 支持（现有）
5. ✅ Workspace/Research 本地管理（现有）
6. ✅ Semantic Scholar API 支持（现有）
7. 🚧 **智能任务规划**（需要优化）
8. 🚧 **自验证/自反思**（需要添加）
9. 🚧 **实时研究数据访问**（需要优化）
10. 🚧 **安全特性**（需要添加）
11. 🚧 **Scratchpad 记录**（需要添加）
12. 🚧 **评估套件**（需要添加）

---

## 三、分阶段实施计划

### Phase 0: 遵循标准（0-1天）

#### 1. 添加 AGENTS.md
- [ ] 在 redigg-agent 根目录创建 `AGENTS.md`
- [ ] 内容包括：
  - 项目概述
  - 构建命令（`npm install`, `npm run build`, `npm run dev`）
  - 测试命令（`npm test`）
  - 代码风格指南（TypeScript strict mode, 单引号，无分号等）
  - 测试说明
  - 安全考虑

#### 2. 遵循 Agent Skills 格式
- [ ] 确保现有 Skills 符合 agentskills.io 标准
- [ ] 每个 Skill 应该是一个文件夹，包含：
  - `SKILL.md`（技能描述）
  - 脚本文件
  - 资源文件
- [ ] 检查 https://github.com/anthropics/skills 的示例

---

### Phase 1: 核心架构优化（1-2天）

#### 1.1 引入 RediggAgent 类
（参考 evowork-v0/agent-sdk）

- [ ] 创建 `src/agent/RediggAgent.ts`
- [ ] 状态机管理：`disconnected` | `connecting` | `connected` | `idle` | `busy` | `error`
- [ ] 双模式连接（WebSocket 优先，Polling 回退）
- [ ] 自动重连机制（指数退避）

#### 1.2 任务处理优化
- [ ] 任务回调模式（`onTask(callback)`）
- [ ] 超时控制（默认 5 分钟）
- [ ] 结果提交带重试（指数退避）
- [ ] 更清晰的错误处理和恢复

#### 1.3 状态管理
- [ ] 清晰的状态机
- [ ] 状态变更事件通知
- [ ] 连续错误计数

---

### Phase 2: 智能任务规划 + 自反思（2-3天）

（参考 dexter）

#### 2.1 智能任务规划
- [ ] 自动分解复杂研究查询为结构化步骤
- [ ] 基于任务类型选择正确的 Skill
- [ ] 动态规划后续步骤

#### 2.2 自验证/自反思
- [ ] 在每个步骤后检查自己的工作
- [ ] 迭代直到任务完成
- [ ] 质量检查和验证

#### 2.3 安全特性
- [ ] 循环检测
- [ ] 步骤限制（防止 runaway 执行）
- [ ] 执行超时保护

---

### Phase 3: Scratchpad + 评估（1-2天）

（参考 dexter）

#### 3.1 Scratchpad 记录
- [ ] 记录所有 tool calls 到 JSONL 文件
- [ ] 位置：`.redigg/scratchpad/`
- [ ] 每个查询创建新文件
- [ ] 记录：init、tool_result、thinking

#### 3.2 评估套件
- [ ] 创建评估数据集（研究问题）
- [ ] LLM-as-judge 评估正确性
- [ ] 实时 UI 显示进度和准确率
- [ ] 结果记录到 LangSmith（可选）

---

### Phase 4: Skill 优化（2-3天）

（参考 agentskills.io）

#### 4.1 Skill 标准化
- [ ] 确保所有 Skills 符合 agentskills.io 格式
- [ ] 每个 Skill 有清晰的 SKILL.md
- [ ] 可重用的程序知识
- [ ] 版本控制的组织知识

#### 4.2 更多研究 Skills
- [ ] 基于 https://github.com/anthropics/skills 添加更多研究相关 Skills
- [ ] 从 agentskills.io 参考库获取灵感
- [ ] 垂类研究 Skills（特定领域）

---

## 四、保持不变的部分

✅ 不需要修改的部分：
- 现有的 CLI 命令结构
- 内置 Skills（10个）
- Skill Market 同步
- MCP 支持
- Semantic Scholar API 支持
- Workspace/Research 本地管理（刚添加）
- 配置管理

---

## 五、技术栈确认

**现有技术栈**（保持不变）:
- TypeScript
- Node.js
- Commander.js（CLI）
- Conf（配置管理）
- Axios（HTTP 客户端）
- OpenAI SDK
- MCP SDK
- EventSourcePolyfill（SSE）
- Zod（验证）
- Citation.js（引用格式化）

**新增/优化**:
- 更好的状态管理
- 任务规划 + 自反思
- Scratchpad 记录
- 评估套件

---

## 六、下一步行动

1. **立即开始**: Phase 0 - 添加 AGENTS.md，遵循标准
2. **短期**: Phase 1 - 核心架构优化
3. **中期**: Phase 2-3 - 智能规划 + Scratchpad
4. **长期**: Phase 4 - Skill 优化

---

## 七、参考资源清单

- 📖 **agents.md**: https://agents.md/
- 📖 **agentskills.io**: https://agentskills.io/home
- 📖 **示例 Skills**: https://github.com/anthropics/skills
- 📖 **Dexter (垂类 Agent)**: https://github.com/virattt/dexter
- 📖 **Evowork Agent SDK**: evowork-v0/agent-sdk

---

**总结**: 基于多个优秀参考资源，将 redigg-agent 打造为研究领域的垂类 Agent，具备智能规划、自反思、可追溯等能力！
