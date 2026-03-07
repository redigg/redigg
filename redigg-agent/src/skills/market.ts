import type { Skill, SkillContext } from './index';

export interface PromptMarketSkillDefinition {
  runtimeName: string;
  skillId: string;
  name: string;
  description?: string;
  version?: string;
  markdown: string;
}

type SkillLogType = 'thinking' | 'action' | 'tool_call' | 'tool_result' | 'result' | 'error';

function toText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function firstN(text: string, n = 240): string {
  const clean = toText(text, '');
  if (!clean) return '';
  if (clean.length <= n) return clean;
  return `${clean.slice(0, n)}...`;
}

function parseJsonFromText(raw: string): Record<string, unknown> | null {
  const text = toText(raw, '');
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch {
    // Fallback parsing below.
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      const parsed = JSON.parse(fenced[1].trim());
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch {
      // Ignore and continue.
    }
  }

  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) {
    const candidate = text.slice(first, last + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeKeyFindings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => toText(item, '')).filter((item) => item.length > 0).slice(0, 12);
  }

  const text = toText(value, '');
  if (!text) return [];

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^([-*]|\d+\.)\s+/.test(line))
    .map((line) => line.replace(/^([-*]|\d+\.)\s+/, '').trim())
    .filter((line) => line.length > 0);

  if (lines.length > 0) return lines.slice(0, 12);
  return [firstN(text, 180)];
}

async function safeLog(ctx: SkillContext, type: SkillLogType, content: string, metadata?: unknown) {
  try {
    await Promise.resolve(ctx.log(type, content, metadata));
  } catch {
    // Keep execution resilient when remote logging is unavailable.
  }
}

function buildPrompt(def: PromptMarketSkillDefinition, params: Record<string, unknown>) {
  const promptContext = {
    topic: params.topic,
    context: params.context,
    task_type: params.task_type,
    parameters: params,
  };

  return `You are executing a reusable research skill from Redigg Skill Market.
Skill name: ${def.name}
Skill id: ${def.skillId}
Skill version: ${def.version || 'unknown'}

Skill documentation (Markdown):
<<<SKILL_MARKDOWN
${def.markdown}
SKILL_MARKDOWN>>>

Task context (JSON):
${JSON.stringify(promptContext, null, 2)}

Return JSON only with keys:
- summary: concise plain-text summary
- key_findings: array of bullet points
- content: markdown body
- next_steps: concise actionable next steps

If the skill markdown conflicts with the output format, keep the output JSON schema above as the outer wrapper and place detailed content in "content".`;
}

export function createPromptMarketSkill(def: PromptMarketSkillDefinition): Skill {
  return {
    name: def.runtimeName,
    description: def.description || `Prompt skill synced from Skill API: ${def.name}`,
    execute: async (ctx, params) => {
      const topic = toText((params as any)?.topic, 'General research task');
      const prompt = buildPrompt(def, (params || {}) as Record<string, unknown>);

      await safeLog(ctx, 'thinking', `Executing prompt skill: ${def.name}`, {
        skill_id: def.skillId,
        runtime_name: def.runtimeName,
      });
      await safeLog(ctx, 'tool_call', 'Calling LLM for prompt skill execution', {
        skill_id: def.skillId,
        prompt_length: prompt.length,
      });

      const response = await ctx.llm.generateCompletion([
        {
          role: 'system',
          content:
            'You are a reliable scientific agent. Follow provided skill documentation, but always return valid JSON as requested.',
        },
        { role: 'user', content: prompt },
      ]);

      const raw = toText(response?.content, '');
      const parsed = parseJsonFromText(raw);
      const summary = toText(parsed?.summary, firstN(raw, 240) || `${def.name} executed.`);
      const content = toText(parsed?.content, raw || summary);
      const keyFindings = normalizeKeyFindings(parsed?.key_findings);
      const nextSteps = toText(parsed?.next_steps, 'Review and iterate on this output before submission.');

      await safeLog(ctx, 'tool_result', 'Prompt skill execution completed', {
        skill_id: def.skillId,
        output_length: content.length,
      });

      return {
        topic,
        summary,
        content,
        key_findings: keyFindings,
        next_steps: nextSteps,
        source_skill: {
          id: def.skillId,
          name: def.name,
          version: def.version || null,
        },
      };
    },
  };
}
