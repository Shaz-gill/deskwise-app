import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { authClient } from '../../lib/auth-client';

export function AdminRoute({ children }: { children: ReactNode }) {
   const { data } = authClient.useSession();

   if (data?.user?.role !== 'admin') {
      return <Navigate to="/" replace />;
   }

   return <>{children}</>;
}
