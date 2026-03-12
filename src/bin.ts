#!/usr/bin/env node
import { Command } from 'commander';
import { main } from './index.js';
import dotenv from 'dotenv';
import path from 'path';

const program = new Command();

program
  .name('redigg')
  .description('Autonomous Research Agent Platform')
  .version('0.1.0');

program
  .command('start')
  .description('Start the Redigg Gateway and Dashboard')
  .option('-p, --port <number>', 'Gateway port', '4000')
  .action(async (options) => {
    console.log('Starting Redigg...');
    
    // Load .env from current directory if exists
    dotenv.config({ path: path.join(process.cwd(), '.env') });
    
    // Check for API Key
    if (!process.env.OPENAI_API_KEY) {
        console.warn('⚠️  Warning: OPENAI_API_KEY not found in environment variables or .env file.');
        console.warn('   Please create a .env file in your current directory with OPENAI_API_KEY=...');
        console.warn('   Or run with: OPENAI_API_KEY=... redigg start');
    }

    try {
        await main({ port: parseInt(options.port) });
    } catch (error) {
        console.error('Failed to start:', error);
        process.exit(1);
    }
  });

program.parse();
