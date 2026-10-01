// Const-object "enums" (not real TS enums — packages/client's
// erasableSyntaxOnly tsconfig option forbids those) shared by server and
// client, one per Prisma enum they mirror.

export const Role = {
   admin: 'admin',
   user: 'user',
   ai: 'ai',
   customer: 'customer',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

// ------------------------------------------------------------------------

export const TicketCategory = {
   GeneralQuestion: 'general_question',
   TechnicalQuestion: 'technical_question',
   RefundRequest: 'refund_request',
} as const;

export type TicketCategory =
   (typeof TicketCategory)[keyof typeof TicketCategory];

// ------------------------------------------------------------------------

export const TicketStatus = {
   New: 'new',
   Processing: 'processing',
   Open: 'open',
   Resolved: 'resolved',
   Closed: 'closed',
} as const;

export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

// Statuses a human can see or manually set. 'new' and 'processing' are
// internal-only states owned by the auto-resolve pipeline and must never
// reach the UI.
export const HUMAN_TICKET_STATUSES = [
   TicketStatus.Open,
   TicketStatus.Resolved,
   TicketStatus.Closed,
] as const;

// ------------------------------------------------------------------------

// Mirrors packages/server/prisma/schema.prisma's TicketReplySenderType enum
// (user | customer | ai) — "user" means an internal Deskwise user replied,
// as opposed to the external customer who emailed in; "ai" is the
// auto-resolve pipeline's bot-authored reply.
export const TicketReplySenderType = {
   user: 'user',
   customer: 'customer',
   ai: 'ai',
} as const;

export type TicketReplySenderType =
   (typeof TicketReplySenderType)[keyof typeof TicketReplySenderType];

// ------------------------------------------------------------------------

export const KnowledgeDocStatus = {
   Processing: 'processing',
   Ready: 'ready',
   Failed: 'failed',
} as const;

export type KnowledgeDocStatus =
   (typeof KnowledgeDocStatus)[keyof typeof KnowledgeDocStatus];
