import { Role } from 'core';
import {
   ChevronDownIcon,
   LayoutDashboardIcon,
   LogOutIcon,
   MenuIcon,
   MoonIcon,
   SettingsIcon,
   SunIcon,
   TicketIcon,
   UserIcon,
   UsersIcon,
   type LucideIcon,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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

function isNavLinkActive(pathname: string, path: string) {
   return pathname === path || pathname.startsWith(`${path}/`);
}

type NavItem = { to: string; icon: LucideIcon; label: string };

export function NavBar() {
   const navigate = useNavigate();
   const { pathname } = useLocation();
   const { data, refetch } = authClient.useSession();
   const { isDark, toggle } = useDarkMode();

   async function handleSignOut() {
      await authClient.signOut();
      await refetch();
      navigate('/login', { replace: true });
   }

   const navItems: NavItem[] = [
      data?.user && {
         to: '/dashboard',
         icon: LayoutDashboardIcon,
         label: 'Dashboard',
      },
      data?.user?.role === Role.admin && {
         to: '/users',
         icon: UsersIcon,
         label: 'Users',
      },
      data?.user && { to: '/tickets', icon: TicketIcon, label: 'Tickets' },
   ].filter((item): item is NavItem => !!item);

   return (
      <nav className="border-b border-border bg-card">
         <div
            className={cn(
               PAGE_CONTAINER,
               'flex items-center justify-between gap-2 py-4'
            )}
         >
            <div className="flex items-center gap-6">
               <Link to="/">
                  <Logo size="sm" />
               </Link>
               <div className="hidden items-center gap-6 md:flex">
                  {navItems.map((item) => (
                     <Link
                        key={item.to}
                        to={item.to}
                        className={cn(
                           'flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground',
                           isNavLinkActive(pathname, item.to) &&
                              'font-semibold text-foreground'
                        )}
                     >
                        <item.icon className="size-4" />
                        {item.label}
                     </Link>
                  ))}
               </div>
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
               {navItems.length > 0 && (
                  <DropdownMenu>
                     <DropdownMenuTrigger
                        render={
                           <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Open navigation menu"
                              className="md:hidden"
                           >
                              <MenuIcon />
                           </Button>
                        }
                     />
                     <DropdownMenuContent align="end">
                        {navItems.map((item) => (
                           <DropdownMenuItem
                              key={item.to}
                              onClick={() => navigate(item.to)}
                              className={cn(
                                 isNavLinkActive(pathname, item.to) &&
                                    'font-semibold text-foreground'
                              )}
                           >
                              <item.icon />
                              {item.label}
                           </DropdownMenuItem>
                        ))}
                     </DropdownMenuContent>
                  </DropdownMenu>
               )}
               <DropdownMenu>
                  <DropdownMenuTrigger
                     render={
                        <Button variant="ghost" className="gap-1.5">
                           <UserIcon className="text-muted-foreground" />
                           <span className="hidden sm:inline">
                              {data?.user?.name}
                           </span>
                           <ChevronDownIcon className="text-muted-foreground" />
                        </Button>
                     }
                  />
                  <DropdownMenuContent align="end">
                     {data?.user?.role === Role.admin && (
                        <DropdownMenuItem onClick={() => navigate('/settings')}>
                           <SettingsIcon />
                           Settings
                        </DropdownMenuItem>
                     )}
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
