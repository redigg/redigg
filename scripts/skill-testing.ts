import * as fs from 'fs';
import * as path from 'path';

const GATEWAY_URL = 'http://localhost:4000';
const A2A_ENDPOINT = `${GATEWAY_URL}/a2a/jsonrpc`;

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

let results: TestResult[] = [];

async function sendA2ARequest(prompt: string): Promise<{ response: string; latency: number; error?: string }> {
  const startTime = Date.now();

  try {
    const response = await fetch(A2A_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'message/send',
        params: {
          message: {
            messageId: `test-${Date.now()}`,
            role: 'user',
            parts: [{ kind: 'text', text: prompt }],
            kind: 'message',
          },
          configuration: { blocking: false },
        },
        id: Math.floor(Math.random() * 1000000),
      }),
    });

    const data = await response.json();
    const latency = Date.now() - startTime;

    if (data.error) {
      return { response: '', latency, error: data.error.message };
    }

    if (data.result?.parts?.[0]?.text) {
      return { response: data.result.parts[0].text, latency };
    }

    return { response: '', latency, error: 'No response text found' };
  } catch (error) {
    const latency = Date.now() - startTime;
    return { response: '', latency, error: String(error) };
  }
}

async function testSkill(test: SkillTest): Promise<TestResult> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📝 SKILL: ${test.skill}`);
  console.log(`📋 PROMPT: ${test.prompt}`);
  console.log('='.repeat(80));

  const { response, latency, error } = await sendA2ARequest(test.prompt);

  const result: TestResult = {
    skill: test.skill,
    prompt: test.prompt,
    success: !error && response.length > 0,
    response,
    latency,
    error,
  };

  if (result.success) {
    console.log(`\n✅ SUCCESS (${latency}ms)`);
    console.log(`\n${'-'.repeat(40)}`);
    console.log('📤 RESPONSE:');
    console.log('-'.repeat(40));
    console.log(response.substring(0, 1000));
    if (response.length > 1000) {
      console.log(`... [${response.length - 1000} more characters]`);
    }
  } else {
    console.log(`\n❌ FAILED (${latency}ms)`);
    console.log(`\n${'-'.repeat(40)}`);
    console.log('📤 ERROR:');
    console.log('-'.repeat(40));
    console.log(error || 'No response received');
  }

  return result;
}

async function testAllSkills(): Promise<TestResult[]> {
  results = [];

  for (const test of skillTests) {
    const result = await testSkill(test);
    results.push(result);

    await new Promise(resolve => setTimeout(resolve, 300));
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

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    SKILL TESTING SUITE                                      ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log(`\n🌐 Gateway: ${GATEWAY_URL}`);
  console.log(`📊 Total Tests: ${skillTests.length}`);
  console.log('');

  await testAllSkills();

  console.log(`\n${'='.repeat(80)}`);
  console.log('TESTING COMPLETE - GENERATING REPORT');
  console.log('='.repeat(80));

  const analysis = analyzeResults(results);
  const report = generateReport(results, analysis);

  const reportPath = path.join(process.cwd(), 'tests/skills/skill-test-report.md');
  fs.writeFileSync(reportPath, report);

  console.log(`\n📄 Report saved to: ${reportPath}`);

  console.log(`\n${'='.repeat(80)}`);
  console.log('FINAL SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Total:   ${analysis.total}`);
  console.log(`  Passed:  ${analysis.passed}`);
  console.log(`  Failed:  ${analysis.failed}`);
  console.log(`  Rate:    ${((analysis.passed / analysis.total) * 100).toFixed(1)}%`);

  console.log(`\n${'='.repeat(80)}`);
  console.log('BY CATEGORY');
  console.log('='.repeat(80));
  Object.entries(analysis.byCategory).forEach(([cat, data]) => {
    const rate = ((data.passed / data.total) * 100).toFixed(0);
    const bar = '█'.repeat(Math.round(data.passed / data.total * 10)) + '░'.repeat(10 - Math.round(data.passed / data.total * 10));
    console.log(`  ${cat.padEnd(15)} ${bar} ${data.passed}/${data.total} (${rate}%)`);
  });

  if (analysis.slowSkills.length > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log('SLOW SKILLS (>10s avg)');
    console.log('='.repeat(80));
    analysis.slowSkills.forEach(s => {
      console.log(`  ${s.skill.padEnd(25)} ${(s.latency / 1000).toFixed(1)}s`);
    });
  }

  process.exit(analysis.failed > analysis.total * 0.3 ? 1 : 0);
}

main().catch(console.error);