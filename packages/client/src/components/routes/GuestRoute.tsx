import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { authClient } from '../../lib/auth-client';
import { LoadingScreen } from '../LoadingScreen';

// Mirror image of ProtectedRoute: gates a route behind the *absence* of
// a session — wraps "/login" so an already-authenticated user hitting
// that URL directly is bounced to "/" instead of seeing the form again.
export function GuestRoute({ children }: { children: ReactNode }) {
   const { data, isPending } = authClient.useSession();

   if (isPending) {
      return <LoadingScreen />;
   }

   if (data?.user) {
      return <Navigate to="/" replace />;
   }

   return <>{children}</>;
}
