import fs from 'node:fs/promises';
import path from 'node:path';

// Uploaded documents live at the repo root's knowledge-base/, not inside
// packages/server/ — this file lives at packages/server/lib/knowledge-base,
// so repo root is four levels up. Resolved off import.meta.dirname (not
// process.cwd()) so it's correct regardless of the server's invocation
// directory.
export const KNOWLEDGE_BASE_DIR = path.resolve(
   import.meta.dirname,
   '../../../../knowledge-base'
);

export async function ensureKnowledgeBaseDir(): Promise<void> {
   await fs.mkdir(KNOWLEDGE_BASE_DIR, { recursive: true });
}
