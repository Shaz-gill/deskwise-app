import { Router } from 'express';
import type { Request, Response } from 'express';
import {
   createTicketReplySchema,
   inboundEmailSchema,
   polishReplySchema,
   updateTicketSchema,
} from 'core';
import prisma from '../db';
import { Prisma } from '../generated/prisma/client';
import {
   TicketCategory,
   TicketStatus,
   TicketReplySenderType,
} from '../generated/prisma/enums';
import { boss } from '../lib/queue';
import { Sentry } from '../lib/sentry';
import { polishReply } from '../lib/tickets/polish-reply';
import { sanitizeHtml } from '../lib/sanitize-html';
import { summarizeTicket } from '../lib/tickets/summarize-ticket';
import { parseIntParam, validateBody } from '../lib/validate';
import { CLASSIFY_TICKET_QUEUE } from '../jobs/classify-ticket-job';
import { AUTO_RESOLVE_TICKET_QUEUE } from '../jobs/auto-resolve-ticket-job';
import { SEND_REPLY_EMAIL_QUEUE } from '../jobs/send-reply-email-job';
import { requireAuth } from '../middleware/require-auth';
import {
   inboundEmailLimiter,
   polishLimiter,
   summarizeLimiter,
} from '../middleware/rate-limiters';
import { verifyWebhookSecret } from '../middleware/verify-webhook-secret';

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

const TICKET_REPLY_SELECT = {
   id: true,
   body: true,
   bodyHtml: true,
   senderType: true,
   createdAt: true,
   author: { select: { id: true, name: true, email: true, role: true } },
} as const;

const SORTABLE_FIELDS = ['subject', 'status', 'category', 'createdAt'] as const;
type SortableField = (typeof SORTABLE_FIELDS)[number];

function isSortableField(value: unknown): value is SortableField {
   return SORTABLE_FIELDS.includes(value as SortableField);
}

// Statuses the ticket list is allowed to show — 'new' and 'processing' are
// internal-only states owned by the auto-resolve pipeline
// (jobs/auto-resolve-ticket-job.ts) and must never reach the UI.
const VISIBLE_TICKET_STATUSES = [
   TicketStatus.open,
   TicketStatus.resolved,
   TicketStatus.closed,
] as const;

function isVisibleTicketStatus(
   value: unknown
): value is (typeof VISIBLE_TICKET_STATUSES)[number] {
   return (VISIBLE_TICKET_STATUSES as readonly string[]).includes(
      value as string
   );
}

function isTicketCategory(value: unknown): value is TicketCategory {
   return Object.values(TicketCategory).includes(value as TicketCategory);
}

const UNCATEGORIZED_FILTER_VALUE = 'uncategorized';

const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 100;

