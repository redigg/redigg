import { MemoryManager } from '../../MemoryManager.js';
import { LLMClient } from '../../../llm/LLMClient.js';

export interface ExtractedMemory {
  type: 'preference' | 'fact' | 'context' | 'paper';
  content: string;
  metadata?: any;
}

export class MemoryEvolutionSystem {
  private memoryManager: MemoryManager;
  private llm: LLMClient;

  constructor(memoryManager: MemoryManager, llm: LLMClient) {
    this.memoryManager = memoryManager;
    this.llm = llm;
  }

  // Analyze interaction and extract new memories
  public async evolve(userId: string, userQuery: string, agentResponse: string): Promise<{ added: any[], updated: any[] }> {
    console.log(`[MemoryEvolution] Analyzing interaction for user ${userId}...`);

    const prompt = `
      Analyze the following interaction between a User and an AI Assistant.
      Extract any new information about:
      1. User's preferences, research interests, or factual constraints (type: preference/fact/context).
      2. Specific research papers or materials mentioned (type: paper).

      For 'paper' type, please include a 'metadata' object with: title, authors (array), url (optional), summary (optional).

      Output ONLY a JSON object with a "memories" array. Each item should have "type", "content", and optional "metadata".

      User: "${userQuery}"
      AI: "${agentResponse}"
    `;

    try {
      const response = await this.llm.chat([
        { role: 'system', content: 'You are a memory extraction system. You extract structured memories and research materials from conversations.' },
        { role: 'user', content: prompt }
      ]);

      const extracted = this.parseResponse(response.content);
      const added = [];
      
      if (extracted && extracted.length > 0) {
        console.log(`[MemoryEvolution] Extracted ${extracted.length} new memories.`);
        for (const mem of extracted) {
          await this.memoryManager.addMemory(userId, mem.type, mem.content, mem.metadata);
          added.push(mem);
        }
      } else {
        console.log('[MemoryEvolution] No new memories extracted.');
      }

      return { added, updated: [] };

    } catch (error) {
      console.error('[MemoryEvolution] Failed to evolve memory:', error);
      return { added: [], updated: [] };
    }
  }

  private parseResponse(content: string): ExtractedMemory[] {
    try {
      // Simple JSON parsing, might need more robust handling for real LLM output
      const jsonStr = content.match(/\{[\s\S]*\}/)?.[0] || content;
      const parsed = JSON.parse(jsonStr);
      return parsed.memories || [];
    } catch (e) {
      console.warn('[MemoryEvolution] Failed to parse LLM response:', content);
      return [];
    }
  }
}
