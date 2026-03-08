#!/usr/bin/env python3
"""
自动化论文评估脚本
基于我们设计的5个维度进行自动评估
"""

import os
import sys
from datetime import datetime

class PaperEvaluator:
    def __init__(self):
        self.evaluation_dimensions = [
            {
                'name': '原创性与新颖性',
                'english_name': 'Originality & Novelty',
                'weight': 0.25,
                'max_score': 5
            },
            {
                'name': '技术质量与严谨性',
                'english_name': 'Technical Quality & Rigor',
                'weight': 0.25,
                'max_score': 5
            },
            {
                'name': '清晰度与表达',
                'english_name': 'Clarity & Presentation',
                'weight': 0.20,
                'max_score': 5
            },
            {
                'name': '相关性与影响力',
                'english_name': 'Relevance & Impact',
                'weight': 0.15,
                'max_score': 5
            },
            {
                'name': '文献引用与上下文',
                'english_name': 'Citations & Context',
                'weight': 0.15,
                'max_score': 5
            }
        ]

    def evaluate_paper(self, paper_content, paper_title="Untitled Paper"):
        """评估一篇论文"""
        print(f"\n{'='*80}")
        print(f"📄 论文评估: {paper_title}")
        print(f"{'='*80}")
        
        # 简单的基于关键词的启发式评估（实际项目中可以用LLM）
        scores = self._heuristic_evaluate(paper_content)
        
        total_score = 0
        results = []
        
        for i, dim in enumerate(self.evaluation_dimensions):
            score = scores.get(i, 3.0)  # 默认3分
            weighted_score = score * dim['weight']
            total_score += weighted_score
            
            results.append({
                'dimension': dim['name'],
                'english_name': dim['english_name'],
                'score': score,
                'weight': dim['weight'],
                'weighted_score': weighted_score
            })
        
        # 确定等级
        grade = self._get_grade(total_score)
        
        # 打印结果
        self._print_results(results, total_score, grade, paper_title)
        
        return {
            'title': paper_title,
            'scores': results,
            'total_score': total_score,
            'grade': grade,
            'timestamp': datetime.now().isoformat()
        }

    def _heuristic_evaluate(self, content):
        """启发式评估（实际项目中可以替换为LLM评估）"""
        content_lower = content.lower()
        
        scores = {}
        
        # 维度1: 原创性与新颖性
        novelty_keywords = ['novel', 'new', 'innovative', 'first', 'unprecedented', 'breakthrough']
        novelty_count = sum(1 for kw in novelty_keywords if kw in content_lower)
        scores[0] = min(5.0, 2.0 + novelty_count * 0.3)
        
        # 维度2: 技术质量与严谨性
        rigor_keywords = ['method', 'experiment', 'result', 'analysis', 'validation', 'hypothesis']
        rigor_count = sum(1 for kw in rigor_keywords if kw in content_lower)
        scores[1] = min(5.0, 2.0 + rigor_count * 0.2)
        
        # 维度3: 清晰度与表达
        structure_keywords = ['abstract', 'introduction', 'method', 'result', 'discussion', 'conclusion', 'reference']
        structure_count = sum(1 for kw in structure_keywords if kw in content_lower)
        scores[2] = min(5.0, 2.0 + structure_count * 0.3)
        
        # 维度4: 相关性与影响力
        impact_keywords = ['important', 'significant', 'impact', 'contribution', 'benefit', 'value']
        impact_count = sum(1 for kw in impact_keywords if kw in content_lower)
        scores[3] = min(5.0, 2.0 + impact_count * 0.3)
        
        # 维度5: 文献引用与上下文
        citation_keywords = ['cite', 'reference', 'bibliography', 'et al', '202', '201', '200']
        citation_count = sum(1 for kw in citation_keywords if kw in content_lower)
        scores[4] = min(5.0, 2.0 + citation_count * 0.25)
        
        return scores

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
        print(f"\n📊 各维度评分:")
        print(f"{'-'*80}")
        
        for r in results:
            stars = '⭐' * int(round(r['score']))
            print(f"  {r['dimension']} ({r['english_name']}):")
            print(f"    评分: {r['score']:.1f}/5.0  {stars}")
            print(f"    权重: {r['weight']*100:.0f}%")
            print(f"    加权分: {r['weighted_score']:.2f}")
            print()
        
        print(f"{'-'*80}")
        print(f"🎯 综合评分: {total_score:.2f}/5.0")
        print(f"🏆 等级: {grade}")
        print(f"{'-'*80}")

    def compare_papers(self, paper1_path, paper2_path):
        """对比两篇论文"""
        print(f"\n{'='*80}")
        print(f"📊 论文对比评估")
        print(f"{'='*80}")
        
        # 读取论文1
        with open(paper1_path, 'r', encoding='utf-8') as f:
            content1 = f.read()
        title1 = os.path.basename(paper1_path)
        
        # 读取论文2
        with open(paper2_path, 'r', encoding='utf-8') as f:
            content2 = f.read()
        title2 = os.path.basename(paper2_path)
        
        # 评估两篇论文
        result1 = self.evaluate_paper(content1, title1)
        result2 = self.evaluate_paper(content2, title2)
        
        # 打印对比
        print(f"\n{'='*80}")
        print(f"📊 对比汇总")
        print(f"{'='*80}")
        print(f"\n论文 1: {title1}")
        print(f"  综合评分: {result1['total_score']:.2f}/5.0")
        print(f"  等级: {result1['grade']}")
        print(f"\n论文 2: {title2}")
        print(f"  综合评分: {result2['total_score']:.2f}/5.0")
        print(f"  等级: {result2['grade']}")
        
        # 比较
        if result1['total_score'] > result2['total_score']:
            print(f"\n🏆 论文 1 评分更高！")
        elif result2['total_score'] > result1['total_score']:
            print(f"\n🏆 论文 2 评分更高！")
        else:
            print(f"\n🤝 两篇论文评分相同！")
        
        print(f"{'='*80}")
        
        return {
            'paper1': result1,
            'paper2': result2,
            'timestamp': datetime.now().isoformat()
        }


def main():
    """主函数"""
    evaluator = PaperEvaluator()
    
    # 获取论文路径
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    
    paper1_path = os.path.join(project_dir, 'optimized-paper-2026-03-03.md')
    paper2_path = os.path.join(project_dir, 'further-optimized-paper-2026-03-03.md')
    
    print(f"论文 1 路径: {paper1_path}")
    print(f"论文 2 路径: {paper2_path}")
    print(f"论文 1 存在: {os.path.exists(paper1_path)}")
    print(f"论文 2 存在: {os.path.exists(paper2_path)}")
    
    # 对比两篇论文
    evaluator.compare_papers(paper1_path, paper2_path)


if __name__ == '__main__':
    main()
