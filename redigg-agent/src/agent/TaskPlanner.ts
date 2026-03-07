/**
 * TaskPlanner - 智能任务规划模块
 * 
 * 负责将复杂研究查询分解为可执行的 Skill 调用序列
 * 参考：dexter (垂类 Agent)、CrewAI AMP Suite
 * 
 * @module TaskPlanner
 */

import { LLMClient } from '../llm/LLMClient';
import { SkillRegistry } from '../skills/SkillRegistry';

/**
 * 任务类型枚举
 */
export type TaskType = 
  | 'literature_review'
  | 'experiment_design'
  | 'data_analysis'
  | 'paper_writing'
  | 'code_generation'
  | 'unknown';

/**
 * 任务步骤状态
 */
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * 任务整体状态
 */
export type TaskStatus = 'planning' | 'executing' | 'completed' | 'failed' | 'cancelled';

/**
 * 任务步骤定义
 */
export interface TaskStep {
  /** 步骤唯一标识 */
  stepId: string;
  /** 步骤描述 */
  description: string;
  /** 关联的 Skill ID */
  skillId: string;
  /** 步骤输入参数 */
  input: Record<string, any>;
  /** 步骤输出结果（执行后填充） */
  output?: Record<string, any>;
  /** 步骤状态 */
  status: StepStatus;
  /** 重试次数 */
  retryCount: number;
  /** 错误信息（如果失败） */
  error?: string;
  /** 执行时间（毫秒） */
  executionTime?: number;
}

/**
 * 任务计划定义
 */
export interface TaskPlan {
  /** 任务唯一标识 */
  taskId: string;
  /** 原始用户查询 */
  originalQuery: string;
  /** 任务类型 */
  taskType: TaskType;
  /** 任务步骤列表 */
  steps: TaskStep[];
  /** 当前执行到的步骤索引 */
  currentStep: number;
  /** 任务状态 */
  status: TaskStatus;
  /** 创建时间戳 */
  createdAt: number;
  /** 更新时间戳 */
  updatedAt: number;
  /** 任务约束条件 */
  constraints?: TaskConstraints;
  /** 执行元数据 */
  metadata?: TaskMetadata;
}

/**
 * 任务约束条件
 */
export interface TaskConstraints {
  /** 时间限制（分钟） */
  timeLimit?: number;
  /** 最大步骤数 */
  maxSteps?: number;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 其他约束 */
  [key: string]: any;
}

/**
 * 任务元数据
 */
export interface TaskMetadata {
  /** 总执行时间（毫秒） */
  totalExecutionTime?: number;
  /** 完成的步骤数 */
  completedSteps?: number;
  /** 失败的步骤数 */
  failedSteps?: number;
  /** 跳过的步骤数 */
  skippedSteps?: number;
  /** 质量评分（0-1） */
  qualityScore?: number;
}

/**
 * 任务模板 - 预定义的任务执行模式
 */
export interface TaskTemplate {
  /** 模板 ID */
  id: string;
  /** 任务类型 */
  taskType: TaskType;
  /** 模板描述 */
  description: string;
  /** 步骤模板列表 */
  steps: TaskStepTemplate[];
  /** 适用场景关键词 */
  keywords: string[];
}

/**
 * 步骤模板
 */
export interface TaskStepTemplate {
  /** 步骤描述模板 */
  description: string;
  /** Skill ID */
  skillId: string;
  /** 输入参数模板（支持变量替换） */
  inputTemplate: Record<string, string>;
  /** 是否可选步骤 */
  optional?: boolean;
  /** 前置步骤 ID（依赖关系） */
  dependsOn?: string[];
}

/**
 * TaskPlanner 类
 * 
 * 智能任务规划核心实现
 */
export class TaskPlanner {
  private llmClient: LLMClient;
  private skillRegistry: SkillRegistry;
  private templates: Map<TaskType, TaskTemplate[]>;

