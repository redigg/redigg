import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { A2AGateway } from '../../src/gateway/index.js';
import { ResearchAgent } from '../../src/agent/ResearchAgent.js';
import { MemoryManager } from '../../src/memory/MemoryManager.js';
import { MemoryEvolutionSystem } from '../../src/memory/evolution/MemoryEvolutionSystem.js';
import { MockLLMClient } from '../../src/llm/LLMClient.js';
import { SQLiteStorage } from '../../src/storage/sqlite.js';
import type { Server } from 'http';

let GATEWAY_URL = 'http://localhost:4000';
let CHAT_ENDPOINT = `${GATEWAY_URL}/api/chat`;

interface TestResult {
  skill: string;
  prompt: string;
  success: boolean;
  response: string;
  latency: number;
  error?: string;
}

interface SkillTest {
  skill: string;
  prompt: string;
  category: 'calculation' | 'information' | 'file' | 'research' | 'code' | 'system' | 'communication';
}

const skillTests: SkillTest[] = [
  { skill: 'calculator', prompt: 'What is 123 * 456?', category: 'calculation' },
  { skill: 'calculator', prompt: 'What is sqrt(81)?', category: 'calculation' },
  { skill: 'calculator', prompt: 'What is 25% of 200?', category: 'calculation' },
  { skill: 'get_current_time', prompt: 'What is the current time?', category: 'information' },
  { skill: 'get_current_time', prompt: 'What day of the week is it?', category: 'information' },
  { skill: 'local_file_ops', prompt: 'List files in the current directory', category: 'file' },
  { skill: 'local_file_ops', prompt: 'Show me the package.json content', category: 'file' },
  { skill: 'shell', prompt: 'Run echo hello', category: 'file' },
  { skill: 'code_analysis', prompt: 'Analyze the code structure of src/agent/ResearchAgent.ts', category: 'code' },
  { skill: 'memory_search', prompt: 'Search for any stored memories about research', category: 'system' },
  { skill: 'paper_search', prompt: 'Search for papers about machine learning', category: 'research' },
  { skill: 'paper_summarizer', prompt: 'Summarize the key points of a research paper about AI', category: 'research' },
  { skill: 'bibtex_manager', prompt: 'Show how to add a new BibTeX entry', category: 'research' },
  { skill: 'literature_review', prompt: 'How do I write a literature review?', category: 'research' },
  { skill: 'gap_analyzer', prompt: 'What is a research gap analysis?', category: 'research' },
  { skill: 'hypothesis_generator', prompt: 'Generate a hypothesis about AI safety', category: 'research' },
  { skill: 'data_analysis', prompt: 'How do I analyze a dataset?', category: 'research' },
  { skill: 'plot_generator', prompt: 'How do I create a publication-quality figure?', category: 'research' },
  { skill: 'figure_generator', prompt: 'Generate a diagram showing the research workflow', category: 'research' },
  { skill: 'latex_helper', prompt: 'How do I write LaTeX equations?', category: 'research' },
  { skill: 'pdf_generator', prompt: 'How do I generate a PDF report?', category: 'research' },
  { skill: 'browser_control', prompt: 'Open example.com in browser', category: 'system' },
  { skill: 'session_management', prompt: 'Show my current sessions', category: 'system' },
  { skill: 'memory_management', prompt: 'Show me my memory statistics', category: 'system' },
  { skill: 'skill_management', prompt: 'List all available skills', category: 'system' },
  { skill: 'scheduling', prompt: 'Schedule a research review for tomorrow', category: 'system' },
  { skill: 'agent_orchestration', prompt: 'How do you coordinate multiple agents?', category: 'system' },
  { skill: 'evolution', prompt: 'How does the research agent evolve over time?', category: 'system' },
];

async function sendChatRequest(prompt: string): Promise<{ response: string; latency: number; error?: string }> {
  const startTime = Date.now();

  try {
    const response = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        userId: 'skill-test',
      }),
    });

    const data = await response.json();
    const latency = Date.now() - startTime;

    if (!response.ok) {
      return { response: '', latency, error: data?.error || `HTTP ${response.status}` };
    }

    if (typeof data?.reply === 'string') {
      return { response: data.reply, latency };
    }

    return { response: '', latency, error: 'No response text found' };
  } catch (error) {
    const latency = Date.now() - startTime;
    return { response: '', latency, error: String(error) };
  }
}

async function testSkill(test: SkillTest): Promise<TestResult> {
  console.log(`  Testing: ${test.skill} - "${test.prompt.substring(0, 50)}..."`);

  const { response, latency, error } = await sendChatRequest(test.prompt);

  return {
    skill: test.skill,
    prompt: test.prompt,
    success: !error && response.length > 0,
    response: response.substring(0, 500),
    latency,
    error,
  };
}

