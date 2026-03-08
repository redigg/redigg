import { get_encoding } from 'tiktoken';

export interface SearchDocument {
    id: string;
    content: string;
}

export class BM25Search {
    private documents: Map<string, number[]> = new Map(); // id -> tokens
    private docLengths: Map<string, number> = new Map();
    private avgDocLength: number = 0;
    private invertedIndex: Map<number, string[]> = new Map(); // token -> list of doc ids
    private k1: number = 1.5;
    private b: number = 0.75;
    private tokenizer: any;

    constructor() {
        this.tokenizer = get_encoding("cl100k_base");
    }

    public addDocument(doc: SearchDocument) {
        const tokens = Array.from(this.tokenizer.encode(doc.content)) as number[];
        this.documents.set(doc.id, tokens);
        this.docLengths.set(doc.id, tokens.length);

        // Update index
        const uniqueTokens = new Set(tokens);
        uniqueTokens.forEach(token => {
            if (!this.invertedIndex.has(token)) {
                this.invertedIndex.set(token, []);
            }
            this.invertedIndex.get(token)!.push(doc.id);
        });

        this.updateStats();
    }

    public addDocuments(docs: SearchDocument[]) {
        docs.forEach(doc => this.addDocument(doc));
    }

    private updateStats() {
        let totalLength = 0;
        this.docLengths.forEach(len => totalLength += len);
        this.avgDocLength = totalLength / Math.max(1, this.documents.size);
    }

    public search(query: string, limit: number = 5): { id: string, score: number }[] {
        const queryTokens = Array.from(this.tokenizer.encode(query)) as number[];
        const scores: Map<string, number> = new Map();

        queryTokens.forEach(token => {
            const postingList = this.invertedIndex.get(token);
            if (!postingList) return;

            const idf = Math.log(1 + (this.documents.size - postingList.length + 0.5) / (postingList.length + 0.5));

            postingList.forEach(docId => {
                const docLen = this.docLengths.get(docId) || 0;
                const tf = this.documents.get(docId)!.filter(t => t === token).length;
                
                const numerator = tf * (this.k1 + 1);
                const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLength));
                
                const score = idf * (numerator / denominator);
                scores.set(docId, (scores.get(docId) || 0) + score);
            });
        });

        return Array.from(scores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([id, score]) => ({ id, score }));
    }
    
    public free() {
        this.tokenizer.free();
    }
}
