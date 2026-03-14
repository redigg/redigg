import { END, START, StateGraph, type StateGraphArgs } from '@langchain/langgraph';
import type { Session } from '../../session/SessionManager.js';

export type ProgressEventType =
  | 'token'
  | 'log'
  | 'plan'
  | 'todo'
  | 'thinking'
  | 'stats'
  | 'session_title'
  | 'done'
  | 'error';
export type ProgressHandler = (type: ProgressEventType, content: any) => void;
export type LogHandler = (content: string, stats?: any) => void;

export type Plan = { intent: string; steps: any[] };

export type ChatGraphState = {
  userId: string;
  message: string;
  session: Session;
  options?: { autoMode?: boolean };
  onProgress?: ProgressHandler;
  log: LogHandler;
  sendPlan: (plan: { steps: any[] }) => void;
  sendStepThinking: (stepId: string, token: string) => void;
  isConversational: boolean;
  shouldPlan: boolean;
  plan: Plan | null;
  reply: string;
  accumulatedArtifacts: any[];
};

export type ChatGraphDeps = {
  createPlan: (args: {
    message: string;
    log: LogHandler;
    forceAuto: boolean;
    onProgress?: ProgressHandler;
  }) => Promise<Plan>;
  executePlan: (args: {
    userId: string;
    session: Session;
    message: string;
    plan: Plan;
    log: LogHandler;
    onProgress?: ProgressHandler;
    sendPlan: (plan: { steps: any[] }) => void;
    sendStepThinking: (stepId: string, token: string) => void;
    accumulatedArtifacts: any[];
  }) => Promise<{ reply: string; accumulatedArtifacts: any[] }>;
  executeLegacy: (args: {
    userId: string;
    session: Session;
    message: string;
    log: LogHandler;
    onProgress?: ProgressHandler;
  }) => Promise<string>;
  postProcess: (args: {
    userId: string;
    session: Session;
    message: string;
    reply: string;
    log: LogHandler;
    onProgress?: ProgressHandler;
  }) => Promise<void>;
};

const channels: StateGraphArgs<ChatGraphState>['channels'] = {
  userId: { value: (_prev, next) => next, default: () => '' },
  message: { value: (_prev, next) => next, default: () => '' },
  session: { value: (_prev, next) => next, default: () => null as any },
  options: { value: (_prev, next) => next, default: () => undefined },
  onProgress: { value: (_prev, next) => next, default: () => undefined },
  log: { value: (_prev, next) => next, default: () => (() => undefined) as any },
  sendPlan: { value: (_prev, next) => next, default: () => (() => undefined) as any },
  sendStepThinking: { value: (_prev, next) => next, default: () => (() => undefined) as any },
  isConversational: { value: (_prev, next) => next, default: () => false },
  shouldPlan: { value: (_prev, next) => next, default: () => false },
  plan: { value: (_prev, next) => next, default: () => null },
  reply: { value: (_prev, next) => next, default: () => '' },
  accumulatedArtifacts: {
    value: (prev, next) => (Array.isArray(next) ? prev.concat(next) : prev),
    default: () => [],
  },
};

export function buildChatGraph(deps: ChatGraphDeps) {
  const decidePlanning = async (state: ChatGraphState) => {
    const normalized = state.message.trim().replace(/[!.?]+$/, '');
    const isConversational = /^(hello|hi|hey|thanks|thank you|bye|goodbye|ok|okay|yes|no|cool|great|wow|who are you|what are you)\b/i.test(
      normalized
    );
    const shouldPlan = !isConversational || Boolean(state.options?.autoMode);
    return { isConversational, shouldPlan };
  };

  const createPlan = async (state: ChatGraphState) => {
    try {
      const plan = await deps.createPlan({
        message: state.message,
        log: state.log,
        forceAuto: Boolean(state.options?.autoMode),
        onProgress: state.onProgress,
      });

      if (Array.isArray(plan.steps) && plan.steps.length > 0) {
        state.sendPlan({ steps: plan.steps });
      }

      return { plan };
    } catch (error) {
      state.log('[Agent] Planning failed, falling back to legacy logic');
      return { plan: { intent: 'single', steps: [] } };
    }
  };

  const executePlan = async (state: ChatGraphState) => {
    if (!state.plan) {
      return {};
    }

    const result = await deps.executePlan({
      userId: state.userId,
      session: state.session,
      message: state.message,
      plan: state.plan,
      log: state.log,
      onProgress: state.onProgress,
      sendPlan: state.sendPlan,
      sendStepThinking: state.sendStepThinking,
      accumulatedArtifacts: state.accumulatedArtifacts,
    });

    return {
      reply: result.reply,
      accumulatedArtifacts: result.accumulatedArtifacts,
    };
  };

  const executeLegacy = async (state: ChatGraphState) => {
    const reply = await deps.executeLegacy({
      userId: state.userId,
      session: state.session,
      message: state.message,
      log: state.log,
      onProgress: state.onProgress,
    });

    return { reply };
  };

  const postProcess = async (state: ChatGraphState) => {
    if (!state.reply) {
      return {};
    }

    await deps.postProcess({
      userId: state.userId,
      session: state.session,
      message: state.message,
      reply: state.reply,
      log: state.log,
      onProgress: state.onProgress,
    });

    return {};
  };

  const routeAfterDecide = (state: ChatGraphState) => (state.shouldPlan ? 'create_plan' : 'legacy');

  const routeAfterPlan = (state: ChatGraphState) => {
    const hasSteps = Boolean(state.plan && Array.isArray(state.plan.steps) && state.plan.steps.length > 0);
    return hasSteps ? 'execute_plan' : 'legacy';
  };

  const graph = new StateGraph<ChatGraphState>({ channels })
    .addNode('decide_planning', decidePlanning)
    .addNode('create_plan', createPlan)
    .addNode('execute_plan', executePlan)
    .addNode('legacy', executeLegacy)
    .addNode('post_process', postProcess)
    .addEdge(START, 'decide_planning')
    .addConditionalEdges('decide_planning', routeAfterDecide)
    .addConditionalEdges('create_plan', routeAfterPlan)
    .addEdge('execute_plan', 'post_process')
    .addEdge('legacy', 'post_process')
    .addEdge('post_process', END)
    .compile();

  return graph;
}
