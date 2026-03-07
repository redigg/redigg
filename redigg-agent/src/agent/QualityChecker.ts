/**
 * QualityChecker - 质量检查与自反思模块
 * 
 * 负责在任务执行的每个步骤后进行质量验证
 * 支持迭代改进和自动重试
 * 参考：Anthropic self-reflection、LLM-as-judge
 * 
 * @module QualityChecker
 */

import { LLMClient } from '../llm/LLMClient';
import { TaskStep } from './TaskPlanner';

/**
 * 质量检查类型
 */
export type CheckType = 
  | 'completeness'    // 完整性
  | 'accuracy'        // 准确性
  | 'relevance'       // 相关性
  | 'format'          // 格式正确性
  | 'consistency'     // 一致性
  | 'citation_quality'; // 引用质量（科研场景专用）

/**
 * 质量检查标准
 */
export interface QualityCriterion {
  /** 标准名称 */
  name: string;
  /** 标准描述 */
  description: string;
  /** 检查类型 */
  checkType: CheckType;
  /** 通过阈值（0-1） */
  threshold: number;
  /** 权重（用于综合评分） */
  weight?: number;
  /** 领域特定参数 */
  domainParams?: Record<string, any>;
}

/**
 * 单项质量检查结果
 */
export interface CriterionResult {
  /** 标准名称 */
  name: string;
  /** 得分（0-1） */
  score: number;
  /** 是否通过 */
  passed: boolean;
  /** 详细反馈 */
  feedback: string;
  /** 改进建议 */
  suggestions?: string[];
}

/**
 * 质量检查结果
 */
export interface QualityCheck {
  /** 关联的步骤 ID */
  stepId: string;
  /** 所有标准的检查结果 */
  criteria: CriterionResult[];
  /** 是否全部通过 */
  passed: boolean;
  /** 综合得分（0-1） */
  overallScore: number;
  /** 总体反馈 */
  feedback: string;
  /** 建议的操作 */
  suggestedAction: QualityAction;
  /** 检查时间戳 */
  timestamp: number;
}

/**
 * 建议的操作类型
 */
export type QualityAction = 
  | 'accept'              // 接受，继续下一步
  | 'retry'               // 重试当前步骤
  | 'adjust_and_retry'    // 调整后重试
  | 'escalate'            // 升级处理（需要人工干预）
  | 'skip';               // 跳过（如果是可选步骤）

/**
 * 质量检查配置
 */
export interface QualityCheckConfig {
  /** 是否启用 LLM-as-judge */
  enableLLMJudge: boolean;
  /** 是否启用自动重试 */
  enableAutoRetry: boolean;
  /** 最大重试次数 */
  maxRetries: number;
  /** 是否记录详细日志 */
  verboseLogging: boolean;
  /** 领域特定配置 */
  domainConfig?: DomainConfig;
}

/**
 * 领域特定配置
 */
export interface DomainConfig {
  /** 科研场景配置 */
  research?: {
    /** 最小引用数量 */
    minCitations: number;
    /** 要求近 5 年文献比例 */
    recentPaperRatio: number;
    /** 要求顶级会议/期刊 */
    requireTopVenue: boolean;
  };
  /** 代码场景配置 */
  code?: {
    /** 要求单元测试 */
    requireTests: boolean;
    /** 要求类型注解 */
    requireTypeAnnotations: boolean;
  };
}

/**
 * 默认质量标准 - 文献综述场景
 */
const LITERATURE_REVIEW_CRITERIA: QualityCriterion[] = [
  {
    name: '覆盖率',
    description: '是否覆盖了关键论文和重要研究方向',
    checkType: 'completeness',
    threshold: 0.8,
    weight: 0.25,
    domainParams: { minCitations: 20 }
  },
  {
    name: '准确性',
    description: '论文信息、引用、总结是否准确',
    checkType: 'accuracy',
    threshold: 0.9,
    weight: 0.25
  },
  {
    name: '相关性',
    description: '内容是否与用户研究问题相关',
    checkType: 'relevance',
    threshold: 0.85,
    weight: 0.2
  },
  {
    name: '结构完整性',
    description: '综述结构是否清晰、逻辑是否连贯',
    checkType: 'format',
    threshold: 0.8,
    weight: 0.15
  },
  {
    name: '引用质量',
    description: '引用是否规范、是否包含关键文献',
    checkType: 'citation_quality',
    threshold: 0.85,
    weight: 0.15,
    domainParams: { recentPaperRatio: 0.5 }
  }
];

/**
 * 默认质量标准 - 实验设计场景
 */
