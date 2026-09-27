import { Router } from 'express';
import type { Request, Response } from 'express';
import { createTicketReplySchema, polishReplySchema } from 'core';
import prisma from '../db';
import { polishReply } from '../lib/polish-reply';
import { sanitizeHtml } from '../lib/sanitize-html';
import { validateBody } from '../lib/validate';
import { polishLimiter } from '../middleware/rate-limiters';
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

ticketRepliesRouter.post(
   '/polish',
   requireAuth,
   polishLimiter,
   async (req: Request, res: Response) => {
      const data = validateBody(polishReplySchema, req, res);
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

      try {
         const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            select: { subject: true, body: true, senderName: true },
         });
         if (!ticket) {
            res.status(404).json({ error: 'Ticket not found' });
            return;
         }

         const polishedBody = await polishReply({
            draft: data.body,
            ticketSubject: ticket.subject,
            ticketBody: ticket.body,
            customerName: ticket.senderName,
         });

         res.json({ polishedBody });
      } catch (err) {
         console.error('Failed to polish reply:', err);
         res.status(500).json({ error: 'Failed to polish reply' });
      }
   }
);
