import OpenAI from 'openai';
import { getConfig } from '../config';

export class LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = getConfig('openai.apiKey', 'OPENAI_API_KEY');
    const baseURL = getConfig('openai.baseUrl', 'OPENAI_BASE_URL');
    this.model = getConfig('openai.model', 'OPENAI_MODEL') || 'gpt-4-turbo';

    if (!apiKey) {
      console.warn('Warning: OPENAI_API_KEY is not set. LLM features will not work.');
    }

    this.client = new OpenAI({
      apiKey: apiKey || 'dummy-key',
      baseURL: baseURL,
    });
  }

  async generateCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    onToken?: (token: string, type: 'content' | 'reasoning') => void,
    tools?: OpenAI.Chat.Completions.ChatCompletionTool[]
  ) {
    try {
      if (onToken && !tools) {
        const stream = await this.client.chat.completions.create({
            model: this.model,
            messages,
            stream: true,
            stream_options: { include_usage: true }
        });
        
        let fullContent = '';
        let usage: any = null;

        for await (const chunk of stream) {
            // Check usage (some providers send it in the last chunk)
            if ((chunk as any).usage) {
                usage = (chunk as any).usage;
            }

            if (chunk.choices && chunk.choices.length > 0) {
                const delta = chunk.choices[0]?.delta;
                if (delta) {
                    // @ts-ignore
                    const reasoning = delta.reasoning_content;
                    if (reasoning && onToken) {
                        onToken(reasoning, 'reasoning');
                    }
                    
                    const content = delta.content || '';
                    if (content) {
                        onToken(content, 'content');
                        fullContent += content;
                    }
                }
            }
        }
        return { content: fullContent, role: 'assistant', usage };
      } else {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages,
            tools,
        });
        return { ...response.choices[0].message, usage: response.usage };
      }
    } catch (error: any) {
      console.error('LLM Generation Error:', error?.message || error);
      // Fallback to mock response if model is not supported or API fails
      return {
        content: "Currently, this model is not supported. The Redigg Agent is capable of handling tasks but requires a valid API configuration. Please check your LLM settings."
      };
    }
  }

  async generateStructured(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[], schema: any) {
    try {
      const jsonMessages = [
          ...messages,
          { role: 'system', content: 'Output JSON only. ' + JSON.stringify(schema) } as OpenAI.Chat.Completions.ChatCompletionMessageParam
      ];

      const response = await this.client.chat.completions.create({
          model: this.model,
          messages: jsonMessages,
          response_format: { type: 'json_object' }
      });
      
      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error: any) {
      console.error('Structured LLM Generation Error:', error?.message || error);
      return { error: "Model not supported for structured generation" };
    }
  }
}
