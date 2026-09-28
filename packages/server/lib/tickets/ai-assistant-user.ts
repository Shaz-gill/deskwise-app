import prisma from '../../db';
import { Role } from '../../generated/prisma/enums';
import type { User } from '../../generated/prisma/client';

// Well-known bot account whose replies represent auto-resolutions
// (senderType: 'ai' on TicketReply). Deliberately a real User row rather
// than a nullable TicketReply.authorId — see auto-resolve-ticket-job.ts.
// Never logs in, so it gets no Account row (a User doesn't require one —
// see seed-users.ts, which only creates an Account for the credential
// provider).
const AI_ASSISTANT_EMAIL = 'ai-assistant@deskwise.internal';
const AI_ASSISTANT_NAME = 'AI Assistant';

export async function getOrCreateAiAssistantUser(): Promise<User> {
   const existing = await prisma.user.findUnique({
      where: { email: AI_ASSISTANT_EMAIL },
   });
   if (existing) return existing;

   const now = new Date();
   return prisma.user.create({
      data: {
         id: crypto.randomUUID(),
         name: AI_ASSISTANT_NAME,
         email: AI_ASSISTANT_EMAIL,
         emailVerified: true,
         role: Role.user,
         createdAt: now,
         updatedAt: now,
      },
   });
}
