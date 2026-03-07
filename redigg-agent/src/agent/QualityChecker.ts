/**
 * QualityChecker - 质量检查器
 * 
 * 负责在任务执行的每个步骤后检查质量，
 * 通过 5 个维度评估输出：完整性、准确性、相关性、格式、引用质量。
 */

export interface QualityDimension {
  name: QualityDimensionName;
  weight: number;
  score: number; // 0-5
  feedback: string;
  checks: QualityCheck[];
}

export type QualityDimensionName = 
  | 'completeness'    // 完整性
  | 'accuracy'        // 准确性
  | 'relevance'       // 相关性
  | 'format'          // 格式
  | 'citationQuality'; // 引用质量

export interface QualityCheck {
  checkId: string;
  description: string;
  passed: boolean;
  details?: string;
}

export interface QualityReport {
  taskId: string;
  stepId?: string;
  overallScore: number; // 0-5
  passed: boolean;
  dimensions: QualityDimension[];
  criticalErrors: string[];
  recommendations: string[];
  timestamp: number;
}

export interface QualityThresholds {
  completeness: number;    // 覆盖率 > 90%
  accuracy: number;        // 引用正确率 > 95%
  relevance: number;       // 内容相关度 > 4/5
  format: number;          // 符合学术规范
  citationQuality: number; // 来源可靠性 > 4/5
  overall: number;         // 综合得分 > 4/5
}

export const DEFAULT_THRESHOLDS: QualityThresholds = {
  completeness: 4.5,      // 90% = 4.5/5
  accuracy: 4.75,         // 95% = 4.75/5
  relevance: 4.0,
  format: 4.0,
  citationQuality: 4.0,
  overall: 4.0,
};

export const DIMENSION_WEIGHTS: Record<QualityDimensionName, number> = {
  completeness: 0.25,
  accuracy: 0.30,
  relevance: 0.20,
  format: 0.15,
  citationQuality: 0.10,
};

export class QualityChecker {
  private thresholds: QualityThresholds;

