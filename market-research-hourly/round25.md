# Round 25 市场调研报告

**时间**: 2026-03-08 05:00-06:00  
**轮次**: 25  
**主题**: 竞品官网实时验证 + Landing Page 模板确认

---

## 📊 调研重点

### 1. Elicit 官网实时验证（2026-03-08 05:15）

**核心数据确认**：

| 指标 | 数值 | 状态 |
|------|------|------|
| 用户数 | 500 万 + | ✅ 确认 |
| 论文库 | 1.38 亿 + | ✅ 确认 |
| 临床试验 | 54.5 万 + | ✅ 确认 |
| 数据来源 | 持续扩展中 | 🟡 "more data sources coming soon" |

**核心功能模块**：

| 功能 | 说明 | Redigg 对标 |
|------|------|-------------|
| **Search** | 语义搜索 1.38 亿论文 +54.5 万临床试验 | Redigg Search Skill（多源：PubMed/arXiv/自有+Elicit API 可选） |
| **Research Reports** | 基于系统综述流程的研究简报，可深度定制 | Redigg Literature Review Skill（Phase 1 核心） |
| **Systematic Review** | 自动化筛选和数据提取，80% 时间节省 | Redigg QualityChecker + Peer Review |
| **Library** | 个人文献库，组织和管理来源 | Redigg 本地存储 + 云端同步 |
| **Alerts** | 新研究提醒，不 clutter 收件箱 | Redigg 待规划功能 |

**Elicit 差异化四点**：

| 维度 | Elicit 主张 | Redigg 应对 |
|------|------------|-------------|
| **Scale** | 1000 篇论文/20000 数据点同时分析 | 本地 + 云端混合，可扩展（依赖用户硬件） |
| **Accuracy** | "最准确的科研 AI 产品"，有验证报告 | Peer Review + LLM-as-judge 双重验证 |
| **Transparency** | 句级引用，所有 AI 生成内容有来源 | 相同策略（句级引用是行业标准） |
| **More than chat** | 丰富的交互式表格和多步骤工作流 | Skill 组合 + TaskPlanner 实现多步骤 |

**关键洞察**：
- Elicit 官网强调"10x more evidence-based"（10 倍更有证据支持）
- 价值主张清晰："understand more quickly what science already knows, so that you can discover the unknown"
- 目标用户覆盖：从"quick answer"到"multi-month comprehensive review"
- **Redigg 机会**：Elicit 纯云端，Redigg 本地 + 云端混合（隐私优势）

### 2. Litmaps 官网验证（2026-03-08 05:20）

**状态**：功能稳定，无重大更新

**核心定位**：Literature Review Assistant（文献综述助手）

**功能模块**（基于历史调研）：
- Discover：发现相关论文
- Visualize：可视化文献关系图谱
- Share：分享 Litmap
- Monitor：跟踪新研究

**用户规模**：35 万 + 用户，150+ 国家（Round 23 确认）

**Redigg 对标**：
- Litmaps 强项：可视化图谱（引用关系）
- Redigg 强项：自动化综述生成 + 质量保证
- **竞合策略**：可考虑集成 Litmaps 可视化能力（如果开放 API）

### 3. Elicit API GitHub 示例库验证（2026-03-08 05:25）

**仓库**：https://github.com/elicit/api-examples

**支持语言**：

| 语言 | 前置要求 | 示例内容 |
|------|----------|----------|
| **curl** | curl, jq | Shell 脚本示例 |
| **JavaScript** | Node.js 18+ | 原生 fetch（无依赖） |
| **Python** | Python 3.7+ | requests 库 |

**集成示例**：

| 集成 | 说明 | 对 Redigg 的启示 |
|------|------|-----------------|
| **CLI 工具** | 零依赖，Python 标准库 | Redigg 可提供类似 CLI Skill 工具 |
| **Slack Bot** | /elicit search + /elicit report | 验证 B 端协作场景，Redigg 可参考 |
| **Claude Code Skill** | Claude Code 内自然语言研究 | **直接竞争** Redigg Agent 能力 |

**关键洞察**：
- Elicit API 文档：https://docs.elicit.com
- API Key 获取：elicit.com/settings（账号设置）
- 三种操作示例：basic search / filtered search / async report creation
- **Redigg 机会**：Elicit API 生态初期，Redigg Skill 市场可更开放

### 4. Alytics 模板实时验证（2026-03-08 05:30）

**模板状态**：✅ 可访问，可 Remix

**预览**：https://alytics.framer.website/  
**Remix**：https://framer.com/remix/sYqnVgaJ6jfdOyaORZkY（免费复制）

**页面结构确认**：

```
Navigation → Hero → Logo Wall → Features → Benefits → Integrations → Pricing → FAQ → Blogs
```

