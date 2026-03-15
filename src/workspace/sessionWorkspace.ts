import path from 'path';
import { promises as fs } from 'fs';

export interface SessionWorkspacePaths {
  sessionId: string;
  rootDir: string;
  uploadsDir: string;
  outputDir: string;
  pdfsDir: string;
}

function sanitizeSessionId(sessionId: string): string {
  const normalized = sessionId.trim();
  if (!normalized) {
    throw new Error('sessionId is required');
  }

  return normalized.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function getSessionWorkspacePaths(sessionId: string): SessionWorkspacePaths {
  const safeSessionId = sanitizeSessionId(sessionId);
  const rootDir = path.resolve(process.cwd(), 'workspace', 'sessions', safeSessionId);
  const uploadsDir = path.join(rootDir, 'uploads');
  const outputDir = path.join(rootDir, 'output');
  const pdfsDir = path.join(outputDir, 'pdfs');

  return {
    sessionId: safeSessionId,
    rootDir,
    uploadsDir,
    outputDir,
    pdfsDir,
  };
}

export async function ensureSessionWorkspace(sessionId: string): Promise<SessionWorkspacePaths> {
  const dirs = getSessionWorkspacePaths(sessionId);

  await Promise.all([
    fs.mkdir(dirs.rootDir, { recursive: true }),
    fs.mkdir(dirs.uploadsDir, { recursive: true }),
    fs.mkdir(dirs.outputDir, { recursive: true }),
    fs.mkdir(dirs.pdfsDir, { recursive: true }),
  ]);

  return dirs;
}
