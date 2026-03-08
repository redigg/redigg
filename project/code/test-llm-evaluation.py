#!/usr/bin/env python3
"""
测试LLM论文评估 - 简化版本
"""

import sys
import os
from pathlib import Path

# 添加路径
script_dir = Path(__file__).parent
experiments_dir = script_dir.parent.parent / "fin-agent-group" / "experiments"

sys.path.insert(0, str(experiments_dir / "models"))

try:
    from llm_client import LLMClient
    print("✅ LLM客户端导入成功！")
    
    # 初始化LLM客户端
    print("\n🔄 初始化LLM客户端...")
    client = LLMClient(use_openai=True, use_overseas=False)
    print(f"✅ LLM客户端初始化成功: {client.model}")
    
    # 测试一个简单的调用
    print("\n🤖 测试LLM调用...")
    response = client.call("请简单介绍一下你自己。")
    
    if response.success:
        print(f"✅ LLM调用成功！")
        print(f"响应: {response.content[:100]}...")
    else:
        print(f"❌ LLM调用失败: {response.error}")
        
except Exception as e:
    print(f"❌ 发生错误: {e}")
    import traceback
    traceback.print_exc()
