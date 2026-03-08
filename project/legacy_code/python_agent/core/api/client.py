"""
Redigg.com API 客户端
"""

import json
import urllib.request
import urllib.parse
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


@dataclass
class RediggAgent:
    """Redigg Agent 数据模型"""
    id: str = ""
    name: str = ""
    api_key: str = ""
    created_at: Optional[datetime] = None


@dataclass
class RediggResearchTask:
    """Redigg Research Task 数据模型"""
    id: str = ""
    title: str = ""
    description: str = ""
    status: str = "pending"
    type: str = "general"
    parameters: Dict[str, Any] = None
    created_at: Optional[datetime] = None
    claimed_by_agent_id: Optional[str] = None
    claimed_at: Optional[datetime] = None
    lock_expires_at: Optional[datetime] = None

    def __post_init__(self):
        if self.parameters is None:
            self.parameters = {}


@dataclass
class RediggTodo:
    """Redigg Todo 数据模型"""
    id: str = ""
    content: str = ""
    status: str = "pending"
    priority: str = "medium"
    step_number: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class RediggAPIClient:
    """Redigg.com API 客户端"""

    BASE_URL = "https://redigg.com"

    def __init__(self, api_key: Optional[str] = None, config_path: Optional[str] = None):
        self.api_key = api_key
        self.config_path = config_path or str(Path.home() / ".redigg" / "config.json")
        self._load_config()

    def _load_config(self):
        """加载配置"""
        config_file = Path(self.config_path)
        if config_file.exists():
            with open(config_file, "r", encoding="utf-8") as f:
                config = json.load(f)
                if not self.api_key and "api_key" in config:
                    self.api_key = config["api_key"]

    def _save_config(self):
        """保存配置"""
        config_file = Path(self.config_path)
        config_file.parent.mkdir(parents=True, exist_ok=True)
        config = {}
        if config_file.exists():
            with open(config_file, "r", encoding="utf-8") as f:
                config = json.load(f)
        if self.api_key:
            config["api_key"] = self.api_key
        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=2)

    def _get_headers(self) -> Dict[str, str]:
        """获取请求头"""
        headers = {
            "Content-Type": "application/json"
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        """发送 HTTP 请求"""
        url = f"{self.BASE_URL}{endpoint}"

        if method in ["GET", "DELETE"] and data:
            url += f"?{urllib.parse.urlencode(data)}"
            data = None

        req = urllib.request.Request(url, method=method, headers=self._get_headers())

        if data and method in ["POST", "PUT", "PATCH"]:
            req.data = json.dumps(data).encode("utf-8")

        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            raise Exception(f"API Error: {e.code} - {error_body}")

    def register_agent(self, name: str, email: Optional[str] = None,
                       owner_token: Optional[str] = None) -> Dict[str, Any]:
        """
        注册 Agent

        Args:
            name: Agent 名称
            email: 可选邮箱
            owner_token: 可选的 owner token

        Returns:
            API 响应
        """
        data = {"name": name}
        if email:
            data["email"] = email
        if owner_token:
            data["owner_token"] = owner_token

        result = self._request("POST", "/api/agent/register", data)

        if result.get("success") and "agent" in result:
            agent = result["agent"]
            self.api_key = agent.get("api_key")
            self._save_config()

        return result

    def heartbeat(self) -> bool:
        """发送心跳"""
        try:
            self._request("POST", "/api/agent/heartbeat")
            return True
        except Exception as e:
            print(f"⚠️  心跳失败: {e}")
            return False

    def get_researches(self) -> List[RediggResearchTask]:
        """获取可用的 Research Task"""
        result = self._request("GET", "/api/researches")

        if not result.get("success"):
            return []

        tasks = []
        for data in result.get("data", []):
            task = RediggResearchTask(
                id=data.get("id", ""),
                title=data.get("title", ""),
                description=data.get("description", ""),
                status=data.get("status", "pending"),
                type=data.get("type", "general"),
                parameters=data.get("parameters", {}),
                created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
                claimed_by_agent_id=data.get("claimed_by_agent_id"),
                claimed_at=datetime.fromisoformat(data["claimed_at"]) if data.get("claimed_at") else None,
                lock_expires_at=datetime.fromisoformat(data["lock_expires_at"]) if data.get("lock_expires_at") else None
            )
            tasks.append(task)

        return tasks

    def claim_task(self, task_id: str) -> Dict[str, Any]:
        """认领任务"""
        return self._request("POST", f"/api/researches/{task_id}/claim")

    def upload_file(self, file_path: str, bucket: str = "artifacts") -> Dict[str, Any]:
        """上传文件"""
        # TODO: 实现 multipart/form-data 文件上传
        # 暂时返回模拟数据
        print(f"📤 上传文件: {file_path}")
        return {
            "success": True,
            "data": {
                "path": f"agent/{Path(file_path).name}",
                "url": f"https://redigg.com/artifacts/{Path(file_path).name}",
                "bucket": bucket,
                "size": Path(file_path).stat().st_size if Path(file_path).exists() else 0,
                "type": "application/octet-stream"
            }
        }

    def submit_progress(self, task_id: str, progress: int, description: str,
                        details: Optional[Dict] = None) -> Dict[str, Any]:
        """提交进度"""
        data = {
            "progress": progress,
            "step_status": "in_progress",
            "description": description
        }
        if details:
            data["details"] = details

        return self._request("POST", f"/api/researches/{task_id}/progress", data)

    def add_todo(self, research_id: str, content: str,
                 priority: str = "medium",
                 step_number: Optional[int] = None) -> Dict[str, Any]:
        """添加 Todo"""
        data = {
            "content": content,
            "priority": priority
        }
        if step_number is not None:
            data["step_number"] = step_number

        return self._request("POST", f"/api/researches/{research_id}/todos", data)

    def update_todo(self, research_id: str, todo_id: str,
                    status: str, content: Optional[str] = None) -> Dict[str, Any]:
        """更新 Todo"""
        data = {"status": status}
        if content:
            data["content"] = content

        return self._request("PATCH", f"/api/researches/{research_id}/todos/{todo_id}", data)

    def get_todos(self, research_id: str) -> List[RediggTodo]:
        """获取 Todo 列表"""
        result = self._request("GET", f"/api/researches/{research_id}/todos")

        if not result.get("success"):
            return []

        todos = []
        for data in result.get("data", []):
            todo = RediggTodo(
                id=data.get("id", ""),
                content=data.get("content", ""),
                status=data.get("status", "pending"),
                priority=data.get("priority", "medium"),
                step_number=data.get("step_number"),
                created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
                updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else None
            )
            todos.append(todo)

        return todos

    def submit_final_result(self, task_id: str, result: str,
                            artifacts: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """提交最终结果"""
        data = {"result": result}
        if artifacts:
            data["artifacts"] = artifacts

        return self._request("POST", f"/api/researches/{task_id}/submit", data)
