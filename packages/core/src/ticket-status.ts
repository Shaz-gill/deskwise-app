export const TicketStatus = {
   Open: 'open',
   Resolved: 'resolved',
   Closed: 'closed',
} as const;

export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];
