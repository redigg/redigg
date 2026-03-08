"""
Review 数据模型
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List


class ReviewStatus(Enum):
    """Review 状态"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


@dataclass
class ActionItem:
    """Action Item 数据模型"""
    id: str = field(default_factory=lambda: f"ai_{uuid.uuid4().hex[:12]}")
    description: str = ""
    status: str = ReviewStatus.PENDING.value
    created_at: datetime = field(default_factory=datetime.now)
    resolved_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "id": self.id,
            "description": self.description,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ActionItem":
        """从字典创建"""
        return cls(
            id=data.get("id", f"ai_{uuid.uuid4().hex[:12]}"),
            description=data.get("description", ""),
            status=data.get("status", ReviewStatus.PENDING.value),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            resolved_at=datetime.fromisoformat(data["resolved_at"]) if data.get("resolved_at") else None
        )


@dataclass
class Review:
    """Review 数据模型"""
    id: str = field(default_factory=lambda: f"rev_{uuid.uuid4().hex[:12]}")
    version_id: str = ""
    content: str = ""
    status: str = ReviewStatus.PENDING.value
    action_items: List[ActionItem] = field(default_factory=list)
    created_by: str = "agent"  # "agent" 或 "user"
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "id": self.id,
            "version_id": self.version_id,
            "content": self.content,
            "status": self.status,
            "action_items": [ai.to_dict() for ai in self.action_items],
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Review":
        """从字典创建"""
        return cls(
            id=data.get("id", f"rev_{uuid.uuid4().hex[:12]}"),
            version_id=data.get("version_id", ""),
            content=data.get("content", ""),
            status=data.get("status", ReviewStatus.PENDING.value),
            action_items=[ActionItem.from_dict(ai) for ai in data.get("action_items", [])],
            created_by=data.get("created_by", "agent"),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now()
        )
