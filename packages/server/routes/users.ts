import { Router } from 'express';
import type { Request, Response } from 'express';
import { hashPassword } from 'better-auth/crypto';
import { createUserSchema, editUserSchema } from '../../core';
import prisma from '../db';
import { Prisma } from '../generated/prisma/client';
import { Role } from '../generated/prisma/enums';
import { requireAuth } from '../middleware/require-auth';
import { requireAdmin } from '../middleware/require-admin';

export const usersRouter = Router();

usersRouter.get(
   '/',
   requireAuth,
   requireAdmin,
   async (req: Request, res: Response) => {
      try {
         const users = await prisma.user.findMany({
            where: { deletedAt: null },
            select: {
               id: true,
               name: true,
               email: true,
               role: true,
               createdAt: true,
            },
            orderBy: { name: 'asc' },
         });

         res.json({ users });
      } catch (err) {
         console.error('Failed to list users:', err);
         res.status(500).json({ error: 'Internal Server Error' });
      }
   }
);

usersRouter.post(
   '/',
   requireAuth,
   requireAdmin,
   async (req: Request, res: Response) => {
      const result = createUserSchema.safeParse(req.body);
      if (!result.success) {
         res.status(400).json({
            error: 'Validation failed',
            issues: result.error.issues,
         });
         return;
      }

      const { name, email, password } = result.data;

      try {
         const hashedPassword = await hashPassword(password);
         const now = new Date();
         const userId = crypto.randomUUID();

         const user = await prisma.user.create({
            data: {
               id: userId,
               name,
               email,
               emailVerified: true,
               role: Role.agent,
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
            select: {
               id: true,
               name: true,
               email: true,
               role: true,
               createdAt: true,
            },
         });

         res.status(201).json({ user });
      } catch (err) {
         // P2002 = unique constraint violation — User.email is @unique.
         if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002'
         ) {
            res.status(409).json({
               error: 'A user with this email already exists',
            });
            return;
         }

         console.error('Failed to create user:', err);
         res.status(500).json({ error: 'Internal Server Error' });
      }
   }
);

usersRouter.patch(
   '/:id',
   requireAuth,
   requireAdmin,
   async (req: Request, res: Response) => {
      const result = editUserSchema.safeParse(req.body);
      if (!result.success) {
         res.status(400).json({
            error: 'Validation failed',
            issues: result.error.issues,
         });
         return;
      }

      const { name, email, password } = result.data;
      const userId = req.params.id;
      if (typeof userId !== 'string') {
         res.status(400).json({ error: 'Invalid user id' });
         return;
      }

      try {
         const user = await prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
               where: { id: userId },
               data: { name, email, updatedAt: new Date() },
               select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                  createdAt: true,
               },
            });

            if (password) {
               const hashedPassword = await hashPassword(password);
               await tx.account.updateMany({
                  where: { userId, providerId: 'credential' },
                  data: { password: hashedPassword, updatedAt: new Date() },
               });
            }

            return updated;
         });

         res.json({ user });
      } catch (err) {
         if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // P2002 = unique constraint violation — User.email is @unique.
            if (err.code === 'P2002') {
               res.status(409).json({
                  error: 'A user with this email already exists',
               });
               return;
            }

            // P2025 = record not found — req.params.id didn't match a user.
            if (err.code === 'P2025') {
               res.status(404).json({ error: 'User not found' });
               return;
            }
         }

         console.error('Failed to update user:', err);
         res.status(500).json({ error: 'Internal Server Error' });
      }
   }
);

usersRouter.delete(
   '/:id',
   requireAuth,
   requireAdmin,
   async (req: Request, res: Response) => {
      const userId = req.params.id;
      if (typeof userId !== 'string') {
         res.status(400).json({ error: 'Invalid user id' });
         return;
      }

      try {
         const target = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, deletedAt: true },
         });

         if (!target || target.deletedAt) {
            res.status(404).json({ error: 'User not found' });
            return;
         }

         if (target.role === Role.admin) {
            res.status(403).json({ error: 'Admin accounts cannot be deleted' });
            return;
         }

         await prisma.$transaction([
            prisma.user.update({
               where: { id: userId },
               data: { deletedAt: new Date() },
            }),
            prisma.session.deleteMany({ where: { userId } }),
         ]);

         res.status(204).send();
      } catch (err) {
         console.error('Failed to delete user:', err);
         res.status(500).json({ error: 'Internal Server Error' });
      }
   }
);
