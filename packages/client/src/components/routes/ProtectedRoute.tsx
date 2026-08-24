import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { authClient } from '../../lib/auth-client';
import { LoadingScreen } from '../LoadingScreen';

// Gates a route behind an authenticated session — used to wrap "/" so
// signed-out visitors land on /login instead of the app shell.
export function ProtectedRoute({ children }: { children: ReactNode }) {
   const { data, isPending } = authClient.useSession();

   // Check isPending before data: on first mount the session cache may
   // still hold a stale/empty value from before the initial /get-session
   // fetch resolves. Redirecting on that stale value would flash to
   // /login even for an already-authenticated user.
   if (isPending) {
      return <LoadingScreen />;
   }

   if (!data?.user) {
      return <Navigate to="/login" replace />;
   }

   return <>{children}</>;
}
