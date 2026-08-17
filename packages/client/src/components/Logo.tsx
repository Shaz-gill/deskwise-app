// Single source of truth for the Deskwise mark, used at two sizes:
// 'sm' in NavBar (compact, inline with nav content) and 'lg' on
// LoginPage (standalone, above the sign-in card). A size prop keeps
// both call sites in sync instead of drifting as two separate markups.
export function Logo({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
   const badge = size === 'lg' ? 'h-12 w-12' : 'h-8 w-8';
   const icon = size === 'lg' ? 'h-6 w-6' : 'h-4 w-4';
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
