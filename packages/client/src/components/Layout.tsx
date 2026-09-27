import type { ReactNode } from 'react';
import { PAGE_CONTAINER } from '../lib/layout';
import { cn } from '../lib/utils';
import { Footer } from './Footer';
import { NavBar } from './NavBar';

export function Layout({ children }: { children: ReactNode }) {
   return (
      <div className="flex min-h-screen flex-col bg-muted">
         <NavBar />
         <main className={cn(PAGE_CONTAINER, 'flex-1 py-8')}>{children}</main>
         <Footer />
      </div>
   );
}