const EXPERIMENT_DESIGN_CRITERIA: QualityCriterion[] = [
  {
    name: '问题明确性',
    description: '研究问题是否清晰、可验证',
    checkType: 'clarity',
    threshold: 0.9,
    weight: 0.2
  },
  {
    name: '方法适当性',
    description: '实验方法是否适合回答研究问题',
    checkType: 'relevance',
    threshold: 0.85,
    weight: 0.25
  },
  {
    name: '可复现性',
    description: '实验步骤是否详细、可复现',
    checkType: 'completeness',
    threshold: 0.9,
    weight: 0.25
  },
  {
    name: '控制变量',
    description: '是否考虑了适当的控制变量',
    checkType: 'accuracy',
    threshold: 0.8,
    weight: 0.15
  },
  {
    name: '伦理合规',
    description: '是否符合研究伦理要求',
    checkType: 'consistency',
    threshold: 0.95,
    weight: 0.15
  }
];

/**
 * 默认质量标准 - 数据分析场景
 */
const DATA_ANALYSIS_CRITERIA: QualityCriterion[] = [
  {
    name: '数据完整性',
    description: '数据加载是否完整、无缺失',
    checkType: 'completeness',
    threshold: 0.9,
    weight: 0.2
  },
  {
    name: '分析正确性',
    description: '统计方法使用是否正确',
    checkType: 'accuracy',
    threshold: 0.9,
    weight: 0.3
  },
  {
    name: '结果解释',
    description: '结果解释是否合理、有洞察',
    checkType: 'relevance',
    threshold: 0.85,
    weight: 0.25
  },
  {
    name: '可视化质量',
    description: '图表是否清晰、信息丰富',
    checkType: 'format',
    threshold: 0.8,
    weight: 0.15
  },
  {
    name: '代码质量',
    description: '分析代码是否规范、可复现',
    checkType: 'consistency',
    threshold: 0.85,
    weight: 0.1
  }
];

/**
 * 默认质量标准 - 论文写作场景
 */
const PAPER_WRITING_CRITERIA: QualityCriterion[] = [
  {
    name: '结构完整性',
    description: '论文结构是否符合学术规范',
    checkType: 'format',
    threshold: 0.9,
    weight: 0.2
  },
  {
    name: '论证逻辑',
    description: '论证是否清晰、逻辑是否连贯',
    checkType: 'consistency',
    threshold: 0.85,
    weight: 0.25
  },
  {
    name: '语言质量',
    description: '语言表达是否准确、流畅',
    checkType: 'accuracy',
    threshold: 0.85,
    weight: 0.2
  },
  {
    name: '引用规范',
    description: '引用格式是否规范、完整',
    checkType: 'citation_quality',
    threshold: 0.9,
    weight: 0.2
  },
  {
    name: '创新性表达',
    description: '是否清晰表达了创新贡献',
    checkType: 'relevance',
    threshold: 0.8,
    weight: 0.15
  }
];

/**
 * QualityChecker 类
 * 
 * 质量检查与自反思核心实现
 */
export class QualityChecker {
  private llmClient: LLMClient;
  private config: QualityCheckConfig;
  private criteriaCache: Map<string, QualityCriterion[]>;

  constructor(llmClient: LLMClient, config?: Partial<QualityCheckConfig>) {
    this.llmClient = llmClient;
    this.config = {
      enableLLMJudge: true,
      enableAutoRetry: true,
      maxRetries: 3,
      verboseLogging: true,
      ...config
    };
    this.criteriaCache = new Map();
    this.initializeCriteriaCache();
  }

  /**
   * 初始化质量标准缓存
   */
  private initializeCriteriaCache(): void {
    this.criteriaCache.set('literature_review', LITERATURE_REVIEW_CRITERIA);
    this.criteriaCache.set('experiment_design', EXPERIMENT_DESIGN_CRITERIA);
    this.criteriaCache.set('data_analysis', DATA_ANALYSIS_CRITERIA);
    this.criteriaCache.set('paper_writing', PAPER_WRITING_CRITERIA);
  }

  /**
   * 主函数：检查步骤结果质量
   * 
   * @param step 任务步骤（包含输出）
   * @param taskType 任务类型
   * @param customCriteria 自定义标准（可选）
   * @returns 质量检查结果
   */
  async check(
    step: TaskStep,
    taskType: string,
    customCriteria?: QualityCriterion[]
  ): Promise<QualityCheck> {
    const startTime = Date.now();

    // 1. 获取质量标准
    const criteria = customCriteria || this.getCriteriaForTaskType(taskType);

    // 2. 执行各项检查
    const criterionResults: CriterionResult[] = [];
    for (const criterion of criteria) {
      const result = await this.evaluateCriterion(step, criterion);
      criterionResults.push(result);
    }

    // 3. 计算综合得分
    const overallScore = this.calculateOverallScore(criterionResults);

    // 4. 判断是否通过
    const passed = criterionResults.every(r => r.passed);

    // 5. 生成总体反馈
    const feedback = this.generateOverallFeedback(criterionResults, overallScore);

    // 6. 确定建议操作
    const suggestedAction = this.determineAction(passed, step, overallScore);

    const qualityCheck: QualityCheck = {
      stepId: step.stepId,
      criteria: criterionResults,
      passed,
      overallScore,
      feedback,
      suggestedAction,
      timestamp: startTime
    };

    // 7. 记录日志（如果启用）
    if (this.config.verboseLogging) {
      this.logQualityCheck(qualityCheck);
    }

    return qualityCheck;
  }

