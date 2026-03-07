import { intro, outro, text, spinner, isCancel, log, confirm, select } from '@clack/prompts';
import pc from 'picocolors';
import { AgentRuntime } from '../agent/runtime';
import { randomUUID } from 'crypto';
import { marked } from 'marked';
// @ts-ignore
import TerminalRenderer from 'marked-terminal';
import { getConfig } from '../config';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import * as readline from 'readline';
import { extractBulletList } from '../skills';

marked.setOptions({
  // @ts-ignore
  renderer: new TerminalRenderer(),
});

const SESSION_FILE = path.join(homedir(), '.redigg', 'session.json');

function saveSession(topic: string, history: string[]) {
  try {
    const dir = path.dirname(SESSION_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ topic, history, timestamp: Date.now() }));
  } catch (e) {
    // ignore
  }
}

function loadSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    }
  } catch (e) {
    return null;
  }
  return null;
}

function createLogHandler(s: any, state: { isStreaming: boolean, reasoningBuffer: string, spinnerStopped: boolean, lastUpdate: number, tokenCount: number }) {
  return (type: string, content: string, metadata?: any) => {
    switch (type) {
      case 'stream_start':
        if (!state.isStreaming) {
          // Do not stop spinner here, update its message instead
          state.isStreaming = true;
          state.reasoningBuffer = '';
          state.spinnerStopped = false;
          state.lastUpdate = 0;
          state.tokenCount = 0;
          s.message(pc.dim('Thinking...'));
        }
        break;
      case 'reasoning_token':
        if (state.isStreaming) {
             if (!state.spinnerStopped) {
                 state.reasoningBuffer += content;
                 state.tokenCount++;
                 
                 const now = Date.now();
                 if (now - state.lastUpdate > 100) {
                     // Only show token count, not the content
                     s.message(pc.dim(`Thinking... (${state.tokenCount} tokens)`));
                     state.lastUpdate = now;
                 }
             } else {
                 process.stdout.write(pc.dim(content));
             }
        }
        break;
      case 'token':
        if (state.isStreaming) {
            if (!state.spinnerStopped) {
                s.stop(pc.dim('Thinking complete.'));
                state.spinnerStopped = true;
                process.stdout.write('\n');
            }
            process.stdout.write(content);
        }
        break;
      case 'stream_end':
        if (state.isStreaming) {
          state.isStreaming = false;
          if (state.spinnerStopped) {
              process.stdout.write('\n\n');
              s.start('Continuing...');
              state.spinnerStopped = false;
          } else {
              s.message(pc.dim('Done.'));
          }
        }
        break;
      case 'thinking':
        if (state.isStreaming) return;
        s.message(pc.italic(content));
        break;
      case 'action':
        if (state.isStreaming) return;
        s.stop(pc.blue(`Action: ${content}`));
        s.start('Executing...');
        break;
      case 'tool_call':
        if (state.isStreaming) return;
        const toolMsg = metadata?.tool_name ? `Using tool: ${metadata.tool_name}` : `Tool: ${content}`;
        s.stop(pc.cyan(toolMsg));
        s.start('Running tool...');
        break;
      case 'tool_result':
        if (state.isStreaming) return;
        const resultText = content.length > 50 ? content.slice(0, 50) + '...' : content;
        s.stop(pc.dim(`Tool Result: ${resultText}`));
        s.start('Continuing...');
        break;
      case 'error':
        if (state.isStreaming) {
          state.isStreaming = false;
          process.stdout.write('\n');
        }
        log.error(content);
        break;
      case 'usage':
        try {
            const usage = JSON.parse(content);
            const total = usage.total_tokens || 0;
            console.log(pc.dim(`   (Tokens: ${total} | In: ${usage.prompt_tokens} | Out: ${usage.completion_tokens})`));
        } catch (e) {}
        break;
    }
  };
}

