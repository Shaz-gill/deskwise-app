import { betterAuth } from 'better-auth';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import prisma from '../db';
import { Role } from '../generated/prisma/enums';
import { trustedOrigins } from './trusted-origins';

export const auth = betterAuth({
   basePath: '/api/auth',
   database: prismaAdapter(prisma, {
      provider: 'postgresql',
   }),
   trustedOrigins,
   emailAndPassword: {
      enabled: true,
      disableSignUp: true,
   },
   rateLimit: {
      enabled: true,
   },
   user: {
      additionalFields: {
         role: {
            type: 'string',
            required: true,
            defaultValue: Role.user,
            input: false,
         },
      },
   },
   hooks: {
      before: createAuthMiddleware(async (ctx) => {
         if (ctx.path !== '/sign-in/email') return;

         const email = ctx.body?.email as string | undefined;
         if (!email) return;

         const existing = await prisma.user.findUnique({
            where: { email },
            select: { deletedAt: true, role: true },
         });

         if (existing?.deletedAt) {
            throw new APIError('FORBIDDEN', {
               message: 'This account has been disabled.',
            });
         }

         // The AI Assistant (Role.ai) never has a credential Account row,
         // so it can't complete a real sign-in anyway — this makes that
         // explicit and permanent rather than relying on that incidentally.
         // Same story for Role.customer: seeded customer rows (ticket-reply
         // authors only) never get an Account row either.
         if (existing?.role === Role.ai || existing?.role === Role.customer) {
            throw new APIError('FORBIDDEN', {
               message: 'This account cannot sign in.',
            });
         }
      }),
   },
});
