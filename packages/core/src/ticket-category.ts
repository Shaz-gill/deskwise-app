export const TicketCategory = {
   GeneralQuestion: 'general_question',
   TechnicalQuestion: 'technical_question',
   RefundRequest: 'refund_request',
} as const;

export type TicketCategory =
   (typeof TicketCategory)[keyof typeof TicketCategory];
