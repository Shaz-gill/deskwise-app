import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import moment from 'moment';
import { Link } from 'react-router-dom';
import type { ApiTicket } from '../../pages/TicketsPage';
import { STATUS_BADGE_VARIANT } from '../../lib/ticket-format';
import { Badge } from '../ui/badge';

const RECENT_TICKETS_COUNT = 5;

async function fetchRecentTickets(): Promise<ApiTicket[]> {
   const { data } = await axios.get<{ tickets: ApiTicket[] }>('/api/tickets', {
      withCredentials: true,
      params: {
         sortBy: 'createdAt',
         sortOrder: 'desc',
         page: 1,
         pageSize: RECENT_TICKETS_COUNT,
      },
   });

   return data.tickets;
}

export function RecentTickets() {
   const { data, isPending, isError } = useQuery({
      queryKey: ['tickets', 'recent'],
      queryFn: fetchRecentTickets,
   });

   if (isPending) {
      return (
         <div className="flex flex-col gap-3">
            {Array.from({ length: RECENT_TICKETS_COUNT }).map((_, i) => (
               <div
                  key={i}
                  className="h-5 w-full animate-pulse rounded bg-muted"
               />
            ))}
         </div>
      );
   }

   if (isError) {
      return (
         <p className="text-sm text-muted-foreground">
            Failed to load recent tickets.
         </p>
      );
   }

   if (data.length === 0) {
      return <p className="text-sm text-muted-foreground">No tickets yet.</p>;
   }

   return (
      <div className="flex flex-col divide-y divide-border">
         {data.map((ticket) => (
            <Link
               key={ticket.id}
               to={`/tickets/${ticket.id}`}
               className="group flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
            >
               <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                     {ticket.subject}
                  </span>
                  <span className="text-xs text-muted-foreground">
                     {ticket.senderName} · {moment(ticket.createdAt).fromNow()}
                  </span>
               </div>
               <Badge
                  variant={STATUS_BADGE_VARIANT[ticket.status]}
                  className="shrink-0 capitalize"
               >
                  {ticket.status}
               </Badge>
            </Link>
         ))}
      </div>
   );
}
