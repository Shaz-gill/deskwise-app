import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

import { authClient } from '@/lib/auth-client';

interface RequireAuthProps {
   children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
   const { data: session, isPending } = authClient.useSession();

   if (isPending) {
      return (
         <div className="flex min-h-svh items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading…</p>
         </div>
      );
   }

   if (!session) {
      return <Navigate to="/login" replace />;
   }

   return <>{children}</>;
}
