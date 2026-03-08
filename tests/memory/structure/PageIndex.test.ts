import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PageIndex } from '../../../src/memory/structure/PageIndex.js';
import { MemoryManager } from '../../../src/memory/MemoryManager.js';
import { SQLiteStorage } from '../../../src/storage/sqlite.js';
import { MockLLMClient } from '../../../src/llm/LLMClient.js';
import fs from 'fs';
import path from 'path';

describe('PageIndex', () => {
  let pageIndex: PageIndex;
  let memoryManager: MemoryManager;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(process.cwd(), 'data', 'test-pageindex.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    const storage = new SQLiteStorage(dbPath);
    const llm = new MockLLMClient();
    memoryManager = new MemoryManager(storage, llm);
    pageIndex = new PageIndex(memoryManager, llm);
  });

  afterEach(() => {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('should index a document into a tree', async () => {
    const content = `
Section 1
This is the first section. It has some details.

Section 2
This is the second section. It is also important.

Section 3
Third section here.
    `.trim();

    const rootId = await pageIndex.indexDocument('user1', 'Test Doc', content);
    expect(rootId).toBeDefined();

    const tree = await pageIndex.getTree(rootId);
    expect(tree).toBeDefined();
    expect(tree?.title).toBe('Test Doc');
    // Depending on splitter logic, it should have children
    expect(tree?.children.length).toBeGreaterThan(0);
  });
});
