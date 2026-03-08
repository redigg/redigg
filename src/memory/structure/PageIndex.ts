import { MemoryManager } from '../MemoryManager.js';
import { LLMClient } from '../../llm/LLMClient.js';

export interface PageNode {
    id: string;
    title: string;
    content: string;
    children: PageNode[];
    parentId?: string;
}

export class PageIndex {
    private memoryManager: MemoryManager;
    private llm: LLMClient;

    constructor(memoryManager: MemoryManager, llm: LLMClient) {
        this.memoryManager = memoryManager;
        this.llm = llm;
    }

    /**
     * Ingests a long document and creates a hierarchical tree of memories (Page Index).
     * This is a simplified implementation. Real PageIndex uses recursive summarization and tree building.
     */
    public async indexDocument(userId: string, title: string, content: string): Promise<string> {
        // 1. Create Root Node
        const rootMemory = await this.memoryManager.addMemory(
            userId,
            'context', // or 'document_root'
            `Document: ${title}`,
            { title, isRoot: true, type: 'page_index' },
            1.0,
            'long_term'
        );

        // 2. Chunk Document (Naive splitting by paragraphs for now)
        // Ideally we use LLM to split by semantic sections
        const sections = this.splitIntoSections(content);

        // 3. Create Child Nodes
        for (const section of sections) {
            // Generate summary or title for section
            const sectionTitle = section.substring(0, 50) + '...';
            
            await this.memoryManager.addMemory(
                userId,
                'context',
                section,
                { title: sectionTitle, type: 'page_index_node', docId: rootMemory.id },
                0.8,
                'long_term',
                rootMemory.id // Parent ID
            );
        }

        return rootMemory.id;
    }

    private splitIntoSections(content: string): string[] {
        // Simple splitter: split by double newlines (paragraphs)
        // Merge small paragraphs to avoid too much fragmentation
        const paragraphs = content.split(/\n\n+/);
        const sections: string[] = [];
        let currentSection = '';

        for (const p of paragraphs) {
            if (currentSection.length + p.length > 1000) {
                sections.push(currentSection.trim());
                currentSection = p;
            } else {
                currentSection += '\n\n' + p;
            }
        }
        if (currentSection.trim()) {
            sections.push(currentSection.trim());
        }
        return sections;
    }

    public async getTree(rootId: string): Promise<PageNode | null> {
        const root = await this.memoryManager.getMemory(rootId);
        if (!root) return null;

        const db = this.memoryManager.storage.getDb();
        // Get all descendants using LIKE query on index_path
        const descendants = db.prepare('SELECT * FROM memories WHERE index_path LIKE ? ORDER BY index_path').all(`${root.id}%`);
        
        // Reconstruct tree in memory
        const nodeMap = new Map<string, PageNode>();
        const rootNode: PageNode = {
            id: root.id,
            title: root.metadata?.title || 'Untitled',
            content: root.content,
            children: []
        };
        nodeMap.set(root.id, rootNode);

        for (const row of descendants) {
            if (row.id === root.id) continue;
            
            const node: PageNode = {
                id: row.id,
                title: JSON.parse(row.metadata || '{}').title || 'Untitled',
                content: row.content,
                children: [],
                parentId: row.parent_id
            };
            nodeMap.set(row.id, node);
        }

        // Link children
        for (const [id, node] of nodeMap) {
            if (node.parentId && nodeMap.has(node.parentId)) {
                nodeMap.get(node.parentId)!.children.push(node);
            }
        }

        return rootNode;
    }
}
