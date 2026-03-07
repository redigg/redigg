/**
 * TaskPlanner - 智能任务规划器
 * 
 * 负责将复杂研究查询分解为结构化步骤，
 * 基于任务类型选择正确的 Skill，动态规划后续步骤。
 */

export type TaskType = 
  | 'literature_review'
  | 'experiment_design'
  | 'data_analysis'
  | 'paper_writing'
  | 'peer_review'
  | 'research_planning'
  | 'general';

export interface TaskStep {
  stepId: string;
  skillName: string;
  description: string;
  parameters: Record<string, unknown>;
  dependencies: string[]; // 依赖的前置步骤 ID
  estimatedDuration?: number; // 预估耗时（秒）
}

export interface TaskPlan {
  taskId: string;
  taskType: TaskType;
  steps: TaskStep[];
  totalEstimatedDuration: number;
  createdAt: number;
}

export interface TaskClassification {
  type: TaskType;
  confidence: number;
  keywords: string[];
  reasoning: string;
}

export class TaskPlanner {
  private static readonly TASK_TYPE_KEYWORDS: Record<TaskType, string[]> = {
    literature_review: ['literature', 'review', 'survey', 'papers', 'research', 'existing work', 'related work', 'background'],
    experiment_design: ['experiment', 'design', 'hypothesis', 'methodology', 'protocol', 'validation', 'test'],
    data_analysis: ['analyze', 'data', 'dataset', 'statistics', 'results', 'findings', 'patterns', 'trends'],
    paper_writing: ['write', 'paper', 'manuscript', 'draft', 'article', 'publication', 'section'],
    peer_review: ['review', 'evaluate', 'critique', 'feedback', 'assessment', 'quality'],
    research_planning: ['plan', 'roadmap', 'timeline', 'goals', 'objectives', 'strategy'],
    general: ['help', 'question', 'information', 'explain', 'understand'],
  };

  private static readonly SKILL_ROUTING: Record<TaskType, string[]> = {
    literature_review: ['LiteratureReviewSkill', 'ResearchHighlightExtractionSkill', 'CitationFormattingSkill'],
    experiment_design: ['ExperimentDesignSkill', 'ResearchPlanningSkill'],
    data_analysis: ['DataAnalysisSkill', 'DataVisualizationSkill'],
    paper_writing: ['PaperWritingSkill', 'GrammarAndPolishingSkill', 'CitationFormattingSkill'],
    peer_review: ['PeerReviewSkill', 'GeneralSkill'],
    research_planning: ['ResearchPlanningSkill', 'GeneralSkill'],
    general: ['GeneralSkill'],
  };

  /**
   * 分类任务类型
   */
  classifyTask(query: string): TaskClassification {
    const normalizedQuery = query.toLowerCase();
    
    const scores: Record<TaskType, number> = {
      literature_review: 0,
      experiment_design: 0,
      data_analysis: 0,
      paper_writing: 0,
      peer_review: 0,
      research_planning: 0,
      general: 0,
    };

    const matchedKeywords: Record<TaskType, string[]> = {
      literature_review: [],
      experiment_design: [],
      data_analysis: [],
      paper_writing: [],
      peer_review: [],
      research_planning: [],
      general: [],
    };

    // 计算每种任务类型的匹配分数
    for (const [type, keywords] of Object.entries(TaskPlanner.TASK_TYPE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (normalizedQuery.includes(keyword)) {
          scores[type as TaskType] += 1;
          matchedKeywords[type as TaskType].push(keyword);
        }
      }
    }

    // 找出最高分数的任务类型
    let bestType: TaskType = 'general';
    let bestScore = 0;

    for (const [type, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestType = type as TaskType;
      }
    }

    // 计算置信度
    const totalKeywords = Object.values(matchedKeywords).flat().length;
    const confidence = totalKeywords > 0 ? Math.min(0.5 + (bestScore / totalKeywords) * 0.5, 1.0) : 0.3;

    return {
      type: bestType,
      confidence,
      keywords: matchedKeywords[bestType],
      reasoning: `Matched ${bestScore} keywords for ${bestType} out of ${totalKeywords} total matches`,
    };
  }

