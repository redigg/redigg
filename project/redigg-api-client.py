#!/usr/bin/env python3
"""
Redigg API 客户端 - 用于与Redigg平台交互
"""

import requests
import json
from datetime import datetime

class RediggClient:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "https://redigg.com"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def heartbeat(self):
        """发送心跳"""
        try:
            response = requests.post(
                f"{self.base_url}/api/agent/heartbeat",
                headers=self.headers
            )
            return response.json()
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_researches(self):
        """获取可用的研究任务"""
        try:
            response = requests.get(
                f"{self.base_url}/api/researches",
                headers=self.headers
            )
            return response.json()
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def claim_research(self, research_id):
        """认领一个研究任务"""
        try:
            response = requests.post(
                f"{self.base_url}/api/researches/{research_id}/claim",
                headers=self.headers
            )
            return response.json()
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def submit_progress(self, research_id, progress, description, details=None):
        """提交进度"""
        try:
            data = {
                "progress": progress,
                "description": description,
                "details": details or {}
            }
            response = requests.post(
                f"{self.base_url}/api/researches/{research_id}/progress",
                headers=self.headers,
                json=data
            )
            return response.json()
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def submit_result(self, research_id, result, artifacts=None):
        """提交最终结果"""
        try:
            data = {
                "result": result,
                "artifacts": artifacts or []
            }
            response = requests.post(
                f"{self.base_url}/api/researches/{research_id}/submit",
                headers=self.headers,
                json=data
            )
            return response.json()
        except Exception as e:
            return {"success": False, "error": str(e)}


def main():
    """主函数 - 测试Redigg API"""
    # 使用提供的API key
    API_KEY = "sk-redigg-bc6e1c2a8a7540fe9d32f7058a961afa"
    
    print("="*80)
    print("Redigg API 客户端测试")
    print("="*80)
    
    # 创建客户端
    client = RediggClient(API_KEY)
    
    # 1. 发送心跳
    print("\n1. 发送心跳...")
    heartbeat_result = client.heartbeat()
    print(f"   结果: {json.dumps(heartbeat_result, indent=2, ensure_ascii=False)}")
    
    # 2. 获取可用任务
    print("\n2. 获取可用任务...")
    researches_result = client.get_researches()
    print(f"   结果: {json.dumps(researches_result, indent=2, ensure_ascii=False)}")
    
    # 如果有任务，显示详细信息
    if researches_result.get("success") and researches_result.get("data"):
        tasks = researches_result["data"]
        print(f"\n3. 找到 {len(tasks)} 个任务:")
        for i, task in enumerate(tasks, 1):
            print(f"\n   任务 {i}:")
            print(f"      ID: {task.get('id')}")
            print(f"      标题: {task.get('title')}")
            print(f"      状态: {task.get('status')}")
            print(f"      类型: {task.get('type')}")
            print(f"      描述: {task.get('description', '')[:100]}...")
    else:
        print("\n3. 没有找到可用任务")
    
    print("\n" + "="*80)
    print("测试完成")
    print("="*80)


if __name__ == '__main__':
    main()
