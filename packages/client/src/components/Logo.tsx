import { Ticket } from 'lucide-react';

export function Logo({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
   const badge = size === 'lg' ? 'h-10 w-10' : 'h-7 w-7';
   const icon = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5';
   const text = size === 'lg' ? 'text-4xl' : 'text-2xl';

   return (
      <div className="flex items-center gap-2">
         <span
            className={`flex ${badge} items-center justify-center rounded-lg bg-primary`}
         >
            <Ticket
               className={`${icon} stroke-primary-foreground`}
               strokeWidth={2.5}
            />
         </span>
         <span className={`${text} font-heading font-semibold text-foreground`}>
            Deskwise
         </span>
      </div>
   );
}
