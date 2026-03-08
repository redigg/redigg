#!/usr/bin/env python3
"""
测试 redigg-agent 基本功能
"""

import sys
from pathlib import Path

# Add the current directory to the path
sys.path.insert(0, str(Path(__file__).parent))

print("🧪 测试 redigg-agent 基本功能...")
print("=" * 60)

# 测试 1: Workspace 模块
print("\n1️⃣  测试 Workspace 模块...")
try:
    from core.workspace.models import Workspace
    from core.workspace.manager import WorkspaceManager

    print("   ✅ Workspace 模块导入成功")

    # 创建测试 workspace
    manager = WorkspaceManager()
    ws = manager.create("Test Workspace")
    print(f"   ✅ Workspace 创建成功: {ws.name} (ID: {ws.id})")

    # 列出 workspaces
    workspaces = manager.list()
    print(f"   ✅ Workspace 列表: {len(workspaces)} 个")

except Exception as e:
    print(f"   ❌ Workspace 模块测试失败: {e}")
    import traceback
    traceback.print_exc()

# 测试 2: Research 模块
print("\n2️⃣  测试 Research 模块...")
try:
    from core.research.models import Research
    from core.research.manager import ResearchManager

    print("   ✅ Research 模块导入成功")

    # 创建测试 research
    manager = ResearchManager()
    res = manager.create(
        title="Test Survey",
        type="survey",
        workspace_id=ws.id if 'ws' in locals() else None
    )
    print(f"   ✅ Research 创建成功: {res.title} (ID: {res.id})")

    # 列出 researches
    researches = manager.list(workspace_id=ws.id if 'ws' in locals() else None)
    print(f"   ✅ Research 列表: {len(researches)} 个")

except Exception as e:
    print(f"   ❌ Research 模块测试失败: {e}")
    import traceback
    traceback.print_exc()

# 测试 3: Version 模块
print("\n3️⃣  测试 Version 模块...")
try:
    from core.version.models import Version
    from core.version.manager import VersionManager

    print("   ✅ Version 模块导入成功")

    if 'res' in locals():
        # 创建测试 version
        manager = VersionManager()
        ver = manager.create(
            research_id=res.id,
            context={"step": "initial", "notes": "测试版本"},
            description="初始版本"
        )
        print(f"   ✅ Version 创建成功: {ver.version} (ID: {ver.id})")

        # 列出 versions
        versions = manager.list(research_id=res.id)
        print(f"   ✅ Version 列表: {len(versions)} 个")
    else:
        print("   ⚠️  跳过（需要先创建 Research）")

except Exception as e:
    print(f"   ❌ Version 模块测试失败: {e}")
    import traceback
    traceback.print_exc()

# 测试 4: Review 模块
print("\n4️⃣  测试 Review 模块...")
try:
    from core.review.models import Review
    from core.review.manager import ReviewManager

    print("   ✅ Review 模块导入成功")

    if 'ver' in locals():
        # 创建自动 review
        manager = ReviewManager()
        review = manager.create_automatic_review(
            version_id=ver.id,
            research_id=res.id if 'res' in locals() else None
        )
        print(f"   ✅ 自动 Review 创建成功 (ID: {review.id})")

        # 列出 reviews
        reviews = manager.list(
            version_id=ver.id,
            research_id=res.id if 'res' in locals() else None
        )
        print(f"   ✅ Review 列表: {len(reviews)} 个")
    else:
        print("   ⚠️  跳过（需要先创建 Version）")

except Exception as e:
    print(f"   ❌ Review 模块测试失败: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("✅ 测试完成！")
print("\n💡 下一步: 可以安装并测试 CLI")
print("   cd redigg-agent")
print("   pip install -e .")
print("   redigg-agent --help")
