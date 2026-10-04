import fs from 'node:fs/promises';
import path from 'node:path';
import {
   DeleteObjectCommand,
   GetObjectCommand,
   PutObjectCommand,
   S3Client,
} from '@aws-sdk/client-s3';
import { ensureKnowledgeBaseDir, KNOWLEDGE_BASE_DIR } from './path';

const S3_BUCKET = process.env.KNOWLEDGE_BASE_S3_BUCKET;

// Mirrors lib/email/send-email.ts's "silently fall back when unconfigured"
// shape: with no bucket configured, documents are stored on local disk at
// the repo root's knowledge-base/ dir instead — the same place this app
// always used before S3 support existed. Whichever backend is active when
// a doc is saved is also the one used to later read/delete it, so
// switching KNOWLEDGE_BASE_S3_BUCKET after docs already exist orphans
// them — fine for a demo, not meant to support live migration between
// backends.
const s3Client = S3_BUCKET
   ? new S3Client({ region: process.env.AWS_REGION })
   : null;

export async function saveKnowledgeFile(
   buffer: Buffer,
   filename: string
): Promise<string> {
   const key = `${crypto.randomUUID()}-${filename}`;

   if (s3Client) {
      await s3Client.send(
         new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: buffer })
      );
      return key;
   }

   await ensureKnowledgeBaseDir();
   const filePath = path.join(KNOWLEDGE_BASE_DIR, key);
   await fs.writeFile(filePath, buffer);
   return filePath;
}

export async function readKnowledgeFile(storedPath: string): Promise<Buffer> {
   if (s3Client) {
      const result = await s3Client.send(
         new GetObjectCommand({ Bucket: S3_BUCKET, Key: storedPath })
      );
      return Buffer.from(await result.Body!.transformToByteArray());
   }

   return fs.readFile(storedPath);
}

export async function deleteKnowledgeFile(storedPath: string): Promise<void> {
   if (s3Client) {
      await s3Client.send(
         new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: storedPath })
      );
      return;
   }

   await fs.rm(storedPath, { force: true });
}
