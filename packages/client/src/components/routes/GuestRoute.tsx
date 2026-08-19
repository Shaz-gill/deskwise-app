import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { authClient } from '../../lib/auth-client';
import { LoadingScreen } from '../LoadingScreen';

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
