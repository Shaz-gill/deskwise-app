import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type { TicketCategory } from 'core';
import { CheckCircle2, Sparkles, Ticket, TicketX } from 'lucide-react';
import { CategoryBreakdown } from '../components/dashboard/CategoryBreakdown';
import { DailyTicketsChart } from '../components/dashboard/DailyTicketsChart';
import { RecentTickets } from '../components/dashboard/RecentTickets';
import { StatCard } from '../components/dashboard/StatCard';
import { UserWorkload } from '../components/dashboard/UserWorkload';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from '../components/ui/card';
import {
   DailyTicketsChartSkeleton,
   DashboardBarListSkeleton,
   DashboardStatsSkeleton,
} from '../components/ui/skeletons';

type TicketStatsResponse = {
   totalTickets: number;
   openTickets: number;
   dailyTicketCounts: { date: string; count: number }[];
   aiResolvedCount: number;
   aiResolvedPercentage: number;
   categoryBreakdown: { category: TicketCategory | null; count: number }[];
   userWorkload: { userId: string; userName: string; openCount: number }[];
};

async function fetchTicketStats(): Promise<TicketStatsResponse> {
   const { data } = await axios.get<TicketStatsResponse>('/api/tickets/stats', {
      withCredentials: true,
   });

   return data;
}

export function DashboardPage() {
   const { data, isPending, isError } = useQuery({
      queryKey: ['tickets', 'stats'],
      queryFn: fetchTicketStats,
   });

   return (
      <div className="flex flex-col gap-4">
         <h1 className="font-heading text-2xl font-semibold text-foreground">
            Dashboard
         </h1>

         {isPending && (
            <>
               <DashboardStatsSkeleton />
               <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <DailyTicketsChartSkeleton />
                  <DailyTicketsChartSkeleton />
               </div>
               <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Card>
                     <CardContent>
                        <DashboardBarListSkeleton />
                     </CardContent>
                  </Card>
                  <Card>
                     <CardContent>
                        <DashboardBarListSkeleton rowCount={5} />
                     </CardContent>
                  </Card>
               </div>
            </>
         )}

         {isError && (
            <Alert variant="destructive">
               <AlertDescription>
                  Failed to load dashboard stats. Please try again later.
               </AlertDescription>
            </Alert>
         )}

         {data && (
            <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 lg:grid-cols-4 lg:divide-y-0">
               <StatCard
                  label="Total tickets"
                  value={data.totalTickets.toLocaleString()}
                  icon={Ticket}
               />
               <StatCard
                  label="Open tickets"
                  value={data.openTickets.toLocaleString()}
                  icon={TicketX}
               />
               <StatCard
                  label="Resolved by AI"
                  value={data.aiResolvedCount.toLocaleString()}
                  icon={Sparkles}
               />
               <StatCard
                  label="% resolved by AI"
                  value={`${data.aiResolvedPercentage.toFixed(1)}%`}
                  icon={CheckCircle2}
               />
            </div>
         )}

         {data && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
               <Card>
                  <CardHeader>
                     <CardTitle>Tickets per day</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <DailyTicketsChart data={data.dailyTicketCounts} />
                  </CardContent>
               </Card>
               <Card>
                  <CardHeader>
                     <CardTitle>Tickets by category</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                     <CategoryBreakdown data={data.categoryBreakdown} />
                  </CardContent>
               </Card>
            </div>
         )}

         {data && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
               <Card>
                  <CardHeader>
                     <CardTitle>User workload</CardTitle>
                     <CardDescription>
                        Open tickets currently assigned per user
                     </CardDescription>
                  </CardHeader>
                  <CardContent>
                     <UserWorkload data={data.userWorkload} />
                  </CardContent>
               </Card>
               <Card>
                  <CardHeader>
                     <CardTitle>Recent tickets</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <RecentTickets />
                  </CardContent>
               </Card>
            </div>
         )}
      </div>
   );
}
