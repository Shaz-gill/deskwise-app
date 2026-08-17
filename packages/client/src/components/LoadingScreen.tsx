import { Spinner } from './ui/spinner';

// Shared full-page loading state for route guards (ProtectedRoute,
// GuestRoute) while the session cache's initial fetch resolves.
export function LoadingScreen() {
   return (
      <div className="flex min-h-screen items-center justify-center">
         <Spinner className="size-6 text-muted-foreground" />
      </div>
   );
}
