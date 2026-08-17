import type { ReactNode } from 'react';
import { NavBar } from './NavBar';

// Shared shell for every authenticated page — owns the nav bar, page
// background, and content container so individual pages only need to
// render their own content, not re-derive the app chrome each time.
export function Layout({ children }: { children: ReactNode }) {
   return (
      <div className="min-h-screen bg-muted">
         <NavBar />
         <main className="mx-auto max-w-5xl p-6">{children}</main>
      </div>
   );
}