  /**
   * 获取任务类型对应的质量标准
   * 
   * @param taskType 任务类型
   * @returns 质量标准列表
   */
  getCriteriaForTaskType(taskType: string): QualityCriterion[] {
    return this.criteriaCache.get(taskType) || LITERATURE_REVIEW_CRITERIA;
  }

  /**
   * 评估单项标准
   * 
   * @param step 任务步骤
   * @param criterion 质量标准
   * @returns 检查结果
   */
  private async evaluateCriterion(
    step: TaskStep,
    criterion: QualityCriterion
  ): Promise<CriterionResult> {
    // 如果禁用 LLM Judge，使用规则检查
    if (!this.config.enableLLMJudge) {
      return this.ruleBasedCheck(step, criterion);
    }

    // 使用 LLM-as-judge
    return await this.llmJudgeCheck(step, criterion);
  }

  /**
   * LLM-as-judge 检查
   * 
   * @param step 任务步骤
   * @param criterion 质量标准
   * @returns 检查结果
   */
  private async llmJudgeCheck(
    step: TaskStep,
    criterion: QualityCriterion
  ): Promise<CriterionResult> {
    const prompt = this.buildJudgePrompt(step, criterion);

    try {
      const response = await this.llmClient.generate(prompt, {
        maxTokens: 500,
        temperature: 0.1
      });

      // 解析 LLM 响应
      const result = this.parseJudgeResponse(response.text, criterion);
      return result;
    } catch (error) {
      console.error(`LLM judge failed for ${criterion.name}:`, error);
      // 降级到规则检查
      return this.ruleBasedCheck(step, criterion);
    }
  }

  /**
   * 构建 LLM Judge 提示词
   * 
   * @param step 任务步骤
   * @param criterion 质量标准
   * @returns 提示词
   */
  private buildJudgePrompt(step: TaskStep, criterion: QualityCriterion): string {
    const outputPreview = JSON.stringify(step.output, null, 2).slice(0, 2000);

    return `
你是一位严格的学术质量评估专家。请评估以下任务输出的质量。

## 评估标准
**标准名称**: ${criterion.name}
**标准描述**: ${criterion.description}
**检查类型**: ${criterion.checkType}
**通过阈值**: ${criterion.threshold} (0-1 之间的分数)

## 任务输出
${outputPreview}

## 评估要求
1. 仔细分析输出内容
2. 根据评估标准打分（0-1 之间，保留 2 位小数）
3. 提供具体的反馈意见
4. 如果分数低于阈值，提供改进建议

## 输出格式
请严格按照以下 JSON 格式输出：
{
  "score": 0.85,
  "passed": true,
  "feedback": "具体的评估反馈...",
  "suggestions": ["改进建议 1", "改进建议 2"]
}

只输出 JSON，不要其他内容。
`.trim();
  }

