"""
Research 管理器
"""

import json
from pathlib import Path
from typing import List, Optional
from .models import Research
from ..workspace.manager import WorkspaceManager


class ResearchManager:
    """Research 管理器"""

    def __init__(self, base_path: Optional[Path] = None):
        self.base_path = base_path or Path.home() / ".redigg"
        self.workspace_manager = WorkspaceManager(base_path)

    def _get_research_index_path(self, workspace_id: Optional[str] = None) -> Path:
        """获取 research 索引文件路径"""
        if workspace_id:
            workspace = self.workspace_manager.get(workspace_id)
            if workspace:
                return Path(workspace.path) / "researches.json"
        # 全局索引
        return self.base_path / "researches.json"

    def _load_index(self, workspace_id: Optional[str] = None) -> List[dict]:
        """加载 research 索引"""
        index_path = self._get_research_index_path(workspace_id)
        if not index_path.exists():
            return []
        with open(index_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_index(self, researches: List[dict], workspace_id: Optional[str] = None):
        """保存 research 索引"""
        index_path = self._get_research_index_path(workspace_id)
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(researches, f, ensure_ascii=False, indent=2)

    def create(self, title: str, type: str = "survey",
               workspace_id: Optional[str] = None,
               conference: Optional[str] = None,
               description: str = "") -> Research:
        """创建新的 research"""
        research = Research(
            title=title,
            type=type,
            workspace_id=workspace_id,
            conference=conference,
            description=description
        )

        # 获取 workspace 路径
        workspace_path = None
        if workspace_id:
            workspace = self.workspace_manager.get(workspace_id)
            if workspace:
                workspace_path = Path(workspace.path)

        if not workspace_path:
            # 默认使用全局路径
            workspace_path = self.base_path / "researches"
            workspace_path.mkdir(parents=True, exist_ok=True)

        # 创建 research 目录
        research_dir = workspace_path / "researches" / research.id
        research_dir.mkdir(parents=True, exist_ok=True)

        # 创建 research 内部结构
        (research_dir / "versions").mkdir(exist_ok=True)
        (research_dir / "artifacts").mkdir(exist_ok=True)

        # 保存 research 配置
        research_config = research_dir / "research.json"
        with open(research_config, "w", encoding="utf-8") as f:
            json.dump(research.to_dict(), f, ensure_ascii=False, indent=2)

        # 更新索引（全局 + workspace）
        for ws_id in [None, workspace_id]:
            if ws_id or not workspace_id:  # 要么更新全局，要么更新 workspace
                index = self._load_index(ws_id)
                index.append(research.to_dict())
                self._save_index(index, ws_id)

        return research

    def list(self, workspace_id: Optional[str] = None) -> List[Research]:
        """列出所有 research"""
        index = self._load_index(workspace_id)
        return [Research.from_dict(data) for data in index]

    def get(self, research_id: str) -> Optional[Research]:
        """获取指定的 research"""
        # 先查全局索引
        index = self._load_index(None)
        for data in index:
            if data["id"] == research_id:
                return Research.from_dict(data)
        # 再查各个 workspace
        workspaces = self.workspace_manager.list()
        for ws in workspaces:
            index = self._load_index(ws.id)
            for data in index:
                if data["id"] == research_id:
                    return Research.from_dict(data)
        return None
