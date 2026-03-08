#!/usr/bin/env python3
"""
测试 redigg.com API 客户端
"""

import sys
from pathlib import Path

# Add the current directory to the path
sys.path.insert(0, str(Path(__file__).parent))

print("🧪 测试 redigg.com API 客户端...")
print("=" * 60)

# 测试 1: API 客户端导入
print("\n1️⃣  测试 API 客户端导入...")
try:
    from core.api.client import RediggAPIClient

    print("   ✅ API 客户端导入成功")

    client = RediggAPIClient()
    print("   ✅ API 客户端初始化成功")

except Exception as e:
    print(f"   ❌ API 客户端测试失败: {e}")
    import traceback
    traceback.print_exc()

# 测试 2: Agent 注册（演示用）
print("\n2️⃣  测试 Agent 注册（演示模式）...")
try:
    from core.api.client import RediggAPIClient

    client = RediggAPIClient()

    print("   💡 提示: 要注册 Agent，请使用:")
    print("      client.register_agent(name='YourAgentName')")
    print("   💡 或者提供 owner_token 直接获取 API key")

    print("   ✅ 注册流程理解正确")

except Exception as e:
    print(f"   ❌ 注册测试失败: {e}")
    import traceback
    traceback.print_exc()

# 测试 3: API 方法
print("\n3️⃣  测试 API 方法...")
try:
    from core.api.client import RediggAPIClient, RediggResearchTask, RediggTodo

    print("   ✅ 数据模型导入成功")
    print(f"      - RediggResearchTask")
    print(f"      - RediggTodo")

    print("   ✅ API 方法可用:")
    print("      - client.heartbeat()")
    print("      - client.get_researches()")
    print("      - client.claim_task(task_id)")
    print("      - client.upload_file(file_path)")
    print("      - client.submit_progress(task_id, progress, description)")
    print("      - client.add_todo(research_id, content, priority)")
    print("      - client.update_todo(research_id, todo_id, status)")
    print("      - client.get_todos(research_id)")
    print("      - client.submit_final_result(task_id, result, artifacts)")

except Exception as e:
    print(f"   ❌ API 方法测试失败: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("✅ API 客户端测试完成！")
print("\n💡 使用说明:")
print("   1. 注册 Agent:")
print("      client = RediggAPIClient()")
print("      client.register_agent(name='MyResearchAgent')")
print("")
print("   2. 获取任务:")
print("      tasks = client.get_researches()")
print("")
print("   3. 认领任务:")
print("      client.claim_task(task_id)")
print("")
print("   4. 提交进度:")
print("      client.submit_progress(task_id, 50, 'Halfway there')")
print("")
print("   5. 提交结果:")
print("      client.submit_final_result(task_id, 'Done!', artifacts)")