// ------------------------------------------------------------------------
// GET /api/tickets (requireAuth)
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
   if (typeof statusParam === 'string' && isVisibleTicketStatus(statusParam)) {
      where.status = statusParam;
   } else {
      where.status = { in: [...VISIBLE_TICKET_STATUSES] };
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

// Number of days (including today) the /stats route's daily ticket-count
// breakdown covers. The raw SQL below hardcodes '29 days' — the window
// start — since it must stay in lockstep with this constant.
const DAILY_TICKET_COUNT_DAYS = 30;

type DailyTicketCountRow = { day: Date; count: number };

function buildDailyTicketCounts(
   rows: DailyTicketCountRow[]
): { date: string; count: number }[] {
   const countsByDate = new Map(
      rows.map((row) => [row.day.toISOString().slice(0, 10), row.count])
   );

   const oneDayMs = 24 * 60 * 60 * 1000;
   const startOfTodayUtc = Math.floor(Date.now() / oneDayMs) * oneDayMs;

   return Array.from({ length: DAILY_TICKET_COUNT_DAYS }, (_, i) => {
      const offset = DAILY_TICKET_COUNT_DAYS - 1 - i;
      const date = new Date(startOfTodayUtc - offset * oneDayMs)
         .toISOString()
         .slice(0, 10);
      return { date, count: countsByDate.get(date) ?? 0 };
   });
}

// ------------------------------------------------------------------------
// GET /api/tickets/stats (requireAuth)
// Org-wide dashboard summary. Avg resolution time is intentionally omitted —
// Ticket has no resolvedAt timestamp yet (updatedAt is bumped by unrelated
// edits too); add it once a resolvedAt column exists via migration.

ticketsRouter.get(
   '/stats',
   requireAuth,
   async (req: Request, res: Response) => {
      const [
         [
            totalTickets,
            openTickets,
            resolvedOrClosedCount,
            aiResolvedCount,
            dailyCountRows,
         ],
         categoryGroups,
         openAssigneeGroups,
      ] = await Promise.all([
         prisma.$transaction([
            prisma.ticket.count(),
            prisma.ticket.count({ where: { status: TicketStatus.open } }),
            prisma.ticket.count({
               where: {
                  status: { in: [TicketStatus.resolved, TicketStatus.closed] },
               },
            }),
            prisma.ticket.count({
               where: {
                  status: { in: [TicketStatus.resolved, TicketStatus.closed] },
                  replies: { some: { senderType: TicketReplySenderType.ai } },
               },
            }),
            prisma.$queryRaw<DailyTicketCountRow[]>`
               SELECT date_trunc('day', "createdAt")::date AS day,
                      COUNT(*)::int AS count
               FROM "ticket"
               WHERE "createdAt" >= date_trunc('day', now()) - interval '29 days'
               GROUP BY day
               ORDER BY day
            `,
         ]),
         prisma.ticket.groupBy({ by: ['category'], _count: true }),
         // Open-ticket workload per assignee — groupBy can't join to the
         // User table directly, so assignee names are resolved below in a
         // second query against just the ids that came back here.
         prisma.ticket.groupBy({
            by: ['assignedToId'],
            where: { status: TicketStatus.open, assignedToId: { not: null } },
            _count: true,
         }),
      ]);

      const aiResolvedPercentage =
         resolvedOrClosedCount === 0
            ? 0
            : (aiResolvedCount / resolvedOrClosedCount) * 100;

      const categoryBreakdown = categoryGroups
         .map((group) => ({ category: group.category, count: group._count }))
         .sort((a, b) => b.count - a.count);

      const assigneeIds = openAssigneeGroups
         .map((group) => group.assignedToId)
         .filter((id): id is string => id !== null);
      const assignees =
         assigneeIds.length > 0
            ? await prisma.user.findMany({
                 where: { id: { in: assigneeIds } },
                 select: { id: true, name: true },
              })
            : [];
      const assigneeNameById = new Map(
         assignees.map((assignee) => [assignee.id, assignee.name])
      );
      // Top 8 by open-ticket count — enough to spot who's overloaded
      // without the dashboard card needing its own scroll.
      const USER_WORKLOAD_LIMIT = 8;
      const userWorkload = openAssigneeGroups
         .map((group) => ({
            userId: group.assignedToId as string,
            userName:
               assigneeNameById.get(group.assignedToId as string) ?? 'Unknown',
            openCount: group._count,
         }))
         .sort((a, b) => b.openCount - a.openCount)
         .slice(0, USER_WORKLOAD_LIMIT);

      res.json({
         totalTickets,
         openTickets,
         dailyTicketCounts: buildDailyTicketCounts(dailyCountRows),
         aiResolvedCount,
         aiResolvedPercentage,
         categoryBreakdown,
         userWorkload,
      });
   }
);

// ------------------------------------------------------------------------
// GET /api/tickets/:id (requireAuth)
// Fetch a single ticket with its replies

ticketsRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
   const id = parseIntParam(req.params.id, res, 'Invalid ticket id');
   if (id === undefined) return;

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
// PATCH /api/tickets/:id (requireAuth)
// Update a ticket's assignee, status, and/or category

ticketsRouter.patch(
   '/:id',
   requireAuth,
   async (req: Request, res: Response) => {
      const data = validateBody(updateTicketSchema, req, res);
      if (!data) return;

      const id = parseIntParam(req.params.id, res, 'Invalid ticket id');
      if (id === undefined) return;

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
// POST /api/tickets/:id/replies (requireAuth)
// Add a reply to a ticket

ticketsRouter.post(
   '/:id/replies',
   requireAuth,
   async (req: Request, res: Response) => {
      const data = validateBody(createTicketReplySchema, req, res);
      if (!data) return;

      const ticketId = parseIntParam(req.params.id, res, 'Invalid ticket id');
      if (ticketId === undefined) return;

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

      // Fire-and-forget, same contract as the inbound-email webhook's
      // classify/auto-resolve enqueues below: emailing the customer runs
      // asynchronously in jobs/send-reply-email-job.ts's worker, so this
      // response doesn't wait on SendGrid. A failure to enqueue is logged
      // rather than failing the request — the reply is already saved.
      try {
         await boss.send(SEND_REPLY_EMAIL_QUEUE, { replyId: reply.id });
      } catch (err) {
         console.error('Failed to enqueue reply email:', err);
         Sentry.captureException(err);
      }

      res.status(201).json({ reply });
   }
);

// ------------------------------------------------------------------------
// POST /api/tickets/:id/replies/polish (requireAuth, polishLimiter)
// Polish a draft reply with AI before sending

ticketsRouter.post(
   '/:id/replies/polish',
   requireAuth,
   polishLimiter,
   async (req: Request, res: Response) => {
      const data = validateBody(polishReplySchema, req, res);
      if (!data) return;

      const ticketId = parseIntParam(req.params.id, res, 'Invalid ticket id');
      if (ticketId === undefined) return;

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
            agentName: req.user.name,
         });

         res.json({ polishedBody });
      } catch (err) {
         console.error('Failed to polish reply:', err);
         Sentry.captureException(err);
         res.status(500).json({ error: 'Failed to polish reply' });
      }
   }
);

