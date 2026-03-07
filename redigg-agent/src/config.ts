import Conf from 'conf';
import dotenv from 'dotenv';

dotenv.config();

const defaults = {
  redigg: {
    apiKey: '',
    apiBase: 'https://redigg.com',
  },
  openai: {
    apiKey: '',
    baseUrl: 'https://coding.dashscope.aliyuncs.com/v1',
    model: 'qwen3.5-plus',
  },
  tavily: {
    apiKey: '',
  },
  semanticScholar: {
    apiKey: '',
    timeoutMs: 10000,
    maxRetries: 3,
    initialBackoffMs: 1000,
  },
  mcpServers: {},
};

export const config = new Conf({
  projectName: 'redigg-cli',
  defaults,
});

// Helper to get config or env var
export function getConfig(key: string, envKey?: string): string {
  if (envKey && process.env[envKey]) {
    return process.env[envKey]!;
  }
  const value = config.get(key) as string;
  return value || '';
}

export function setConfig(key: string, value: any) {
  config.set(key, value);
}

export function getMCPServers(): Record<string, { command: string; args: string[] }> {
  return config.get('mcpServers') as Record<string, { command: string; args: string[] }>;
}
