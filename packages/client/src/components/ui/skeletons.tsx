import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader } from './card';
import { Separator } from './separator';
import { Skeleton } from './skeleton';
import { Table, TableBody, TableCell, TableRow } from './table';

// Loading placeholders for the app's two recurring page shapes: a table
// (UsersPage, TicketsPage) and the ticket-detail two-card layout. Kept
// together here since both are pure loading-state presentation with no
// page-specific logic — pages configure them instead of hand-rolling their
// own skeleton rows.

export function TableSkeleton({
   header,
   columns,
   rowCount = 5,
}: {
   header: ReactNode;
   columns: { width: string; height?: string }[];
   rowCount?: number;
}) {
   return (
      <Table>
         {header}
         <TableBody>
            {Array.from({ length: rowCount }).map((_, i) => (
               <TableRow key={i}>
                  {columns.map((column, j) => (
                     <TableCell key={j}>
                        <Skeleton
                           className={`${column.height ?? 'h-4'} ${column.width} bg-muted-foreground/20`}
                        />
                     </TableCell>
                  ))}
               </TableRow>
            ))}
         </TableBody>
      </Table>
   );
}

export function TicketDetailSkeleton() {
   return (
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_280px]">
         <Card>
            <CardHeader>
               <Skeleton className="h-5 w-64 bg-muted-foreground/20" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
               <div className="flex flex-col gap-1">
                  <Skeleton className="h-4 w-48 bg-muted-foreground/20" />
                  <Skeleton className="h-3 w-40 bg-muted-foreground/20" />
                  <Skeleton className="h-3 w-40 bg-muted-foreground/20" />
               </div>
               <Separator />
               <Skeleton className="h-4 w-full bg-muted-foreground/20" />
               <Skeleton className="h-4 w-full bg-muted-foreground/20" />
               <Skeleton className="h-4 w-3/4 bg-muted-foreground/20" />
            </CardContent>
         </Card>
         <Card>
            <CardHeader>
               <Skeleton className="h-4 w-16 bg-muted-foreground/20" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
               <Skeleton className="h-8 w-full bg-muted-foreground/20" />
               <Skeleton className="h-8 w-full bg-muted-foreground/20" />
               <Skeleton className="h-8 w-full bg-muted-foreground/20" />
            </CardContent>
         </Card>
      </div>
   );
}