export async function startInteractiveSession() {
  console.clear();
  
  const agentId = getConfig('redigg.agentId') || 'Anonymous';
  const agentName = getConfig('redigg.agentName') || 'Redigg Agent';
  // Use .redigg directly, remove intermediate 'workspace' folder
  const workspaceBase = path.join(homedir(), '.redigg');
  
  intro(pc.bgCyan(pc.black(` ${agentName} (${agentId}) `)));
  console.log(pc.dim(`📂 Base Directory: ${workspaceBase}`));

  const agent = new AgentRuntime();
  let sessionHistory: string[] = [];
  let currentTopic = '';

  // Resume check
  const saved = loadSession();
  if (saved && saved.history && saved.history.length > 0) {
      const resume = await confirm({ 
          message: `Found previous session on "${saved.topic || 'Untitled'}". Resume?` 
      });
      if (resume && !isCancel(resume)) {
          sessionHistory = saved.history;
          currentTopic = saved.topic || '';
          log.success('Session resumed.');
      }
  }

  while (true) {
    const input = await text({
      message: sessionHistory.length > 0 ? 'What is the next step?' : 'What would you like to research?',
      placeholder: sessionHistory.length > 0 ? 'e.g., "Summarize the findings"' : 'e.g., "Review latest papers on multimodal LLMs"',
    });

    if (isCancel(input)) {
      outro('Goodbye!');
      process.exit(0);
    }

    const trimmed = input.toString().trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('/')) {
      const cmd = trimmed.toLowerCase();
      if (cmd === '/exit' || cmd === '/quit') {
        outro('Goodbye!');
        process.exit(0);
      }
      if (cmd === '/help') {
        log.info(pc.cyan('Commands:'));
        log.message('  /exit, /quit  - Exit the CLI');
        log.message('  /clear        - Clear screen');
        log.message('  /new, /reset  - Clear session context');
        continue;
      }
      if (cmd === '/clear') {
        console.clear();
        intro(pc.bgCyan(pc.black(` ${agentName} (${agentId}) `)));
        continue;
      }
      if (cmd === '/new' || cmd === '/reset') {
        sessionHistory = [];
        currentTopic = '';
        saveSession('', []); // Clear saved session
        log.success('Session context cleared.');
        continue;
      }
      log.error(`Unknown command: ${cmd}`);
      continue;
    }

    // Set topic if new or reset
    if (!currentTopic || sessionHistory.length === 0) {
        currentTopic = trimmed.length > 50 ? trimmed.slice(0, 50) + '...' : trimmed;
        
        // Template Selection
        const outputType = await select({
            message: 'Select research output format:',
            options: [
                { value: 'survey', label: 'Survey Paper', hint: 'Comprehensive review, taxonomy, comparisons' },
                { value: 'article', label: 'Deep Dive Article', hint: 'Narrative-driven, analytical, argumentative' },
                { value: 'report', label: 'Technical Report', hint: 'Data-driven, factual, actionable' },
                { value: 'custom', label: 'General Research', hint: 'Standard mode' }
            ],
        });
        
        if (isCancel(outputType)) {
            outro('Goodbye!');
            process.exit(0);
        }
        
        let templateGuideline = '';
        switch (outputType) {
            case 'survey': 
                templateGuideline = 'OUTPUT REQUIREMENT: Format as a comprehensive Survey Paper. Focus on breadth, categorization (taxonomy), and comparative analysis of existing works.'; 
                break;
            case 'article': 
                templateGuideline = 'OUTPUT REQUIREMENT: Format as a Deep Dive Article. Focus on narrative flow, in-depth analysis of key concepts, and building a strong argument.'; 
                break;
            case 'report': 
                templateGuideline = 'OUTPUT REQUIREMENT: Format as a Technical Report. Focus on concise facts, key data points, and actionable recommendations. Use bullet points heavily.'; 
                break;
        }
        
        if (templateGuideline) {
            sessionHistory.push(templateGuideline);
        }
    }

    // Setup Workspace based on topic (directly under .redigg)
    const sanitizedTopic = currentTopic.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 50);
    const currentWorkspace = path.join(homedir(), '.redigg', sanitizedTopic);
    if (!fs.existsSync(currentWorkspace)) fs.mkdirSync(currentWorkspace, { recursive: true });

    const s = spinner();
    s.start('Analyzing request...');

    try {
      const taskId = randomUUID();
      const task = {
        id: taskId,
        type: 'research',
        title: currentTopic,
        content: trimmed,
        status: 'running',
        step_number: 1,
        parameters: {
            workspace: currentWorkspace,
            context: sessionHistory.length > 0 
                ? `--- Previous Context ---\n${sessionHistory.join('\n\n')}\n--- End Context ---` 
                : undefined
        }
      };

      const logState = { isStreaming: false, reasoningBuffer: '', spinnerStopped: false, lastUpdate: 0, tokenCount: 0 };
      const result = await agent.executeTask(
        task,
        true,
        createLogHandler(s, logState)
      );

      s.stop('Task completed');

      if (result.success) {
        if (result.reply) {
             console.log('');
             console.log(pc.bold(pc.green('Reply:')));
             try {
                 console.log(marked(result.reply));
             } catch (e) {
                 console.log(result.reply);
             }
             
             try {
                 const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                 const filename = `response_${timestamp}.md`;
                 const fullPath = path.join(currentWorkspace, filename);
                 fs.writeFileSync(fullPath, result.reply);
                 // Format path as ~/.redigg/...
                 const displayPath = fullPath.replace(homedir(), '~');
                 console.log(pc.dim(`💾 Output saved to: ${displayPath}`));
             } catch (e) {}
        }

        let summaryForHistory = '';
        if (result.proposal && result.proposal.content) {
            console.log(pc.dim('──────────────────────────────────────────────────'));
            try {
                console.log(marked(result.proposal.content));
            } catch (e) {
                console.log(result.proposal.content);
            }
            console.log(pc.dim('──────────────────────────────────────────────────'));
            summaryForHistory = result.proposal.summary || result.proposal.content;
        } else if (result.result && result.result.summary) {
            console.log(pc.dim('──────────────────────────────────────────────────'));
            try {
                console.log(marked(result.result.summary));
            } catch (e) {
                console.log(result.result.summary);
            }
            console.log(pc.dim('──────────────────────────────────────────────────'));
            summaryForHistory = result.result.summary;
        } else {
            summaryForHistory = result.reply || '';
        }

        if (summaryForHistory) {
             const shortSummary = summaryForHistory.length > 500 ? summaryForHistory.slice(0, 500) + '...' : summaryForHistory;
             sessionHistory.push(`User Step: ${trimmed}\nResult Summary: ${shortSummary}`);
             if (sessionHistory.length > 10) sessionHistory.shift();
             saveSession(currentTopic, sessionHistory); // Save after update
        }

        // Autonomous Loop Check
        const milestones = result.result?.milestones || [];
        if (milestones.length > 0) {
            let finalMilestones = milestones;
            
            const action = await select({
                message: `I have identified ${milestones.length} milestones. How would you like to proceed?`,
                options: [
                    { value: 'execute', label: '🚀 Execute Plan', hint: 'Run autonomously as is' },
                    { value: 'optimize_depth', label: '🔍 Optimize for Depth', hint: 'Add verification steps' },
                    { value: 'optimize_speed', label: '⚡ Optimize for Speed', hint: 'Streamline critical path' },
                    { value: 'edit', label: '✏️  Edit Manually', hint: 'Modify steps' },
                    { value: 'cancel', label: '❌ Cancel' }
                ]
            });

            if (isCancel(action) || action === 'cancel') continue;

            if (action === 'edit') {
                 const newPlan = await text({
                     message: 'Edit milestones (comma separated):',
                     initialValue: milestones.join(', '),
                     placeholder: 'Step 1, Step 2'
                 });
                 if (isCancel(newPlan)) continue;
                 finalMilestones = newPlan.toString().split(',').map(s => s.trim()).filter(Boolean);
            } else if (action === 'optimize_depth' || action === 'optimize_speed') {
                 const sOpt = spinner();
                 sOpt.start('Optimizing plan...');
                 try {
                     const prompt = action === 'optimize_depth' 
                         ? `Refine these milestones for maximum rigor:\n${milestones.join('\n')}\nOutput as bullet list.`
                         : `Simplify for speed:\n${milestones.join('\n')}\nOutput as bullet list.`;
                     
                     const optRes = await agent.executeTask({ id: randomUUID(), type: 'general', title: 'Optimize', content: prompt }, false); 
                     
                     if (optRes.success) {
                         const extracted = extractBulletList(optRes.reply || '', 'Step');
                         if (extracted.length > 0) {
                             finalMilestones = extracted;
                             sOpt.stop(`Optimized to ${finalMilestones.length} steps.`);
                              log.success('New Plan:\n' + finalMilestones.map((m: string) => `- ${m}`).join('\n'));
                          } else {
                             sOpt.stop('Optimization output unclear.');
                         }
                     }
                 } catch (e) { sOpt.stop('Optimization failed.'); }
            }

            if (finalMilestones.length > 0) {
               log.info(pc.bold('🚀 Starting Autonomous Research Loop'));
               
               for (let i = 0; i < finalMilestones.length; i++) {
                   const milestone = finalMilestones[i];
                   
                   // Dashboard View - Clear and Redraw
                   console.clear();
                   intro(pc.bgCyan(pc.black(` ${agentName} (${agentId}) `)));
                   console.log(pc.bold('📋 Current Research: ') + pc.cyan(currentTopic));
                   console.log(pc.bold('📍 Progress: ') + pc.yellow(`Step ${i+1}/${finalMilestones.length}`));
                   console.log(pc.dim('──────────────────────────────────────────────────'));
                   console.log(pc.bold(`Current Task: ${milestone}`));
                   console.log('\n');
                   
                   const subTask = {
                      id: randomUUID(),
                      type: 'general',
                      title: milestone,
                      content: `Execute this milestone: "${milestone}".
You have access to file system and research tools.
Use them to complete the task.
Context:
${sessionHistory.join('\n')}`,
                      parameters: { 
                          workspace: currentWorkspace,
                          redigg_api_key: getConfig('redigg.apiKey', 'REDIGG_API_KEY')
                      },
                      step_number: i + 2
                   };

                   const subS = spinner();
                   subS.start(`Executing step ${i+1}...`);
                   const subLogState = { isStreaming: false, reasoningBuffer: '', spinnerStopped: false, lastUpdate: 0, tokenCount: 0 };
                   
                   try {
                       const subResult = await agent.executeTask(subTask, true, createLogHandler(subS, subLogState));
                       
                       // We don't have a direct way to check spinner state on this object, 
                       // but createLogHandler manages stopping it for 'stream_end'.
                       // If we are here, executeTask finished. 
                       // We can just log completion.
                       console.log(pc.green('✔ Step completed'));
                       
                       if (!subResult.success) {
                           const retry = await confirm({ message: `Step ${i+1} failed. Retry?` });
                           if (retry && !isCancel(retry)) {
                               i--; 
                               continue;
                           } else {
                               log.warn('Stopping autonomous loop.');
                               break; 
                           }
                       }
                       
                       const subSummary = subResult.reply || subResult.result?.summary || '';
                       sessionHistory.push(`Step ${i+1}: ${milestone}\nResult: ${subSummary}`);
                       saveSession(currentTopic, sessionHistory); // Save after each step
                       
                   } catch (e: any) {
                       subS.stop('Step error');
                       log.error(e.message);
                       const retry = await confirm({ message: `Error in step ${i+1}. Retry?` });
                       if (retry && !isCancel(retry)) {
                           i--;
                       } else {
                           break;
                       }
                   }
               }
               log.success('Autonomous loop finished.');
            }
        }

      } else {
        s.stop('Task failed');
        log.error(result.error?.message || String(result.error));
      }

    } catch (error: any) {
      s.stop('An error occurred');
      log.error(pc.red(`Error: ${error.message}`));
      if (error.stack) {
          console.error(pc.dim(error.stack));
      }
    }
  }
}
