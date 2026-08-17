import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

export function NavBar() {
   const navigate = useNavigate();
   const { data: session } = authClient.useSession();

   const user = session?.user;
   const displayName = user?.name || user?.email || '';

   async function handleLogout() {
      await authClient.signOut();
      navigate('/login', { replace: true });
   }

   return (
      <header className="flex items-center justify-between border-b px-6 py-3">
         <span className="text-sm font-medium">Deskwise</span>
         <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{displayName}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
               Log out
            </Button>
         </div>
      </header>
   );
}
