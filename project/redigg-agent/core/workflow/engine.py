"""
Workflow 执行引擎
"""

import json
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass
from pathlib import Path
from enum import Enum


class StepStatus(Enum):
    """步骤状态"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class WorkflowStep:
    """Workflow 步骤"""
    id: str = ""
    name: str = ""
    description: str = ""
    skill: str = ""
    params: Dict[str, Any] = None
    status: StepStatus = StepStatus.PENDING
    result: Any = None
    error: Optional[str] = None
    started_at: Optional[float] = None
    completed_at: Optional[float] = None

    def __post_init__(self):
        if self.params is None:
            self.params = {}

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "skill": self.skill,
            "params": self.params,
            "status": self.status.value,
            "result": self.result,
            "error": self.error,
            "started_at": self.started_at,
            "completed_at": self.completed_at
        }


@dataclass
class Workflow:
    """Workflow 定义"""
    id: str = ""
    name: str = ""
    description: str = ""
    type: str = "survey"
    steps: List[WorkflowStep] = None
    variables: Dict[str, Any] = None
    created_at: Optional[float] = None

    def __post_init__(self):
        if self.steps is None:
            self.steps = []
        if self.variables is None:
            self.variables = {}

    @classmethod
    def from_dict(cls, data: dict) -> "Workflow":
        """从字典创建"""
        steps = [WorkflowStep(**step) for step in data.get("steps", [])]
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            description=data.get("description", ""),
            type=data.get("type", "survey"),
            steps=steps,
            variables=data.get("variables", {})
        )


class WorkflowEngine:
    """Workflow 执行引擎"""

    def __init__(self, skill_registry: Optional[Dict[str, Callable]] = None):
        self.skill_registry = skill_registry or {}

    def register_skill(self, skill_name: str, skill_func: Callable):
        """注册 Skill"""
        self.skill_registry[skill_name] = skill_func

    def load_workflow(self, workflow_path: str) -> Workflow:
        """加载 Workflow 定义"""
        path = Path(workflow_path)
        if not path.exists():
            raise FileNotFoundError(f"Workflow not found: {workflow_path}")

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        return Workflow.from_dict(data)

    def execute_step(self, step: WorkflowStep, context: Dict[str, Any]) -> WorkflowStep:
        """执行单个步骤"""
        import time

        step.status = StepStatus.IN_PROGRESS
        step.started_at = time.time()

        try:
            if step.skill in self.skill_registry:
                # 执行注册的 skill
                skill_func = self.skill_registry[step.skill]
                step.result = skill_func(step.params, context)
            else:
                # 模拟执行（占位）
                print(f"⚠️  Skill '{step.skill}' not found, simulating execution...")
                step.result = {"simulated": True, "params": step.params}

            step.status = StepStatus.COMPLETED

        except Exception as e:
            step.status = StepStatus.FAILED
            step.error = str(e)

        step.completed_at = time.time()
        return step

    def execute(self, workflow: Workflow, context: Optional[Dict[str, Any]] = None) -> Workflow:
        """执行完整的 Workflow"""
        if context is None:
            context = {}

        print(f"🚀 Starting workflow: {workflow.name}")
        print(f"📋 Total steps: {len(workflow.steps)}")

        for i, step in enumerate(workflow.steps, 1):
            print(f"\n📍 Step {i}/{len(workflow.steps)}: {step.name}")
            print(f"   Skill: {step.skill}")

            step = self.execute_step(step, context)

            if step.status == StepStatus.COMPLETED:
                print(f"   ✅ Completed")
            elif step.status == StepStatus.FAILED:
                print(f"   ❌ Failed: {step.error}")
                # 可以选择是否继续执行后续步骤
                break

        print(f"\n🏁 Workflow completed")
        return workflow

    def get_summary(self, workflow: Workflow) -> Dict[str, Any]:
        """获取 Workflow 执行摘要"""
        completed = sum(1 for s in workflow.steps if s.status == StepStatus.COMPLETED)
        failed = sum(1 for s in workflow.steps if s.status == StepStatus.FAILED)
        pending = sum(1 for s in workflow.steps if s.status == StepStatus.PENDING)

        return {
            "workflow_id": workflow.id,
            "name": workflow.name,
            "total_steps": len(workflow.steps),
            "completed": completed,
            "failed": failed,
            "pending": pending,
            "status": "completed" if failed == 0 and pending == 0 else "in_progress"
        }
