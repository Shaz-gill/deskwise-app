import { Router } from 'express';
import type { Request, Response } from 'express';
import { inboundEmailSchema, updateTicketSchema } from 'core';
import prisma from '../db';
import { Prisma } from '../generated/prisma/client';
import { TicketCategory, TicketStatus } from '../generated/prisma/enums';
import { sanitizeHtml } from '../lib/sanitize-html';
import { validateBody } from '../lib/validate';
import { requireAuth } from '../middleware/require-auth';
import { inboundEmailLimiter } from '../middleware/inbound-email-limiter';
import { verifyWebhookSecret } from '../middleware/verify-webhook-secret';
import { TICKET_REPLY_SELECT } from './ticket-replies';

export const ticketsRouter = Router();

const TICKET_SELECT = {
   id: true,
   subject: true,
   body: true,
   bodyHtml: true,
   senderEmail: true,
   senderName: true,
   status: true,
   category: true,
   createdAt: true,
   updatedAt: true,
   assignedTo: { select: { id: true, name: true, email: true } },
} as const;

const SORTABLE_FIELDS = ['subject', 'status', 'category', 'createdAt'] as const;
type SortableField = (typeof SORTABLE_FIELDS)[number];

function isSortableField(value: unknown): value is SortableField {
   return SORTABLE_FIELDS.includes(value as SortableField);
}

function isTicketStatus(value: unknown): value is TicketStatus {
   return Object.values(TicketStatus).includes(value as TicketStatus);
}

function isTicketCategory(value: unknown): value is TicketCategory {
   return Object.values(TicketCategory).includes(value as TicketCategory);
}

const UNCATEGORIZED_FILTER_VALUE = 'uncategorized';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

// ------------------------------------------------------------------------
// List tickets (paginated, sortable, filterable by subject/status/category)

ticketsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
   const {
      sortBy: sortByParam,
      sortOrder: sortOrderParam,
      subject: subjectParam,
      status: statusParam,
      category: categoryParam,
      page: pageParam,
      pageSize: pageSizeParam,
   } = req.query;

   const sortBy: SortableField =
      typeof sortByParam === 'string' && isSortableField(sortByParam)
         ? sortByParam
         : 'createdAt';
   const sortOrder: 'asc' | 'desc' = sortOrderParam === 'asc' ? 'asc' : 'desc';

   const where: Prisma.TicketWhereInput = {};
   if (typeof subjectParam === 'string' && subjectParam.trim() !== '') {
      where.subject = { contains: subjectParam, mode: 'insensitive' };
   }
   if (typeof statusParam === 'string' && isTicketStatus(statusParam)) {
      where.status = statusParam;
   }
   if (categoryParam === UNCATEGORIZED_FILTER_VALUE) {
      where.category = null;
   } else if (
      typeof categoryParam === 'string' &&
      isTicketCategory(categoryParam)
   ) {
      where.category = categoryParam;
   }

   const parsedPage =
      typeof pageParam === 'string' ? Number.parseInt(pageParam, 10) : NaN;
   const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

   const parsedPageSize =
      typeof pageSizeParam === 'string'
         ? Number.parseInt(pageSizeParam, 10)
         : NaN;
   const pageSize =
      Number.isInteger(parsedPageSize) && parsedPageSize > 0
         ? Math.min(parsedPageSize, MAX_PAGE_SIZE)
         : DEFAULT_PAGE_SIZE;

   const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
         where,
         select: TICKET_SELECT,
         orderBy: { [sortBy]: sortOrder },
         skip: (page - 1) * pageSize,
         take: pageSize,
      }),
      prisma.ticket.count({ where }),
   ]);

   res.json({ tickets, total });
});

// ------------------------------------------------------------------------
// Fetch a single ticket with its replies

ticketsRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
   const idParam = req.params.id;
   const id = typeof idParam === 'string' ? Number.parseInt(idParam, 10) : NaN;

   if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid ticket id' });
      return;
   }

   const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: {
         ...TICKET_SELECT,
         replies: {
            select: TICKET_REPLY_SELECT,
            orderBy: { createdAt: 'asc' },
         },
      },
   });

   if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
   }

   res.json({ ticket });
});

// ------------------------------------------------------------------------
// Update a ticket's assignee, status, and/or category

ticketsRouter.patch(
   '/:id',
   requireAuth,
   async (req: Request, res: Response) => {
      const data = validateBody(updateTicketSchema, req, res);
      if (!data) return;

      const idParam = req.params.id;
      const id =
         typeof idParam === 'string' ? Number.parseInt(idParam, 10) : NaN;
      if (!Number.isInteger(id)) {
         res.status(400).json({ error: 'Invalid ticket id' });
         return;
      }

      const { assignedToId, status, category } = data;

      if (assignedToId !== undefined && assignedToId !== null) {
         const targetUser = await prisma.user.findUnique({
            where: { id: assignedToId },
            select: { deletedAt: true },
         });
         if (!targetUser || targetUser.deletedAt !== null) {
            res.status(400).json({ error: 'Assignee not found' });
            return;
         }
      }

      const ticket = await prisma.ticket.update({
         where: { id },
         data: { assignedToId, status, category },
         select: TICKET_SELECT,
      });

      res.json({ ticket });
   }
);

// ------------------------------------------------------------------------
// Webhook: create a ticket from an inbound support email (or reuse an
// existing open ticket for the same sender/subject)

ticketsRouter.post(
   '/inbound-email',
   inboundEmailLimiter,
   verifyWebhookSecret,
   async (req: Request, res: Response) => {
      const data = validateBody(inboundEmailSchema, req, res);
      if (!data) return;

      const { from, fromName, subject, body, bodyHtml } = data;

      const existing = await prisma.ticket.findFirst({
         where: { senderEmail: from, subject, status: TicketStatus.open },
         select: TICKET_SELECT,
      });

      if (existing) {
         res.status(200).json({ ticket: existing });
         return;
      }

      const ticket = await prisma.ticket.create({
         data: {
            subject,
            body,
            bodyHtml: bodyHtml ? sanitizeHtml(bodyHtml) : bodyHtml,
            senderEmail: from,
            senderName: fromName,
         },
         select: TICKET_SELECT,
      });

      res.status(201).json({ ticket });
   }
);