  /**
   * 解析 LLM Judge 响应
   * 
   * @param response LLM 响应文本
   * @param criterion 质量标准
   * @returns 检查结果
   */
  private parseJudgeResponse(
    response: string,
    criterion: QualityCriterion
  ): CriterionResult {
    try {
      // 尝试提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        name: criterion.name,
        score: Math.min(1, Math.max(0, parsed.score || 0)),
        passed: (parsed.score || 0) >= criterion.threshold,
        feedback: parsed.feedback || '评估完成',
        suggestions: parsed.suggestions || []
      };
    } catch (error) {
      console.error('Failed to parse judge response:', error);
      // 返回保守评估
      return {
        name: criterion.name,
        score: 0.5,
        passed: false,
        feedback: '无法解析评估结果，建议人工检查',
        suggestions: ['手动验证输出质量']
      };
    }
  }

  /**
   * 规则基础检查（LLM 不可用时的降级方案）
   * 
   * @param step 任务步骤
   * @param criterion 质量标准
   * @returns 检查结果
   */
  private ruleBasedCheck(
    step: TaskStep,
    criterion: QualityCriterion
  ): CriterionResult {
    // 简单的规则检查逻辑
    let score = 0.5;
    const feedback: string[] = [];

    // 检查输出是否存在
    if (!step.output) {
      score = 0;
      feedback.push('输出为空');
    } else {
      // 根据检查类型进行简单规则判断
      switch (criterion.checkType) {
        case 'completeness':
          // 检查输出是否包含必要字段
          if (Object.keys(step.output).length > 0) {
            score = 0.8;
            feedback.push('输出包含数据');
          }
          break;
        case 'format':
          // 检查输出格式
          score = 0.7;
          feedback.push('格式基本正确');
          break;
        default:
          score = 0.6;
          feedback.push('通过基础检查');
      }
    }

    return {
      name: criterion.name,
      score,
      passed: score >= criterion.threshold,
      feedback: feedback.join('; '),
      suggestions: score < criterion.threshold ? ['建议启用 LLM Judge 进行详细评估'] : []
    };
  }

  /**
   * 计算综合得分
   * 
   * @param results 各项检查结果
   * @returns 综合得分
   */
  private calculateOverallScore(results: CriterionResult[]): number {
    if (results.length === 0) return 0;

    let totalWeight = 0;
    let weightedSum = 0;

    for (const result of results) {
      const weight = this.getWeightForResult(result);
      weightedSum += result.score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * 获取检查结果的权重
   * 
   * @param result 检查结果
   * @returns 权重
   */
  private getWeightForResult(result: CriterionResult): number {
    // 从原始标准中获取权重，默认 1
    const defaultWeight = 1;
    
    // 这里可以根据需要动态调整权重
    // 例如：某些关键标准的权重更高
    
    return defaultWeight;
  }

  /**
   * 生成总体反馈
   * 
   * @param results 各项检查结果
   * @param overallScore 综合得分
   * @returns 总体反馈
   */
  private generateOverallFeedback(
    results: CriterionResult[],
    overallScore: number
  ): string {
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;

    const summary = `质量评估完成：${passedCount}/${totalCount} 项标准通过，综合得分 ${overallScore.toFixed(2)}`;

    const failedCriteria = results.filter(r => !r.passed);
    if (failedCriteria.length > 0) {
      const failedNames = failedCriteria.map(r => r.name).join('、');
      return `${summary}。未通过项：${failedNames}。建议：${failedCriteria[0].suggestions?.[0] || '请检查相关输出'}`;
    }

    return `${summary}。输出质量良好，可以继续。`;
  }

  /**
   * 确定建议操作
   * 
   * @param passed 是否通过
   * @param step 任务步骤
   * @param overallScore 综合得分
   * @returns 建议操作
   */
  private determineAction(
    passed: boolean,
    step: TaskStep,
    overallScore: number
  ): QualityAction {
    if (passed) {
      return 'accept';
    }

    // 如果分数接近阈值，建议调整后重试
    if (overallScore >= 0.6) {
      return 'adjust_and_retry';
    }

    // 如果分数很低，检查是否可以重试
    if (step.retryCount < (this.config.maxRetries || 3)) {
      return 'retry';
    }

    // 超过最大重试次数，建议升级处理
    return 'escalate';
  }

  /**
   * 记录质量检查日志
   * 
   * @param check 质量检查结果
   */
  private logQualityCheck(check: QualityCheck): void {
    const status = check.passed ? '✅' : '❌';
    console.log(`[${status}] QualityCheck for ${check.stepId}: ${check.overallScore.toFixed(2)} - ${check.suggestedAction}`);
    
    if (!check.passed) {
      const failed = check.criteria.filter(c => !c.passed);
      console.log(`  未通过项：${failed.map(c => c.name).join(', ')}`);
    }
  }

  /**
   * 批量检查多个步骤
   * 
   * @param steps 步骤列表
   * @param taskType 任务类型
   * @returns 检查结果列表
   */
  async batchCheck(
    steps: TaskStep[],
    taskType: string
  ): Promise<QualityCheck[]> {
    const checks: QualityCheck[] = [];

    for (const step of steps) {
      if (step.output) {
        const check = await this.check(step, taskType);
        checks.push(check);
      }
    }

    return checks;
  }

  /**
   * 生成质量报告
   * 
   * @param checks 检查结果列表
   * @returns 质量报告
   */
  generateQualityReport(checks: QualityCheck[]): string {
    const totalChecks = checks.length;
    const passedChecks = checks.filter(c => c.passed).length;
    const avgScore = checks.reduce((sum, c) => sum + c.overallScore, 0) / totalChecks;

    const report = `
## 质量检查报告

**总检查数**: ${totalChecks}
**通过数**: ${passedChecks}
**通过率**: ${(passedChecks / totalChecks * 100).toFixed(1)}%
**平均得分**: ${avgScore.toFixed(2)}

### 详细结果
${checks.map(c => `
- **${c.stepId}**: ${c.passed ? '✅' : '❌'} ${c.overallScore.toFixed(2)}
  ${c.feedback}
`).join('\n')}
`.trim();

    return report;
  }
}

export default QualityChecker;
