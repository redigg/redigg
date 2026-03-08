# Literature Review Skill（示例）

**Skill ID**: `skill-literature-review-v1`  
**版本**: `1.0.0`  
**作者**: Redigg Team  
**创建日期**: 2026-03-04  
**最后更新**: 2026-03-04  
**许可证**: MIT

---

## 概述

这是一个用于自动生成文献综述的skill。它可以根据研究主题自动检索相关文献，分析文献内容，生成结构化的文献综述。

**核心功能**:
- 文献检索和筛选
- 文献内容分析和总结
- 研究趋势分析
- 结构化文献综述生成

---

## 功能说明

### 输入

#### 输入参数

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|--------|
| `topic` | string | 是 | 研究主题，例如："AI Agent in Finance" |
| `num_papers` | number | 否 | 检索的文献数量，默认20 |
| `years` | array | 否 | 时间范围，例如：[2020, 2026] |
| `focus` | string | 否 | 重点方向，例如："methodology" 或 "applications" |

#### 输入示例

```json
{
  "topic": "AI Agent in Finance",
  "num_papers": 20,
  "years": [2020, 2026],
  "focus": "methodology"
}
```

### 输出

#### 输出格式

| 字段名 | 类型 | 描述 |
|---------|------|--------|
| `summary` | string | 文献综述摘要 |
| `papers` | array | 检索到的文献列表 |
| `trends` | object | 研究趋势分析 |
| `gaps` | array | 研究空白识别 |
| `full_review` | string | 完整的文献综述（Markdown格式） |

#### 输出示例

```json
{
  "summary": "This literature review analyzes 20 papers on AI Agent in Finance...",
  "papers": [
    {
      "title": "FinAgent: A Multi-Modal Foundation Agent for Financial Trading",
      "authors": "Li et al.",
      "year": 2024,
      "venue": "arXiv",
      "key_contribution": "Multi-modal foundation agent for financial trading"
    }
  ],
  "trends": {
    "from_single_to_multi_agent": true,
    "tool_use_increasing": true,
    "focus_on_safety": true
  },
  "gaps": [
    "Lack of standardized evaluation benchmarks",
    "Limited research on multi-agent coordination in finance"
  ],
  "full_review": "# Literature Review: AI Agent in Finance\n\n## 1. Introduction\n..."
}
```

---

## 使用示例

### 示例1：基础文献综述

**输入**:
```json
{
  "topic": "Large Language Models for Sentiment Analysis",
  "num_papers": 15
}
```

**输出**: 15篇文献的综述，包括研究趋势和空白识别。

### 示例2：带时间范围和重点

**输入**:
```json
{
  "topic": "Multi-Agent Systems in Research",
  "num_papers": 25,
  "years": [2022, 2026],
  "focus": "applications"
}
```

**输出**: 2022-2026年的25篇文献综述，重点关注应用方向。

---

## 实现细节

### 技术实现

1. **文献检索**: 使用arXiv API、Semantic Scholar API等
2. **文献分析**: 使用LLM进行文献内容分析和总结
3. **趋势分析**: 时间序列分析、主题建模
4. **综述生成**: 结构化模板 + LLM生成

### 依赖

- arXiv API
- Semantic Scholar API
- LLM API（用于文献分析和综述生成）

---

## 性能指标

| 指标 | 值 |
|------|-----|
| 平均延迟 | 45s |
| 文献覆盖率 | 0.90 |
| 用户满意度 | 4.2/5.0 |

---

## 限制和注意事项

- 依赖外部API（arXiv、Semantic Scholar），可能有速率限制
- 文献质量取决于检索到的文献
- 综述质量取决于LLM的能力
- 建议用户人工审核和修改生成的综述

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2026-03-04 | 初始版本 |

---

## 参考资料

- [arXiv API](https://arxiv.org/help/api/)
- [Semantic Scholar API](https://www.semanticscholar.org/product/api)
- [FinAgent arXiv](https://arxiv.org/abs/2402.18485)
