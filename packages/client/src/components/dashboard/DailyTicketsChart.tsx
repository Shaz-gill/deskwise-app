type DailyCount = { date: string; count: number };

function formatDayLabel(date: string) {
   return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
   });
}

export function DailyTicketsChart({ data }: { data: DailyCount[] }) {
   const max = Math.max(1, ...data.map((d) => d.count));

   return (
      <div className="flex flex-col gap-2">
         <div className="flex h-80 items-end gap-1 border-b border-border">
            {data.map((d) => {
               const heightPct = (d.count / max) * 100;
               const label = formatDayLabel(d.date);
               return (
                  <div
                     key={d.date}
                     tabIndex={0}
                     role="img"
                     aria-label={`${label}: ${d.count} ticket${d.count === 1 ? '' : 's'}`}
                     className="group relative flex h-full flex-1 flex-col justify-end outline-none"
                  >
                     <div
                        className="w-full rounded-t-[4px] bg-chart-1 transition-opacity duration-100 group-hover:opacity-80 group-focus-visible:opacity-80"
                        style={{ height: `${heightPct}%` }}
                     />
                     <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background shadow-md group-hover:block group-focus-visible:block">
                        <span className="font-medium">{d.count}</span>{' '}
                        <span className="text-background/70">{label}</span>
                     </div>
                  </div>
               );
            })}
         </div>
         <div className="flex gap-1 text-xs text-muted-foreground">
            {data.map((d, i) => (
               <div key={d.date} className="flex-1 text-center">
                  {(data.length - 1 - i) % 5 === 0
                     ? formatDayLabel(d.date)
                     : ''}
               </div>
            ))}
         </div>
      </div>
   );
}
