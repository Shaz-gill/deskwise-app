type UserWorkloadEntry = {
   userId: string;
   userName: string;
   openCount: number;
};

export function UserWorkload({ data }: { data: UserWorkloadEntry[] }) {
   if (data.length === 0) {
      return (
         <p className="text-sm text-muted-foreground">
            No open tickets are currently assigned to a user.
         </p>
      );
   }

   const max = Math.max(1, ...data.map((d) => d.openCount));

   return (
      <div className="flex flex-col gap-3">
         {data.map((d) => (
            <div key={d.userId} className="flex flex-col gap-1">
               <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{d.userName}</span>
                  <span className="text-muted-foreground [font-variant-numeric:tabular-nums]">
                     {d.openCount} open
                  </span>
               </div>
               <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                     className="h-full rounded-full bg-warning"
                     style={{ width: `${(d.openCount / max) * 100}%` }}
                  />
               </div>
            </div>
         ))}
      </div>
   );
}
