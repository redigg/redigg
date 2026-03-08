"""
Review 管理器
"""

import json
from pathlib import Path
from typing import List, Optional
from .models import Review, ReviewStatus
from ..version.manager import VersionManager


class ReviewManager:
    """Review 管理器"""

    def __init__(self, base_path: Optional[Path] = None):
        self.base_path = base_path or Path.home() / ".redigg"
        self.version_manager = VersionManager(base_path)

    def _get_version_dir(self, version_id: str, research_id: Optional[str] = None) -> Optional[Path]:
        """获取 version 目录"""
        if research_id:
            research_dir = self.version_manager._get_research_dir(research_id)
            if research_dir:
                return research_dir / "versions" / version_id
        return None

    def create(self, version_id: str, content: str,
               research_id: Optional[str] = None,
               created_by: str = "agent") -> Review:
        """创建新的 review（agent 主动发起）"""
        version_dir = self._get_version_dir(version_id, research_id)
        if not version_dir:
            raise ValueError(f"Version not found: {version_id}")

        review = Review(
            version_id=version_id,
            content=content,
            created_by=created_by
        )

        # 保存 review
        review_file = version_dir / "reviews" / f"{review.id}.json"
        with open(review_file, "w", encoding="utf-8") as f:
            json.dump(review.to_dict(), f, ensure_ascii=False, indent=2)

        # 更新版本的 review 索引
        self._update_review_index(version_dir, review)

        return review

    def create_automatic_review(self, version_id: str,
                                  research_id: Optional[str] = None) -> Review:
        """创建自动 review（agent 主动发起）"""
        # 这里可以调用 LLM 生成 review 内容
        # 暂时使用占位内容
        content = """
🤖 **自动 Peer Review**

这是 agent 主动发起的 peer review。

## 检查清单

- [ ] 研究问题是否清晰？
- [ ] 方法是否合理？
- [ ] 结果是否可靠？
- [ ] 讨论是否充分？

## 建议

（这里会根据实际内容生成具体建议）
        """.strip()

        return self.create(version_id, content, research_id, created_by="agent")

    def _update_review_index(self, version_dir: Path, review: Review):
        """更新版本的 review 索引"""
        index_file = version_dir / "reviews.json"
        index = []
        if index_file.exists():
            with open(index_file, "r", encoding="utf-8") as f:
                index = json.load(f)
        index.append(review.to_dict())
        with open(index_file, "w", encoding="utf-8") as f:
            json.dump(index, f, ensure_ascii=False, indent=2)

    def list(self, version_id: str, research_id: Optional[str] = None) -> List[Review]:
        """列出 version 的所有 review"""
        version_dir = self._get_version_dir(version_id, research_id)
        if not version_dir:
            return []

        index_file = version_dir / "reviews.json"
        if not index_file.exists():
            return []

        with open(index_file, "r", encoding="utf-8") as f:
            index = json.load(f)

        return [Review.from_dict(data) for data in index]

    def update_status(self, review_id: str, status: ReviewStatus,
                      version_id: str, research_id: Optional[str] = None) -> Optional[Review]:
        """更新 review 状态"""
        # TODO: 实现更新逻辑
        return None
