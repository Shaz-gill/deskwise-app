import { Link, useNavigate } from 'react-router-dom';
import { MoonIcon, SunIcon } from 'lucide-react';
import { authClient } from '../lib/auth-client';
import { cn } from '../lib/utils';
import { PAGE_CONTAINER } from '../lib/layout';
import { useDarkMode } from '../hooks/use-dark-mode';
import { Logo } from './Logo';
import { Button } from './ui/button';

export function NavBar() {
   const navigate = useNavigate();
   const { data, refetch } = authClient.useSession();
   const { isDark, toggle } = useDarkMode();

   async function handleSignOut() {
      await authClient.signOut();
      await refetch();
      navigate('/login', { replace: true });
   }

   return (
      <nav className="border-b border-border bg-card">
         <div
            className={cn(
               PAGE_CONTAINER,
               'flex items-center justify-between py-4'
            )}
         >
            <div className="flex items-center gap-6">
               <Logo size="sm" />
               {data?.user?.role === 'admin' && (
                  <Link
                     to="/users"
                     className="text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                     Users
                  </Link>
               )}
            </div>
            <div className="flex items-center gap-4">
               <span className="text-sm font-medium text-foreground">
                  {data?.user?.name}
               </span>
               <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={
                     isDark ? 'Switch to light mode' : 'Switch to dark mode'
                  }
                  onClick={toggle}
               >
                  {isDark ? <MoonIcon /> : <SunIcon />}
               </Button>
               <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Sign out
               </Button>
            </div>
         </div>
      </nav>
   );
}