  /**
   * 为任务生成执行计划
   */
  generatePlan(taskId: string, query: string, taskType?: TaskType): TaskPlan {
    const classification = taskType ? 
      { type: taskType, confidence: 1.0, keywords: [], reasoning: 'Explicitly specified' } :
      this.classifyTask(query);

    const steps = this.generateStepsForType(classification.type, query);

    const totalDuration = steps.reduce((sum, step) => sum + (step.estimatedDuration || 60), 0);

    return {
      taskId,
      taskType: classification.type,
      steps,
      totalEstimatedDuration: totalDuration,
      createdAt: Date.now(),
    };
  }

  /**
   * 为特定任务类型生成步骤
   */
  private generateStepsForType(taskType: TaskType, query: string): TaskStep[] {
    switch (taskType) {
      case 'literature_review':
        return this.generateLiteratureReviewSteps(query);
      case 'experiment_design':
        return this.generateExperimentDesignSteps(query);
      case 'data_analysis':
        return this.generateDataAnalysisSteps(query);
      case 'paper_writing':
        return this.generatePaperWritingSteps(query);
      case 'peer_review':
        return this.generatePeerReviewSteps(query);
      case 'research_planning':
        return this.generateResearchPlanningSteps(query);
      default:
        return this.generateGeneralSteps(query);
    }
  }

  private generateLiteratureReviewSteps(query: string): TaskStep[] {
    return [
      {
        stepId: 'step_1',
        skillName: 'LiteratureReviewSkill',
        description: 'Search and collect relevant papers',
        parameters: { query, maxResults: 20 },
        dependencies: [],
        estimatedDuration: 120,
      },
      {
        stepId: 'step_2',
        skillName: 'ResearchHighlightExtractionSkill',
        description: 'Extract key findings from papers',
        parameters: { papers: '${step_1.output}' },
        dependencies: ['step_1'],
        estimatedDuration: 180,
      },
      {
        stepId: 'step_3',
        skillName: 'CitationFormattingSkill',
        description: 'Format citations and build citation graph',
        parameters: { papers: '${step_1.output}', style: 'APA' },
        dependencies: ['step_1'],
        estimatedDuration: 60,
      },
      {
        stepId: 'step_4',
        skillName: 'LiteratureReviewSkill',
        description: 'Synthesize literature review',
        parameters: { highlights: '${step_2.output}', citations: '${step_3.output}' },
        dependencies: ['step_2', 'step_3'],
        estimatedDuration: 240,
      },
    ];
  }

  private generateExperimentDesignSteps(query: string): TaskStep[] {
    return [
      {
        stepId: 'step_1',
        skillName: 'ResearchPlanningSkill',
        description: 'Review existing literature for context',
        parameters: { query },
        dependencies: [],
        estimatedDuration: 120,
      },
      {
        stepId: 'step_2',
        skillName: 'ExperimentDesignSkill',
        description: 'Formalize hypothesis',
        parameters: { query, context: '${step_1.output}' },
        dependencies: ['step_1'],
        estimatedDuration: 90,
      },
      {
        stepId: 'step_3',
        skillName: 'ExperimentDesignSkill',
        description: 'Design experimental protocol',
        parameters: { hypothesis: '${step_2.output}' },
        dependencies: ['step_2'],
        estimatedDuration: 180,
      },
      {
        stepId: 'step_4',
        skillName: 'ExperimentDesignSkill',
        description: 'Define metrics and evaluation criteria',
        parameters: { design: '${step_3.output}' },
        dependencies: ['step_3'],
        estimatedDuration: 60,
      },
    ];
  }

  private generateDataAnalysisSteps(query: string): TaskStep[] {
    return [
      {
        stepId: 'step_1',
        skillName: 'DataAnalysisSkill',
        description: 'Load and validate dataset',
        parameters: { query },
        dependencies: [],
        estimatedDuration: 60,
      },
      {
        stepId: 'step_2',
        skillName: 'DataAnalysisSkill',
        description: 'Clean and preprocess data',
        parameters: { data: '${step_1.output}' },
        dependencies: ['step_1'],
        estimatedDuration: 120,
      },
      {
        stepId: 'step_3',
        skillName: 'DataAnalysisSkill',
        description: 'Perform statistical analysis',
        parameters: { data: '${step_2.output}' },
        dependencies: ['step_2'],
        estimatedDuration: 180,
      },
      {
        stepId: 'step_4',
        skillName: 'DataVisualizationSkill',
        description: 'Create visualizations',
        parameters: { results: '${step_3.output}' },
        dependencies: ['step_3'],
        estimatedDuration: 90,
      },
      {
        stepId: 'step_5',
        skillName: 'DataAnalysisSkill',
        description: 'Interpret results and generate report',
        parameters: { analysis: '${step_3.output}', visuals: '${step_4.output}' },
        dependencies: ['step_3', 'step_4'],
        estimatedDuration: 120,
      },
    ];
  }

