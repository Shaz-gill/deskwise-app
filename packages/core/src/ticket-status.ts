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
