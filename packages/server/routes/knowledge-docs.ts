import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import prisma from '../db';
import { KnowledgeDocStatus } from '../generated/prisma/enums';
import { INGEST_DOCUMENT_QUEUE } from '../jobs/ingest-document-job';
import { KNOWLEDGE_BASE_DIR } from '../lib/knowledge-base/path';
import { deleteDocVectors } from '../lib/knowledge-base/pinecone';
import { boss } from '../lib/queue';
import { parseIntParam } from '../lib/validate';
import { knowledgeUploadLimiter } from '../middleware/rate-limiters';
import { requireAdmin } from '../middleware/require-admin';
import { requireAuth } from '../middleware/require-auth';

export const knowledgeDocsRouter = Router();

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.md']);
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// Extension, not mimetype, is the filter: browsers send an inconsistent
// (sometimes empty) Content-Type for .md in particular, so the file's own
// name is the more reliable signal here for all four supported types.
const upload = multer({
   storage: multer.diskStorage({
      destination: KNOWLEDGE_BASE_DIR,
      filename: (_req, file, cb) => {
         cb(null, `${crypto.randomUUID()}-${file.originalname}`);
      },
   }),
   limits: { fileSize: MAX_FILE_SIZE },
   fileFilter: (_req, file, cb) => {
      const extension = path.extname(file.originalname).toLowerCase();
      cb(null, ALLOWED_EXTENSIONS.has(extension));
   },
});

// Multer errors (e.g. the file-size limit) surface via a callback, not a
// rejected promise, so they can't rely on Express 5's auto-forwarding to
// middleware/error-handler.ts — handle them here instead.
function handleUpload(req: Request, res: Response, next: NextFunction) {
   upload.single('file')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
         const message =
            err.code === 'LIMIT_FILE_SIZE'
               ? 'File is too large (max 20MB)'
               : 'File upload failed';
         res.status(400).json({ error: message });
         return;
      }
      if (err) {
         next(err);
         return;
      }
      next();
   });
}

// ------------------------------------------------------------------------
// GET /api/knowledge-docs (requireAuth, requireAdmin)
// List knowledge base documents, most recently uploaded first

knowledgeDocsRouter.get(
   '/',
   requireAuth,
   requireAdmin,
   async (_req: Request, res: Response) => {
      const docs = await prisma.knowledgeDoc.findMany({
         orderBy: { createdAt: 'desc' },
         select: {
            id: true,
            filename: true,
            status: true,
            chunkCount: true,
            error: true,
            createdAt: true,
            uploadedBy: { select: { name: true } },
         },
      });

      res.json({ docs });
   }
);

// ------------------------------------------------------------------------
// POST /api/knowledge-docs (requireAuth, requireAdmin)
// Save the uploaded file and enqueue ingestion (extract/chunk/embed/upsert)
// as an async pg-boss job — see jobs/ingest-document-job.ts

knowledgeDocsRouter.post(
   '/',
   requireAuth,
   requireAdmin,
   knowledgeUploadLimiter,
   handleUpload,
   async (req: Request, res: Response) => {
      if (!req.file) {
         res.status(400).json({
            error: 'No file uploaded, or unsupported file type (PDF, DOCX, TXT, MD only)',
         });
         return;
      }

      const doc = await prisma.knowledgeDoc.create({
         data: {
            filename: req.file.originalname,
            path: req.file.path,
            status: KnowledgeDocStatus.processing,
            uploadedById: req.user.id,
         },
      });

      try {
         await boss.send(INGEST_DOCUMENT_QUEUE, { docId: doc.id });
      } catch (err) {
         console.error('Failed to enqueue document ingestion:', err);
      }

      res.status(201).json({ doc });
   }
);

// ------------------------------------------------------------------------
// GET /api/knowledge-docs/:id/file (requireAuth, requireAdmin)
// Serves the original uploaded file so it can be viewed in the browser
// (e.g. opened in a new tab) — regardless of ingestion status, since the
// file is saved before ingestion runs

knowledgeDocsRouter.get(
   '/:id/file',
   requireAuth,
   requireAdmin,
   async (req: Request, res: Response) => {
      const id = parseIntParam(req.params.id, res, 'Invalid document id');
      if (id === undefined) return;

      const doc = await prisma.knowledgeDoc.findUnique({ where: { id } });
      if (!doc) {
         res.status(404).json({ error: 'Document not found' });
         return;
      }

      // "inline" (not "attachment") so PDFs/text preview in the browser
      // tab rather than force-downloading; encodeURIComponent guards
      // against a filename breaking the header on special characters.
      res.setHeader(
         'Content-Disposition',
         `inline; filename="${encodeURIComponent(doc.filename)}"`
      );

      res.sendFile(doc.path, (err) => {
         if (err && !res.headersSent) {
            res.status(404).json({ error: 'File not found on disk' });
         }
      });
   }
);

// ------------------------------------------------------------------------
// DELETE /api/knowledge-docs/:id (requireAuth, requireAdmin)
// Best-effort Pinecone + file cleanup, then the DB row last — see
// lib/knowledge-base/pinecone.ts's deleteDocVectors for why vectors go first

knowledgeDocsRouter.delete(
   '/:id',
   requireAuth,
   requireAdmin,
   async (req: Request, res: Response) => {
      const id = parseIntParam(req.params.id, res, 'Invalid document id');
      if (id === undefined) return;

      const doc = await prisma.knowledgeDoc.findUnique({ where: { id } });
      if (!doc) {
         res.status(404).json({ error: 'Document not found' });
         return;
      }

      try {
         await deleteDocVectors(doc.id);
      } catch (err) {
         console.error(`Failed to delete Pinecone vectors for doc ${id}:`, err);
      }

      try {
         await fs.rm(doc.path, { force: true });
      } catch (err) {
         console.error(`Failed to delete file for doc ${id}:`, err);
      }

      await prisma.knowledgeDoc.delete({ where: { id } });

      res.status(204).send();
   }
);
