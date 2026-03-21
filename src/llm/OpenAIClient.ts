import { LLMClient, LLMResponse, LLMStreamHandler, LLMChatOptions } from './LLMClient.js';
import OpenAI from 'openai';

export class OpenAIClient implements LLMClient {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, baseURL?: string, model?: string) {
    this.openai = new OpenAI({ 
      apiKey,
      baseURL: baseURL || 'https://api.openai.com/v1'
    });
    this.model = model || 'gpt-3.5-turbo';
  }

  async complete(prompt: string, options?: any): Promise<LLMResponse> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
    });
    return { content: response.choices[0].message.content || '' };
  }

  async chat(messages: any[], options?: LLMChatOptions): Promise<LLMResponse> {
    const reqOptions: any = {
      model: this.model,
      messages: messages,
      stream: false,
    };
    if (options?.tools && options.tools.length > 0) {
      reqOptions.tools = options.tools;
      if (options.tool_choice) reqOptions.tool_choice = options.tool_choice;
    }

    const response = await this.openai.chat.completions.create(reqOptions);
    const msg = response.choices[0].message;
    return { 
      content: msg.content || '',
      tool_calls: msg.tool_calls as any,
      usage: response.usage as any
    };
  }

  async chatStream(messages: any[], handler: LLMStreamHandler, options?: LLMChatOptions): Promise<void> {
    try {
      const reqOptions: any = {
        model: this.model,
        messages: messages,
        stream: true,
      };
      if (options?.tools && options.tools.length > 0) {
        reqOptions.tools = options.tools;
        if (options.tool_choice) reqOptions.tool_choice = options.tool_choice;
      }

      const stream = await this.openai.chat.completions.create(reqOptions) as any;

      let fullText = '';
      const activeToolCalls = new Map<number, any>();
      let isThinking = false;
      let buffer = '';
      let foundToolCall = false;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        // Native reasoning content (e.g. DeepSeek API)
        if (delta.reasoning_content) {
            handler.onThinking?.(delta.reasoning_content);
            continue;
        }

        if (delta.content) {
          let chunkStr = delta.content;
          
          // Handle inline <think> tags from some models
          if (chunkStr.includes('<think>')) {
              isThinking = true;
              const parts = chunkStr.split('<think>');
              if (parts[0]) {
                  buffer += parts[0];
              }
              chunkStr = parts.slice(1).join('<think>');
          }

          if (isThinking) {
              if (chunkStr.includes('</think>')) {
                  isThinking = false;
                  const parts = chunkStr.split('</think>');
                  if (parts[0]) handler.onThinking?.(parts[0]);
                  if (parts[1]) {
                      buffer += parts[1];
                  }
              } else {
                  handler.onThinking?.(chunkStr);
                  continue; // Skip the rest of the loop since we handled the thinking token
              }
          } else {
              buffer += chunkStr;
          }

          // Buffer logic to intercept <tool_call> tags from leaking to the UI
          if (!isThinking && buffer) {
              if (foundToolCall) {
                  // If we already hit a tool call tag, just accumulate silently
                  fullText += buffer;
                  buffer = '';
              } else {
                  const ltIdx = buffer.indexOf('<');
                  if (ltIdx !== -1) {
                      const potentialTag = buffer.slice(ltIdx);
                      if ("<tool_call>".startsWith(potentialTag)) {
                          // Partial match, flush everything before '<' and keep waiting
                          if (ltIdx > 0) {
                              const flushText = buffer.slice(0, ltIdx);
                              fullText += flushText;
                              handler.onToken?.(flushText);
                              buffer = potentialTag;
                          }
                      } else if (potentialTag.startsWith("<tool_call>")) {
                          // Exact match!
                          foundToolCall = true;
                          if (ltIdx > 0) {
                              const flushText = buffer.slice(0, ltIdx);
                              fullText += flushText;
                              handler.onToken?.(flushText);
                          }
                          fullText += potentialTag; // silently accumulate for parsing
                          buffer = '';
                      } else {
                          // Not a tool_call tag, flush everything
                          fullText += buffer;
                          handler.onToken?.(buffer);
                          buffer = '';
                      }
                  } else {
                      // No '<' in buffer, safe to flush entirely
                      fullText += buffer;
                      handler.onToken?.(buffer);
                      buffer = '';
                  }
              }
          }
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.id) {
              // New tool call
              activeToolCalls.set(tc.index, {
                id: tc.id,
                type: 'function',
                function: { name: tc.function?.name || '', arguments: tc.function?.arguments || '' }
              });
              handler.onToolCallStart?.(activeToolCalls.get(tc.index));
            } else {
              // Appending arguments
              const existing = activeToolCalls.get(tc.index);
              if (existing && tc.function?.arguments) {
                existing.function.arguments += tc.function.arguments;
                handler.onToolCallDelta?.({ index: tc.index, arguments: tc.function.arguments });
              }
            }
          }
        }
      }
      
      const finalToolCalls = activeToolCalls.size > 0 ? Array.from(activeToolCalls.values()) : undefined;
      if (finalToolCalls) {
        for (const tc of finalToolCalls) {
          handler.onToolCallComplete?.(tc);
        }
      }
      handler.onComplete?.(fullText, finalToolCalls);
    } catch (error) {
      handler.onError?.(error);
      throw error;
    }
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });
    return response.data[0].embedding;
  }
}
