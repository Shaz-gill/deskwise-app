import type { TicketCategory } from 'core';
import { formatCategory } from '../../lib/ticket-format';

type CategoryCount = { category: TicketCategory | null; count: number };

function titleCase(s: string) {
   return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Fixed category -> color-slot mapping, independent of sort order, so a
// category's color stays stable even if its rank by count changes later —
// color follows the entity, never its rank.
const CATEGORY_COLOR_VAR: Record<string, string> = {
   general_question: 'var(--chart-cat-1)',
   technical_question: 'var(--chart-cat-2)',
   refund_request: 'var(--chart-cat-3)',
   uncategorized: 'var(--chart-cat-4)',
};

const RADIUS = 40;
const STROKE_WIDTH = 16;
// Visual gap (in the same 0-100 "percent of circumference" units pathLength
// gives us) between adjacent donut segments — the surface-color separator,
// same idea as the bar charts' inter-bar gap.
const SEGMENT_GAP = 0.6;

export function CategoryBreakdown({ data }: { data: CategoryCount[] }) {
   const total = data.reduce((sum, d) => sum + d.count, 0);

   if (total === 0) {
      return <p className="text-sm text-muted-foreground">No tickets yet.</p>;
   }

   let cumulative = 0;
   const segments = data.map((d) => {
      const key = d.category ?? 'uncategorized';
      const label = d.category
         ? titleCase(formatCategory(d.category))
         : 'Uncategorized';
      const pct = (d.count / total) * 100;
      const drawnPct = Math.max(pct - SEGMENT_GAP, 0);
      const segment = {
         key,
         label,
         count: d.count,
         pct,
         color: CATEGORY_COLOR_VAR[key] ?? 'var(--chart-cat-4)',
         dashArray: `${drawnPct} ${100 - drawnPct}`,
         dashOffset: -cumulative,
      };
      cumulative += pct;
      return segment;
   });

   return (
      <div className="flex h-full flex-col items-center justify-center gap-8 sm:flex-row">
         <div className="relative h-64 w-64 shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
               <circle
                  cx="50"
                  cy="50"
                  r={RADIUS}
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth={STROKE_WIDTH}
               />
               {segments.map((s) => (
                  <circle
                     key={s.key}
                     cx="50"
                     cy="50"
                     r={RADIUS}
                     fill="none"
                     stroke={s.color}
                     strokeWidth={STROKE_WIDTH}
                     strokeDasharray={s.dashArray}
                     strokeDashoffset={s.dashOffset}
                     pathLength={100}
                     tabIndex={0}
                     role="img"
                     aria-label={`${s.label}: ${s.count} ticket${s.count === 1 ? '' : 's'} (${s.pct.toFixed(0)}%)`}
                     className="outline-none transition-opacity duration-100 hover:opacity-80 focus-visible:opacity-80"
                  />
               ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
               <span className="text-3xl font-semibold text-foreground [font-variant-numeric:tabular-nums]">
                  {total}
               </span>
               <span className="text-sm text-muted-foreground">tickets</span>
            </div>
         </div>
         <div className="flex w-full flex-col gap-4">
            {segments.map((s) => (
               <div key={s.key} className="flex items-center gap-2 text-sm">
                  <span
                     className="size-2.5 shrink-0 rounded-full"
                     style={{ backgroundColor: s.color }}
                  />
                  <span className="flex-1 truncate text-foreground">
                     {s.label}
                  </span>
                  <span className="text-muted-foreground [font-variant-numeric:tabular-nums]">
                     {s.count} · {s.pct.toFixed(0)}%
                  </span>
               </div>
            ))}
         </div>
      </div>
   );
}