  constructor(thresholds: QualityThresholds = DEFAULT_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  /**
   * 检查输出质量
   */
  async checkQuality(
    taskId: string,
    content: string,
    context?: {
      stepId?: string;
      taskType?: string;
      inputQuery?: string;
      expectedOutput?: string;
    }
  ): Promise<QualityReport> {
    const dimensions: QualityDimension[] = [];

    // 1. 完整性检查
    dimensions.push(await this.checkCompleteness(content, context));

    // 2. 准确性检查
    dimensions.push(await this.checkAccuracy(content, context));

    // 3. 相关性检查
    dimensions.push(await this.checkRelevance(content, context));

    // 4. 格式检查
    dimensions.push(await this.checkFormat(content, context));

    // 5. 引用质量检查
    dimensions.push(await this.checkCitationQuality(content, context));

    // 计算总体分数
    const overallScore = this.calculateOverallScore(dimensions);

    // 识别严重错误
    const criticalErrors = this.identifyCriticalErrors(dimensions);

    // 生成建议
    const recommendations = this.generateRecommendations(dimensions);

    // 判断是否通过
    const passed = overallScore >= this.thresholds.overall && criticalErrors.length === 0;

    return {
      taskId,
      stepId: context?.stepId,
      overallScore,
      passed,
      dimensions,
      criticalErrors,
      recommendations,
      timestamp: Date.now(),
    };
  }

  /**
   * 完整性检查 - 覆盖率 > 90%
   */
  private async checkCompleteness(content: string, context?: any): Promise<QualityDimension> {
    const checks: QualityCheck[] = [];
    let score = 5.0;
    const feedback: string[] = [];

    // 检查 1: 内容长度是否合理
    const wordCount = content.split(/\s+/).length;
    if (wordCount < 100) {
      checks.push({
        checkId: 'completeness_1',
        description: 'Content length check',
        passed: false,
        details: `Content too short: ${wordCount} words (minimum 100)`,
      });
      score -= 1.5;
      feedback.push('Content is too short, may be missing key information');
    } else {
      checks.push({
        checkId: 'completeness_1',
        description: 'Content length check',
        passed: true,
        details: `Adequate length: ${wordCount} words`,
      });
    }

    // 检查 2: 是否有明确的结构
    const hasStructure = 
      content.includes('##') || 
      content.includes('###') ||
      content.includes('1.') ||
      content.includes('- ') ||
      content.includes('* ');
    
    checks.push({
      checkId: 'completeness_2',
      description: 'Structure check',
      passed: hasStructure,
      details: hasStructure ? 'Content has clear structure' : 'Content lacks clear structure',
    });
    if (!hasStructure) {
      score -= 0.5;
      feedback.push('Consider adding clear sections and organization');
    }

    // 检查 3: 是否有结论或总结
    const hasConclusion = 
      content.toLowerCase().includes('conclusion') ||
      content.toLowerCase().includes('summary') ||
      content.toLowerCase().includes('in summary') ||
      content.toLowerCase().includes('to conclude');
    
    checks.push({
      checkId: 'completeness_3',
      description: 'Conclusion check',
      passed: hasConclusion,
      details: hasConclusion ? 'Content includes conclusion' : 'Content missing conclusion',
    });
    if (!hasConclusion) {
      score -= 0.5;
      feedback.push('Add a conclusion or summary section');
    }

    // 检查 4: 关键元素是否存在（基于任务类型）
    if (context?.taskType === 'literature_review') {
      const hasCitations = content.includes('[') && content.includes(']');
      checks.push({
        checkId: 'completeness_4',
        description: 'Citation presence check',
        passed: hasCitations,
        details: hasCitations ? 'Citations present' : 'No citations found',
      });
      if (!hasCitations) {
        score -= 1.0;
        feedback.push('Literature review should include citations');
      }
    }

    return {
      name: 'completeness',
      weight: DIMENSION_WEIGHTS.completeness,
      score: Math.max(0, score),
      feedback: feedback.join('; '),
      checks,
    };
  }

  /**
   * 准确性检查 - 引用正确率 > 95%
   */
  private async checkAccuracy(content: string, context?: any): Promise<QualityDimension> {
    const checks: QualityCheck[] = [];
    let score = 5.0;
    const feedback: string[] = [];

    // 检查 1: 是否有明显的事实错误标记
    const uncertaintyMarkers = [
      'i think',
      'maybe',
      'probably',
      'not sure',
      'might be',
      'could be',
    ];
    const uncertaintyCount = uncertaintyMarkers.filter(m => 
      content.toLowerCase().includes(m)
    ).length;

    checks.push({
      checkId: 'accuracy_1',
      description: 'Uncertainty language check',
      passed: uncertaintyCount < 3,
      details: `Found ${uncertaintyCount} uncertainty markers`,
    });
    if (uncertaintyCount >= 3) {
      score -= 1.0;
      feedback.push('Reduce uncertain language, be more definitive');
    }

    // 检查 2: 数字和统计数据是否合理
    const numbers = content.match(/\d+(\.\d+)?%/g);
    if (numbers) {
      const invalidPercentages = numbers.filter(n => {
        const value = parseFloat(n);
        return value < 0 || value > 100;
      });
      
      checks.push({
        checkId: 'accuracy_2',
        description: 'Percentage validity check',
        passed: invalidPercentages.length === 0,
        details: invalidPercentages.length === 0 
          ? 'All percentages valid' 
          : `Invalid percentages: ${invalidPercentages.join(', ')}`,
      });
      if (invalidPercentages.length > 0) {
        score -= 2.0;
        feedback.push('Fix invalid percentage values');
      }
    }

    // 检查 3: 内部一致性
    const contradictions = this.detectContradictions(content);
    checks.push({
      checkId: 'accuracy_3',
      description: 'Internal consistency check',
      passed: contradictions.length === 0,
      details: contradictions.length === 0 
        ? 'No contradictions detected' 
        : `Potential contradictions: ${contradictions.join(', ')}`,
    });
    if (contradictions.length > 0) {
      score -= 1.5;
      feedback.push('Resolve internal contradictions');
    }

    return {
      name: 'accuracy',
      weight: DIMENSION_WEIGHTS.accuracy,
      score: Math.max(0, score),
      feedback: feedback.join('; '),
      checks,
    };
  }

  /**
   * 相关性检查 - 内容相关度 > 4/5
   */
  private async checkRelevance(content: string, context?: any): Promise<QualityDimension> {
    const checks: QualityCheck[] = [];
    let score = 5.0;
    const feedback: string[] = [];

    const inputQuery = context?.inputQuery?.toLowerCase() || '';
    const contentLower = content.toLowerCase();

    // 检查 1: 关键词匹配
    if (inputQuery) {
      const queryWords = inputQuery.split(/\s+/).filter((w: string) => w.length > 3);
      const matchCount = queryWords.filter((w: string) => contentLower.includes(w)).length;
      const matchRate = queryWords.length > 0 ? matchCount / queryWords.length : 0;

      checks.push({
        checkId: 'relevance_1',
        description: 'Keyword match check',
        passed: matchRate > 0.5,
        details: `${Math.round(matchRate * 100)}% of query keywords found in content`,
      });

      if (matchRate < 0.3) {
        score -= 2.0;
        feedback.push('Content does not match query keywords well');
      } else if (matchRate < 0.5) {
        score -= 1.0;
        feedback.push('Consider addressing more query keywords');
      }
    }

    // 检查 2: 是否有无关内容
    const offTopicMarkers = ['by the way', 'unrelated', 'side note', 'interesting fact'];
    const offTopicCount = offTopicMarkers.filter(m => contentLower.includes(m)).length;

    checks.push({
      checkId: 'relevance_2',
      description: 'Off-topic content check',
      passed: offTopicCount === 0,
      details: offTopicCount === 0 ? 'No off-topic markers' : `${offTopicCount} off-topic markers found`,
    });
    if (offTopicCount > 0) {
      score -= 0.5;
      feedback.push('Remove off-topic content');
    }

    return {
      name: 'relevance',
      weight: DIMENSION_WEIGHTS.relevance,
      score: Math.max(0, score),
      feedback: feedback.join('; '),
      checks,
    };
  }

  /**
   * 格式检查 - 符合学术规范
   */
  private async checkFormat(content: string, context?: any): Promise<QualityDimension> {
    const checks: QualityCheck[] = [];
    let score = 5.0;
    const feedback: string[] = [];

    // 检查 1: 段落结构
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    checks.push({
      checkId: 'format_1',
      description: 'Paragraph structure check',
      passed: paragraphs.length >= 2,
      details: `Found ${paragraphs.length} paragraphs`,
    });
    if (paragraphs.length < 2) {
      score -= 1.0;
      feedback.push('Add more paragraphs for better readability');
    }

    // 检查 2: 列表格式
    const hasLists = 
      content.includes('- ') || 
      content.includes('* ') ||
      content.includes('1.') ||
      content.includes('•');
    
    checks.push({
      checkId: 'format_2',
      description: 'List formatting check',
      passed: hasLists,
      details: hasLists ? 'Lists properly formatted' : 'No lists found',
    });

    // 检查 3: 代码块格式（如果有代码）
    if (content.includes('```')) {
      const codeBlocks = content.match(/```[\s\S]*?```/g);
      const allClosed = codeBlocks && codeBlocks.length % 2 === 0;
      
      checks.push({
        checkId: 'format_3',
        description: 'Code block formatting check',
        passed: !!allClosed,
        details: allClosed ? 'Code blocks properly closed' : 'Unclosed code blocks',
      });
      if (!allClosed) {
        score -= 1.0;
        feedback.push('Close all code blocks');
      }
    }

    // 检查 4: Markdown 语法
    const markdownElements = ['##', '###', '**', '*', '`', '[', ']', '>', '|'];
    const markdownUsage = markdownElements.filter(e => content.includes(e)).length;
    
    checks.push({
      checkId: 'format_4',
      description: 'Markdown usage check',
      passed: markdownUsage >= 2,
      details: `Using ${markdownUsage} Markdown elements`,
    });

    return {
      name: 'format',
      weight: DIMENSION_WEIGHTS.format,
      score: Math.max(0, score),
      feedback: feedback.join('; '),
      checks,
    };
  }

  /**
   * 引用质量检查 - 来源可靠性 > 4/5
   */
  private async checkCitationQuality(content: string, context?: any): Promise<QualityDimension> {
    const checks: QualityCheck[] = [];
    let score = 5.0;
    const feedback: string[] = [];

    // 检查 1: 是否有引用
    const citations = content.match(/\[[^\]]+\]/g) || [];
    const doiPattern = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/gi;
    const dois = content.match(doiPattern) || [];
    const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
    const urls = content.match(urlPattern) || [];

    checks.push({
      checkId: 'citation_1',
      description: 'Citation presence check',
      passed: citations.length > 0 || dois.length > 0 || urls.length > 0,
      details: `Found ${citations.length} citations, ${dois.length} DOIs, ${urls.length} URLs`,
    });

    // 检查 2: 引用格式一致性
    if (citations.length > 0) {
      const hasConsistentFormat = 
        citations.every(c => /^\[\d+\]$/.test(c)) ||
        citations.every(c => /^\[[A-Za-z]+,\s*\d{4}\]$/.test(c));
      
      checks.push({
        checkId: 'citation_2',
        description: 'Citation format consistency check',
        passed: hasConsistentFormat,
        details: hasConsistentFormat ? 'Consistent citation format' : 'Inconsistent citation formats',
      });
      if (!hasConsistentFormat) {
        score -= 0.5;
        feedback.push('Use consistent citation format throughout');
      }
    }

    // 检查 3: 权威来源检查
    const authoritativeDomains = [
      'arxiv.org',
      'doi.org',
      'pubmed',
      'ieee',
      'acm',
      'springer',
      'elsevier',
      'nature',
      'science',
      '.edu',
      '.gov',
    ];
    
    const authoritativeCount = urls.filter(url => 
      authoritativeDomains.some(domain => url.includes(domain))
    ).length;
    
    if (urls.length > 0) {
      const authorityRate = authoritativeCount / urls.length;
      
      checks.push({
        checkId: 'citation_3',
        description: 'Source authority check',
        passed: authorityRate > 0.5,
        details: `${Math.round(authorityRate * 100)}% from authoritative sources`,
      });
      
      if (authorityRate < 0.3) {
        score -= 1.5;
        feedback.push('Use more authoritative sources');
      } else if (authorityRate < 0.5) {
        score -= 0.5;
        feedback.push('Consider using more authoritative sources');
      }
    }

    // 如果没有引用，根据任务类型决定扣分
    if (citations.length === 0 && dois.length === 0 && urls.length === 0) {
      if (context?.taskType === 'literature_review' || context?.taskType === 'paper_writing') {
        score -= 2.0;
        feedback.push('Academic content should include citations');
      }
    }

    return {
      name: 'citationQuality',
      weight: DIMENSION_WEIGHTS.citationQuality,
      score: Math.max(0, score),
      feedback: feedback.join('; '),
      checks,
    };
  }

