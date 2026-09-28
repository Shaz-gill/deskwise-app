import 'dotenv/config';
import { hashPassword } from 'better-auth/crypto';
import { Role } from '../../generated/prisma/enums';
import prisma from '../../db';

// Manual dev-data seed for a realistic-looking user roster — one admin
// (Shaz Gill) plus a set of regular support agents, all sharing
// DEMO_PASSWORD so any of them can be used to log in locally. Distinct
// from scripts/seed.ts, which bootstraps a single admin account from the
// ADMIN_EMAIL/ADMIN_PASSWORD env vars for a real deployment. Skips any
// email that already exists, so it's safe to re-run.
const DEMO_PASSWORD = 'Password123!';

const USERS: [name: string, email: string, role: Role][] = [
   ['Shaz Gill', 'shaz.gill@deskwise.dev', Role.admin],
   ['Amara Johnson', 'amara.johnson@deskwise.dev', Role.user],
   ['Ben Whitfield', 'ben.whitfield@deskwise.dev', Role.user],
   ['Carmen Ruiz', 'carmen.ruiz@deskwise.dev', Role.user],
   ['Daniel Osei', 'daniel.osei@deskwise.dev', Role.user],
   ['Elena Petrova', 'elena.petrova@deskwise.dev', Role.user],
   ['Farid Hassan', 'farid.hassan@deskwise.dev', Role.user],
   ['Grace Lindqvist', 'grace.lindqvist@deskwise.dev', Role.user],
   ['Harun Yilmaz', 'harun.yilmaz@deskwise.dev', Role.user],
   ['Isla Fraser', 'isla.fraser@deskwise.dev', Role.user],
   ['Jamal Thompson', 'jamal.thompson@deskwise.dev', Role.user],
   ['Keiko Tanaka', 'keiko.tanaka@deskwise.dev', Role.user],
   ['Leo Moretti', 'leo.moretti@deskwise.dev', Role.user],
   ['Maya Iyer', 'maya.iyer@deskwise.dev', Role.user],
   ['Nathan Cole', 'nathan.cole@deskwise.dev', Role.user],
];

async function main() {
   const hashedPassword = await hashPassword(DEMO_PASSWORD);

   let createdCount = 0;
   for (const [name, email, role] of USERS) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) continue;

      const now = new Date();
      const userId = crypto.randomUUID();

      await prisma.user.create({
         data: {
            id: userId,
            name,
            email,
            emailVerified: true,
            role,
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
      createdCount++;
   }

   console.log(
      `Seeded ${createdCount} user(s) (${USERS.length - createdCount} already existed).`
   );
   console.log(`All seeded users share the password: ${DEMO_PASSWORD}`);
}

main()
   .catch((error) => {
      console.error(error);
      process.exitCode = 1;
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
