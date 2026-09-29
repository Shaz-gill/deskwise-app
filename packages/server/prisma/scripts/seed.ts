import 'dotenv/config';
import { hashPassword } from 'better-auth/crypto';
import { Role } from '../../generated/prisma/enums';
import prisma from '../../db';
import {
   AI_ASSISTANT_EMAIL,
   AI_ASSISTANT_NAME,
} from '../../lib/tickets/ai-assistant-user';

async function main() {
   const email = process.env.ADMIN_EMAIL;
   const password = process.env.ADMIN_PASSWORD;

   if (!email || !password) {
      throw new Error(
         'ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment to seed the admin user.'
      );
   }

   const existing = await prisma.user.findUnique({ where: { email } });
   if (existing) {
      console.log(`User ${email} already exists — skipping admin seed.`);
   } else {
      const hashedPassword = await hashPassword(password);
      const now = new Date();
      const userId = crypto.randomUUID();

      await prisma.user.create({
         data: {
            id: userId,
            name: 'Admin',
            email,
            emailVerified: true,
            role: Role.admin,
            createdAt: now,
            updatedAt: now,
            accounts: {
               create: {
                  id: crypto.randomUUID(),
                  accountId: userId,
                  providerId: 'credential',
                  password: hashedPassword,
                  createdAt: now,
                  updatedAt: now,
               },
            },
         },
      });

      console.log(`Seeded admin user: ${email}`);
   }

   // Independent of the admin above (so it's not skipped by that early
   // return) — this is the only place the AI Assistant is ever created;
   // lib/tickets/ai-assistant-user.ts's getAiAssistantUser() is a lookup
   // only, matching how it never gets an Account row either.
   const existingAiAssistant = await prisma.user.findUnique({
      where: { email: AI_ASSISTANT_EMAIL },
   });
   if (existingAiAssistant) {
      console.log(
         `User ${AI_ASSISTANT_EMAIL} already exists — skipping AI Assistant seed.`
      );
   } else {
      const now = new Date();
      await prisma.user.create({
         data: {
            id: crypto.randomUUID(),
            name: AI_ASSISTANT_NAME,
            email: AI_ASSISTANT_EMAIL,
            emailVerified: true,
            role: Role.ai,
            createdAt: now,
            updatedAt: now,
         },
      });
      console.log(`Seeded AI Assistant user: ${AI_ASSISTANT_EMAIL}`);
   }
}

main()
   .catch((error) => {
      console.error(error);
      process.exitCode = 1;
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
