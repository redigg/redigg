import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SkillManager } from '../../src/skills/SkillManager.js';
import { MemoryManager } from '../../src/memory/MemoryManager.js';
import { MockLLMClient } from '../../src/llm/LLMClient.js';
import { SQLiteStorage } from '../../src/storage/sqlite.js';
import fs from 'fs';
import path from 'path';

describe('SkillManager - Vendor Skills', () => {
  let memoryManager: MemoryManager;
  let dbPath: string;
  let llm: MockLLMClient;
  let skillManager: SkillManager;
  let testWorkspace: string;

  beforeEach(async () => {
    dbPath = path.join(process.cwd(), 'data', 'test-vendor.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    const storage = new SQLiteStorage(dbPath);
    llm = new MockLLMClient();
    memoryManager = new MemoryManager(storage, llm);
    
    // Create a temporary workspace with a mock vendor skill
    testWorkspace = path.join(process.cwd(), 'test-workspace');
    if (!fs.existsSync(testWorkspace)) fs.mkdirSync(testWorkspace);
    
    const vendorDir = path.join(testWorkspace, 'skills', 'vendor');
    fs.mkdirSync(vendorDir, { recursive: true });
    
    // Create PACK.md
    fs.writeFileSync(path.join(vendorDir, 'PACK.md'), '# Vendor Pack');
    
    // Create a mock OpenClaw skill (markdown only)
    const mockSkillDir = path.join(vendorDir, 'mock-agent');
    fs.mkdirSync(mockSkillDir);
    fs.writeFileSync(path.join(mockSkillDir, 'SKILL.md'), `---
name: Mock Agent
description: A mock agent for testing OpenClaw adapter
---
# Mock Agent
Does nothing.
`);

    skillManager = new SkillManager(llm, memoryManager, testWorkspace);
    await skillManager.loadSkillsFromDisk();
  });

  afterEach(() => {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  it('should load OpenClaw skill as a shell skill adapter', () => {
    const skill = skillManager.getSkill('mock-agent');
    expect(skill).toBeDefined();
    expect(skill?.name).toBe('Mock Agent');
    expect(skill?.description).toBe('A mock agent for testing OpenClaw adapter');
  });

  it('should execute the adapter skill', async () => {
    const result = await skillManager.executeSkill('mock-agent', 'user1', {});
    expect(result.success).toBe(true);
    expect(result.message).toContain('Executed OpenClaw skill mock-agent');
  });
});