  constructor(llmClient: LLMClient, skillRegistry: SkillRegistry) {
    this.llmClient = llmClient;
    this.skillRegistry = skillRegistry;
    this.templates = new Map();
    this.initializeTemplates();
  }

  /**
   * 初始化预定义任务模板
   */
  private initializeTemplates(): void {
    // 文献综述模板
    this.templates.set('literature_review', [
      {
        id: 'lit_review_standard',
        taskType: 'literature_review',
        description: '标准文献综述流程',
        keywords: ['文献综述', 'literature review', '调研', 'survey', '相关研究'],
        steps: [
          {
            description: '搜索相关论文',
            skillId: 'arxiv_search',
            inputTemplate: { query: '${topic}', maxResults: '${maxPapers}' },
            optional: false
          },
          {
            description: '提取论文摘要',
            skillId: 'paper_summarizer',
            inputTemplate: { papers: '${search_results}' },
            optional: false,
            dependsOn: ['step_1']
          },
          {
            description: '构建引用网络',
            skillId: 'citation_graph',
            inputTemplate: { papers: '${summarized_papers}' },
            optional: true
          },
          {
            description: '综合撰写综述',
            skillId: 'synthesis',
            inputTemplate: { 
              summaries: '${summarized_papers}',
              citations: '${citation_network}'
            },
            optional: false,
            dependsOn: ['step_2']
          }
        ]
      }
    ]);

    // 实验设计模板
    this.templates.set('experiment_design', [
      {
        id: 'exp_design_standard',
        taskType: 'experiment_design',
        description: '标准实验设计流程',
        keywords: ['实验设计', 'experiment', 'methodology', '实验方案'],
        steps: [
          {
            description: '明确研究问题',
            skillId: 'problem_formulation',
            inputTemplate: { topic: '${topic}' },
            optional: false
          },
          {
            description: '设计实验方案',
            skillId: 'experiment_designer',
            inputTemplate: { problem: '${problem_statement}' },
            optional: false,
            dependsOn: ['step_1']
          },
          {
            description: '生成代码实现',
            skillId: 'code_generator',
            inputTemplate: { design: '${experiment_design}' },
            optional: true
          }
        ]
      }
    ]);

    // 数据分析模板
    this.templates.set('data_analysis', [
      {
        id: 'data_analysis_standard',
        taskType: 'data_analysis',
        description: '标准数据分析流程',
        keywords: ['数据分析', 'data analysis', '统计', 'visualization'],
        steps: [
          {
            description: '数据加载与探索',
            skillId: 'data_explorer',
            inputTemplate: { dataSource: '${data_source}' },
            optional: false
          },
          {
            description: '统计分析',
            skillId: 'statistical_analysis',
            inputTemplate: { data: '${explored_data}' },
            optional: false,
            dependsOn: ['step_1']
          },
          {
            description: '可视化生成',
            skillId: 'visualization',
            inputTemplate: { results: '${analysis_results}' },
            optional: true
          }
        ]
      }
    ]);

    // 论文写作模板
    this.templates.set('paper_writing', [
      {
        id: 'paper_writing_standard',
        taskType: 'paper_writing',
        description: '标准论文写作流程',
        keywords: ['论文写作', 'paper writing', 'manuscript', '撰写'],
        steps: [
          {
            description: '生成论文大纲',
            skillId: 'outline_generator',
            inputTemplate: { topic: '${topic}', results: '${results}' },
            optional: false
          },
          {
            description: '撰写初稿',
            skillId: 'draft_writer',
            inputTemplate: { outline: '${outline}' },
            optional: false,
            dependsOn: ['step_1']
          },
          {
            description: '润色与修改',
            skillId: 'paper_polisher',
            inputTemplate: { draft: '${first_draft}' },
            optional: true
          }
        ]
      }
    ]);
  }

