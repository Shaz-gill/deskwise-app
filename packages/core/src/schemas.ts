import { z } from 'zod';

export const loginSchema = z.object({
   email: z.string().min(1, 'Email is required').email('Enter a valid email'),
   password: z.string().min(1, 'Password is required'),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const createUserSchema = z.object({
   name: z.string().min(3, 'Name must be at least 3 characters'),
   email: z.string().min(1, 'Email is required').email('Enter a valid email'),
   password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type CreateUserFormValues = z.infer<typeof createUserSchema>;

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
