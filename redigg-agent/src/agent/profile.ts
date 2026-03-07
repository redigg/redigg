
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { AGENT_PROFILE_FILE, PROFILES_DIR } from '../config/workspace';

export interface AgentProfile {
  name: string;
  description?: string;
  model?: string;
  tools?: string[];
  capabilities?: string[];
  system_prompt: string;
  environment?: Record<string, any>;
}

export function loadMainProfile(): AgentProfile {
  if (!fs.existsSync(AGENT_PROFILE_FILE)) {
    // If main profile missing, create default or throw?
    // Better to throw and ask for init.
    // But for robustness, maybe return a default object?
    // Let's throw.
    throw new Error(`Agent profile not found at ${AGENT_PROFILE_FILE}. Please run "redigg init" first.`);
  }
  return parseProfile(AGENT_PROFILE_FILE);
}

export function loadProfile(name: string): AgentProfile | null {
  // Normalize name
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '');
  const file = path.join(PROFILES_DIR, `${safeName}.md`);
  if (!fs.existsSync(file)) return null;
  return parseProfile(file);
}

export function listProfiles(): string[] {
    if (!fs.existsSync(PROFILES_DIR)) return [];
    return fs.readdirSync(PROFILES_DIR)
        .filter(f => f.endsWith('.md'))
        .map(f => f.replace('.md', ''));
}

function parseProfile(filePath: string): AgentProfile {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { data, content: body } = matter(content);
  
  return {
    name: data.name || 'Unknown',
    description: data.description,
    model: data.model,
    tools: data.tools || [],
    capabilities: data.capabilities || [],
    system_prompt: body.trim(),
    environment: data.environment,
  };
}