  /**
   * 主函数：根据查询生成任务计划
   * 
   * @param query 用户研究查询
   * @param constraints 任务约束条件
   * @returns 任务计划
   */
  async plan(query: string, constraints?: TaskConstraints): Promise<TaskPlan> {
    const startTime = Date.now();

    // 1. 任务类型识别
    const taskType = await this.classifyTask(query);

    // 2. 获取并实例化任务模板
    const steps = await this.instantiateSteps(taskType, query);

    // 3. 创建任务计划
    const taskPlan: TaskPlan = {
      taskId: this.generateTaskId(),
      originalQuery: query,
      taskType,
      steps,
      currentStep: 0,
      status: 'planning',
      createdAt: startTime,
      updatedAt: startTime,
      constraints: constraints || this.getDefaultConstraints(taskType)
    };

    // 4. 应用约束
    this.applyConstraints(taskPlan);

    return taskPlan;
  }

  /**
   * 任务类型分类
   * 
   * @param query 用户查询
   * @returns 任务类型
   */
  async classifyTask(query: string): Promise<TaskType> {
    const prompt = `
请分析以下研究查询，判断其任务类型：

查询：${query}

可选任务类型：
- literature_review: 文献综述、调研相关研究
- experiment_design: 设计实验方案
- data_analysis: 分析数据、统计、可视化
- paper_writing: 撰写论文、修改论文
- code_generation: 生成代码

只需返回任务类型名称（如：literature_review），不要其他内容。
`.trim();

    try {
      const response = await this.llmClient.generate(prompt, {
        maxTokens: 50,
        temperature: 0.1
      });

      const type = response.text.trim().toLowerCase() as TaskType;
      
      // 验证类型是否有效
      const validTypes: TaskType[] = [
        'literature_review',
        'experiment_design',
        'data_analysis',
        'paper_writing',
        'code_generation'
      ];

      if (validTypes.includes(type)) {
        return type;
      }

      return 'unknown';
    } catch (error) {
      console.error('Task classification failed:', error);
      return 'unknown';
    }
  }

  /**
   * 实例化任务步骤
   * 
   * @param taskType 任务类型
   * @param query 用户查询
   * @returns 任务步骤列表
   */
  async instantiateSteps(taskType: TaskType, query: string): Promise<TaskStep[]> {
    // 获取模板
    const templates = this.templates.get(taskType) || [];
    
    if (templates.length === 0) {
      // 如果没有预定义模板，使用 LLM 动态生成步骤
      return await this.generateStepsDynamically(query);
    }

    // 使用第一个模板（后续可以优化为智能选择）
    const template = templates[0];

    // 从查询中提取参数
    const params = await this.extractQueryParams(query, taskType);

    // 实例化步骤
    const steps: TaskStep[] = template.steps.map((stepTemplate, index) => ({
      stepId: `step_${index + 1}`,
      description: stepTemplate.description,
      skillId: stepTemplate.skillId,
      input: this.fillInputTemplate(stepTemplate.inputTemplate, params),
      status: 'pending',
      retryCount: 0
    }));

    return steps;
  }

  /**
   * 动态生成任务步骤（当没有预定义模板时）
   * 
   * @param query 用户查询
   * @returns 任务步骤列表
   */
  async generateStepsDynamically(query: string): Promise<TaskStep[]> {
    const prompt = `
请为以下研究任务设计执行步骤：

任务：${query}

要求：
1. 将任务分解为 3-7 个具体步骤
2. 每个步骤应该可以使用一个 Skill 完成
3. 步骤之间应该有清晰的依赖关系

请以 JSON 格式返回，格式如下：
[
  {
    "description": "步骤描述",
    "skillId": "skill_id",
    "input": {"param": "value"}
  }
]

只需返回 JSON，不要其他内容。
`.trim();

    try {
      const response = await this.llmClient.generate(prompt, {
        maxTokens: 1000,
        temperature: 0.3
      });

      // 解析 JSON 响应
      const stepsData = JSON.parse(response.text);
      
      return stepsData.map((step: any, index: number) => ({
        stepId: `step_${index + 1}`,
        description: step.description,
        skillId: step.skillId,
        input: step.input || {},
        status: 'pending',
        retryCount: 0
      }));
    } catch (error) {
      console.error('Dynamic step generation failed:', error);
      // 返回空步骤列表
      return [];
    }
  }

