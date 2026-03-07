
# Redigg 核心技能实现计划（P0 优先级）

本文档定义 Redigg 第一阶段要实现的 4 个核心研究技能的详细计划。

---

## 一、Skill 1: 文献检索（Literature Search）

### 1.1 功能描述
- 按关键词、主题、作者检索相关文献
- 支持多个数据源：arXiv、Semantic Scholar、Google Scholar（可选）
- 过滤条件：时间范围、学科领域、文献类型、引用数门槛

### 1.2 输入参数
```typescript
interface LiteratureSearchInput {
  keywords: string[];          // 关键词列表
  query: string;                // 自然语言查询
  timeRange?: {                 // 时间范围
    startYear: number;
    endYear: number;
  };
  subject?: string;             // 学科领域：cs.AI, cs.LG, physics, biology, business
  documentType?: string;        // 文献类型：article, preprint, review
  minCitations?: number;        // 最小引用数
  maxResults?: number;          // 最多返回结果数（默认 20）
}
```

### 1.3 输出结果
```typescript
interface LiteratureSearchResult {
  total: number;                 // 总结果数
  papers: Paper[];               // 文献列表
}

interface Paper {
  id: string;                    // 文献 ID
  title: string;                 // 标题
  authors: string[];             // 作者列表
  abstract: string;              // 摘要
  year: number;                  // 发表年份
  citations: number;             // 引用数
  url: string;                   // 全文链接
  pdfUrl?: string;               // PDF 链接
  venue?: string;                // 期刊/会议
  subjects?: string[];           // 学科分类
}
```

### 1.4 实现步骤
1. **集成 arXiv API**（优先级最高）
   - 使用 arXiv API: https://arxiv.org/help/api/user-manual
   - 实现基础关键词检索
   - 支持时间范围和学科分类过滤
2. **集成 Semantic Scholar API**
   - 使用 Semantic Scholar API: https://api.semanticscholar.org/
   - 补充引用数和更丰富的元数据
3. **结果聚合与去重**
   - 合并多个数据源的结果
   - 按 DOI/标题去重
   - 按引用数/时间排序

### 1.5 参考资料
- arXiv API 文档: https://arxiv.org/help/api/user-manual
- Semantic Scholar API 文档: https://api.semanticscholar.org/
- 现有工具: Elicit, Consensus

---

## 二、Skill 2: 文献摘要生成（Paper Summarization）

### 2.1 功能描述
- 为单篇文献生成结构化摘要
- 为多篇文献生成主题综述摘要
- 支持自定义摘要长度和重点方向

### 2.2 输入参数
```typescript
interface PaperSummarizationInput {
  papers: Paper[];               // 要总结的文献列表
  focus?: string;                // 重点方向：methods, results, conclusions, all
  length?: 'short' | 'medium' | 'long';  // 摘要长度
  outputFormat?: 'bullet' | 'paragraph' | 'structured'; // 输出格式
}
```

### 2.3 输出结果
```typescript
interface PaperSummarizationResult {
  summary: string;               // 摘要文本
  keyFindings: string[];         // 关键发现列表
  methodology: string;           // 方法总结（如果有）
  limitations: string[];         // 局限性列表
}
```

### 2.4 实现步骤
1. **单篇文献摘要**
   - 提取文献标题、摘要、全文（如果有）
   - 使用 LLM 生成结构化摘要
   - 支持 bullet/paragraph/structured 格式
2. **多篇文献综述**
   - 对比多篇文献的方法和结果
   - 识别共同点和分歧点
   - 生成综合综述

### 2.5 参考资料
- Prompt 工程: 结构化摘要生成的最佳实践
- 现有工具: Elicit, SciSpace, Wordtune

---

## 三、Skill 3: 引用格式化（Citation Formatting）

### 3.1 功能描述
- 将文献元数据格式化为指定引用风格
- 支持常见风格：APA 7th, MLA 9th, Chicago 17th, IEEE
- 导出 BibTeX, RIS, EndNote 格式

### 3.2 输入参数
```typescript
interface CitationFormattingInput {
  papers: Paper[];               // 要格式化的文献列表
  style: 'apa' | 'mla' | 'chicago' | 'ieee'; // 引用风格
  outputType: 'in-text' | 'bibliography' | 'bibtex' | 'ris'; // 输出类型
}
```

### 3.3 输出结果
```typescript
interface CitationFormattingResult {
  citations: string[];            // 格式化后的引用列表
  bibtex?: string;                // BibTeX 格式（如果需要）
  ris?: string;                   // RIS 格式（如果需要）
}
```

### 3.4 实现步骤
1. **使用现有库**
   - citation-js: https://citation.js.org/
   - BibTeX 解析和生成
2. **支持主流风格**
   - APA 7th
   - MLA 9th
   - Chicago 17th (Notes-Bibliography and Author-Date)
   - IEEE
3. **导出功能**
   - BibTeX
   - RIS
   - 纯文本参考文献列表

### 3.5 参考资料
- citation-js: https://citation.js.org/
- Zotero Citation Style Language: https://www.zotero.org/styles
- 现有工具: Zotero, Mendeley, Citation Machine

---

## 四、Skill 4: 文献综述生成（Literature Review Generation）

### 4.1 功能描述
- 基于多篇文献生成完整的主题文献综述
- 带正确引用
- 可自定义结构

### 4.2 输入参数
```typescript
interface LiteratureReviewInput {
  researchQuestion: string;       // 研究问题
  papers: Paper[];               // 相关文献列表
  structure?: string[];           // 自定义章节结构
  minCitations?: number;          // 每部分最小引用数
  tone?: 'academic' | 'accessible'; // 语气
}
```

### 4.3 输出结果
```typescript
interface LiteratureReviewResult {
  title: string;                  // 综述标题
  sections: Section[];            // 章节列表
  references: string[];           // 参考文献列表
}

interface Section {
  title: string;                  // 章节标题
  content: string;                // 章节内容（带引用）
}
```

### 4.4 实现步骤
1. **文献分组**
   - 按主题/方法/结果对文献分组
   - 识别研究脉络
2. **生成各章节**
   - 引言
   - 主题 1
   - 主题 2
   - 研究空白
   - 结论
3. **引用插入**
   - 在正确位置插入引用标记
   - 生成参考文献列表

### 4.5 参考资料
- Litmaps, Connected Papers（文献分组思路）
- Elicit（综述生成）
- 学术写作指南

---

## 五、总体实现优先级

### Week 1
- Skill 1: 文献检索（arXiv API 集成）
- Skill 3: 引用格式化（citation-js 集成）

### Week 2
- Skill 2: 文献摘要生成（单篇）
- Skill 1: 补充 Semantic Scholar API

### Week 3
- Skill 2: 文献摘要生成（多篇）
- Skill 4: 文献综述生成（基础版）

---

**最后更新**: 2026年3月1日
