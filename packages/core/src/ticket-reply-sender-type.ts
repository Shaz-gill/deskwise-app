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
