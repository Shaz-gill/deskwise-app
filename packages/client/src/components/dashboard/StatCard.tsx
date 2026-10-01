import type { LucideIcon } from 'lucide-react';

// A plain cell meant to sit inside one shared ledger-row container (see
// DashboardPage.tsx) rather than owning its own card/border/shadow — four
// stats are facets of one summary, not four separate objects.
export function StatCard({
   label,
   value,
   icon: Icon,
}: {
   label: string;
   value: string | number;
   icon?: LucideIcon;
}) {
   return (
      <div className="flex flex-col gap-1 px-4 py-3">
         <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">{label}</span>
            {Icon && <Icon className="size-4 text-muted-foreground" />}
         </div>
         <span className="font-heading text-4xl font-semibold text-foreground [font-variant-numeric:proportional-nums]">
            {value}
         </span>
      </div>
   );
}