**Hero 区域**：

| 元素 | 原文案 | Redigg 适配 |
|------|--------|-------------|
| 标题 | "Turn scattered data into smart decisions" | "Turn research questions into evidence-based answers" |
| 副标题 | "One simple dashboard to track your SaaS growth, MRR, churn and user behavior—without the chaos." | "Automate literature reviews, systematic reviews, and research reports—without the manual work." |
| CTA | "Get Started For Free" + "No credit card required" | "Join Beta" + "Free for seed users" |
| 社会证明 | "Trusted by 1M+ users" | "Trusted by researchers worldwide"（种子阶段用占位符） |

**内容准备清单**（Redigg 定制）：

- [ ] **Hero 标题和副标题** - 核心价值主张
- [ ] **Features（3-4 个）** - Literature Review / Systematic Review / Quality Assurance / Skill Market
- [ ] **Benefits（3-4 个）** - 时间节省 / 质量保证 / 隐私保护 / 协作能力
- [ ] **Integrations Logo** - PubMed / arXiv / Zotero / Notion（占位符即可）
- [ ] **Pricing（3 档）** - Free / Pro / Team（种子用户终身免费标注）
- [ ] **FAQ（5-8 个）** - 常见问题解答
- [ ] **CTA 文案** - "Join Beta" 邮件收集

**执行步骤**：

1. 注册 Framer 账号（免费，5 分钟）
2. 访问 https://framer.com/remix/sYqnVgaJ6jfdOyaORZkY
3. 点击 "Remix" 复制到个人账号
4. 定制内容（使用上述适配方案）
5. 绑定域名（redigg.ai / redigg.io）
6. 发布上线

**预计时间**: 2-4 小时  
**成本**: 
- Framer 模板：Free
- 域名：约¥100-200/年（.ai 或 .io）
- 总计：<¥500

---

## 🔍 关键发现

### 竞品动态总结（Round 25 更新）

**Elicit 官网实时数据**：
- ✅ 500 万 + 用户（持续验证）
- ✅ 1.38 亿 + 论文（Round 24 的 1.25 亿更新为 1.38 亿）
- ✅ 54.5 万 + 临床试验
- 🟡 "more data sources coming soon"（数据源扩展中）

**Elicit API 生态**：
- 完整开发者工具（文档 + 示例 + 集成）
- 多语言支持（curl/JS/Python）
- 现成集成（Slack/Claude Code）降低使用门槛
- **Claude Code Skill 直接竞争 Redigg Agent 能力**

**Redigg 差异化机会**：

| 维度 | Elicit | Redigg |
|------|--------|--------|
| 架构 | 纯云端 | 本地 + 云端混合 |
| 隐私 | 云端处理 | 敏感数据本地处理 |
| 数据源 | 自有库（1.38 亿） | 多源（PubMed/arXiv/自有+Elicit API 可选） |
| 开发者生态 | API（Pro 计划起） | Skill 市场（免费层 + 开放） |
| 定价门槛 | Pro 计划起（API 访问） | 基础功能免费 |

### Landing Page 执行方案确认

**模板验证**：✅ Alytics 模板可访问，可免費 Remix

**内容适配方案**：已完成 Redigg 价值主张映射

**执行优先级**：
- P0: 今天（3/8 周日）完成 Landing Page 搭建
- P1: 本周（3/8-3/14）完成内容审核和种子用户名单确认
- P0: 下周（3/16 周一）开始种子用户邀请

---

## 📋 行动建议

### 本小时完成（05:00-06:00）- ✅

1. ✅ **Elicit 官网实时验证** - 核心数据确认（500 万用户/1.38 亿论文/54.5 万临床试验）
2. ✅ **Litmaps 官网验证** - 功能稳定，无重大更新
3. ✅ **Elicit API GitHub 示例库验证** - 多语言支持和集成生态确认
4. ✅ **Alytics 模板实时验证** - 可访问，可 Remix，内容适配方案完成

### 今天（3/8 周日）- P0

5. **Landing Page 搭建** - 使用 Alytics 模板，预计 2-4 小时
   - 注册 Framer 账号（免费）
   - Remix 模板
   - 定制 Redigg 内容
   - 绑定域名并发布
6. **域名购买** - redigg.ai 或 redigg.io（约¥100-200/年）

### 本周（3/8-3/14）- P1

7. **Landing Page 审核** - Vix 审核内容和设计（3/8 晚上）
8. **种子用户名单确认** - Vix 提供 10-20 人（3/14 前）
9. **邀请邮件模板审核** - Vix 审核语气和内容

### 下周（3/16 开始）- P0

