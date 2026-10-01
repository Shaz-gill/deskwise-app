import 'dotenv/config';
import { hashPassword } from 'better-auth/crypto';
import { Role } from '../../generated/prisma/enums';
import prisma from '../../db';

// Manual dev-data seed for a realistic-looking user roster — one admin
// (Shaz Gill) plus a set of regular support agents at "Pathlight Academy"
// (the fictional LMS demo tenant), all sharing DEMO_PASSWORD so any of them
// can be used to log in locally. Distinct from scripts/seed.ts, which
// bootstraps a single admin account from the ADMIN_EMAIL/ADMIN_PASSWORD env
// vars for a real deployment. Skips any email that already exists, so it's
// safe to re-run.
const DEMO_PASSWORD = 'Password123!';

export const ADMIN = { name: 'Shaz Gill', email: 'shaz.gill@pathlight.io' };

// Informal, seed-data-only grouping — there's no `team` column on User, this
// just drives which agents seed-tickets.ts picks as assignees for which
// ticket topics, mirroring how a real support org would route tickets.
export type AgentTeam =
   'billing' | 'technical' | 'instructor_success' | 'general';

export const AGENTS: { name: string; email: string; team: AgentTeam }[] = [
   // Billing & Payments — refunds, failed/duplicate charges, coupons,
   // billing side of team/business licenses.
   {
      name: 'Amara Johnson',
      email: 'amara.johnson@pathlight.io',
      team: 'billing',
   },
   {
      name: 'Ben Whitfield',
      email: 'ben.whitfield@pathlight.io',
      team: 'billing',
   },
   { name: 'Carmen Ruiz', email: 'carmen.ruiz@pathlight.io', team: 'billing' },
   { name: 'Daniel Osei', email: 'daniel.osei@pathlight.io', team: 'billing' },

   // Platform & Technical Support — course access, video playback,
   // certificates, login/2FA.
   {
      name: 'Elena Petrova',
      email: 'elena.petrova@pathlight.io',
      team: 'technical',
   },
   {
      name: 'Farid Hassan',
      email: 'farid.hassan@pathlight.io',
      team: 'technical',
   },
   {
      name: 'Grace Lindqvist',
      email: 'grace.lindqvist@pathlight.io',
      team: 'technical',
   },
   {
      name: 'Harun Yilmaz',
      email: 'harun.yilmaz@pathlight.io',
      team: 'technical',
   },
   {
      name: 'Isla Fraser',
      email: 'isla.fraser@pathlight.io',
      team: 'technical',
   },

   // Instructor Success — instructor payouts/revenue share, course
   // publishing/review.
   {
      name: 'Jamal Thompson',
      email: 'jamal.thompson@pathlight.io',
      team: 'instructor_success',
   },
   {
      name: 'Keiko Tanaka',
      email: 'keiko.tanaka@pathlight.io',
      team: 'instructor_success',
   },
   {
      name: 'Leo Moretti',
      email: 'leo.moretti@pathlight.io',
      team: 'instructor_success',
   },

   // Customer Success — General — non-billing team/license questions,
   // ambiguous/uncategorized tickets.
   { name: 'Maya Iyer', email: 'maya.iyer@pathlight.io', team: 'general' },
   { name: 'Nathan Cole', email: 'nathan.cole@pathlight.io', team: 'general' },
];

async function main() {
   const hashedPassword = await hashPassword(DEMO_PASSWORD);

   const users: { name: string; email: string; role: Role }[] = [
      { ...ADMIN, role: Role.admin },
      ...AGENTS.map((agent) => ({
         name: agent.name,
         email: agent.email,
         role: Role.user,
      })),
   ];

   let createdCount = 0;
   for (const { name, email, role } of users) {
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
      `Seeded ${createdCount} user(s) (${users.length - createdCount} already existed).`
   );
   console.log(`All seeded users share the password: ${DEMO_PASSWORD}`);
}

// seed-tickets.ts imports AGENTS/ADMIN from this module for its agent
// roster — guard the run-as-a-script behavior so that import doesn't also
// re-run this file's own main() (and disconnect the shared prisma client
// out from under the importing script).
if (import.meta.main) {
   main()
      .catch((error) => {
         console.error(error);
         process.exitCode = 1;
      })
      .finally(async () => {
         await prisma.$disconnect();
      });
}
