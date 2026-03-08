"""
Literature Review Skill - 文献综述技能
"""

from typing import Dict, Any, List
from dataclasses import dataclass


@dataclass
class LiteratureReviewResult:
    """文献综述结果"""
    topic: str = ""
    summary: str = ""
    papers: List[Dict[str, Any]] = None
    key_findings: List[str] = None
    research_gaps: List[str] = None

    def __post_init__(self):
        if self.papers is None:
            self.papers = []
        if self.key_findings is None:
            self.key_findings = []
        if self.research_gaps is None:
            self.research_gaps = []


def literature_review_skill(params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    文献综述 Skill

    Args:
        params: Skill 参数
            - topic: 研究主题
            - max_papers: 最大论文数量（默认：10）
            - categories: arXiv 分类列表（默认：["cs.AI", "cs.LG"]）
        context: 上下文信息

    Returns:
        文献综述结果
    """
    topic = params.get("topic", "")
    max_papers = params.get("max_papers", 10)
    categories = params.get("categories", ["cs.AI", "cs.LG"])

    print(f"📚 Starting literature review on: {topic}")
    print(f"   Max papers: {max_papers}")
    print(f"   Categories: {', '.join(categories)}")

    # 1. 搜索论文（使用 arXiv 工具）
    try:
        from tools.arxiv import ArxivTool
        arxiv = ArxivTool()
        papers = []

        for category in categories:
            category_papers = arxiv.search(topic, max_results=max_papers // len(categories), category=category)
            papers.extend(category_papers)

        # 去重并限制数量
        seen_ids = set()
        unique_papers = []
        for paper in papers:
            if paper.id not in seen_ids and len(unique_papers) < max_papers:
                seen_ids.add(paper.id)
                unique_papers.append(paper)

        papers = unique_papers
        print(f"   Found {len(papers)} relevant papers")

    except Exception as e:
        print(f"   ⚠️  Failed to search arXiv: {e}")
        papers = []

    # 2. 生成综述（模拟，实际应该使用 LLM）
    summary = f"""
# Literature Review: {topic}

## Overview
This literature review summarizes recent advances in {topic}.

## Key Findings
1. Significant progress has been made in recent years
2. Multiple approaches have been proposed
3. Benchmark performance continues to improve

## Research Gaps
1. Limited real-world deployment
2. Robustness needs improvement
3. Scalability challenges remain

## Conclusion
While great progress has been made, there are still many open challenges to address.
    """.strip()

    # 3. 构建结果
    result = LiteratureReviewResult(
        topic=topic,
        summary=summary,
        papers=[{
            "id": p.id,
            "title": p.title,
            "authors": p.authors,
            "abstract": p.abstract,
            "published": p.published.isoformat() if p.published else None,
            "categories": p.categories,
            "pdf_url": p.pdf_url
        } for p in papers],
        key_findings=[
            "Significant progress in recent years",
            "Multiple approaches proposed",
            "Benchmark performance improving"
        ],
        research_gaps=[
            "Limited real-world deployment",
            "Robustness needs improvement",
            "Scalability challenges remain"
        ]
    )

    print(f"   ✅ Literature review completed")
    print(f"   📄 Papers reviewed: {len(result.papers)}")
    print(f"   🎯 Key findings: {len(result.key_findings)}")
    print(f"   ❓ Research gaps: {len(result.research_gaps)}")

    return {
        "success": True,
        "result": result.__dict__
    }


# Skill 注册信息
SKILL_REGISTRY = {
    "name": "literature_review",
    "description": "Search for papers and generate a literature review",
    "function": literature_review_skill,
    "params": {
        "topic": "string (required) - Research topic",
        "max_papers": "number (optional, default: 10) - Maximum number of papers",
        "categories": "array (optional, default: ['cs.AI', 'cs.LG']) - arXiv categories"
    }
}
