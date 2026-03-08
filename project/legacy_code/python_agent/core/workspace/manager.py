"""
Workspace 管理器
"""

import json
from pathlib import Path
from typing import List, Optional
from .models import Workspace


class WorkspaceManager:
    """Workspace 管理器"""

    def __init__(self, base_path: Optional[Path] = None):
        self.base_path = base_path or Path.home() / ".redigg"
        self.base_path.mkdir(parents=True, exist_ok=True)
        self.workspaces_path = self.base_path / "workspaces"
        self.workspaces_path.mkdir(parents=True, exist_ok=True)
        self.index_file = self.base_path / "workspaces.json"

    def _load_index(self) -> List[dict]:
        """加载 workspace 索引"""
        if not self.index_file.exists():
            return []
        with open(self.index_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_index(self, workspaces: List[dict]):
        """保存 workspace 索引"""
        with open(self.index_file, "w", encoding="utf-8") as f:
            json.dump(workspaces, f, ensure_ascii=False, indent=2)

    def create(self, name: str) -> Workspace:
        """创建新的 workspace"""
        workspace = Workspace(name=name)

        # 创建 workspace 目录
        Path(workspace.path).mkdir(parents=True, exist_ok=True)

        # 创建 workspace 内部结构
        ws_path = Path(workspace.path)
        (ws_path / "researches").mkdir(exist_ok=True)
        (ws_path / "assets").mkdir(exist_ok=True)

        # 保存 workspace 配置
        ws_config = ws_path / "workspace.json"
        with open(ws_config, "w", encoding="utf-8") as f:
            json.dump(workspace.to_dict(), f, ensure_ascii=False, indent=2)

        # 更新索引
        index = self._load_index()
        index.append(workspace.to_dict())
        self._save_index(index)

        return workspace

    def list(self) -> List[Workspace]:
        """列出所有 workspace"""
        index = self._load_index()
        return [Workspace.from_dict(data) for data in index]

    def get(self, workspace_id: str) -> Optional[Workspace]:
        """获取指定的 workspace"""
        index = self._load_index()
        for data in index:
            if data["id"] == workspace_id:
                return Workspace.from_dict(data)
        return None

    def delete(self, workspace_id: str) -> bool:
        """删除 workspace（谨慎使用）"""
        # TODO: 实现删除逻辑，需要确认
        raise NotImplementedError("删除功能暂未实现")
