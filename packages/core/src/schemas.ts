import { z } from 'zod';
import { TicketCategory } from './ticket-category';
import { TicketStatus } from './ticket-status';

export const loginSchema = z.object({
   email: z.string().min(1, 'Email is required').email('Enter a valid email'),
   password: z.string().min(1, 'Password is required'),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

// ------------------------------------------------------------------------

export const createUserSchema = z.object({
   name: z.string().min(3, 'Name must be at least 3 characters'),
   email: z.string().min(1, 'Email is required').email('Enter a valid email'),
   password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type CreateUserFormValues = z.infer<typeof createUserSchema>;

// ------------------------------------------------------------------------

export const editUserSchema = z.object({
   name: z.string().min(3, 'Name must be at least 3 characters'),
   email: z.string().min(1, 'Email is required').email('Enter a valid email'),
   password: z
      .union([
         z.literal(''),
         z.string().min(8, 'Password must be at least 8 characters'),
      ])
      .optional(),
});
export type EditUserFormValues = z.infer<typeof editUserSchema>;

// ------------------------------------------------------------------------

export const inboundEmailSchema = z.object({
   // 254 = RFC 5321's max total email address length.
   from: z.email('Enter a valid email').max(254, 'Email is too long'),
   fromName: z
      .string()
      .trim()
      .min(1, 'Sender name is required')
      .max(200, 'Sender name is too long'),
   subject: z
      .string()
      .trim()
      .min(1, 'Subject is required')
      .max(500, 'Subject is too long'),
   body: z.string().min(1, 'Body is required').max(50_000, 'Body is too long'),
   bodyHtml: z.string().max(100_000, 'Body HTML is too long').optional(),
});
export type InboundEmailPayload = z.infer<typeof inboundEmailSchema>;

// ------------------------------------------------------------------------

export const updateTicketSchema = z.object({
   assignedToId: z.string().nullable().optional(),
   status: z.enum(Object.values(TicketStatus)).optional(),
   category: z.enum(Object.values(TicketCategory)).nullable().optional(),
});
export type UpdateTicketPayload = z.infer<typeof updateTicketSchema>;

// ------------------------------------------------------------------------

export const createTicketReplySchema = z.object({
   body: z
      .string()
      .trim()
      .min(1, 'Reply cannot be empty')
      .max(10_000, 'Reply is too long'),
   bodyHtml: z.string().max(20_000, 'Reply is too long').optional(),
});
export type CreateTicketReplyFormValues = z.infer<
   typeof createTicketReplySchema
>;