  /**
   * 计算总体分数
   */
  private calculateOverallScore(dimensions: QualityDimension[]): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const dim of dimensions) {
      weightedSum += dim.score * dim.weight;
      totalWeight += dim.weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * 识别严重错误
   */
  private identifyCriticalErrors(dimensions: QualityDimension[]): string[] {
    const errors: string[] = [];

    for (const dim of dimensions) {
      // 检查未通过的关键检查项
      for (const check of dim.checks) {
        if (!check.passed && check.checkId.includes('accuracy')) {
          errors.push(`Accuracy issue: ${check.details}`);
        }
      }

      // 分数过低
      if (dim.score < 2.0) {
        errors.push(`${dim.name} score critically low: ${dim.score}/5`);
      }
    }

    return errors;
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(dimensions: QualityDimension[]): string[] {
    const recommendations: string[] = [];

    for (const dim of dimensions) {
      if (dim.score < this.thresholds[dim.name]) {
        if (dim.feedback) {
          recommendations.push(`[${dim.name}] ${dim.feedback}`);
        }
      }
    }

    return recommendations;
  }

  /**
   * 检测内容中的潜在矛盾
   */
  private detectContradictions(content: string): string[] {
    const contradictions: string[] = [];
    
    // 简单的矛盾检测：查找相反的表达
    const positivePatterns = ['increases', 'improves', 'enhances', 'positive', 'better'];
    const negativePatterns = ['decreases', 'worsens', 'reduces', 'negative', 'worse'];

    const contentLower = content.toLowerCase();
    
    const hasPositive = positivePatterns.some(p => contentLower.includes(p));
    const hasNegative = negativePatterns.some(p => contentLower.includes(p));

    if (hasPositive && hasNegative) {
      // 需要更复杂的分析来确定是否真的矛盾
      // 这里简化处理，只标记潜在问题
      contradictions.push('Mixed positive/negative claims detected');
    }

    return contradictions;
  }

  /**
   * 更新阈值
   */
  updateThresholds(newThresholds: Partial<QualityThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  /**
   * 获取当前阈值
   */
  getThresholds(): QualityThresholds {
    return { ...this.thresholds };
  }
}
