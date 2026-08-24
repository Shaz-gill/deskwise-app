import { betterAuth } from 'better-auth';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import prisma from '../db';
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
            defaultValue: 'user',
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
            select: { deletedAt: true },
         });

         if (existing?.deletedAt) {
            throw new APIError('FORBIDDEN', {
               message: 'This account has been disabled.',
            });
         }
      }),
   },
});
