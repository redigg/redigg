#!/usr/bin/env node
import { Command } from 'commander';
import { setConfig, getConfig } from './config';
import { AgentRuntime } from './agent/runtime';
import { RediggClient } from './api/client';
import { WorkspaceManager } from './workspace';
import { startInteractiveSession } from './cli/interactive';
import { 
    ensureWorkspace, 
    createDefaultAgentProfile, 
    createDefaultProfiles,
    REDIGG_DIR 
} from './config/workspace';
import fs from 'fs';
import path from 'path';
import { intro, text, outro, select, confirm } from '@clack/prompts';
import pc from 'picocolors';

const program = new Command();

program
  .name('redigg')
  .description('Redigg Agent CLI for Autonomous Research')
  .version('0.1.0');

program
  .command('init')
  .description('Interactive setup wizard')
  .action(async () => {
    console.clear();
    intro(pc.bgCyan(pc.black(' Redigg Agent Setup ')));
    
    ensureWorkspace();
    createDefaultAgentProfile();
    createDefaultProfiles();
    
    console.log(pc.green(`✅ Workspace initialized at ${REDIGG_DIR}`));
    
    const rediggKey = await text({ 
        message: 'Enter Redigg API Key (Optional)',
        placeholder: 'sk-redigg-...',
        initialValue: getConfig('redigg.apiKey') || ''
    });
    if (typeof rediggKey === 'string' && rediggKey.trim()) {
        setConfig('redigg.apiKey', rediggKey.trim());
    }

    const openaiKey = await text({ 
        message: 'Enter OpenAI API Key',
        placeholder: 'sk-...',
        initialValue: getConfig('openai.apiKey') || ''
    });
    if (typeof openaiKey === 'string' && openaiKey.trim()) {
        setConfig('openai.apiKey', openaiKey.trim());
    }

    const openaiBaseUrl = await text({ 
        message: 'Enter OpenAI Base URL (Optional)',
        placeholder: 'https://api.openai.com/v1',
        initialValue: getConfig('openai.baseUrl') || ''
    });
    if (typeof openaiBaseUrl === 'string' && openaiBaseUrl.trim()) {
        setConfig('openai.baseUrl', openaiBaseUrl.trim());
    }
    
    const openaiModel = await text({ 
        message: 'Enter OpenAI Model (Optional)',
        placeholder: 'gpt-4-turbo',
        initialValue: getConfig('openai.model') || ''
    });
    if (typeof openaiModel === 'string' && openaiModel.trim()) {
        setConfig('openai.model', openaiModel.trim());
    }

    const tavilyKey = await text({ 
        message: 'Enter Tavily API Key (Optional, for Web Search)',
        placeholder: 'tvly-...',
        initialValue: getConfig('tavily.apiKey') || ''
    });
    if (typeof tavilyKey === 'string' && tavilyKey.trim()) {
        setConfig('tavily.apiKey', tavilyKey.trim());
    }

    outro(pc.green('Configuration saved successfully!'));
  });

program
  .command('status')
  .description('Check agent status and configuration')
  .action(async () => {
    console.log(pc.bold('\n🤖 Agent Status'));
    
    const agentId = getConfig('redigg.agentId');
    const agentName = getConfig('redigg.agentName');
    console.log(`Identity: ${agentName ? pc.cyan(agentName) : 'Unknown'} ${agentId ? pc.dim(`(${agentId})`) : ''}`);
    
    const rediggKey = getConfig('redigg.apiKey');
    console.log(`Redigg API: ${rediggKey ? pc.green('Configured') : pc.yellow('Missing')}`);
    
    const openaiKey = getConfig('openai.apiKey');
    console.log(`LLM API:    ${openaiKey ? pc.green('Configured') : pc.red('Missing')}`);
    
    const client = new RediggClient();
    if (rediggKey) {
        try {
            // Simple check by listing tasks or just assuming key implies auth until used
            // Client doesn't have a specific "ping" but getTasks works
            process.stdout.write('Connecting to Redigg... ');
            const tasks = await client.getTasks();
            console.log(pc.green('Online ✅'));
            console.log(`Pending Tasks: ${tasks.data?.length || 0}`);
        } catch (e: any) {
            console.log(pc.red('Offline ❌'));
            console.log(pc.dim(e.message));
        }
    } else {
        console.log('Redigg Connection: Skipped (No Key)');
    }
    console.log('');
  });

program
  .command('config')
  .description('Manage configuration')
  .argument('<action>', 'get or set')
  .argument('[key]', 'config key')
  .argument('[value]', 'config value')
  .action((action, key, value) => {
    if (action === 'set' && key && value) {
      setConfig(key, value);
      console.log(pc.green(`Set ${key} = ${value}`));
    } else if (action === 'get' && key) {
      const val = getConfig(key);
      console.log(`${key} = ${val ? val : pc.dim('(empty)')}`);
    } else {
      console.log('Usage: redigg config set <key> <value> | redigg config get <key>');
    }
  });

program
  .command('login')
  .description('Login to Redigg')
  .argument('<key>', 'Redigg API Key')
  .action((key) => {
    setConfig('redigg.apiKey', key);
    console.log(pc.green('Logged in successfully.'));
  });

