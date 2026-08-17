import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { authClient } from '../lib/auth-client';

// Narrows a route already behind ProtectedRoute (so a session and its
// isPending resolution are guaranteed) down to admins only — signed-in
// non-admins are bounced to "/" rather than seeing the admin page.
export function AdminRoute({ children }: { children: ReactNode }) {
   const { data } = authClient.useSession();

   if (data?.user?.role !== 'admin') {
      return <Navigate to="/" replace />;
   }

   return <>{children}</>;
}
