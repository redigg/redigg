"""
Research 数据模型
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class ResearchType(Enum):
    """Research 类型"""
    SURVEY = "survey"
    BENCHMARK = "benchmark"
    ALGORITHM_PAPER = "algorithm_paper"
    POSITION_PAPER = "position_paper"
    REPRODUCTION = "reproduction"
    EXPERIMENT = "experiment"


class ConferenceType(Enum):
    """会议类型"""
    NIPS = "nips"
    ICLR = "iclr"
    ICML = "icml"
    KDD = "kdd"
    CVPR = "cvpr"
    ACL = "acl"
    AAAI = "aaai"
    CUSTOM = "custom"


@dataclass
class Research:
    """Research 数据模型"""
    id: str = field(default_factory=lambda: f"res_{uuid.uuid4().hex[:12]}")
    title: str = ""
    type: str = ResearchType.SURVEY.value
    conference: Optional[str] = None
    workspace_id: Optional[str] = None
    description: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "id": self.id,
            "title": self.title,
            "type": self.type,
            "conference": self.conference,
            "workspace_id": self.workspace_id,
            "description": self.description,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Research":
        """从字典创建"""
        return cls(
            id=data.get("id", f"res_{uuid.uuid4().hex[:12]}"),
            title=data.get("title", ""),
            type=data.get("type", ResearchType.SURVEY.value),
            conference=data.get("conference"),
            workspace_id=data.get("workspace_id"),
            description=data.get("description", ""),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now()
        )
