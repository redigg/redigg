import { RediggClient } from '../api/client';
import { RediggGateway } from '../gateway/redigg';
import { Gateway, ResearchTask } from '../gateway/interface';
import { LLMProvider } from '../llm/provider';
import { loadMainProfile, AgentProfile } from './profile';
import * as path from 'path';
import { homedir } from 'os';
import * as fs from 'fs';
import {
  CitationFormattingSkill,
  DataAnalysisSkill,
  DataVisualizationSkill,
  ExperimentDesignSkill,
  GrammarAndPolishingSkill,
  GeneralSkill,
  LiteratureReviewSkill,
  PaperWritingSkill,
  PeerReviewSkill,
  ResearchHighlightExtractionSkill,
  ResearchPlanningSkill,
  SkillRegistry,
} from '../skills';
import { createPromptMarketSkill } from '../skills/market';
import { getConfig, getMCPServers } from '../config';
import { MCPManager } from '../mcp';

interface TaskSkillRoute {
  skillName: string;
  params: Record<string, unknown>;
  reason: string;
}

interface DynamicSkillDescriptor {
  runtimeName: string;
  skillId: string;
  name: string;
  description: string;
  tags: string[];
  tokens: Set<string>;
}

export class AgentRuntime {
  private client: RediggClient;
  private llm: LLMProvider;
  private skills: SkillRegistry;
  private dynamicSkillAliases: Map<string, string> = new Map();
  private dynamicSkillCatalog: DynamicSkillDescriptor[] = [];
  private running: boolean = false;
  private gateway: Gateway;
  private profile: AgentProfile | null = null;

  constructor() {
    this.client = new RediggClient();
    this.gateway = new RediggGateway();
    this.llm = new LLMProvider();
    
    try {
        this.profile = loadMainProfile();
        console.log(`Loaded agent profile: ${this.profile.name}`);
    } catch (e) {
        console.warn('Agent profile not found. Using defaults.');
    }

    this.skills = new SkillRegistry();

    // Register built-in skills
    this.skills.register(LiteratureReviewSkill);
    this.skills.register(GeneralSkill);
    this.skills.register(ResearchPlanningSkill);
    this.skills.register(ExperimentDesignSkill);
    this.skills.register(DataAnalysisSkill);
    this.skills.register(PaperWritingSkill);
    this.skills.register(PeerReviewSkill);
    this.skills.register(CitationFormattingSkill);
    this.skills.register(DataVisualizationSkill);
    this.skills.register(GrammarAndPolishingSkill);
    this.skills.register(ResearchHighlightExtractionSkill);
  }

  async start() {
    if (!this.client.isAuthenticated()) {
      console.error('Agent not authenticated. Please run "redigg login" first.');
      return;
    }

    console.log('Starting Redigg Agent...');

    await this.loadSkillMarketPromptSkills();

    // Load MCP Servers
    const mcpManager = new MCPManager();
    const servers = getMCPServers();
    if (servers) {
      for (const [name, config] of Object.entries(servers)) {
        try {
          console.log(`Connecting to MCP Server: ${name}...`);
          await mcpManager.connect(name, config.command, config.args);
          const skills = await mcpManager.getSkillsFrom(name);
          for (const skill of skills) {
            this.skills.register(skill);
            console.log(`Registered skill: ${skill.name} from ${name}`);
          }
        } catch (err) {
          console.error(`Failed to connect to MCP server ${name}`, err);
        }
      }
    }

    this.running = true;

    // Start heartbeat loop
    setInterval(() => this.client.heartbeat(), 60000);

    this.gateway.on('task', async (task: ResearchTask) => {
        try {
            console.log(`Found task: ${task.id} (${task.title})`);
            const claimed = await this.gateway.claimTask(task.id);
            if (claimed) {
                console.log(`Claimed task ${task.id}`);
                await this.executeTask(task.context);
            }
        } catch (error) {
            console.error('Error processing task:', error);
        }
    });

    await this.gateway.connect();
  }

