# GitHub 科研 Claws 竞品分析

**分析日期**: 2026-03-07  
**分析者**: Redigg AI 🦎  
**紧急度**: 🔴 高（需要快速响应）

---

## 一、竞品发现

### 1.1 ClawPhD（已存在）✅

**仓库**: https://github.com/ZhihaoAIRobotic/ClawPhD  
**状态**: 🟢 活跃更新（21 小时前）  
**Stars**: 107 ⭐  
**License**: MIT  
**安装**: `pip install clawphd-ai`

**定位**: "An OpenClaw Agent for research that can turn academic papers into publication-ready diagrams, posters, videos, and more."

**核心功能**:
| 功能 | 说明 |
|------|------|
| Diagram Generation | 从论文生成学术图表 |
| Figure Reference Extraction | 提取论文中的图表为 SVG+PPTX |
| Paper Discovery | 定时搜索 AI 领域新论文 |
| Video Explainers | 生成论文讲解视频 |
| Paper Websites | 将论文转为交互式网页 |
| Poster Generation | 生成会议海报 |
| Code Synthesis | 从论文提取可复现代码 |

**技术栈**:
- 基于 Nanobot (OpenClaw nano 版本)
- Python + uv
- 支持多通道 gateway (WhatsApp 等)
- 内置 cron 调度系统

**优势**:
- ✅ 功能具体且可视化（图、视频、海报）
- ✅ 安装简单（pip 一键安装）
- ✅ 文档完善（中英文）
- ✅ 示例丰富（带效果对比）
- ✅ 自反馈迭代优化（多轮改进图表质量）

**劣势**:
- ❌ 聚焦单篇论文处理，不是完整研究流程
- ❌ 没有文献综述能力
- ❌ 没有实验设计能力
- ❌ 没有论文写作能力
- ❌ 没有社区/网络功能

---

### 1.2 paperclaw（空白）❌

**搜索结果**: 0 个匹配仓库

**机会**: ✅ **paperclaw 名称可用！**

---

### 1.3 researchclaw / scienceclaw

**状态**: 待搜索（可能也不存在）

---

## 二、Redigg vs ClawPhD 对比

| 维度 | ClawPhD | Redigg |
|------|---------|--------|
| **定位** | 论文可视化工具 | 研究基础设施即服务 |
| **核心场景** | 单篇论文→图表/视频 | 完整研究流程 |
| **功能** | 图表、海报、视频 | 文献综述、实验设计、论文写作、Peer Review |
| **技术** | Nanobot (OpenClaw nano) | OpenClaw full |
| **社区** | 无 | Reddit 风格社区 |
| **商业化** | 开源免费 | 付费订阅 ($9-500/月) |
| **Stars** | 107 | 待发展 |

---

## 三、Redigg 差异化策略

### 3.1 定位差异

**ClawPhD**: "把论文变成可视化内容"  
**Redigg**: "让 AI 独立完成整个研究"

```
ClawPhD: 论文 → [AI] → 图表/视频/海报
              ↓
         单点工具

Redigg: 研究问题 → [AI] → 文献综述 → 实验设计 → 
        数据分析 → 论文写作 → Peer Review
              ↓
         完整研究流程
```

### 3.2 核心优势

1. **全流程覆盖** - ClawPhD 只处理已有论文，Redigg 从零开始完成研究
2. **社区网络** - ClawPhD 是单机工具，Redigg 是研究协作网络
3. **Skill 市场** - 可扩展的科研技能生态
4. **商业模式** - ClawPhD 免费开源，Redigg 付费订阅（有收入才能持续发展）

### 3.3 借鉴 ClawPhD

**可以学习的点**:
1. ✅ 具体可视化功能（图表生成）- 可以作为 Redigg 的一个 Skill
2. ✅ 简单安装体验 - `pip install redigg` 一键安装
3. ✅ 示例驱动文档 - 展示真实效果
4. ✅ 自反馈迭代 - 多轮优化输出质量

---

## 四、小红书发布策略

### 4.1 核心信息

**标题方向**:
- "PhD 神器！AI 帮我做文献综述，1 小时搞定 3 天工作量"
- "科研人的 OpenClaw！这个 AI 工具太懂研究了"
- "107 Stars 开源项目 ClawPhD 作者新作？Redigg 更强！"

**内容要点**:
1. 展示真实使用场景（输入问题→输出综述）
2. 对比手动做研究 vs AI 辅助研究
3. 强调"人能停 AI 不能停"理念
4. 引导到 GitHub/官网

### 4.2 视觉素材

**需要制作**:
1. 使用前后对比图（时间节省）
2. 文献综述输出示例（结构化展示）
3. 工作流程图（输入→处理→输出）
4. 与 ClawPhD 功能对比图

### 4.3 发布节奏

| 时间 | 内容 | 平台 |
|------|------|------|
| Day 1 | 产品发布 + 使用演示 | 小红书 |
| Day 2 | 用户案例分享 | 小红书 + Twitter |
| Day 3 | 技术解析 | GitHub + 知乎 |
| Day 7 | 第一周成果总结 | 小红书 |

---

## 五、紧急行动项

### 🔴 本周必须完成

1. **paperclaw 占位** - 立即创建 GitHub 仓库
   - 名称：paperclaw 或 redigg-paperclaw
   - 内容：论文写作 Skill
   - 目标：本周末前发布

2. **小红书内容制作**
   - 截图/录屏：实际使用流程
   - 文案：痛点 + 解决方案 + 效果展示
   - 发布：本周内

3. **差异化定位明确**
   - Redigg ≠ ClawPhD
   - Redigg = 完整研究流程
   - ClawPhD = 论文可视化（可作为 Redigg 子功能）

### 🟡 下周完成

4. **clawphd 功能集成** - 把 ClawPhD 的图表生成做成 Redigg Skill
5. **首批用户获取** - 10-20 个种子用户
6. **反馈收集** - 快速迭代

---

## 六、结论

**ClawPhD 不是威胁，是验证！**

✅ 验证了：科研 + OpenClaw 方向正确  
✅ 验证了：PhD 学生愿意用 AI 工具  
✅ 验证了：可视化功能受欢迎  

**Redigg 机会**:
- 更大的市场（完整研究流程 vs 单点工具）
- 更好的商业模式（付费订阅 vs 免费开源）
- 更强的网络效应（社区协作 vs 单机使用）

**行动建议**: **立刻发布 paperclaw + 小红书！**

---

**Redigg AI 🦎** - 人能停 AI 不能停！
