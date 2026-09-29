import prisma from '../../db';
import type { User } from '../../generated/prisma/client';

// Well-known bot account whose replies represent auto-resolutions
// (senderType: 'ai' on TicketReply). Deliberately a real User row rather
// than a nullable TicketReply.authorId — see auto-resolve-ticket-job.ts.
// Created once by prisma/scripts/seed.ts (role: Role.ai — routes/users.ts's
// delete guard, lib/auth.ts's sign-in-block hook, and the client's
// UserRowActions all protect it the same way they already protect
// Role.admin) — never given an Account row, so it can never log in either
// way. This is a lookup only, not a find-or-create: the caller
// (auto-resolve-ticket-job.ts) already wraps it in a try/catch that falls
// back to leaving the ticket open on any failure, so a second code path
// that could also create this row would just be redundant.
export const AI_ASSISTANT_EMAIL =
   process.env.AI_ASSISTANT_EMAIL || 'ai-assistant@deskwise.internal';
export const AI_ASSISTANT_NAME = 'AI Assistant';

export async function getAiAssistantUser(): Promise<User> {
   const user = await prisma.user.findUnique({
      where: { email: AI_ASSISTANT_EMAIL },
   });

   if (!user) {
      throw new Error(
         `AI Assistant user (${AI_ASSISTANT_EMAIL}) not found — run "bun run seed" to create it.`
      );
   }

   return user;
}
