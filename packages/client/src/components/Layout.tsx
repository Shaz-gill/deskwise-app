import type { ReactNode } from 'react';
import { PAGE_CONTAINER } from '../lib/layout';
import { cn } from '../lib/utils';
import { NavBar } from './NavBar';

export function Layout({ children }: { children: ReactNode }) {
   return (
      <div className="min-h-screen bg-muted">
         <NavBar />
         <main className={cn(PAGE_CONTAINER, 'py-8')}>{children}</main>
      </div>
   );
}
