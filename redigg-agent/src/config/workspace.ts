
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

const home = process.env.REDIGG_HOME || homedir();
export const REDIGG_DIR = path.join(home, '.redigg');
export const WORKSPACE_DIR = path.join(REDIGG_DIR, 'workspace');
export const CONFIG_FILE = path.join(REDIGG_DIR, 'config.yaml');
export const AGENT_PROFILE_FILE = path.join(REDIGG_DIR, 'agent.md');
export const PROFILES_DIR = path.join(REDIGG_DIR, 'profiles');

export function ensureWorkspace() {
  if (!fs.existsSync(REDIGG_DIR)) fs.mkdirSync(REDIGG_DIR, { recursive: true });
  if (!fs.existsSync(WORKSPACE_DIR)) fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  if (!fs.existsSync(PROFILES_DIR)) fs.mkdirSync(PROFILES_DIR, { recursive: true });
}

export function createDefaultAgentProfile() {
  if (fs.existsSync(AGENT_PROFILE_FILE)) return;
  
  const content = `---
name: "RediggAssistant"
model: "claude-3-5-sonnet"
tools: ["search", "fs"]
---

# System Prompt
You are a rigorous research assistant. You prefer primary sources and verifiable data.
When conducting research, you should:
1. Search for relevant literature.
2. Read and synthesize findings.
3. Generate a structured report.
`;
  fs.writeFileSync(AGENT_PROFILE_FILE, content);
}

export function createDefaultProfiles() {
    const researcherProfile = path.join(PROFILES_DIR, 'researcher.md');
    if (!fs.existsSync(researcherProfile)) {
        fs.writeFileSync(researcherProfile, `---
name: "Researcher"
description: "Specialized in literature review and data gathering"
tools: ["search", "read_file"]
---

# System Prompt
You are a specialized researcher agent. Your goal is to find, read, and summarize information.
`);
    }

    const coderProfile = path.join(PROFILES_DIR, 'coder.md');
    if (!fs.existsSync(coderProfile)) {
        fs.writeFileSync(coderProfile, `---
name: "Coder"
description: "Specialized in writing and executing code"
tools: ["execute_command", "write_file", "read_file"]
---

# System Prompt
You are a specialized coding agent. You write robust, testable code.
`);
    }
}
