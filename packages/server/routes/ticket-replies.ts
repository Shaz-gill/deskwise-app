import { Router } from 'express';
import type { Request, Response } from 'express';
import { createTicketReplySchema } from 'core';
import prisma from '../db';
import { Prisma } from '../generated/prisma/client';
import { sanitizeHtml } from '../lib/sanitize-html';
import { validateBody } from '../lib/validate';
import { requireAuth } from '../middleware/require-auth';

export const ticketRepliesRouter = Router({ mergeParams: true });

export const TICKET_REPLY_SELECT = {
   id: true,
   body: true,
   bodyHtml: true,
   senderType: true,
   createdAt: true,
   author: { select: { id: true, name: true, email: true, role: true } },
} as const;

// ------------------------------------------------------------------------
// Add a reply to a ticket

ticketRepliesRouter.post(
   '/',
   requireAuth,
   async (req: Request, res: Response) => {
      const data = validateBody(createTicketReplySchema, req, res);
      if (!data) return;

      const ticketIdParam = req.params.ticketId;
      const ticketId =
         typeof ticketIdParam === 'string'
            ? Number.parseInt(ticketIdParam, 10)
            : NaN;
      if (!Number.isInteger(ticketId)) {
         res.status(400).json({ error: 'Invalid ticket id' });
         return;
      }

      const reply = await prisma.ticketReply.create({
         data: {
            body: data.body,
            bodyHtml: data.bodyHtml
               ? sanitizeHtml(data.bodyHtml)
               : data.bodyHtml,
            ticketId,
            authorId: req.user.id,
         },
         select: TICKET_REPLY_SELECT,
      });

      res.status(201).json({ reply });
   }
);
