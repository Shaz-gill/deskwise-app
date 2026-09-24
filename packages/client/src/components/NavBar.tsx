import { Role } from 'core';
import {
   ChevronDownIcon,
   LogOutIcon,
   MoonIcon,
   SunIcon,
   UserIcon,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useDarkMode } from '../hooks/use-dark-mode';
import { authClient } from '../lib/auth-client';
import { PAGE_CONTAINER } from '../lib/layout';
import { cn } from '../lib/utils';
import { Logo } from './Logo';
import { Button } from './ui/button';
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from './ui/dropdown-menu';

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
               <Link to="/">
                  <Logo size="sm" />
               </Link>
               {data?.user?.role === Role.admin && (
                  <Link
                     to="/users"
                     className="text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                     Users
                  </Link>
               )}
               {data?.user && (
                  <Link
                     to="/tickets"
                     className="text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                     Tickets
                  </Link>
               )}
            </div>
            <div className="flex items-center gap-2">
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
               <DropdownMenu>
                  <DropdownMenuTrigger
                     render={
                        <Button variant="ghost" className="gap-1.5">
                           <UserIcon className="text-muted-foreground" />
                           {data?.user?.name}
                           <ChevronDownIcon className="text-muted-foreground" />
                        </Button>
                     }
                  />
                  <DropdownMenuContent align="end">
                     <DropdownMenuItem onClick={handleSignOut}>
                        <LogOutIcon />
                        Sign out
                     </DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>
            </div>
         </div>
      </nav>
   );
}
