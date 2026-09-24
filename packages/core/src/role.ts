export const Role = {
   admin: 'admin',
   user: 'user',
} as const;

export type Role = (typeof Role)[keyof typeof Role];
