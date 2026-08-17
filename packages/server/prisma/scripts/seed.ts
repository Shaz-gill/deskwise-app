import 'dotenv/config';
import { hashPassword } from 'better-auth/crypto';
import { Role } from '../../generated/prisma/enums';
import prisma from '../../db';

// Seeds the initial admin user directly through Prisma, bypassing Better
// Auth's sign-up endpoint (which is intentionally disabled — see auth.ts).
// Credentials come from the environment so they never live in source control.
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
      console.log(`User ${email} already exists — skipping seed.`);
      return;
   }

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

main()
   .catch((error) => {
      console.error(error);
      process.exitCode = 1;
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
