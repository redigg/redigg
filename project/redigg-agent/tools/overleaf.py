"""
Overleaf 工具集成
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import json
from pathlib import Path


@dataclass
class OverleafProject:
    """Overleaf 项目数据模型"""
    id: str = ""
    name: str = ""
    description: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_edited_by: str = ""
    compiler: str = "pdflatex"
    main_file: str = "main.tex"

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_edited_by": self.last_edited_by,
            "compiler": self.compiler,
            "main_file": self.main_file
        }


@dataclass
class OverleafFile:
    """Overleaf 文件数据模型"""
    name: str = ""
    type: str = "file"  # file, folder
    content: str = ""
    path: str = ""
    updated_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "name": self.name,
            "type": self.type,
            "content": self.content,
            "path": self.path,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class OverleafTool:
    """Overleaf 工具"""

    def __init__(self, email: Optional[str] = None, password: Optional[str] = None):
        self.email = email
        self.password = password
        self._local_projects: Dict[str, OverleafProject] = {}
        self._local_files: Dict[str, Dict[str, OverleafFile]] = {}

    def list_projects(self) -> List[OverleafProject]:
        """列出所有 Overleaf 项目"""
        # TODO: 实现真实的 Overleaf API 调用
        # 暂时返回模拟数据
        return self._get_mock_projects()

    def _get_mock_projects(self) -> List[OverleafProject]:
        """获取模拟 Overleaf 项目（用于演示）"""
        projects = [
            OverleafProject(
                id="proj_123",
                name="LLM Survey 2026",
                description="A comprehensive survey of large language models",
                created_at=datetime(2024, 1, 15),
                updated_at=datetime(2024, 3, 4),
                last_edited_by="user@example.com",
                compiler="pdflatex",
                main_file="main.tex"
            ),
            OverleafProject(
                id="proj_456",
                name="AI Research Paper",
                description="Research paper on AI agents",
                created_at=datetime(2024, 2, 20),
                updated_at=datetime(2024, 3, 3),
                last_edited_by="user@example.com",
                compiler="pdflatex",
                main_file="main.tex"
            )
        ]
        return projects

    def get_project(self, project_id: str) -> Optional[OverleafProject]:
        """获取指定的项目"""
        # TODO: 实现真实的 Overleaf API 调用
        projects = self.list_projects()
        for proj in projects:
            if proj.id == project_id:
                return proj
        return None

    def create_project(self, name: str, template: Optional[str] = None) -> Optional[OverleafProject]:
        """创建新项目"""
        # TODO: 实现真实的 Overleaf API 调用
        project = OverleafProject(
            id=f"proj_{len(self._local_projects) + 1}",
            name=name,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        self._local_projects[project.id] = project
        self._local_files[project.id] = {}
        return project

    def list_files(self, project_id: str) -> List[OverleafFile]:
        """列出项目文件"""
        # TODO: 实现真实的 Overleaf API 调用
        if project_id not in self._local_files:
            # 返回默认文件
            return [
                OverleafFile(name="main.tex", type="file", path="main.tex"),
                OverleafFile(name="references.bib", type="file", path="references.bib"),
                OverleafFile(name="figures", type="folder", path="figures")
            ]
        return list(self._local_files[project_id].values())

    def get_file(self, project_id: str, file_path: str) -> Optional[OverleafFile]:
        """获取文件内容"""
        # TODO: 实现真实的 Overleaf API 调用
        if file_path == "main.tex":
            return OverleafFile(
                name="main.tex",
                type="file",
                path="main.tex",
                content=r"""
\documentclass{article}
\title{My Paper}
\author{Author}
\begin{document}
\maketitle
\section{Introduction}
This is my paper.
\end{document}
                """.strip()
            )
        return None

    def update_file(self, project_id: str, file_path: str, content: str) -> bool:
        """更新文件内容"""
        # TODO: 实现真实的 Overleaf API 调用
        if project_id not in self._local_files:
            self._local_files[project_id] = {}
        self._local_files[project_id][file_path] = OverleafFile(
            name=Path(file_path).name,
            type="file",
            path=file_path,
            content=content,
            updated_at=datetime.now()
        )
        return True

    def compile_project(self, project_id: str) -> bool:
        """编译项目"""
        # TODO: 实现真实的 Overleaf API 调用
        print(f"🚀 编译项目: {project_id}")
        return True

    def download_pdf(self, project_id: str, save_path: str) -> bool:
        """下载 PDF"""
        # TODO: 实现真实的 Overleaf API 调用
        print(f"📄 下载 PDF: {project_id} -> {save_path}")
        return True

    def save_to_local(self, path: str = "~/.redigg/overleaf.json"):
        """保存本地数据"""
        save_path = Path(path).expanduser()
        save_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "projects": {k: v.to_dict() for k, v in self._local_projects.items()},
            "files": {
                proj_id: {
                    file_path: file.to_dict()
                    for file_path, file in files.items()
                }
                for proj_id, files in self._local_files.items()
            }
        }
        with open(save_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_from_local(self, path: str = "~/.redigg/overleaf.json"):
        """加载本地数据"""
        load_path = Path(path).expanduser()
        if load_path.exists():
            with open(load_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self._local_projects = {
                    k: OverleafProject(**v)
                    for k, v in data.get("projects", {}).items()
                }
                self._local_files = {
                    proj_id: {
                        file_path: OverleafFile(**file_data)
                        for file_path, file_data in files.items()
                    }
                    for proj_id, files in data.get("files", {}).items()
                }
