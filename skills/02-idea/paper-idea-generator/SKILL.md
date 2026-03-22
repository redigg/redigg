---
name: paper-idea-generator
version: 2.1.0
description: Generate novel, actionable paper ideas from arXiv papers and LLM analysis. Includes selection reasons, score breakdowns, and gap evidence.
---

# Paper Idea Generator v2.1

## 🆕 v2.1 新增功能

### 选择原因 (Selection Reason)
每个点子都会显示：
- 为什么选择这个研究空白
- 哪些论文暗示这个空白存在

### 评分区分度 (Score Breakdown)
不再是统一的 85 分，而是：
- **新颖性** (30%): 方法创新程度
- **可行性** (25%): 技术实现难度
- **相关性** (25%): 与主题的匹配度
- **影响力** (20%): 潜在研究价值

### 空白证据 (Gap Evidence)
- 统计多少论文提及该技术
- 找出间接暗示该空白的论文

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `topic` | string | required | Research topic (e.g., "LLM Agents") |
| `num_ideas` | number | 5 | Number of ideas (1-10) |
| `max_papers` | number | 20 | Max papers from arXiv (5-50) |
| `language` | string | "both" | Output language: "en", "zh", "both" |
| `detail_level` | string | "detailed" | Detail level: "brief", "standard", "detailed" |
| `focus_areas` | array | [] | Focus on specific categories |

## Output Format

```json
{
  "success": true,
  "ideas": [
    {
      "id": "idea_1234567890",
      "title": "Hierarchical Memory-Constrained Task Decomposition...",
      "title_zh": "面向长周期大语言模型智能体的分层记忆约束任务分解方法",
      "research_gap": "hierarchical",
      "research_gap_category": "agent",
      "research_questions": ["Question 1", "Question 2", "Question 3"],
      "core_method": "Detailed methodology...",
      "experiments": [
        {
          "name": "Performance Evaluation",
          "dataset": "ALFWorld",
          "baselines": ["AutoGen", "MetaGPT"],
          "metrics": ["Success Rate", "Completion Time"]
        }
      ],
      "expected_contributions": ["Contribution 1", "Contribution 2"],
      "related_papers": ["Paper 1", "Paper 2", "Paper 3"],
      "score": 85,
      "difficulty": "medium",
      "novelty": "moderate",
      "feasibility": "high",
      "timeline": "3-6 months",
      "resources_needed": ["GPU cluster", "Dataset access"]
    }
  ],
  "papers_found": 20,
  "gaps_identified": 15,
  "markdown": "...",
  "summary": {
    "total_ideas": 5,
    "avg_score": 82,
    "top_score": 90
  }
}
```

## Usage Examples

### Basic Usage
```typescript
const result = await skill.execute(ctx, {
  topic: "LLM Agents"
});
```

### With Options
```typescript
const result = await skill.execute(ctx, {
  topic: "RAG Enhancement",
  num_ideas: 5,
  max_papers: 30,
  language: "both",
  detail_level: "detailed",
  focus_areas: ["retrieval", "optimization"]
});
```

### Quick Generation
```typescript
const result = await skill.execute(ctx, {
  topic: "Multi-Agent Systems",
  num_ideas: 3,
  detail_level: "brief"
});
```

## Research Gap Categories

| Category | Keywords |
|----------|----------|
| **agent** | hierarchical, peer-to-peer, competitive, collaborative, hybrid, blackboard, event-driven, ... |
| **memory** | shared, hierarchical, episodic, semantic, working, long-term, short-term, ... |
| **reasoning** | chain-of-thought, tree-of-thought, multi-hop, speculative, self-consistency, ... |
| **learning** | reinforcement, supervised, unsupervised, meta-learning, continual, transfer, ... |
| **optimization** | quantization, pruning, distillation, speculative-decoding, cache, ... |
| **retrieval** | sparse, dense, hybrid, multi-modal, adaptive, re-ranking, query-expansion, ... |

## Dependencies

- Internet access for arXiv API
- Configured LLM client for idea generation

## Performance

- **Batch Processing**: 3 ideas generated in parallel
- **arXiv Fetch**: ~2-3 seconds for 20 papers
- **LLM Generation**: ~2-5 seconds per idea
- **Total Time**: ~15-30 seconds for 5 ideas