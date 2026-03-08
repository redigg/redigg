#!/usr/bin/env python3
"""
测试 Workflow 执行引擎和 Skill
"""

import sys
from pathlib import Path

# Add the current directory to the path
sys.path.insert(0, str(Path(__file__).parent))

print("🧪 测试 Workflow 执行引擎和 Skill...")
print("=" * 60)

# 测试 1: Workflow 引擎导入
print("\n1️⃣  测试 Workflow 引擎导入...")
try:
    from core.workflow.engine import WorkflowEngine, Workflow, WorkflowStep, StepStatus

    print("   ✅ Workflow 引擎导入成功")

    engine = WorkflowEngine()
    print("   ✅ Workflow 引擎初始化成功")

except Exception as e:
    print(f"   ❌ Workflow 引擎测试失败: {e}")
    import traceback
    traceback.print_exc()

# 测试 2: Literature Review Skill
print("\n2️⃣  测试 Literature Review Skill...")
try:
    from skills.literature_review import literature_review_skill, SKILL_REGISTRY

    print("   ✅ Literature Review Skill 导入成功")
    print(f"   Skill 名称: {SKILL_REGISTRY['name']}")
    print(f"   Skill 描述: {SKILL_REGISTRY['description']}")

    # 注册 skill
    engine.register_skill(SKILL_REGISTRY["name"], SKILL_REGISTRY["function"])
    print("   ✅ Skill 注册成功")

    # 测试 skill 执行
    print("   执行 Skill...")
    result = literature_review_skill(
        params={
            "topic": "large language models",
            "max_papers": 5,
            "categories": ["cs.AI", "cs.LG"]
        },
        context={}
    )

    if result.get("success"):
        print("   ✅ Skill 执行成功")
        res = result["result"]
        print(f"   📄 Papers: {len(res.get('papers', []))}")
        print(f"   🎯 Key findings: {len(res.get('key_findings', []))}")
        print(f"   ❓ Research gaps: {len(res.get('research_gaps', []))}")
    else:
        print("   ❌ Skill 执行失败")

except Exception as e:
    print(f"   ❌ Skill 测试失败: {e}")
    import traceback
    traceback.print_exc()

# 测试 3: 加载 Workflow
print("\n3️⃣  测试加载 Workflow...")
try:
    workflow_path = Path(__file__).parent / "workflows" / "survey_workflow.json"

    if workflow_path.exists():
        workflow = engine.load_workflow(str(workflow_path))
        print("   ✅ Workflow 加载成功")
        print(f"   Workflow 名称: {workflow.name}")
        print(f"   Workflow 类型: {workflow.type}")
        print(f"   步骤数量: {len(workflow.steps)}")

        for i, step in enumerate(workflow.steps, 1):
            print(f"   Step {i}: {step.name} (Skill: {step.skill})")
    else:
        print(f"   ⚠️  Workflow 文件不存在: {workflow_path}")

except Exception as e:
    print(f"   ❌ Workflow 加载测试失败: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("✅ Workflow 和 Skill 测试完成！")
