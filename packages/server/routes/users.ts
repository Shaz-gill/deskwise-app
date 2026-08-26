import { Router } from 'express';
import type { Request, Response } from 'express';
import { hashPassword } from 'better-auth/crypto';
import { createUserSchema, editUserSchema } from 'core';
import prisma from '../db';
import { Role } from '../generated/prisma/enums';
import { validateBody } from '../lib/validate';
import { requireAuth } from '../middleware/require-auth';
import { requireAdmin } from '../middleware/require-admin';

export const usersRouter = Router();

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

usersRouter.get(
   '/',
   requireAuth,
   requireAdmin,
   async (req: Request, res: Response) => {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(
         MAX_PAGE_SIZE,
         Math.max(1, Number(req.query.pageSize) || DEFAULT_PAGE_SIZE)
      );
      const search =
         typeof req.query.search === 'string' ? req.query.search.trim() : '';

      const where = {
         deletedAt: null,
         ...(search && {
            email: { contains: search, mode: 'insensitive' as const },
         }),
      };

      const [users, total] = await Promise.all([
         prisma.user.findMany({
            where,
            select: {
               id: true,
               name: true,
               email: true,
               role: true,
               createdAt: true,
            },
            orderBy: { name: 'asc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
         }),
         prisma.user.count({ where }),
      ]);

      res.json({ users, total, page, pageSize });
   }
);

usersRouter.post(
   '/',
   requireAuth,
   requireAdmin,
   async (req: Request, res: Response) => {
      const data = validateBody(createUserSchema, req, res);
      if (!data) return;

      const { name, email, password } = data;

      const hashedPassword = await hashPassword(password);
      const now = new Date();
      const userId = crypto.randomUUID();

      const user = await prisma.user.create({
         data: {
            id: userId,
            name,
            email,
            emailVerified: true,
            role: Role.user,
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
   }
);

usersRouter.patch(
   '/:id',
   requireAuth,
   requireAdmin,
   async (req: Request, res: Response) => {
      const data = validateBody(editUserSchema, req, res);
      if (!data) return;

      const { name, email, password } = data;
      const userId = req.params.id;
      if (typeof userId !== 'string') {
         res.status(400).json({ error: 'Invalid user id' });
         return;
      }

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
            data: {
               deletedAt: new Date(),
               // Frees the original email for reuse by a new account —
               // the user row (id/name/role) sticks around for ticket
               // history, but its email no longer occupies the unique
               // constraint.
               email: `deleted+${userId}@deskwise.invalid`,
            },
         }),
         prisma.session.deleteMany({ where: { userId } }),
      ]);

      res.status(204).send();
   }
);
