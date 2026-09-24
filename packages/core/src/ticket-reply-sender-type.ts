// Mirrors packages/server/prisma/schema.prisma's TicketReplySenderType enum
// (user | customer) — "user" means an internal Deskwise user replied, as
// opposed to the external customer who emailed in.
export const TicketReplySenderType = {
   user: 'user',
   customer: 'customer',
} as const;

export type TicketReplySenderType =
   (typeof TicketReplySenderType)[keyof typeof TicketReplySenderType];
