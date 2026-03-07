"""
Version 管理器
"""

import json
from pathlib import Path
from typing import List, Optional, Dict, Any
from .models import Version
from ..research.manager import ResearchManager


class VersionManager:
    """Version 管理器"""

    def __init__(self, base_path: Optional[Path] = None):
        self.base_path = base_path or Path.home() / ".redigg"
        self.research_manager = ResearchManager(base_path)

    def _get_research_dir(self, research_id: str) -> Optional[Path]:
        """获取 research 目录"""
        research = self.research_manager.get(research_id)
        if not research:
            return None

        if research.workspace_id:
            workspace = self.research_manager.workspace_manager.get(research.workspace_id)
            if workspace:
                return Path(workspace.path) / "researches" / research_id

        return self.base_path / "researches" / research_id

    def create(self, research_id: str, context: Optional[Dict[str, Any]] = None,
               description: str = "") -> Version:
        """创建新的 version"""
        research_dir = self._get_research_dir(research_id)
        if not research_dir:
            raise ValueError(f"Research not found: {research_id}")

        # 计算下一个版本号
        existing_versions = self.list(research_id)
        next_num = len(existing_versions) + 1
        version_str = f"v{next_num}"

        version = Version(
            research_id=research_id,
            version=version_str,
            context=context or {},
            description=description
        )

        # 创建 version 目录
        version_dir = research_dir / "versions" / version.id
        version_dir.mkdir(parents=True, exist_ok=True)

        # 创建 version 内部结构
        (version_dir / "context").mkdir(exist_ok=True)
        (version_dir / "outputs").mkdir(exist_ok=True)
        (version_dir / "reviews").mkdir(exist_ok=True)

        # 保存 version 配置
        version_config = version_dir / "version.json"
        with open(version_config, "w", encoding="utf-8") as f:
            json.dump(version.to_dict(), f, ensure_ascii=False, indent=2)

        # 保存 context（如果有）
        if version.context:
            context_file = version_dir / "context" / "context.json"
            with open(context_file, "w", encoding="utf-8") as f:
                json.dump(version.context, f, ensure_ascii=False, indent=2)

        # 更新 research 的版本索引
        self._update_version_index(research_dir, version)

        return version

    def _update_version_index(self, research_dir: Path, version: Version):
        """更新 research 的版本索引"""
        index_file = research_dir / "versions.json"
        index = []
        if index_file.exists():
            with open(index_file, "r", encoding="utf-8") as f:
                index = json.load(f)
        index.append(version.to_dict())
        with open(index_file, "w", encoding="utf-8") as f:
            json.dump(index, f, ensure_ascii=False, indent=2)

    def list(self, research_id: str) -> List[Version]:
        """列出 research 的所有版本"""
        research_dir = self._get_research_dir(research_id)
        if not research_dir:
            return []

        index_file = research_dir / "versions.json"
        if not index_file.exists():
            return []

        with open(index_file, "r", encoding="utf-8") as f:
            index = json.load(f)

        return [Version.from_dict(data) for data in index]

    def get(self, version_id: str, research_id: Optional[str] = None) -> Optional[Version]:
        """获取指定的 version"""
        if research_id:
            versions = self.list(research_id)
            for ver in versions:
                if ver.id == version_id:
                    return ver
            return None

        # 如果没有指定 research_id，遍历所有 research
        # TODO: 实现这个逻辑
        return None