async function testAllSkills(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const test of skillTests) {
    const result = await testSkill(test);
    results.push(result);

    const status = result.success ? '✅' : '❌';
    console.log(`  ${status} ${result.skill} (${result.latency}ms)`);

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

function analyzeResults(results: TestResult[]) {
  const byCategory: Record<string, { total: number; passed: number; failed: number }> = {};
  const bySkill: Record<string, { total: number; passed: number; avgLatency: number }> = {};

  const skillToCategory: Record<string, string> = {};
  skillTests.forEach(t => skillToCategory[t.skill] = t.category);

  const slowSkills: Array<{ skill: string; latency: number }> = [];

  results.forEach(r => {
    const category = skillToCategory[r.skill] || 'unknown';

    if (!byCategory[category]) {
      byCategory[category] = { total: 0, passed: 0, failed: 0 };
    }
    byCategory[category].total++;

    if (!bySkill[r.skill]) {
      bySkill[r.skill] = { total: 0, passed: 0, avgLatency: 0 };
    }
    bySkill[r.skill].total++;

    if (r.success) {
      byCategory[category].passed++;
      bySkill[r.skill].passed++;
    } else {
      byCategory[category].failed++;
    }

    bySkill[r.skill].avgLatency += r.latency;
  });

  Object.keys(bySkill).forEach(skill => {
    bySkill[skill].avgLatency = Math.round(bySkill[skill].avgLatency / bySkill[skill].total);
    if (bySkill[skill].avgLatency > 10000) {
      slowSkills.push({ skill, latency: bySkill[skill].avgLatency });
    }
  });

  slowSkills.sort((a, b) => b.latency - a.latency);

  return {
    total: results.length,
    passed: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    byCategory,
    bySkill,
    slowSkills: slowSkills.slice(0, 5),
  };
}

function generateReport(results: TestResult[], analysis: ReturnType<typeof analyzeResults>): string {
  const lines: string[] = [];

  lines.push('# Skill Testing Report');
  lines.push('');
  lines.push(`**Date**: ${new Date().toISOString()}`);
  lines.push(`**Gateway**: ${GATEWAY_URL}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Tests | ${analysis.total} |`);
  lines.push(`| Passed | ${analysis.passed} |`);
  lines.push(`| Failed | ${analysis.failed} |`);
  lines.push(`| Pass Rate | ${((analysis.passed / analysis.total) * 100).toFixed(1)}% |`);
  lines.push('');
  lines.push('## By Category');
  lines.push('');
  lines.push(`| Category | Total | Passed | Failed | Rate |`);
  lines.push(`|----------|-------|--------|--------|------|`);
  Object.entries(analysis.byCategory).forEach(([cat, data]) => {
    const rate = ((data.passed / data.total) * 100).toFixed(0);
    lines.push(`| ${cat} | ${data.total} | ${data.passed} | ${data.failed} | ${rate}% |`);
  });
  lines.push('');

  if (analysis.slowSkills.length > 0) {
    lines.push('## Slow Skills (>10s avg)');
    lines.push('');
    lines.push(`| Skill | Avg Latency |`);
    lines.push(`|-------|-------------|`);
    analysis.slowSkills.forEach(s => {
      lines.push(`| ${s.skill} | ${(s.latency / 1000).toFixed(1)}s |`);
    });
    lines.push('');
  }

  lines.push('## Detailed Results');
  lines.push('');

  Object.entries(analysis.bySkill).forEach(([skill, data]) => {
    const status = data.passed === data.total ? '✅' : data.passed > 0 ? '⚠️' : '❌';
    lines.push(`### ${status} ${skill}`);
    lines.push('');
    lines.push(`- Tests: ${data.total}, Passed: ${data.passed}, Failed: ${data.total - data.passed}`);
    lines.push(`- Avg Latency: ${(data.avgLatency / 1000).toFixed(1)}s`);
    lines.push('');

    const skillResults = results.filter(r => r.skill === skill);
    skillResults.forEach(r => {
      const testStatus = r.success ? '✅' : '❌';
      lines.push(`**${testStatus} Test**: "${r.prompt}"`);
      if (r.error) {
        lines.push(`> Error: ${r.error}`);
      } else {
        lines.push(`> ${r.response.substring(0, 200)}${r.response.length > 200 ? '...' : ''}`);
      }
      lines.push('');
    });
  });

  return lines.join('\n');
}

describe('Skill Testing Suite', () => {
  let results: TestResult[] = [];
  let gateway: A2AGateway | null = null;
  let server: Server | null = null;

  beforeAll(async () => {
    const storage = new SQLiteStorage(':memory:');
    const memoryManager = new MemoryManager(storage);
    const llm = new MockLLMClient();
    const memoryEvo = new MemoryEvolutionSystem(memoryManager, llm);
    const agent = new ResearchAgent(memoryManager, memoryEvo, llm);
    gateway = new A2AGateway(agent, 0);
    server = await gateway.start();
    const port = gateway.getPort();

    GATEWAY_URL = `http://localhost:${port}`;
    CHAT_ENDPOINT = `${GATEWAY_URL}/api/chat`;
    process.env.PORT = String(port);
    process.env.PUBLIC_BASE_URL = GATEWAY_URL;

    console.log('Starting skill testing...');
    console.log(`Gateway: ${GATEWAY_URL}`);
    console.log('');

    results = await testAllSkills();
  }, 300000);

  afterAll(async () => {
    if (gateway) {
      await gateway.stop();
    } else if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
    }

    console.log('');
    console.log('Generating report...');

    const analysis = analyzeResults(results);
    const report = generateReport(results, analysis);

    console.log(report);

    const reportPath = path.join(process.cwd(), 'tests/skills/skill-test-report.md');
    fs.writeFileSync(reportPath, report);
    console.log(`Report saved to: ${reportPath}`);
  });

  it('should test all skills', () => {
    expect(results.length).toBe(skillTests.length);
  });

  it('should have acceptable pass rate (>70%)', () => {
    const passed = results.filter(r => r.success).length;
    const rate = passed / results.length;
    expect(rate).toBeGreaterThan(0.7);
  });
});
