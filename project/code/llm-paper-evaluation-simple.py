#!/usr/bin/env python3
"""
简化版LLM论文评估 - 只评估终极优化版论文的一个维度
展示LLM评估的专业效果
"""

import sys
import os
from pathlib import Path

# 添加 fin-agent-group 的 models 目录到路径
fin_agent_experiments = Path(__file__).parent.parent.parent / "fin-agent-group" / "experiments"
sys.path.insert(0, str(fin_agent_experiments / "models"))

from llm_client import LLMClient


def evaluate_one_dimension():
    """只评估一个维度，展示LLM评估的效果"""
    
    print("="*80)
    print("🤖 LLM论文评估 - 简化演示版")
    print("="*80)
    
    # 初始化LLM客户端
    print("\n🔄 初始化LLM客户端...")
    client = LLMClient(use_openai=True, use_overseas=False)
    print(f"✅ LLM客户端初始化成功: {client.model}")
    
    # 读取终极优化版论文
    redigg_project_dir = Path(__file__).parent.parent
    paper_path = redigg_project_dir / "ultimate-optimized-paper-2026-03-03.md"
    
    print(f"\n📄 读取论文: {paper_path}")
    with open(paper_path, 'r', encoding='utf-8') as f:
        paper_content = f.read()
    print(f"✅ 论文读取成功，共 {len(paper_content)} 字")
    
    # 只评估"原创性与新颖性"这一个维度
    dimension = "原创性与新颖性"
    print(f"\n🔍 评估维度: {dimension}")
    
    prompt = f"""请作为一个专业的学术审稿人，评估以下论文的原创性与新颖性。

评估标准（1-5分）：
1分 - 没有原创性，完全重复现有工作
2分 - 创新性很低，只有微小的改动
3分 - 有一定的创新性，但贡献有限
4分 - 有明显的创新性，做出了有价值的贡献
5分 - 创新性很强，有重大的原创贡献

请从以下方面评估：
- 论文提出的新想法、新方法、新框架的创新性
- 与现有工作相比的差异化程度
- 贡献的原创性和独特性
- 可能带来的新研究方向

论文内容（前8000字）：
{paper_content[:8000]}...

请按以下格式输出：
评分：X/5
理由：[详细说明理由，至少100字]
亮点：[列出2-3个主要创新点]"""

    system_prompt = "你是一个专业、严格但公正的学术审稿人。请根据提供的评估标准，对论文进行客观、详细的评估。"
    
    print(f"\n🤖 调用LLM进行专业评估...")
    response = client.call(prompt, system_prompt=system_prompt)
    
    if response.success:
        print(f"\n{'='*80}")
        print(f"✅ LLM评估完成！")
        print(f"{'='*80}")
        print(f"\n📊 评估结果：")
        print(f"{'-'*80}")
        print(response.content)
        print(f"{'-'*80}")
    else:
        print(f"\n❌ LLM调用失败: {response.error}")


if __name__ == '__main__':
    evaluate_one_dimension()