  /**
   * 从查询中提取参数
   * 
   * @param query 用户查询
   * @param taskType 任务类型
   * @returns 提取的参数
   */
  async extractQueryParams(query: string, taskType: TaskType): Promise<Record<string, any>> {
    const params: Record<string, any> = {
      topic: query,
      maxPapers: 50,
      yearRange: [2020, 2026]
    };

    // 使用 LLM 提取更详细的参数
    const prompt = `
从以下研究查询中提取参数：

查询：${query}
任务类型：${taskType}

请提取以下参数（如果存在）：
- topic: 研究主题
- maxPapers: 最大论文数量（如果没有指定，默认 50）
- yearRange: 年份范围 [start, end]
- includeCode: 是否需要代码（true/false）
- timeLimit: 时间限制（分钟）

以 JSON 格式返回。
`.trim();

    try {
      const response = await this.llmClient.generate(prompt, {
        maxTokens: 500,
        temperature: 0.1
      });

      const extracted = JSON.parse(response.text);
      return { ...params, ...extracted };
    } catch (error) {
      console.error('Parameter extraction failed:', error);
      return params;
    }
  }

  /**
   * 填充输入模板
   * 
   * @param template 输入模板
   * @param params 参数
   * @returns 填充后的输入
   */
  private fillInputTemplate(
    template: Record<string, string>,
    params: Record<string, any>
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, valueTemplate] of Object.entries(template)) {
      // 替换 ${param} 格式的变量
      result[key] = valueTemplate.replace(/\$\{(\w+)\}/g, (_, paramName) => {
        return params[paramName] !== undefined ? params[paramName] : '';
      });
    }

    return result;
  }

  /**
   * 应用约束条件
   * 
   * @param taskPlan 任务计划
   */
  private applyConstraints(taskPlan: TaskPlan): void {
    const constraints = taskPlan.constraints;

    if (!constraints) return;

    // 限制最大步骤数
    if (constraints.maxSteps && taskPlan.steps.length > constraints.maxSteps) {
      taskPlan.steps = taskPlan.steps.slice(0, constraints.maxSteps);
    }
  }

  /**
   * 获取默认约束
   * 
   * @param taskType 任务类型
   * @returns 默认约束
   */
  private getDefaultConstraints(taskType: TaskType): TaskConstraints {
    const defaults: Record<TaskType, TaskConstraints> = {
      literature_review: {
        timeLimit: 30,
        maxSteps: 10,
        maxRetries: 3
      },
      experiment_design: {
        timeLimit: 20,
        maxSteps: 8,
        maxRetries: 3
      },
      data_analysis: {
        timeLimit: 25,
        maxSteps: 10,
        maxRetries: 3
      },
      paper_writing: {
        timeLimit: 60,
        maxSteps: 12,
        maxRetries: 3
      },
      code_generation: {
        timeLimit: 15,
        maxSteps: 5,
        maxRetries: 3
      },
      unknown: {
        timeLimit: 30,
        maxSteps: 10,
        maxRetries: 3
      }
    };

    return defaults[taskType] || defaults.unknown;
  }

  /**
   * 生成任务 ID
   * 
   * @returns 任务 ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取任务计划状态
   * 
   * @param taskPlan 任务计划
   * @returns 状态摘要
   */
  getStatusSummary(taskPlan: TaskPlan): string {
    const completed = taskPlan.steps.filter(s => s.status === 'completed').length;
    const failed = taskPlan.steps.filter(s => s.status === 'failed').length;
    const pending = taskPlan.steps.filter(s => s.status === 'pending').length;

    return `${completed}/${taskPlan.steps.length} 步骤完成，${failed} 失败，${pending} 待执行`;
  }
}

export default TaskPlanner;
