// Mirrors packages/server/prisma/schema.prisma's Role enum (admin | user).
// A plain const object rather than a TS `enum` — packages/client's
// tsconfig has erasableSyntaxOnly, which real enums violate.
export const Role = {
   admin: 'admin',
   user: 'user',
} as const;

export type Role = (typeof Role)[keyof typeof Role];