  private generatePaperWritingSteps(query: string): TaskStep[] {
    return [
      {
        stepId: 'step_1',
        skillName: 'PaperWritingSkill',
        description: 'Create paper outline',
        parameters: { topic: query },
        dependencies: [],
        estimatedDuration: 90,
      },
      {
        stepId: 'step_2',
        skillName: 'PaperWritingSkill',
        description: 'Draft main content',
        parameters: { outline: '${step_1.output}' },
        dependencies: ['step_1'],
        estimatedDuration: 300,
      },
      {
        stepId: 'step_3',
        skillName: 'CitationFormattingSkill',
        description: 'Add and format citations',
        parameters: { draft: '${step_2.output}' },
        dependencies: ['step_2'],
        estimatedDuration: 120,
      },
      {
        stepId: 'step_4',
        skillName: 'GrammarAndPolishingSkill',
        description: 'Polish and refine text',
        parameters: { draft: '${step_3.output}' },
        dependencies: ['step_3'],
        estimatedDuration: 180,
      },
    ];
  }

  private generatePeerReviewSteps(query: string): TaskStep[] {
    return [
      {
        stepId: 'step_1',
        skillName: 'PeerReviewSkill',
        description: 'Evaluate content quality',
        parameters: { content: query },
        dependencies: [],
        estimatedDuration: 180,
      },
      {
        stepId: 'step_2',
        skillName: 'PeerReviewSkill',
        description: 'Check citations and references',
        parameters: { content: query },
        dependencies: [],
        estimatedDuration: 120,
      },
      {
        stepId: 'step_3',
        skillName: 'PeerReviewSkill',
        description: 'Generate feedback report',
        parameters: { qualityReview: '${step_1.output}', citationReview: '${step_2.output}' },
        dependencies: ['step_1', 'step_2'],
        estimatedDuration: 90,
      },
    ];
  }

  private generateResearchPlanningSteps(query: string): TaskStep[] {
    return [
      {
        stepId: 'step_1',
        skillName: 'ResearchPlanningSkill',
        description: 'Define research goals and objectives',
        parameters: { query },
        dependencies: [],
        estimatedDuration: 90,
      },
      {
        stepId: 'step_2',
        skillName: 'ResearchPlanningSkill',
        description: 'Create timeline and milestones',
        parameters: { goals: '${step_1.output}' },
        dependencies: ['step_1'],
        estimatedDuration: 120,
      },
      {
        stepId: 'step_3',
        skillName: 'ResearchPlanningSkill',
        description: 'Identify required resources',
        parameters: { plan: '${step_2.output}' },
        dependencies: ['step_2'],
        estimatedDuration: 60,
      },
    ];
  }

  private generateGeneralSteps(query: string): TaskStep[] {
    return [
      {
        stepId: 'step_1',
        skillName: 'GeneralSkill',
        description: 'Process general query',
        parameters: { query },
        dependencies: [],
        estimatedDuration: 120,
      },
    ];
  }

  /**
   * 验证计划的依赖关系是否有效
   */
  validatePlan(plan: TaskPlan): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const stepIds = new Set(plan.steps.map(s => s.stepId));

    for (const step of plan.steps) {
      // 检查依赖是否存在
      for (const dep of step.dependencies) {
        if (!stepIds.has(dep)) {
          errors.push(`Step ${step.stepId} depends on non-existent step ${dep}`);
        }
      }

      // 检查循环依赖
      if (step.dependencies.includes(step.stepId)) {
        errors.push(`Step ${step.stepId} has self-dependency`);
      }
    }

    // 检查是否有步骤依赖尚未执行的步骤（拓扑顺序）
    const executed = new Set<string>();
    for (const step of plan.steps) {
      for (const dep of step.dependencies) {
        if (!executed.has(dep)) {
          errors.push(`Step ${step.stepId} depends on step ${dep} which hasn't been executed yet`);
        }
      }
      executed.add(step.stepId);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取推荐技能列表
   */
  getRecommendedSkills(taskType: TaskType): string[] {
    return TaskPlanner.SKILL_ROUTING[taskType] || ['GeneralSkill'];
  }
}
