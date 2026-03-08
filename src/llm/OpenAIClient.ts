import { LLMClient, LLMResponse, LLMStreamHandler } from './LLMClient.js';
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

  async complete(prompt: string): Promise<LLMResponse> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
    });
    return { content: response.choices[0].message.content || '' };
  }

  async chat(messages: { role: string; content: string }[]): Promise<LLMResponse> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: messages as any,
      stream: false,
    });
    return { content: response.choices[0].message.content || '' };
  }

  async chatStream(messages: { role: string; content: string }[], handler: LLMStreamHandler): Promise<void> {
    try {
      const stream = await this.openai.chat.completions.create({
        model: this.model,
        messages: messages as any,
        stream: true,
      });

      let fullText = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullText += content;
          handler.onToken?.(content);
        }
      }
      handler.onComplete?.(fullText);
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
