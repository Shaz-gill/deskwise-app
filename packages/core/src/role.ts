export const Role = {
   admin: 'admin',
   user: 'user',
   ai: 'ai',
} as const;

export type Role = (typeof Role)[keyof typeof Role];
