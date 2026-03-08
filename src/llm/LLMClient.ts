export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface LLMStreamHandler {
  onToken?: (token: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: any) => void;
}

export interface LLMClient {
  complete(prompt: string, options?: any): Promise<LLMResponse>;
  chat(messages: { role: string; content: string }[], options?: any): Promise<LLMResponse>;
  chatStream?(messages: { role: string; content: string }[], handler: LLMStreamHandler, options?: any): Promise<void>;
}

export class MockLLMClient implements LLMClient {
  async complete(prompt: string): Promise<LLMResponse> {
    return { content: 'Mock response' };
  }

  async chat(messages: { role: string; content: string }[]): Promise<LLMResponse> {
    // Simple mock logic for testing memory extraction
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
    
    return { content: 'I am a mock LLM.' };
  }
}
