#!/usr/bin/env python3
"""
LLM驱动的论文评估脚本 V2 - 完整5维度评估
使用真实的LLM来评估论文的各个维度
"""

import sys
import os
import json
from datetime import datetime
from pathlib import Path

# 添加 fin-agent-group 的 models 目录到路径
fin_agent_experiments = Path("/root/.openclaw/workspace/groups/fin-agent-group/experiments")
sys.path.insert(0, str(fin_agent_experiments))

try:
    from models.llm_client import LLMClient
    LLM_AVAILABLE = True
    print("✅ LLM客户端导入成功！")
except ImportError as e:
    print(f"⚠️  从 models.llm_client 导入失败: {e}")
    print("尝试直接导入...")
    
    try:
        sys.path.insert(0, str(fin_agent_experiments / "models"))
        from llm_client import LLMClient
        LLM_AVAILABLE = True
        print("✅ LLM客户端导入成功！")
    except ImportError as e2:
        print(f"⚠️  LLM客户端不可用: {e2}，将使用模拟评估")
        LLM_AVAILABLE = False


class LLMPaperEvaluator:
    def __init__(self):
        self.evaluation_dimensions = [
            {
                'name': '原创性与新颖性',
                'english_name': 'Originality & Novelty',
                'weight': 0.25,
                'max_score': 5,
                'description': '评估论文的创新程度、新颖性和原创贡献'
            },
            {
                'name': '技术质量与严谨性',
                'english_name': 'Technical Quality & Rigor',
                'weight': 0.25,
                'max_score': 5,
                'description': '评估方法论的严谨性、实验设计的质量、分析的深度'
            },
            {
                'name': '清晰度与表达',
                'english_name': 'Clarity & Presentation',
                'weight': 0.20,
                'max_score': 5,
                'description': '评估论文结构的清晰度、表达的逻辑性、写作质量'
            },
            {
                'name': '相关性与影响力',
                'english_name': 'Relevance & Impact',
                'weight': 0.15,
                'max_score': 5,
                'description': '评估论文的实际相关性、潜在影响力、贡献的重要性'
            },
            {
                'name': '文献引用与上下文',
                'english_name': 'Citations & Context',
                'weight': 0.15,
                'max_score': 5,
                'description': '评估文献引用的质量、与现有工作的关系定位、上下文完整性'
            }
        ]
        
        # 初始化LLM客户端
        self.llm_client = None
        if LLM_AVAILABLE:
            try:
                print("\n🔄 初始化LLM客户端...")
                self.llm_client = LLMClient(use_openai=True, use_overseas=False)
                print(f"✅ LLM客户端初始化成功: {self.llm_client.model}")
            except Exception as e:
                print(f"⚠️  LLM客户端初始化失败: {e}")
                import traceback
                traceback.print_exc()
                print("将使用模拟评估模式")

    def _get_evaluation_prompt(self, dimension, paper_content):
        """为特定维度生成评估提示词"""
        
        prompts = {
            '原创性与新颖性': f"""请作为一个专业的学术审稿人，评估以下论文的原创性与新颖性。

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
亮点：[列出2-3个主要创新点]""",

            '技术质量与严谨性': f"""请作为一个专业的学术审稿人，评估以下论文的技术质量与严谨性。

评估标准（1-5分）：
1分 - 方法论有严重缺陷，实验设计不科学
2分 - 技术质量较低，严谨性不足
3分 - 技术质量一般，基本的严谨性
4分 - 技术质量较高，方法论严谨
5分 - 技术质量很高，方法论非常严谨，实验设计科学

请从以下方面评估：
- 实验设计的科学性和完整性
- 方法论的严谨性和正确性
- 统计分析的合理性
- 验证和测试的充分性
- 结果分析的深度和逻辑性

论文内容（前8000字）：
{paper_content[:8000]}...

请按以下格式输出：
评分：X/5
理由：[详细说明理由，至少100字]
亮点：[列出2-3个技术亮点]""",

            '清晰度与表达': f"""请作为一个专业的学术审稿人，评估以下论文的清晰度与表达。

评估标准（1-5分）：
1分 - 结构混乱，表达不清，难以理解
2分 - 清晰度较低，表达有较多问题
3分 - 清晰度一般，基本可以理解
4分 - 清晰度较高，表达流畅
5分 - 清晰度很高，结构完美，表达优秀

请从以下方面评估：
- 论文结构的逻辑性和完整性
- 各部分组织的清晰度
- 语言表达的流畅性和准确性
- 图表和表格的质量（如果有）
- 整体可读性

论文内容（前8000字）：
{paper_content[:8000]}...

请按以下格式输出：
评分：X/5
理由：[详细说明理由，至少100字]
亮点：[列出2-3个表达亮点]""",

            '相关性与影响力': f"""请作为一个专业的学术审稿人，评估以下论文的相关性与影响力。

评估标准（1-5分）：
1分 - 没有实际相关性，影响力很小
2分 - 相关性较低，影响力有限
3分 - 有一定的相关性和潜在影响力
4分 - 相关性较高，有明显的潜在影响力
5分 - 相关性很强，可能产生重大影响

请从以下方面评估：
- 问题的实际重要性和相关性
- 对研究领域的潜在贡献
- 实际应用价值
- 可能带来的影响范围
- 对未来研究的启发

论文内容（前8000字）：
{paper_content[:8000]}...

请按以下格式输出：
评分：X/5
理由：[详细说明理由，至少100字]
亮点：[列出2-3个潜在影响]""",

            '文献引用与上下文': f"""请作为一个专业的学术审稿人，评估以下论文的文献引用与上下文。

评估标准（1-5分）：
1分 - 文献引用严重不足，与现有工作关系定位错误
2分 - 文献引用较少，上下文不完整
3分 - 文献引用基本足够，上下文一般
4分 - 文献引用较好，上下文较完整
5分 - 文献引用优秀，与现有工作关系定位准确，上下文完整

请从以下方面评估：
- 文献引用的充分性和相关性
- 与现有工作的关系定位是否准确
- 对相关工作的综述质量
- 参考文献的质量和时效性
- 研究的上下文完整性

论文内容（前8000字）：
{paper_content[:8000]}...

请按以下格式输出：
评分：X/5
理由：[详细说明理由，至少100字]
亮点：[列出2-3个文献综述亮点]"""
        }
        
        return prompts.get(dimension, "")

    def _parse_llm_response(self, response):
        """解析LLM的评估响应"""
        try:
            # 尝试从响应中提取评分
            lines = response.strip().split('\n')
            score = None
            reason = ""
            
            for line in lines:
                if '评分：' in line or '评分:' in line:
                    # 提取评分
                    import re
                    score_match = re.search(r'(\d+(\.\d+)?)/5', line)
                    if score_match:
                        score = float(score_match.group(1))
                elif '理由：' in line or '理由:' in line:
                    # 开始收集理由
                    reason = line.split('：', 1)[-1].split(':', 1)[-1].strip()
                elif reason and not line.startswith('亮点：') and not line.startswith('亮点:'):
                    # 继续收集理由
                    reason += '\n' + line.strip()
            
            if score is None:
                # 如果没找到评分，尝试用fallback
                score = 3.0
            
            return {
                'score': score,
                'reason': reason.strip() if reason else "未提供详细理由"
            }
        except Exception as e:
            print(f"⚠️  解析LLM响应失败: {e}")
            return {
                'score': 3.0,
                'reason': "解析失败，使用默认评分"
            }

    def evaluate_paper(self, paper_content, paper_title="Untitled Paper"):
        """评估一篇论文"""
        print(f"\n{'='*80}")
        print(f"📄 LLM论文评估: {paper_title}")
        print(f"{'='*80}")
        
        total_score = 0
        results = []
        
        for dim in self.evaluation_dimensions:
            print(f"\n🔍 评估维度: {dim['name']} ({dim['english_name']})")
            
            if self.llm_client:
                # 使用LLM评估
                prompt = self._get_evaluation_prompt(dim['name'], paper_content)
                system_prompt = "你是一个专业、严格但公正的学术审稿人。请根据提供的评估标准，对论文进行客观、详细的评估。"
                
                print(f"   🤖 调用LLM进行评估...")
                response = self.llm_client.call(prompt, system_prompt=system_prompt)
                
                if response.success:
                    eval_result = self._parse_llm_response(response.content)
                else:
                    print(f"   ⚠️  LLM调用失败: {response.error}")
                    eval_result = {'score': 3.0, 'reason': "LLM调用失败，使用默认评分"}
            else:
                # LLM不可用，使用模拟评估
                eval_result = self._heuristic_evaluate(paper_content, dim['name'])
            
            score = eval_result['score']
            weighted_score = score * dim['weight']
            total_score += weighted_score
            
            results.append({
                'dimension': dim['name'],
                'english_name': dim['english_name'],
                'score': score,
                'weight': dim['weight'],
                'weighted_score': weighted_score,
                'reason': eval_result['reason']
            })
            
            stars = '⭐' * int(round(score))
            print(f"   评分: {score:.1f}/5.0  {stars}")
            print(f"   加权分: {weighted_score:.2f}")
            if eval_result['reason']:
                print(f"   理由: {eval_result['reason'][:150]}...")
        
        # 确定等级
        grade = self._get_grade(total_score)
        
        # 打印结果
        self._print_results(results, total_score, grade, paper_title)
        
        # 保存结果
        self._save_results(results, total_score, grade, paper_title)
        
        return {
            'title': paper_title,
            'scores': results,
            'total_score': total_score,
            'grade': grade,
            'timestamp': datetime.now().isoformat(),
            'evaluation_method': 'LLM' if self.llm_client else 'Heuristic'
        }

    def _heuristic_evaluate(self, paper_content, dimension):
        """启发式评估（fallback）"""
        content_lower = paper_content.lower()
        
        # 简单的启发式规则
        dimension_index = [d['name'] for d in self.evaluation_dimensions].index(dimension)
        
        # 基于关键词计数的基础评分
        keyword_sets = {
            '原创性与新颖性': ['novel', 'new', 'innovative', 'first', 'unprecedented', 'breakthrough', 'paradigm'],
            '技术质量与严谨性': ['method', 'experiment', 'result', 'analysis', 'validation', 'hypothesis', 'statistical', 'significance'],
            '清晰度与表达': ['abstract', 'introduction', 'method', 'result', 'discussion', 'conclusion', 'reference'],
            '相关性与影响力': ['important', 'significant', 'impact', 'contribution', 'benefit', 'value', 'practical', 'real-world'],
            '文献引用与上下文': ['cite', 'reference', 'bibliography', 'et al', '202', '201', '200', 'arxiv', 'doi', 'proceedings']
        }
        
        keywords = keyword_sets.get(dimension, [])
        count = sum(1 for kw in keywords if kw in content_lower)
        
        # 基础评分 2.0-4.0
        base_score = 2.0 + min(2.0, count * 0.18)
        
        return {
            'score': base_score,
            'reason': f"启发式评估（关键词匹配：{count}个）"
        }

    def _get_grade(self, total_score):
        """根据总分确定等级"""
        if total_score >= 4.5:
            return 'A (Excellent)'
        elif total_score >= 3.5:
            return 'B (Good)'
        elif total_score >= 2.5:
            return 'C (Fair)'
        elif total_score >= 1.5:
            return 'D (Poor)'
        else:
            return 'F (Fail)'

    def _print_results(self, results, total_score, grade, paper_title):
        """打印评估结果"""
        print(f"\n{'='*80}")
        print(f"📊 各维度评分详情:")
        print(f"{'-'*80}")
        
        for r in results:
            stars = '⭐' * int(round(r['score']))
            print(f"\n  📌 {r['dimension']} ({r['english_name']}):")
            print(f"     评分: {r['score']:.1f}/5.0  {stars}")
            print(f"     权重: {r['weight']*100:.0f}%")
            print(f"     加权分: {r['weighted_score']:.2f}")
            if r.get('reason'):
                print(f"     理由: {r['reason']}")
        
        print(f"\n{'='*80}")
        print(f"🎯 综合评分: {total_score:.2f}/5.0")
        print(f"🏆 等级: {grade}")
        print(f"{'='*80}")

    def _save_results(self, results, total_score, grade, paper_title):
        """保存评估结果到文件"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = Path(__file__).parent.parent / f"evaluation-results-{timestamp}.json"
        
        output_data = {
            'timestamp': datetime.now().isoformat(),
            'paper_title': paper_title,
            'total_score': total_score,
            'grade': grade,
            'results': results,
            'evaluation_method': 'LLM' if self.llm_client else 'Heuristic'
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        print(f"\n💾 评估结果已保存: {output_file}")


def main():
    """主函数"""
    evaluator = LLMPaperEvaluator()
    
    # 获取论文路径
    script_dir = Path(__file__).parent
    redigg_project_dir = script_dir.parent
    
    # 支持命令行参数
    import sys
    if len(sys.argv) > 1:
        paper_path = Path(sys.argv[1])
    else:
        # 默认使用模拟的经典论文
        paper_path = redigg_project_dir / "sample-classic-paper.md"
    
    # 检查文件存在性
    print(f"论文路径: {paper_path}")
    print(f"论文存在: {os.path.exists(paper_path)}")
    
    if os.path.exists(paper_path):
        # 读取论文
        with open(paper_path, 'r', encoding='utf-8') as f:
            paper_content = f.read()
        
        title = os.path.basename(paper_path)
        
        # 评估论文
        evaluator.evaluate_paper(paper_content, title)
    else:
        print("⚠️  没有找到有效的论文文件")
        print(f"用法: python3 llm-paper-evaluation-v2.py [论文路径]")


if __name__ == '__main__':
    main()