  stop() {
    this.running = false;
    this.gateway.disconnect();
  }

  private toText(value: unknown, fallback = ''): string {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : fallback;
    }
    if (value === null || value === undefined) return fallback;
    return String(value);
  }

  private parseTaskParameters(task: any): Record<string, unknown> {
    const raw = task?.parameters;
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    }
    if (typeof raw === 'object') return raw as Record<string, unknown>;
    return {};
  }

  private normalizeSkillAlias(value: unknown): string {
    return this.toText(value, '').trim().toLowerCase();
  }

  private registerDynamicSkillAlias(alias: unknown, runtimeName: string) {
    const normalized = this.normalizeSkillAlias(alias);
    if (!normalized) return;
    this.dynamicSkillAliases.set(normalized, runtimeName);
  }

  private resolveDynamicSkillName(alias: unknown): string | null {
    const normalized = this.normalizeSkillAlias(alias);
    if (!normalized) return null;
    return this.dynamicSkillAliases.get(normalized) || null;
  }

  private normalizeToken(token: string): string {
    const clean = token.toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
    if (!clean) return '';
    if (clean.length > 4 && clean.endsWith('ing')) return clean.slice(0, -3);
    if (clean.length > 4 && clean.endsWith('ed')) return clean.slice(0, -2);
    if (clean.length > 4 && clean.endsWith('es')) return clean.slice(0, -2);
    if (clean.length > 4 && clean.endsWith('s')) return clean.slice(0, -1);
    return clean;
  }

  private tokenize(text: string): Set<string> {
    const stopWords = new Set([
      'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'your', 'you',
      'our', 'are', 'using', 'use', 'over', 'under', 'than', 'task', 'research',
      'general', 'study', 'work', 'method',
    ]);

    const tokens = new Set<string>();
    const parts = text.split(/[^a-zA-Z0-9_:-]+/g);
    for (const part of parts) {
      const normalized = this.normalizeToken(part);
      if (!normalized || normalized.length < 3) continue;
      if (stopWords.has(normalized)) continue;
      tokens.add(normalized);
    }
    return tokens;
  }

  private upsertDynamicSkillDescriptor(
    runtimeName: string,
    skillId: string,
    name: string,
    description: string,
    tags: string[]
  ) {
    const searchableText = [skillId, name, description, ...tags].filter(Boolean).join(' ');
    const descriptor: DynamicSkillDescriptor = {
      runtimeName,
      skillId,
      name,
      description,
      tags,
      tokens: this.tokenize(searchableText),
    };

    const existingIndex = this.dynamicSkillCatalog.findIndex((item) => item.runtimeName === runtimeName);
    if (existingIndex >= 0) {
      this.dynamicSkillCatalog[existingIndex] = descriptor;
      return;
    }
    this.dynamicSkillCatalog.push(descriptor);
  }

  private selectDynamicSkillByQuery(queryText: string): { runtimeName: string; score: number } | null {
    if (this.dynamicSkillCatalog.length === 0) return null;

    const queryTokens = this.tokenize(queryText);
    if (queryTokens.size === 0) return null;

    let best: { runtimeName: string; score: number } | null = null;

    for (const skill of this.dynamicSkillCatalog) {
      let score = 0;
      for (const token of queryTokens) {
        if (skill.tokens.has(token)) score += 1;
      }

      // Boost exact mentions to make manual hints deterministic.
      const normalizedQuery = queryText.toLowerCase();
      if (normalizedQuery.includes(skill.skillId.toLowerCase())) score += 4;
      if (normalizedQuery.includes(skill.name.toLowerCase())) score += 3;

      if (!best || score > best.score) {
        best = { runtimeName: skill.runtimeName, score };
      }
    }

    return best;
  }

  private routeGenericResearchTask(
    taskType: string,
    title: string,
    description: string,
    parameters: Record<string, unknown>
  ): TaskSkillRoute | null {
    const isGenericResearch = taskType === 'research' || taskType === 'task' || taskType === '';
    if (!isGenericResearch) return null;

    const category = this.toText((parameters as any)?.category, '');
    const queryText = `${title}\n${description}\n${category}`.toLowerCase();

    const dynamicMatch = this.selectDynamicSkillByQuery(queryText);
    if (dynamicMatch && dynamicMatch.score >= 2) {
      return {
        skillName: dynamicMatch.runtimeName,
        params: { topic: title, context: description, category, task_type: taskType, ...parameters },
        reason: `generic research matched dynamic skill (score=${dynamicMatch.score})`,
      };
    }

    if (/(literature|survey|related work|state[-\s]?of[-\s]?the[-\s]?art|review|综述|文献)/i.test(queryText)) {
      return {
        skillName: 'literature_review',
        params: { topic: title, context: description, ...parameters },
        reason: 'generic research keyword matched literature review',
      };
    }

    if (/(paper|manuscript|draft|writing|write|论文|写作)/i.test(queryText)) {
      return {
        skillName: 'paper_writing',
        params: { topic: title, context: description, ...parameters },
        reason: 'generic research keyword matched paper writing',
      };
    }

    if (/(benchmark|evaluate|evaluation|metric|compare|finben|评测|评估|对比|指标)/i.test(queryText)) {
      return {
        skillName: 'data_analysis',
        params: { topic: title, data: description, requirements: title, ...parameters },
        reason: 'generic research keyword matched data analysis',
      };
    }

    if (/(experiment|ablation|protocol|robustness|adversarial|time[-\s]?series|实验|鲁棒)/i.test(queryText)) {
      return {
        skillName: 'experiment_design',
        params: { topic: title, requirements: description, ...parameters },
        reason: 'generic research keyword matched experiment design',
      };
    }

    return {
      skillName: 'research_planning',
      params: { topic: title, context: description, ...parameters },
      reason: 'generic research defaulted to research planning',
    };
  }

  private async loadSkillMarketPromptSkills() {
    const agentId = this.toText(getConfig('redigg.agentId', 'REDIGG_AGENT_ID'), '');
    if (!agentId) {
      console.log('Skipping Skill API sync: redigg.agentId / REDIGG_AGENT_ID is not configured.');
      return;
    }

    const records = await this.client.getAgentSkills(agentId);
    if (!Array.isArray(records) || records.length === 0) {
      console.log(`No Skill API bindings found for agent ${agentId}.`);
      return;
    }

    let loaded = 0;
    for (const record of records) {
      if (record?.enabled === false) continue;

      const skillId = this.toText(record?.skill_id || record?.skill?.id || record?.id, '');
      if (!skillId) continue;

      const markdown = await this.client.getSkillRaw(skillId);
      if (!this.toText(markdown, '')) {
        console.warn(`Skipping skill ${skillId}: empty skill markdown.`);
        continue;
      }

      const skillName = this.toText(record?.skill?.name || record?.name, skillId);
      const skillDescription = this.toText(record?.skill?.description || record?.description, '');
      const skillVersion = this.toText(record?.skill?.version || record?.version, '');
      const rawTags = (record as any)?.skill?.tags || (record as any)?.tags || (record as any)?.skill?.parameters?.tags;
      const tags = Array.isArray(rawTags)
        ? rawTags.map((item: unknown) => this.toText(item, '')).filter((item: string) => item.length > 0)
        : [];
      const runtimeName = `skill:${skillId}`;

      this.skills.register(
        createPromptMarketSkill({
          runtimeName,
          skillId,
          name: skillName,
          description: skillDescription,
          version: skillVersion || undefined,
          markdown,
        })
      );

      this.registerDynamicSkillAlias(runtimeName, runtimeName);
      this.registerDynamicSkillAlias(skillId, runtimeName);
      this.registerDynamicSkillAlias(skillName, runtimeName);
      this.upsertDynamicSkillDescriptor(runtimeName, skillId, skillName, skillDescription, tags);
      loaded += 1;
    }

    console.log(`Skill API sync completed: loaded ${loaded} prompt skills.`);
  }

  private routeTaskToSkill(task: any): TaskSkillRoute {
    const taskType = this.toText(task?.type, '').toLowerCase();
    const title = this.toText(task?.idea_title || task?.title, 'Untitled research task');
    const description = this.toText(task?.content || task?.idea_description || task?.description, '');
    const parameters = this.parseTaskParameters(task);
    const mergedText = `${title}\n${description}`.toLowerCase();

    const explicitSkillId = this.toText(
      (parameters as any)?.skill_id || (parameters as any)?.skillId || task?.skill_id || task?.skillId,
      ''
    );
    const explicitSkillName = this.toText(
      (parameters as any)?.skill_name || (parameters as any)?.skillName || task?.skill_name || task?.skillName,
      ''
    );
    const skillFromTaskType = taskType.startsWith('skill:') ? taskType : '';
    const dynamicTarget = explicitSkillId || explicitSkillName || skillFromTaskType || taskType;
    
    if (this.skills.get(dynamicTarget)) {
      return {
        skillName: dynamicTarget,
        params: { topic: title, context: description, task_type: taskType, ...parameters },
        reason: `explicit skill match (${dynamicTarget})`,
      };
    }

    const dynamicSkillName = this.resolveDynamicSkillName(dynamicTarget);

    if (dynamicSkillName) {
      return {
        skillName: dynamicSkillName,
        params: { topic: title, context: description, task_type: taskType, ...parameters },
        reason: `dynamic skill matched (${dynamicTarget})`,
      };
    }

    const genericResearchRoute = this.routeGenericResearchTask(taskType, title, description, parameters);
    if (genericResearchRoute) {
      return genericResearchRoute;
    }

    if (taskType === 'literature_review') {
      return {
        skillName: 'literature_review',
        params: { topic: title, context: description, ...parameters },
        reason: 'task.type=literature_review',
      };
    }

    if (taskType === 'peer_review') {
      return {
        skillName: 'peer_review',
        params: { proposal: description || title, ...parameters },
        reason: 'task.type=peer_review',
      };
    }

    if (taskType === 'research_planning' || taskType === 'research_plan' || taskType === 'proposal_planning') {
      return {
        skillName: 'research_planning',
        params: { topic: title, context: description, ...parameters },
        reason: `task.type=${taskType}`,
      };
    }

    if (taskType === 'experiment_design') {
      return {
        skillName: 'experiment_design',
        params: { topic: title, requirements: description, ...parameters },
        reason: 'task.type=experiment_design',
      };
    }

    if (taskType === 'data_analysis') {
      return {
        skillName: 'data_analysis',
        params: { topic: title, data: description, requirements: title, ...parameters },
        reason: 'task.type=data_analysis',
      };
    }

    if (taskType === 'citation_formatting') {
      return {
        skillName: 'citation_formatting',
        params: { papers: parameters?.papers || [], style: parameters?.style || 'apa', output_type: parameters?.output_type || 'bibliography', ...parameters },
        reason: 'task.type=citation_formatting',
      };
    }

    if (taskType === 'data_visualization' || taskType === 'chart_generation' || taskType === 'visualization') {
      return {
        skillName: 'data_visualization',
        params: { data: parameters?.data || [], chart_type: parameters?.chart_type || 'bar', title: parameters?.title || 'Research Data Visualization', x_axis: parameters?.x_axis || 'x', y_axis: parameters?.y_axis || 'y', ...parameters },
        reason: `task.type=${taskType}`,
      };
    }

    if (taskType === 'grammar_and_polishing' || taskType === 'proofreading' || taskType === 'editing') {
      return {
        skillName: 'grammar_and_polishing',
        params: { text: parameters?.text || '', tone: parameters?.tone || 'academic', language: parameters?.language || 'en', ...parameters },
        reason: `task.type=${taskType}`,
      };
    }

    if (taskType === 'research_highlight_extraction' || taskType === 'highlight_extraction' || taskType === 'takeaway_extraction') {
      return {
        skillName: 'research_highlight_extraction',
        params: { text: parameters?.text || '', source_type: parameters?.source_type || 'paper', ...parameters },
        reason: `task.type=${taskType}`,
      };
    }

    if (
      taskType === 'paper_writing' ||
      taskType === 'manuscript' ||
      taskType === 'manuscript_writing' ||
      taskType === 'paper_drafting'
    ) {
      return {
        skillName: 'paper_writing',
        params: { topic: title, context: description, ...parameters },
        reason: `task.type=${taskType}`,
      };
    }

    if (/(peer[\s_-]*review|rebuttal|审稿|评审)/i.test(mergedText)) {
      return {
        skillName: 'peer_review',
        params: { proposal: description || title, ...parameters },
        reason: 'keyword matched peer review',
      };
    }

    if (/(paper|manuscript|论文|draft|写作|write)/i.test(mergedText)) {
      return {
        skillName: 'paper_writing',
        params: { topic: title, context: description, ...parameters },
        reason: 'keyword matched paper writing',
      };
    }

    if (/(experiment|protocol|methodology|ablation|实验|方法)/i.test(mergedText)) {
      return {
        skillName: 'experiment_design',
        params: { topic: title, requirements: description, ...parameters },
        reason: 'keyword matched experiment design',
      };
    }

    if (/(analysis|analy[sz]e|dataset|statistics|回归|分析|数据)/i.test(mergedText)) {
      return {
        skillName: 'data_analysis',
        params: { topic: title, data: description, requirements: title, ...parameters },
        reason: 'keyword matched data analysis',
      };
    }

    if (/(citation|reference|bibliography|apa|mla|chicago|ieee|引用|参考文献)/i.test(mergedText)) {
      return {
        skillName: 'citation_formatting',
        params: { papers: parameters?.papers || [], style: parameters?.style || 'apa', output_type: parameters?.output_type || 'bibliography', ...parameters },
        reason: 'keyword matched citation formatting',
      };
    }

    if (/(visualization|chart|graph|plot|figure|图表|可视化|画图)/i.test(mergedText)) {
      return {
        skillName: 'data_visualization',
        params: { data: parameters?.data || [], chart_type: parameters?.chart_type || 'bar', title: parameters?.title || 'Research Data Visualization', x_axis: parameters?.x_axis || 'x', y_axis: parameters?.y_axis || 'y', ...parameters },
        reason: 'keyword matched data visualization',
      };
    }

    if (/(grammar|polish|proofread|edit|writing|语法|润色|校对|编辑)/i.test(mergedText)) {
      return {
        skillName: 'grammar_and_polishing',
        params: { text: parameters?.text || '', tone: parameters?.tone || 'academic', language: parameters?.language || 'en', ...parameters },
        reason: 'keyword matched grammar and polishing',
      };
    }

    if (/(highlight|takeaway|key finding|summary|亮点|要点|摘要|总结)/i.test(mergedText)) {
      return {
        skillName: 'research_highlight_extraction',
        params: { text: parameters?.text || '', source_type: parameters?.source_type || 'paper', ...parameters },
        reason: 'keyword matched research highlight extraction',
      };
    }

    if (/(plan|roadmap|proposal|hypothesis|计划|路线图|假设)/i.test(mergedText)) {
      return {
        skillName: 'research_planning',
        params: { topic: title, context: description, ...parameters },
        reason: 'keyword matched research planning',
      };
    }

    return {
      skillName: 'literature_review',
      params: { topic: title, context: description, ...parameters },
      reason: 'fallback to literature review',
    };
  }

  private firstN(text: unknown, n = 220): string {
    const asText = this.toText(text, '');
    if (!asText) return '';
    if (asText.length <= n) return asText;
    return `${asText.slice(0, n)}...`;
  }

  private buildSubmissionPayload(skillName: string, result: any, task: any) {
    let reply = 'Completed';
    let proposal: any | undefined;

    const summary = this.toText(result?.summary || result?.analysis || result?.plan || result?.design || result?.manuscript, '');
    const keyFindings = Array.isArray(result?.key_findings)
      ? result.key_findings.join('; ')
      : this.toText(result?.key_findings, '');
    const nextSteps = this.toText(result?.next_steps, 'Peer review required');

    if (skillName === 'peer_review') {
      reply = this.toText(result?.review, 'Peer review completed.');
      return { reply, proposal: undefined };
    }

    if (skillName === 'literature_review') {
      const paperCount = Array.isArray(result?.papers) ? result.papers.length : 0;
      reply = paperCount > 0 ? `Found ${paperCount} relevant papers. Review complete.` : 'Literature review completed.';
      proposal = {
        summary: this.firstN(summary, 220),
        content: summary,
        key_findings: keyFindings || (paperCount > 0 ? `Found ${paperCount} relevant papers on "${this.toText(task?.idea_title || task?.title, 'the target topic')}"` : 'Generated by Redigg Agent'),
        next_steps: nextSteps,
      };
      return { reply, proposal };
    }

    if (skillName === 'paper_writing') {
      const manuscript = this.toText(result?.manuscript || result?.summary, summary);
      reply = 'Manuscript draft completed.';
      proposal = {
        summary: this.firstN(manuscript, 220),
        content: manuscript,
        key_findings: keyFindings || 'Generated manuscript draft with structured scientific sections.',
        next_steps: nextSteps || 'Run peer review and language polishing before final submission.',
      };
      return { reply, proposal };
    }

    if (['research_planning', 'experiment_design', 'data_analysis'].includes(skillName)) {
      reply = `${skillName} completed.`;
      proposal = {
        summary: this.firstN(summary, 220),
        content: summary,
        key_findings: keyFindings || `Generated output from ${skillName}.`,
        next_steps: nextSteps || 'Convert this output into execution tasks.',
      };
      return { reply, proposal };
    }

    reply = this.toText(result?.reply, 'Completed');
    if (summary) {
      proposal = {
        summary: this.firstN(summary, 220),
        content: summary,
        key_findings: keyFindings || 'Generated by Redigg Agent.',
        next_steps: nextSteps || 'Continue iterative research.',
      };
    }

    return { reply, proposal };
  }

  public async executeTask(
    task: any,
    isInteractive: boolean = false,
    onLog?: (type: string, content: string, metadata?: any) => void
  ): Promise<any> {
    if (!onLog) console.log(`Executing task ${task.id}...`);

    const route = this.routeTaskToSkill(task);
    let skillName = route.skillName;
    let params = route.params;
    let selectedSkill = this.skills.get(skillName);

    if (!selectedSkill) {
      if (!onLog) console.error(`Skill ${skillName} not found. Attempting fallback to literature_review.`);
      skillName = 'literature_review';
      params = {
        topic: this.toText(task?.idea_title || task?.title, 'Untitled research task'),
        context: this.toText(task?.content || task?.idea_description || task?.description, ''),
      };
      selectedSkill = this.skills.get(skillName);
    }

    if (!selectedSkill) {
      throw new Error('No executable skill available. Please register at least one built-in or MCP skill.');
    }

    if (!onLog) console.log(`Using skill: ${skillName} (${route.reason})`);

    try {
      const research_id = this.toText(task?.research_id || task?.id, '');
      const rawStepNumber = Number(task?.step_number);
      const step_number = Number.isFinite(rawStepNumber) && rawStepNumber > 0 ? rawStepNumber : 1;

      const log = async (
        type: 'thinking' | 'action' | 'tool_call' | 'tool_result' | 'result' | 'error',
        content: string,
        metadata?: any
      ) => {
        const logEntry = {
          timestamp: new Date().toISOString(),
          type,
          content,
          metadata,
          agent_id: getConfig('redigg.agentId', 'REDIGG_AGENT_ID'),
          agent_name: getConfig('redigg.agentName', 'REDIGG_AGENT_NAME'),
        };

        if (onLog) {
          onLog(type, content, metadata);
        } else {
          // Default Local log
          console.log(`[${type.toUpperCase()}] ${content}`);
          if (metadata) {
            console.log(`  Metadata: ${JSON.stringify(metadata)}`);
          }
        }

        // Upload to server only if not interactive or if explicitly requested
        if (!isInteractive) {
            await this.gateway.uploadLog(research_id, step_number, logEntry);
        }
      };

      const updateProgress = async (progress: number, description: string, details?: any) => {
        if (!isInteractive) {
            await this.gateway.updateProgress(research_id, progress, description, details);
        }
      };

      const updateTodo = async (
        todoId: string,
        status: 'pending' | 'in_progress' | 'completed' | 'cancelled',
        content?: string
      ) => {
        if (!isInteractive) {
            await this.gateway.updateTodo(research_id, todoId, status, content);
        }
      };

      const addTodo = async (content: string, priority: 'high' | 'medium' | 'low', stepNumber?: number) => {
        if (!isInteractive) {
            await this.gateway.addTodo(research_id, content, priority, stepNumber);
        }
      };

      // Create a wrapper for LLM to support streaming in interactive mode
      const llmWrapper = {
          generateCompletion: async (messages: any, onToken?: any, tools?: any) => {
             if (isInteractive && onLog && !tools) {
                onLog('stream_start', '');
                const res = await this.llm.generateCompletion(messages, (token, type) => {
                    if (type === 'reasoning') {
                        onLog('reasoning_token', token);
                    } else {
                        onLog('token', token);
                        if (onToken) onToken(token);
                    }
                }, tools);
                onLog('stream_end', '');
                
                if (res.usage) {
                    onLog('usage', JSON.stringify(res.usage));
                }
                return res;
             }
             const res = await this.llm.generateCompletion(messages, onToken, tools);
             if (res.usage && onLog) onLog('usage', JSON.stringify(res.usage));
             return res;
          },
          generateStructured: (messages: any, schema: any) => this.llm.generateStructured(messages, schema)
      } as unknown as LLMProvider;

      const defaultWorkspace: string = (params && (params as any).workspace) ? (params as any).workspace : path.join(homedir(), '.redigg', 'workspace');
      if (!fs.existsSync(defaultWorkspace)) fs.mkdirSync(defaultWorkspace, { recursive: true });

      const context: any = {
          profile: this.profile,
          llm: llmWrapper,
          workspace: defaultWorkspace,
          research_id,
          step_number,
          agent_id: getConfig('redigg.agentId', 'REDIGG_AGENT_ID'),
          agent_name: getConfig('redigg.agentName', 'REDIGG_AGENT_NAME'),
          log,
          updateProgress,
          updateTodo,
          addTodo,
      };

      context.invokeSkill = async (name: string, skillParams: any) => {
          const skill = this.skills.get(name);
          if (!skill) throw new Error(`Skill ${name} not found`);
          // if (onLog) onLog('action', `Invoking sub-skill: ${name}`); // Optional logging
          return skill.execute(context, skillParams);
      };

      context.listSkills = async () => {
          return this.skills.all().map(s => ({
              name: s.name,
              description: s.description
          }));
      };

      const result = await selectedSkill.execute(context, params);

      const { reply, proposal } = this.buildSubmissionPayload(skillName, result, task);
      
      if (!isInteractive) {
          await this.gateway.submitResult(task.id, { reply, proposal, ...result });
          console.log(`Submitted result for task ${task.id}`);
      }
      
      return { success: true, reply, proposal, result };
    } catch (error) {
      console.error(`Task execution failed for ${task.id}`, error);
      if (isInteractive) {
          throw error;
      }
      return { success: false, error };
    }
  }
}