// ------------------------------------------------------------------------
// POST /api/tickets/:id/summarize (requireAuth, summarizeLimiter)
// Summarize a ticket's subject/body/replies with AI

ticketsRouter.post(
   '/:id/summarize',
   requireAuth,
   summarizeLimiter,
   async (req: Request, res: Response) => {
      const id = parseIntParam(req.params.id, res, 'Invalid ticket id');
      if (id === undefined) return;

      try {
         // Minimal select (not the full TICKET_SELECT) — only
         // subject/body/replies feed the prompt, no need for
         // assignedTo/status/etc. here. TICKET_REPLY_SELECT is already
         // imported above for GET /:id's own embed.
         const ticket = await prisma.ticket.findUnique({
            where: { id },
            select: {
               subject: true,
               body: true,
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

         const summary = await summarizeTicket({
            ticketSubject: ticket.subject,
            ticketBody: ticket.body,
            replies: ticket.replies.map((reply) => ({
               senderType: reply.senderType,
               authorName: reply.author.name,
               body: reply.body,
               createdAt: reply.createdAt,
            })),
         });

         res.json({ summary });
      } catch (err) {
         // No Prisma error to map beyond the findUnique above — anything
         // reaching this catch is an OpenAI/network failure from
         // summarizeTicket(), same as polish-reply.ts's route.
         console.error('Failed to summarize ticket:', err);
         Sentry.captureException(err);
         res.status(500).json({ error: 'Failed to summarize ticket' });
      }
   }
);

// ------------------------------------------------------------------------
// POST /api/tickets/inbound-email (inboundEmailLimiter, verifyWebhookSecret
// — no requireAuth, since the caller is an email provider, not a signed-in
// user)
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
            status: TicketStatus.new,
         },
         select: TICKET_SELECT,
      });

      // Fire-and-forget: classification itself runs asynchronously in
      // jobs/classify-ticket-job.ts's worker, not inline here, so this
      // webhook response doesn't wait on an LLM call. A failure to enqueue
      // is logged rather than failing the whole webhook — the ticket was
      // already created, and simply staying uncategorized (category: null)
      // is the existing fallback the rest of the app already handles.
      try {
         await boss.send(CLASSIFY_TICKET_QUEUE, { ticketId: ticket.id });
      } catch (err) {
         console.error('Failed to enqueue ticket classification:', err);
         Sentry.captureException(err);
      }

      // Same fire-and-forget contract as classification above: auto-
      // resolution runs asynchronously in jobs/auto-resolve-ticket-job.ts's
      // worker. Unlike a failed classify-enqueue (harmless — the ticket
      // stays visible, just uncategorized), a failed auto-resolve enqueue
      // would leave the ticket stuck in the internal 'new' status forever,
      // invisible on the list — so fall back to 'open' so a human still
      // sees it.
      try {
         await boss.send(AUTO_RESOLVE_TICKET_QUEUE, { ticketId: ticket.id });
      } catch (err) {
         console.error('Failed to enqueue ticket auto-resolution:', err);
         Sentry.captureException(err);
         await prisma.ticket.updateMany({
            where: { id: ticket.id, status: TicketStatus.new },
            data: { status: TicketStatus.open },
         });
      }

      res.status(201).json({ ticket });
   }
);
