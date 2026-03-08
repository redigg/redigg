# Round 24 市场调研报告

**时间**: 2026-03-08 04:00-05:00  
**轮次**: 24  
**主题**: Elicit API 深度分析 + Landing Page 执行准备

---

## 📊 调研重点

### 1. Elicit API 文档深度分析（2026-03-08 04:15）

**API 核心信息**：

| 项目 | 详情 |
|------|------|
| API 版本 | 0.0.1（OpenAPI 3.1.0） |
| 论文库规模 | 1.25 亿 + 学术论文 |
| 访问要求 | Pro 计划及以上 |
| API 费用 | 无额外费用（计入工作流配额） |
| 认证方式 | Bearer Token（Authorization 头） |

**速率限制**：

| 计划 | 篇数/请求 | 请求数/天 |
|------|-----------|-----------|
| Basic | 无访问 | 无访问 |
| Plus | 无访问 | 无访问 |
| **Pro** | **100** | **100** |
| **Team** | **200** | **200** |
| **Enterprise** | **5,000** | **无限制** |

**核心端点**：

#### 端点 1: POST /api/v1/search（论文搜索）

**功能**: 自然语言语义搜索 1.25 亿 + 论文

**请求参数**：
- `query`（必填）: 搜索查询字符串
- `filters`（可选）: 
  - `minYear`/`maxYear`: 年份过滤
  - `includeKeywords`/`excludeKeywords`: 关键词过滤
  - `typeTags`: 研究类型（Review/Meta-Analysis/Systematic Review/RCT/Longitudinal）
  - `hasPdf`: 仅含 PDF 的论文
  - `pubmedOnly`: 仅 PubMed
  - `maxQuartile`: 期刊分区（1=前 25%）
  - `retracted`: 处理撤稿论文（exclude_retracted/include_retracted/only_retracted）
- `maxResults`: 1-5000（默认 10）

**返回字段**：
- `title`, `authors`, `year`, `abstract`
- `doi`, `pmid`, `elicitId`, `venue`
- `citedByCount`, `urls`

**示例请求**：
```bash
curl -X POST https://elicit.com/api/v1/search \
  -H "Authorization: Bearer elk_live_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"query": "effects of sleep deprivation on cognitive performance"}'
```

#### 端点 2: POST /api/v1/reports（报告生成）

**功能**: 异步生成研究简报（系统综述流程）

**工作流程**：
1. POST /api/v1/reports → 返回 reportId
2. GET /api/v1/reports/:reportId → 轮询状态（processing/completed/failed）
3. 完成后下载 pdfUrl/docxUrl

**请求参数**：
- `researchQuestion`（必填）: 研究问题
- `maxSearchPapers`: 搜索阶段最大论文数（默认 50）
- `maxExtractPapers`: 最终提取论文数（默认 10）

**处理时间**: 5-15 分钟

**示例请求**：
```bash
curl -X POST https://elicit.com/api/v1/reports \
  -H "Authorization: Bearer elk_live_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"researchQuestion": "What are the effects of GLP-1 receptor agonists on cardiovascular outcomes?"}'
```

### 2. Elicit API 生态分析（GitHub 示例库）

**官方示例库**: https://github.com/elicit/api-examples

**提供的示例**：

