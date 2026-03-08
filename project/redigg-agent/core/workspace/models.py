"""
Workspace 数据模型
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional


@dataclass
class Workspace:
    """Workspace 数据模型"""
    id: str = field(default_factory=lambda: f"ws_{uuid.uuid4().hex[:12]}")
    name: str = ""
    path: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def __post_init__(self):
        if not self.path:
            # 默认路径: ~/.redigg/workspaces/{name}
            base_path = Path.home() / ".redigg" / "workspaces"
            base_path.mkdir(parents=True, exist_ok=True)
            self.path = str(base_path / self.name.replace(" ", "_").lower())

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "id": self.id,
            "name": self.name,
            "path": self.path,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Workspace":
        """从字典创建"""
        return cls(
            id=data.get("id", f"ws_{uuid.uuid4().hex[:12]}"),
            name=data.get("name", ""),
            path=data.get("path", ""),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now()
        )
