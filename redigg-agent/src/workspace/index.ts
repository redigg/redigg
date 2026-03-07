import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { Workspace, Research, Version, Review, ActionItem } from '../types';

export class WorkspaceManager {
  private basePath: string;
  private workspacesPath: string;
  private indexFile: string;

  constructor() {
    this.basePath = path.join(homedir(), '.redigg');
    this.workspacesPath = path.join(this.basePath, 'workspaces');
    this.indexFile = path.join(this.basePath, 'workspaces.json');
    this.ensureDirectories();
  }

  private ensureDirectories() {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
    if (!fs.existsSync(this.workspacesPath)) {
      fs.mkdirSync(this.workspacesPath, { recursive: true });
    }
  }

  private loadIndex(): Workspace[] {
    if (!fs.existsSync(this.indexFile)) {
      return [];
    }
    const content = fs.readFileSync(this.indexFile, 'utf-8');
    return JSON.parse(content);
  }

  private saveIndex(workspaces: Workspace[]) {
    fs.writeFileSync(this.indexFile, JSON.stringify(workspaces, null, 2), 'utf-8');
  }

  create(name: string): Workspace {
    const id = `ws_${Date.now().toString(36)}`;
    const workspacePath = path.join(this.workspacesPath, name.replace(/\s+/g, '_').toLowerCase());
    const now = new Date().toISOString();

    const workspace: Workspace = {
      id,
      name,
      path: workspacePath,
      createdAt: now,
      updatedAt: now,
    };

    // Create workspace directory structure
    fs.mkdirSync(workspacePath, { recursive: true });
    fs.mkdirSync(path.join(workspacePath, 'researches'), { recursive: true });
    fs.mkdirSync(path.join(workspacePath, 'assets'), { recursive: true });

    // Save workspace config
    const workspaceConfig = path.join(workspacePath, 'workspace.json');
    fs.writeFileSync(workspaceConfig, JSON.stringify(workspace, null, 2), 'utf-8');

    // Update index
    const index = this.loadIndex();
    index.push(workspace);
    this.saveIndex(index);

    return workspace;
  }

  list(): Workspace[] {
    return this.loadIndex();
  }

  get(id: string): Workspace | null {
    const index = this.loadIndex();
    return index.find(ws => ws.id === id) || null;
  }

  createResearch(
    title: string,
    type: Research['type'] = 'survey',
    workspaceId?: string,
    conference?: string,
    description: string = ''
  ): Research {
    const id = `res_${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    const research: Research = {
      id,
      title,
      type,
      conference,
      workspaceId,
      description,
      createdAt: now,
      updatedAt: now,
    };

    // Get workspace path
    let researchDir: string;
    if (workspaceId) {
      const workspace = this.get(workspaceId);
      if (!workspace) {
        throw new Error(`Workspace not found: ${workspaceId}`);
      }
      researchDir = path.join(workspace.path, 'researches', id);
    } else {
      // Global path
      researchDir = path.join(this.workspacesPath, 'researches', id);
    }

    // Create research directory structure
    fs.mkdirSync(researchDir, { recursive: true });
    fs.mkdirSync(path.join(researchDir, 'versions'), { recursive: true });
    fs.mkdirSync(path.join(researchDir, 'artifacts'), { recursive: true });

    // Save research config
    const researchConfig = path.join(researchDir, 'research.json');
    fs.writeFileSync(researchConfig, JSON.stringify(research, null, 2), 'utf-8');

    // Update research index (global + workspace)
    this.updateResearchIndex(research, workspaceId);

    return research;
  }

  private updateResearchIndex(research: Research, workspaceId?: string) {
    // Update global index
    const globalIndexPath = path.join(this.basePath, 'researches.json');
    let globalIndex: Research[] = [];
    if (fs.existsSync(globalIndexPath)) {
      globalIndex = JSON.parse(fs.readFileSync(globalIndexPath, 'utf-8'));
    }
    globalIndex.push(research);
    fs.writeFileSync(globalIndexPath, JSON.stringify(globalIndex, null, 2), 'utf-8');

    // Update workspace index if applicable
    if (workspaceId) {
      const workspace = this.get(workspaceId);
      if (workspace) {
        const workspaceIndexPath = path.join(workspace.path, 'researches.json');
        let workspaceIndex: Research[] = [];
        if (fs.existsSync(workspaceIndexPath)) {
          workspaceIndex = JSON.parse(fs.readFileSync(workspaceIndexPath, 'utf-8'));
        }
        workspaceIndex.push(research);
        fs.writeFileSync(workspaceIndexPath, JSON.stringify(workspaceIndex, null, 2), 'utf-8');
      }
    }
  }

  listResearches(workspaceId?: string): Research[] {
    let indexPath: string;
    if (workspaceId) {
      const workspace = this.get(workspaceId);
      if (!workspace) {
        return [];
      }
      indexPath = path.join(workspace.path, 'researches.json');
    } else {
      indexPath = path.join(this.basePath, 'researches.json');
    }

    if (!fs.existsSync(indexPath)) {
      return [];
    }

    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  }
}
