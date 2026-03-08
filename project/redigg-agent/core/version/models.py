"""
Version 数据模型
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any


@dataclass
class Version:
    """Version 数据模型"""
    id: str = field(default_factory=lambda: f"ver_{uuid.uuid4().hex[:12]}")
    research_id: str = ""
    version: str = "v1"
    context: Dict[str, Any] = field(default_factory=dict)
    description: str = ""
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "id": self.id,
            "research_id": self.research_id,
            "version": self.version,
            "context": self.context,
            "description": self.description,
            "created_at": self.created_at.isoformat()
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Version":
        """从字典创建"""
        return cls(
            id=data.get("id", f"ver_{uuid.uuid4().hex[:12]}"),
            research_id=data.get("research_id", ""),
            version=data.get("version", "v1"),
            context=data.get("context", {}),
            description=data.get("description", ""),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now()
        )
