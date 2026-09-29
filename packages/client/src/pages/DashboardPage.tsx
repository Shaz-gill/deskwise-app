import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { CheckCircle2, Sparkles, Ticket, TicketX } from 'lucide-react';
import { DailyTicketsChart } from '../components/dashboard/DailyTicketsChart';
import { StatCard } from '../components/dashboard/StatCard';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
} from '../components/ui/card';
import {
   DailyTicketsChartSkeleton,
   DashboardStatsSkeleton,
} from '../components/ui/skeletons';

type TicketStatsResponse = {
   totalTickets: number;
   openTickets: number;
   dailyTicketCounts: { date: string; count: number }[];
   aiResolvedCount: number;
   aiResolvedPercentage: number;
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
               <DailyTicketsChartSkeleton />
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <Card>
               <CardHeader>
                  <CardTitle>Tickets per day</CardTitle>
               </CardHeader>
               <CardContent>
                  <DailyTicketsChart data={data.dailyTicketCounts} />
               </CardContent>
            </Card>
         )}
      </div>
   );
}
