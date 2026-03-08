import { LLMClient } from '../llm/LLMClient.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('QualityManager');

export interface QualityReport {
  score: number; // 0-100
  reasoning: string;
  suggestions: string[];
  passed: boolean; // score >= 70
}

export class QualityManager {
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  public async evaluateTask(
    taskDescription: string, 
    resultContent: string, 
    context?: any
  ): Promise<QualityReport> {
    logger.info(`Evaluating task: "${taskDescription.slice(0, 50)}..."`);
    
    const prompt = `
      You are a Quality Assurance AI for a research agent.
      
      Task: "${taskDescription}"
      Context: ${JSON.stringify(context || {})}
      
      Result:
      """
      ${resultContent.slice(0, 5000)}
      """
      
      Evaluate the result based on the following criteria:
      1. Completeness: Did it answer all parts of the request?
      2. Accuracy: Are there any obvious hallucinations or errors?
      3. Relevance: Is the information relevant to the task?
      4. Clarity: Is the output well-structured and easy to understand?
      
      Output strictly in JSON format:
      {
        "score": number, // 0-100
        "reasoning": "string",
        "suggestions": ["string", "string"],
        "passed": boolean // true if score >= 70
      }
    `;

    try {
      const response = await this.llm.chat([
        { role: 'system', content: 'You are a strict QA evaluator.' },
        { role: 'user', content: prompt }
      ]);
      
      let jsonStr = response.content.trim();
      // Handle potential markdown code blocks
      if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```(json)?/, '').replace(/```$/, '').trim();
      }
      
      const report = JSON.parse(jsonStr) as QualityReport;
      
      logger.info(`Evaluation complete. Score: ${report.score}. Passed: ${report.passed}`);
      return report;
      
    } catch (error) {
      logger.error('Evaluation failed:', error);
      // Fallback
      return {
        score: 0,
        reasoning: 'Evaluation failed due to error.',
        suggestions: [],
        passed: false
      };
    }
  }
}
