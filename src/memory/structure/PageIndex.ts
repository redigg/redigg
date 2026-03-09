import { MemoryManager } from '../MemoryManager.js';
import { LLMClient } from '../../llm/LLMClient.js';

export interface PageNode {
    id: string;
    title: string;
    content: string;
    children: PageNode[];
    parentId?: string;
    level: number;
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
     * 1. Create Root Node (Level 0)
     * 2. Split document into logical sections (Leaf Nodes)
     * 3. Recursively summarize sections to build the tree bottom-up
     * 4. Link the top-level summaries to the Root Node
     */
    public async indexDocument(userId: string, title: string, content: string): Promise<string> {
        // 1. Create Root Node (Level 0)
        const rootMemory = await this.memoryManager.addMemory(
            userId,
            'page_index',
            `Document: ${title}`,
            { title, isRoot: true, level: 0 },
            1.0,
            'long_term'
        );

        // 2. Initial Chunking (Leaf Nodes)
        const sections = this.splitIntoSections(content);
        let currentLevelNodes: string[] = [];
        
        // Create Leaf Memories (Level -1, temporarily, will be assigned real level later)
        // Actually let's assume max depth is dynamic. We'll start from bottom.
        // Let's just create them as 'page_index_node' with no parent initially.
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const sectionTitle = section.substring(0, 50).replace(/\n/g, ' ') + '...';
            const memory = await this.memoryManager.addMemory(
                userId,
                'page_index_node',
                section,
                { title: sectionTitle, docId: rootMemory.id, isLeaf: true },
                0.8,
                'long_term'
            );
            currentLevelNodes.push(memory.id);
        }

        // 3. Build Tree Bottom-Up
        // We will loop until we have a small number of nodes, then attach them to root.
        let currentLevel = 1; // 1 means 1 level above leaves? No, let's use depth from root.
        // Actually, let's just group and summarize until we reach < 5 nodes.
        
        while (currentLevelNodes.length > 5) {
            const nextLevelNodes: string[] = [];
            const chunkSize = 5;

            for (let i = 0; i < currentLevelNodes.length; i += chunkSize) {
                const chunkIds = currentLevelNodes.slice(i, i + chunkSize);
                const chunkMemories = await Promise.all(chunkIds.map(id => this.memoryManager.getMemory(id)));
                const combinedContent = chunkMemories.map(m => m.content).join('\n\n');

                // Generate summary
                const summaryPrompt = `Summarize the following section of the document "${title}". 
Capture key points and concepts. 
Content:
${combinedContent.substring(0, 3000)}...`; // Limit context window
                
                const summaryRes = await this.llm.chat([{ role: 'user', content: summaryPrompt }]);
                const summary = summaryRes.content;

                const intermediateNode = await this.memoryManager.addMemory(
                    userId,
                    'page_index_node',
                    summary,
                    { title: `Summary Section ${Math.floor(i/chunkSize) + 1}`, docId: rootMemory.id },
                    0.9,
                    'long_term'
                );

                // Link children to this new parent
                const db = this.memoryManager.storage.getDb();
                for (const childId of chunkIds) {
                    // We need to fetch child to get its current index_path or just construct it?
                    // Ideally index_path should be Root/Level1/Level2...
                    // But we are building bottom up.
                    // This is tricky for index_path.
                    // Let's just update parent_id. index_path might need a full traversal update or we just ignore it for now and fix it at the end?
                    // Or we just store parent_id and use recursive CTEs or multiple queries to reconstruct.
                    // Let's update parent_id.
                    db.prepare('UPDATE memories SET parent_id = ? WHERE id = ?').run(intermediateNode.id, childId);
                }

                nextLevelNodes.push(intermediateNode.id);
            }
            currentLevelNodes = nextLevelNodes;
        }

        // 4. Attach remaining nodes to Root
        const db = this.memoryManager.storage.getDb();
        for (const nodeId of currentLevelNodes) {
            db.prepare('UPDATE memories SET parent_id = ? WHERE id = ?').run(rootMemory.id, nodeId);
        }

        // 5. Update Index Paths (Top-Down)
        // Now that the tree structure is defined via parent_ids, we can walk it to set index_paths.
        await this.updateIndexPaths(rootMemory.id, rootMemory.id);

        return rootMemory.id;
    }

    private async updateIndexPaths(nodeId: string, currentPath: string) {
        const db = this.memoryManager.storage.getDb();
        
        // Update current node
        db.prepare('UPDATE memories SET index_path = ? WHERE id = ?').run(currentPath, nodeId);

        // Get children
        const children = db.prepare('SELECT id FROM memories WHERE parent_id = ?').all(nodeId) as { id: string }[];

        for (const child of children) {
            await this.updateIndexPaths(child.id, `${currentPath}/${child.id}`);
        }
    }

    private splitIntoSections(content: string): string[] {
        // Split by double newlines (paragraphs) and merge small ones
        const paragraphs = content.split(/\n\n+/);
        const sections: string[] = [];
        let currentSection = '';

        for (const p of paragraphs) {
            if (currentSection.length + p.length > 1500) { // ~500 tokens
                sections.push(currentSection.trim());
                currentSection = p;
            } else {
                currentSection += (currentSection ? '\n\n' : '') + p;
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
        // Get all descendants using recursive CTE or just fetching all with docId if we had one.
        // We didn't consistently store docId in metadata for all levels (we did, actually).
        // But let's use index_path which is cleaner.
        const descendants = db.prepare('SELECT * FROM memories WHERE index_path LIKE ? ORDER BY index_path').all(`${root.id}%`) as any[];
        
        const nodeMap = new Map<string, PageNode>();
        
        // Initialize Root Node
        const rootNode: PageNode = {
            id: root.id,
            title: root.metadata?.title || 'Untitled',
            content: root.content,
            children: [],
            level: 0
        };
        nodeMap.set(root.id, rootNode);

        // Create nodes
        for (const row of descendants) {
            if (row.id === root.id) continue;
            
            const metadata = row.metadata ? JSON.parse(row.metadata) : {};
            const node: PageNode = {
                id: row.id,
                title: metadata.title || 'Untitled',
                content: row.content,
                children: [],
                parentId: row.parent_id,
                level: 0 // Will calculate
            };
            nodeMap.set(row.id, node);
        }

        // Link children
        for (const [id, node] of nodeMap) {
            if (node.parentId && nodeMap.has(node.parentId)) {
                nodeMap.get(node.parentId)!.children.push(node);
            }
        }
        
        // Calculate levels (BFS from root)
        const queue: { node: PageNode, level: number }[] = [{ node: rootNode, level: 0 }];
        while (queue.length > 0) {
            const { node, level } = queue.shift()!;
            node.level = level;
            for (const child of node.children) {
                queue.push({ node: child, level: level + 1 });
            }
        }

        return rootNode;
    }
}
