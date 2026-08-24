export function Logo({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
   const badge = size === 'lg' ? 'h-10 w-10' : 'h-7 w-7';
   const icon = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5';
   const text = size === 'lg' ? 'text-2xl' : 'text-lg';

   return (
      <div className="flex items-center gap-2">
         <span
            className={`flex ${badge} items-center justify-center rounded-lg bg-primary`}
         >
            <svg
               viewBox="0 0 24 24"
               className={`${icon} stroke-primary-foreground`}
               fill="none"
               strokeWidth={2.5}
               strokeLinecap="round"
               strokeLinejoin="round"
            >
               <path d="M20 6 9 17l-5-5" />
            </svg>
         </span>
         <span className={`${text} font-heading font-semibold text-foreground`}>
            Deskwise
         </span>
      </div>
   );
}