program
  .command('register')
  .description('Register a new agent')
  .argument('<name>', 'Agent Name')
  .option('-t, --token <token>', 'Owner Token')
  .action(async (name, options) => {
    const client = new RediggClient();
    try {
      const data = await client.register(name, options.token);
      
      const apiKey = data?.api_key || data?.agent?.api_key || data?.data?.api_key;
      const agentId = data?.agent?.id || data?.data?.agent?.id || data?.data?.id;
      const agentName = data?.agent?.name || data?.data?.agent?.name || name;
      const claimUrl = data?.claim_url || data?.data?.claim_url;

      if (apiKey) setConfig('redigg.apiKey', apiKey);
      if (agentId) setConfig('redigg.agentId', agentId);
      if (agentName) setConfig('redigg.agentName', agentName);
      
      console.log(pc.green(`✅ Agent "${agentName}" registered successfully!`));
      if (agentId) console.log(`ID: ${agentId}`);
      if (claimUrl) {
          console.log(pc.yellow('\n⚠️  Action Required:'));
          console.log(`Please visit the following URL to claim this agent and get your API Key:`);
          console.log(pc.underline(pc.cyan(claimUrl)));
          
          // Poll for completion if we have a claim URL
          const spinner = require('ora')('Waiting for agent claim...');
          spinner.start();
          
          let attempts = 0;
          while (attempts < 60) { // 2 minutes timeout
              await new Promise(r => setTimeout(r, 2000));
              try {
                  const me = await client.getMe();
                  if (me && me.api_key) {
                      setConfig('redigg.apiKey', me.api_key);
                      if (me.id) setConfig('redigg.agentId', me.id);
                      if (me.name) setConfig('redigg.agentName', me.name);
                      
                      spinner.succeed(pc.green('Agent claimed successfully!'));
                      console.log(`ID: ${me.id}`);
                      return;
                  }
              } catch (e) {
                  // Ignore errors while polling
              }
              attempts++;
          }
          spinner.stop();
          console.log(pc.dim('Polling timed out. Please configure the API Key manually once claimed using: redigg config set redigg.apiKey <key>'));
      }
    } catch (error: any) {
      console.error(pc.red('Registration failed:'), error.response?.data || error.message);
    }
  });

program
  .command('tasks')
  .description('List available tasks on Redigg server')
  .action(async () => {
      const client = new RediggClient();
      try {
        const tasks = await client.getTasks();
        if (!tasks.data || tasks.data.length === 0) {
            console.log(pc.yellow('No pending tasks found.'));
            return;
        }
        console.log(pc.bold(`Found ${tasks.data.length} tasks:`));
        tasks.data.forEach((task: any) => {
           console.log(`${pc.cyan(task.id)} - ${task.idea_title || 'Untitled'} [${task.status}]`);
        });
      } catch (error: any) {
        if (error.response) {
             if (error.response.headers['content-type']?.includes('text/html')) {
                 console.error(pc.red('Error: API returned HTML (likely 404 page). Check REDIGG_API_BASE configuration.'));
             } else {
                 console.error(pc.red(`API Error ${error.response.status}:`), error.response.data);
             }
        } else {
             console.error(pc.red('Network Error:'), error.message);
        }
      }
  });


const workspaceManager = new WorkspaceManager();

program
  .command('workspace')
  .description('Workspace management')
  .addCommand(new Command('create')
    .description('Create a new workspace')
    .argument('<name>', 'Workspace name')
    .action((name) => {
      const workspace = workspaceManager.create(name);
      console.log(`✅ Workspace created: ${workspace.name} (ID: ${workspace.id})`);
    })
  )
  .addCommand(new Command('list')
    .description('List all workspaces')
    .action(() => {
      const workspaces = workspaceManager.list();
      if (workspaces.length === 0) {
        console.log('📭 No workspaces found');
        return;
      }
      console.log('📚 Workspace list:');
      workspaces.forEach((ws, index) => {
        console.log(`  ${index + 1}. ${ws.name} (ID: ${ws.id})`);
      });
    })
  );

program
  .command('research')
  .description('Research management')
  .addCommand(new Command('create')
    .description('Create a new research')
    .argument('<title>', 'Research title')
    .option('-t, --type <type>', 'Research type', 'survey')
    .option('-w, --workspace <workspaceId>', 'Workspace ID')
    .option('-c, --conference <conference>', 'Conference type')
    .option('-d, --description <description>', 'Description')
    .action((title, options) => {
      const research = workspaceManager.createResearch(
        title,
        options.type as any,
        options.workspace,
        options.conference,
        options.description
      );
      console.log(`✅ Research created: ${research.title} (ID: ${research.id}, Type: ${research.type})`);
    })
  )
  .addCommand(new Command('list')
    .description('List all researches')
    .option('-w, --workspace <workspaceId>', 'Workspace ID')
    .action((options) => {
      const researches = workspaceManager.listResearches(options.workspace);
      if (researches.length === 0) {
        console.log('📭 No researches found');
        return;
      }
      console.log('🔬 Research list:');
      researches.forEach((res, index) => {
        console.log(`  ${index + 1}. ${res.title} (ID: ${res.id}, Type: ${res.type})`);
      });
    })
  );



program
  .command('chat', { isDefault: true })
  .description('Start interactive research session (REPL)')
  .action(async () => {
    await startInteractiveSession();
  });

program
  .command('run')
  .description('Run a task defined in a JSON file')
  .argument('<file>', 'Path to task JSON file')
  .action(async (file) => {
    const filePath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const task = JSON.parse(content);
      const agent = new AgentRuntime();
      console.log(`Running task from ${file}...`);
      await agent.executeTask(task, true);
    } catch (error: any) {
      console.error('Failed to run task:', error.message);
      process.exit(1);
    }
  });

program
  .command('serve')
  .description('Start the agent in passive worker mode')
  .alias('worker')
  .option('-t, --token <token>', 'API Key / Owner Token')
  .option('--follow <id>', 'Follow specific research ID')
  .action(async (options) => {
    if (options.token) {
        setConfig('redigg.apiKey', options.token);
    }
    
    // TODO: Handle --follow logic in AgentRuntime
    
    const agent = new AgentRuntime();
    console.log(pc.green('Starting Redigg Agent Worker...'));
    await agent.start();
  });

program.parse();
