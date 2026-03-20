import type { Session } from '../../session/SessionManager.js';
import type { AgentProgressHandler } from '../../protocol/progress.js';

export async function runPlan(args: {
  userId: string;
  session: Session;
  plan: { intent: string; steps: any[] };
  log: (content: string, stats?: any) => void;
  onProgress?: AgentProgressHandler;
  sendPlan: (plan: { steps: any[] }) => void;
  sendStepThinking: (stepId: string, token: string) => void;
  accumulatedArtifacts: any[];
  isStopped: () => boolean;
  executeStep: (
    step: any,
    userId: string,
    session: Session,
    log: (c: string, stats?: any) => void,
    onProgress?: AgentProgressHandler,
    accumulatedArtifacts?: any[],
    planSteps?: any[],
    sendStepThinking?: (stepId: string, token: string) => void
  ) => Promise<{ output: string; artifacts: any[]; usage?: { promptTokens: number; completionTokens: number } }>;
  addAssistantMessage: (reply: string, metadata?: any) => void;
  onStepError: (message: string, error: unknown) => void;
}): Promise<{ reply: string; accumulatedArtifacts: any[] }> {
  const {
    userId,
    session,
    plan,
    log,
    onProgress,
    sendPlan,
    sendStepThinking,
    executeStep,
    addAssistantMessage,
    onStepError,
  } = args;

  let reply = '';
  const accumulatedArtifacts = Array.isArray(args.accumulatedArtifacts) ? [...args.accumulatedArtifacts] : [];

  if (!(plan.intent === 'multi_step' || (plan.intent === 'single' && plan.steps.length > 0))) {
    return { reply: '', accumulatedArtifacts };
  }

  for (const step of plan.steps) {
    if (args.isStopped()) {
      log('[Agent] Session stopped by user.');
      return { reply: 'Session stopped by user.', accumulatedArtifacts };
    }

    step.status = 'in_progress';
    sendPlan({ steps: plan.steps });

    onProgress?.('segment', {
      id: String(step.id || `${step.tool}:${step.description}`),
      type: step.tool === 'Chat' ? 'chat' : 'action',
      title: String(step.description || step.tool || 'Step'),
      status: 'active'
    });

    if (step.tool && step.tool !== 'Chat') {
      onProgress?.('token', `\n\n${step.description}\n`);
    }

    let retryCount = 0;
    const maxRetries = 2;
    let success = false;
    const stepStartTime = Date.now();

    while (retryCount <= maxRetries && !success) {
      try {
        if (retryCount > 0) {
          log(`[Agent] Retry ${retryCount}/${maxRetries} for step: ${step.description}`);
        } else {
          log(`[${step.tool}] ${step.description}`);
        }

        const result = await executeStep(
          step,
          userId,
          session,
          log,
          onProgress,
          accumulatedArtifacts,
          plan.steps,
          sendStepThinking
        );

        if (result.artifacts && result.artifacts.length > 0) {
          accumulatedArtifacts.push(...result.artifacts);
        }

        const duration = Date.now() - stepStartTime;
        const tokens = result.usage
          ? result.usage.completionTokens + (result.usage.promptTokens || 0)
          : typeof result.output === 'string'
            ? Math.ceil(result.output.length / 4)
            : 0;

        log(`[${step.tool}] Step completed`, { duration, tokens });

        step.status = 'completed';
        step.result = result.output;
        success = true;

        onProgress?.('segment', {
          id: String(step.id || `${step.tool}:${step.description}`),
          type: step.tool === 'Chat' ? 'chat' : 'action',
          title: String(step.description || step.tool || 'Step'),
          status: 'completed'
        });

        if (step.tool && step.tool !== 'Chat') {
          onProgress?.('token', `\n${step.description}：完成。\n`);
        }

        if (step.tool === 'Chat') {
          reply = result.output;
        }
      } catch (e) {
        retryCount++;
        const errorMsg = String(e);
        const duration = Date.now() - stepStartTime;
        onStepError(`Step failed (Attempt ${retryCount}): ${step.description}`, e);

        if (retryCount > maxRetries) {
          step.status = 'failed';
          step.error = errorMsg;
          log(`[Error] Step failed permanently: ${step.description}`, { duration });

          onProgress?.('segment', {
            id: String(step.id || `${step.tool}:${step.description}`),
            type: step.tool === 'Chat' ? 'chat' : 'action',
            title: String(step.description || step.tool || 'Step'),
            status: 'error',
            error: errorMsg
          });
        } else {
          log(`[Warning] Step failed, retrying... (${errorMsg})`, { duration });
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    sendPlan({ steps: plan.steps });
  }

  if (!reply) {
    const completedSteps = plan.steps.filter(s => s.status === 'completed');
    const failedSteps = plan.steps.filter(s => s.status === 'failed');

    let summary = 'I have completed the requested tasks.\n\n';
    if (completedSteps.length > 0) {
      summary += '**Completed:**\n' + completedSteps.map(s => `- ${s.description}`).join('\n') + '\n';
    }
    if (failedSteps.length > 0) {
      summary += '\n**Failed:**\n' + failedSteps.map(s => `- ${s.description}: ${s.error}`).join('\n');
    }

    reply = summary;
    const metadata = accumulatedArtifacts.length > 0 ? { attachments: accumulatedArtifacts } : undefined;
    addAssistantMessage(reply, metadata);
  }

  return { reply, accumulatedArtifacts };
}