| 语言/集成 | 说明 | 前置要求 |
|-----------|------|----------|
| **curl/** | Shell 脚本示例 | curl, jq |
| **javascript/** | Node.js 示例 | Node.js 18+（原生 fetch） |
| **python/** | Python 示例 | Python 3.7+, requests |
| **integrations/cli/** | 命令行工具（零依赖） | Python 标准库 |
| **integrations/slack-bot/** | Slack 机器人 | /elicit search + /elicit report |
| **integrations/claude-code-skill/** | Claude Code 技能 | Claude Code |

**关键洞察**：
- Elicit 提供完整的开发者工具和文档
- 已有 Claude Code 集成（直接竞争 Redigg 的 Agent 能力）
- Slack 机器人验证 B 端协作场景
- CLI 工具降低使用门槛

### 3. Alytics 模板验证（2026-03-08 04:30）

**模板状态**：
- URL: https://alytics.framer.website/
- Remix 链接：https://framer.com/remix/sYqnVgaJ6jfdOyaORZkY
- 需要 Framer 账号登录（免费注册）

**模板结构确认**：
```
Navigation → Hero → Logo Wall → Features → Benefits → Integrations → Pricing → FAQ → Blogs
```

**Hero 区域**：
- 标题："Turn scattered data into smart decisions"
- 副标题："One simple dashboard to track your SaaS growth, MRR, churn and user behavior—without the chaos."
- CTA: "Get Started For Free" + "No credit card required"
- 社会证明："Trusted by 1M+ users"

**Redigg 适配方案**：

| 原模板 | Redigg 适配 |
|--------|-------------|
| "Turn scattered data into smart decisions" | "Turn research questions into evidence-based answers" |
| "track your SaaS growth, MRR, churn" | "automate literature reviews, systematic reviews, research reports" |
| "Trusted by 1M+ users" | "Trusted by researchers worldwide"（种子用户阶段用占位符） |
| Features: Dashboard/MRR/Churn | Features: Literature Review/Systematic Review/Quality Assurance |
| Integrations: 第三方工具 Logo | Integrations: PubMed/arXiv/Zotero/Notion 等 |
| Pricing: SaaS 订阅 tiers | Pricing: Free/Pro/Team（种子用户终身免费） |

### 4. 竞品动态总结（Round 24 更新）

**Elicit API 竞争分析**：

| 维度 | Elicit API | Redigg Skill 市场 |
|------|------------|-------------------|
| 开放程度 | API（Pro 计划起） | Skill 市场（更开放） |
| 数据源 | 1.25 亿论文（自有） | 多源（PubMed/arXiv/自有 + Elicit API 可选） |
| 集成方式 | REST API + SDK | Skill 框架（Python/JS） |
| 开发者生态 | 初期（示例库刚发布） | 规划中（Phase 2 完成后启动） |
| 定价 | 计入订阅配额 | Skill 交易抽成 10-20% |
| 架构 | 云端优先 | 本地 + 云端混合 |

**Redigg 应对策略更新**：
1. **短期（1-2 周）**: 完成 Landing Page，启动种子用户计划
2. **中期（1 个月）**: 发布 Skill 市场框架，吸引开发者
3. **长期（3 个月）**: 考虑集成 Elicit API 作为数据源之一（竞合策略）

---

## 🔍 关键发现

### Elicit API 深度洞察

**优势**：
- ✅ 完整的开发者体验（文档 + 示例 + 集成）
- ✅ 多语言支持（curl/JS/Python）
- ✅ 现成集成（Slack/Claude Code）降低使用门槛
- ✅ 速率限制合理（Pro 100 请求/天，Enterprise 无限制）

**劣势**：
- ⚠️ 需要 Pro 计划（付费门槛）
- ⚠️ 纯云端架构（隐私敏感场景不适用）
- ⚠️ 数据源单一（仅 Elicit 自有库）
- ⚠️ 生态初期（开发者社区尚未形成）

**Redigg 机会**：
- 🎯 **本地 + 云端混合**: 敏感数据本地处理，非敏感用云端
- 🎯 **多数据源**: PubMed/arXiv/自有库 + Elicit API（可选）
- 🎯 **Skill 市场**: 比 API 更开放（Skill 可组合、可交易）
- 🎯 **免费层**: 基础功能免费，降低开发者门槛

### Landing Page 执行方案确认

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

**内容准备清单**：
- [ ] Hero 标题和副标题
- [ ] Features 描述（3-4 个核心功能）
- [ ] Benefits 描述（研究者收益）
- [ ] Integrations Logo（占位符即可）
- [ ] Pricing 方案（Free/Pro/Team）
- [ ] FAQ（5-8 个常见问题）
- [ ] CTA 文案（"Join Beta" 邮件收集）

---

## 📋 行动建议

### 本小时完成（04:00-05:00）- ✅

1. ✅ **Elicit API 文档分析** - 端点、参数、速率限制、示例完整梳理
2. ✅ **GitHub 示例库验证** - 确认多语言支持和集成生态
3. ✅ **Alytics 模板适配方案** - Redigg 内容映射完成
4. ✅ **竞争策略更新** - Skill 市场 vs API 差异化定位

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

## 📈 Round 24 核心产出

### Elicit API 完整分析
- **API 版本**: 0.0.1（OpenAPI 3.1.0）
- **端点**: Search（1.25 亿论文）+ Reports（异步 5-15 分钟）
- **定价**: Pro 计划起（100 请求/天），Enterprise 无限制
- **生态**: 完整示例库（curl/JS/Python/CLI/Slack/Claude Code）
- **竞争评估**: 开发者体验优秀，但纯云端 + 付费门槛是 Redigg 机会

### Landing Page 执行方案
- **模板**: Alytics（Framer，免费）
- **结构**: Navigation/Hero/Logo Wall/Features/Benefits/Integrations/Pricing/FAQ/Blogs
- **内容映射**: 已完成 Redigg 适配方案
- **执行**: 2-4 小时可完成，成本<¥500

### 竞争策略更新
- **Skill 市场 vs API**: Redigg 更开放（Skill 可组合、可交易、免费层）
- **本地 + 云端**: 隐私优势（Elicit 纯云端）
- **多数据源**: PubMed/arXiv/自有库 + Elicit API（可选竞合）
- **时间窗口**: 6-12 个月（Elicit API 生态初期）

---

## 📊 Round 24 vs Round 23 对比

| 维度 | Round 23 | Round 24 | 变化 |
|------|----------|----------|------|
| 调研重点 | Elicit API 发布监测 | API 文档深度分析 + Landing Page 准备 | 监测→执行 ✅ |
| API 信息 | 发布日期 + 功能概述 | 端点/参数/速率限制/示例完整梳理 | 概述→详细 ✅ |
| 生态分析 | GitHub 示例库提及 | 多语言支持和集成验证 | 提及→验证 ✅ |
| Landing Page | 模板确认 | 内容适配方案 + 执行步骤细化 | 确认→准备执行 ✅ |
| 竞争策略 | 应对策略初稿 | Skill 市场 vs API 差异化定位细化 | 初稿→细化 ✅ |

---

## 🎯 核心结论

**Round 24 核心价值**: Elicit API 深度分析 + Landing Page 执行准备

1. **Elicit API 完整评估** - 开发者体验优秀，但纯云端 + 付费门槛是 Redigg 机会
2. **Skill 市场差异化** - 比 Elicit API 更开放（Skill 可组合、可交易、免费层）
3. **Landing Page 准备就绪** - 内容适配方案完成，今天执行（2-4 小时）
4. **时间窗口确认** - 6-12 个月，Elicit API 生态初期，Redigg 加速执行

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

**当前时间**: 05:00（亚洲/上海）

**凌晨工作进展**：
- AI 持续工作，人类休息时完成 Elicit API 深度分析和 Landing Page 准备
- Elicit API 文档完整梳理，开发者体验优秀但纯云端是 Redigg 机会
- Landing Page 内容适配方案完成，Vix 周日白天可执行搭建

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
**下次调研**: Round 25（2026-03-08 05:00-06:00）

*人能停 AI 不能停！*
