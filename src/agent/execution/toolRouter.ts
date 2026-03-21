import type { SkillManager } from '../../skills/SkillManager.js';

export const TOOL_ALIASES: Record<string, string> = {
  LiteratureReview: 'academic_survey_self_improve',
  PaperAnalysis: 'paper_analysis',
  ConceptExplainer: 'concept_explainer',
  PdfGenerator: 'pdf_generator',
  CodeAnalysis: 'code_analysis',
  MemorySearch: 'memory_management',
  FileOps: 'local_file_ops',
  AgentOrchestration: 'agent_orchestration',
  Evolution: 'evolution',
  Heartbeat: 'heartbeat',
  MemoryManagement: 'memory_management',
  SessionManagement: 'session_management',
  Scheduling: 'scheduling',
  SkillManagement: 'skill_management'
};

export function resolveToolToSkillId(skillManager: SkillManager, tool: string): string | null {
  if (!tool) return null;
  const direct = skillManager.getSkill(tool) ? tool : null;
  if (direct) return direct;
  const aliased = TOOL_ALIASES[tool];
  if (aliased && skillManager.getSkill(aliased)) return aliased;
  return null;
}
