import path from 'path';

export function resolvePathUnderRoot(rootDir: string, userPath: string) {
  const rootAbs = path.resolve(rootDir);
  const target = path.resolve(rootAbs, userPath || '.');
  const rel = path.relative(rootAbs, target);

  const escapes = rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
  if (escapes) {
    throw new Error(`Path must be under workspace: ${userPath}`);
  }

  return {
    rootAbs,
    absPath: target,
    relPath: rel || '.',
  };
}

