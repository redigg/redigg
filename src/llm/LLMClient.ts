export interface LLMResponse {
  content: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface LLMStreamHandler {
  onToken?: (token: string) => void;
  onThinking?: (token: string) => void;
  onToolCallStart?: (toolCall: any) => void;
  onToolCallDelta?: (toolCallChunk: any) => void;
  onToolCallComplete?: (toolCall: any) => void;
  onComplete?: (fullText: string, toolCalls?: any[]) => void;
  onError?: (error: any) => void;
}

export interface LLMChatOptions {
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: any;
    };
  }>;
  tool_choice?: any;
  timeoutMs?: number;
}

export interface LLMClient {
  complete(prompt: string, options?: any): Promise<LLMResponse>;
  chat(messages: any[], options?: LLMChatOptions): Promise<LLMResponse>;
  chatStream?(messages: any[], handler: LLMStreamHandler, options?: LLMChatOptions): Promise<void>;
}

export class MockLLMClient implements LLMClient {
  async complete(prompt: string): Promise<LLMResponse> {
    return { content: 'Mock response' };
  }

  async chat(messages: any[], options?: LLMChatOptions): Promise<LLMResponse> {
    const lastMsg = messages[messages.length - 1].content.toLowerCase();
    if (lastMsg.includes('extract memory')) {
      return {
        content: JSON.stringify({
          memories: [
            { type: 'preference', content: 'User is interested in oncology' },
            { type: 'fact', content: 'User is asking about THBS2' }
          ]
        })
      };
    }
    
    // For ResearchAgent test
    if (lastMsg.includes('thbs2')) {
        return { content: 'THBS2 is Thrombospondin-2.' };
    }
    
    return { content: 'I am a mock LLM.' };
  }

  async chatStream(messages: any[], handler: LLMStreamHandler, options?: LLMChatOptions): Promise<void> {
    const response = await this.chat(messages, options);
    const content = response.content;
    
    if (content.length > 5) {
      handler.onThinking?.('Thinking about: ' + messages[messages.length - 1].content.slice(0, 20) + '...');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    for (let i = 0; i < content.length; i += 5) {
      const token = content.slice(i, i + 5);
      handler.onToken?.(token);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    handler.onComplete?.(content);
  }
}
