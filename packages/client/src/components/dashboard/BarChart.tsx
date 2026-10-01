export type BarChartDatum = { key: string; label: string; value: number };

// Rounds the chart's scale up to a clean step (nearest 2, or nearest 5 once
// values get into double digits) so axis ticks read as round numbers
// instead of whatever the tallest bar happens to be.
function niceMax(rawMax: number): number {
   const step = rawMax <= 10 ? 2 : 5;
   return Math.max(step, Math.ceil(rawMax / step) * step);
}

// Shared bar-chart primitive behind both DailyTicketsChart (30 bars, labels
// thinned to every 5th) and CategoryBreakdown (a handful of bars, every
// label shown) — same y-axis/gridline/tooltip treatment either way so the
// two read as one visual system rather than two different charts.
export function BarChart({
   data,
   showAllLabels = false,
}: {
   data: BarChartDatum[];
   showAllLabels?: boolean;
}) {
   const rawMax = Math.max(1, ...data.map((d) => d.value));
   const scaleMax = niceMax(rawMax);
   const ticks = [scaleMax, Math.round(scaleMax / 2), 0];
   const labelInterval = showAllLabels ? 1 : 5;

   return (
      <div className="flex flex-col gap-2">
         <div className="flex h-80 gap-2">
            <div className="flex w-6 shrink-0 flex-col justify-between text-right text-xs text-muted-foreground [font-variant-numeric:tabular-nums]">
               {ticks.map((tick) => (
                  <span key={tick}>{tick}</span>
               ))}
            </div>
            <div className="relative flex flex-1 items-end gap-1 border-b border-border">
               {ticks
                  .filter((tick) => tick > 0)
                  .map((tick) => (
                     <div
                        key={tick}
                        className="pointer-events-none absolute inset-x-0 border-t border-border/60"
                        style={{ bottom: `${(tick / scaleMax) * 100}%` }}
                     />
                  ))}
               {data.map((d) => {
                  const heightPct = (d.value / scaleMax) * 100;
                  return (
                     <div
                        key={d.key}
                        tabIndex={0}
                        role="img"
                        aria-label={`${d.label}: ${d.value} ticket${d.value === 1 ? '' : 's'}`}
                        className="group relative flex h-full flex-1 flex-col justify-end outline-none"
                     >
                        <div
                           className="mx-auto w-full max-w-6 rounded-t-[4px] bg-chart-1 transition-opacity duration-100 group-hover:opacity-80 group-focus-visible:opacity-80"
                           style={{ height: `${heightPct}%` }}
                        />
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background shadow-md group-hover:block group-focus-visible:block">
                           <span className="font-medium">{d.value}</span>{' '}
                           <span className="text-background/70">{d.label}</span>
                        </div>
                     </div>
                  );
               })}
            </div>
         </div>
         <div className="flex gap-1 pl-8 text-xs text-muted-foreground">
            {data.map((d, i) => (
               <div
                  key={d.key}
                  className={
                     showAllLabels
                        ? 'flex-1 text-center'
                        : 'flex-1 text-center whitespace-nowrap'
                  }
               >
                  {(data.length - 1 - i) % labelInterval === 0 ? d.label : ''}
               </div>
            ))}
         </div>
      </div>
   );
}
