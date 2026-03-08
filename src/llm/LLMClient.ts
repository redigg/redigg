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
  embed(text: string): Promise<number[]>;
}

export class MockLLMClient implements LLMClient {
  async complete(prompt: string): Promise<LLMResponse> {
    return { content: 'Mock response' };
  }

  async embed(text: string): Promise<number[]> {
    // Generate a deterministic pseudo-random vector based on input text
    // This ensures different texts get different vectors, but same text gets same vector
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    
    // Seed generator
    const vector = new Array(1536);
    for (let i = 0; i < 1536; i++) {
        // Simple LCG
        hash = (hash * 1664525 + 1013904223) % 4294967296;
        vector[i] = (hash / 4294967296); // Normalize to 0-1
    }
    return vector;
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