10. **种子用户邀请** - 阶段 1 开始（10-20 人）
11. **Onboarding 流程执行** - Day 0-7
12. **反馈收集** - Day 1 + Day 7 问卷

---

## 📈 Round 25 核心产出

### Elicit 官网实时数据确认
- **用户数**: 500 万 +（持续验证）
- **论文库**: 1.38 亿 +（Round 24 的 1.25 亿更新）
- **临床试验**: 54.5 万 +
- **数据源**: "more data sources coming soon"（扩展中）

### Elicit API 生态验证
- **示例库**: curl/JavaScript/Python 三语言支持
- **集成**: CLI 工具/Slack Bot/Claude Code Skill
- **竞争**: Claude Code Skill 直接竞争 Redigg Agent 能力
- **机会**: API 生态初期，Redigg Skill 市场可更开放

### Landing Page 准备就绪
- **模板**: Alytics（Framer，免费）✅ 实时验证可访问
- **Remix**: https://framer.com/remix/sYqnVgaJ6jfdOyaORZkY
- **内容映射**: Redigg 价值主张适配方案完成
- **执行**: 2-4 小时可完成，成本<¥500

### 竞争策略更新
- **Skill 市场 vs API**: Redigg 更开放（Skill 可组合、可交易、免费层）
- **本地 + 云端**: 隐私优势（Elicit 纯云端）
- **多数据源**: PubMed/arXiv/自有库 + Elicit API（可选竞合）
- **时间窗口**: 6-12 个月（Elicit API 生态初期）

---

## 📊 Round 25 vs Round 24 对比

| 维度 | Round 24 | Round 25 | 变化 |
|------|----------|----------|------|
| 调研重点 | Elicit API 文档分析 | 官网实时验证 + 模板确认 | API→全貌 ✅ |
| Elicit 数据 | 1.25 亿论文 | 1.38 亿论文 | 数据更新 ✅ |
| API 生态 | GitHub 示例库分析 | 多语言和集成实时验证 | 分析→验证 ✅ |
| Landing Page | 内容适配方案 | 模板实时访问确认 | 方案→可执行 ✅ |
| 竞争策略 | Skill 市场 vs API 定位 | 差异化细化（架构/隐私/数据源） | 定位→细化 ✅ |

---

## 🎯 核心结论

**Round 25 核心价值**: 竞品官网实时验证 + Landing Page 模板确认

1. **Elicit 数据更新** - 论文库从 1.25 亿更新为 1.38 亿（持续增长）
2. **API 生态验证** - 多语言支持和集成生态实时确认，Claude Code Skill 直接竞争
3. **Landing Page 可执行** - Alytics 模板实时验证可访问，今天可执行搭建
4. **差异化确认** - 本地 + 云端/多数据源/Skill 市场开放是 Redigg 核心优势

**Redigg 应对策略**：
- **加速 Landing Page**: 今天完成搭建，3/16 开始种子用户邀请
- **Skill 市场开放**: 比 Elicit API 更开放，吸引开发者
- **本地优势强化**: 隐私/离线是差异化（Elicit 纯云端）
- **竞合策略**: 考虑集成 Elicit API 作为 Redigg 数据源之一

**下一步行动**：
- **今天（3/8 周日）**: Landing Page 搭建（2-4 小时）
- **本周（3/8-3/14）**: Landing Page 审核 + 种子用户名单确认
- **下周（3/16 周一）**: 种子用户邀请开始（阶段 1: 10-20 人）

---

## 🌙 凌晨备注

**当前时间**: 06:00（亚洲/上海）

**凌晨工作进展**：
- AI 持续工作 6 小时（00:00-06:00），完成 Round 19-25 共 7 轮市场调研
- Elicit API 深度分析完成（Round 24）
- Landing Page 模板实时验证完成（Round 25）
- 所有内容适配方案完成，Vix 周日白天可执行搭建

**今日（3/8 周日）建议 Vix 执行**：
1. Landing Page 搭建（2-4 小时，使用 Alytics 模板）
2. 域名购买（redigg.ai / redigg.io，约¥100-200/年）
3. Landing Page 内容审核（周日晚上）

**执行优先级**：
- P0: Landing Page 搭建（今天完成）
- P1: 种子用户名单确认（3/14 前）
- P0: 种子用户邀请（3/16 开始）

**Elicit API 竞合策略建议**：
- 短期：完成 Landing Page 和种子用户计划
- 中期：发布 Skill 市场框架，吸引开发者
- 长期：考虑集成 Elicit API 作为 Redigg 数据源之一（增强自身能力）

---

**调研者**: Redigg AI 🦎  
**下次调研**: Round 26（2026-03-08 06:00-07:00）

*人能停 AI 不能停！*
