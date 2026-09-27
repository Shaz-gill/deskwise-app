import { PAGE_CONTAINER } from '../lib/layout';
import { cn } from '../lib/utils';

export function Footer() {
   return (
      <footer className="border-t border-border bg-card">
         <div
            className={cn(
               PAGE_CONTAINER,
               'py-4 text-center text-xs text-muted-foreground'
            )}
         >
            © {new Date().getFullYear()} Deskwise. All rights reserved.
         </div>
      </footer>
   );
}
