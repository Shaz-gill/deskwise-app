import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { Role, TicketReplySenderType } from 'core';
import { Alert, AlertDescription } from '../components/ui/alert';
import { buttonVariants } from '../components/ui/button';
import { TicketDetailSkeleton } from '../components/ui/skeletons';
import { TicketDetail } from '../components/tickets/TicketDetail';
import { cn } from '../lib/utils';
import type { ApiTicket } from './TicketsPage';

export type ApiTicketReply = {
   id: number;
   body: string;
   bodyHtml: string | null;
   senderType: TicketReplySenderType;
   createdAt: string;
   author: { id: string; name: string; email: string; role: Role };
};

export type ApiTicketDetail = ApiTicket & { replies: ApiTicketReply[] };

async function fetchTicket(id: string): Promise<{ ticket: ApiTicketDetail }> {
   const { data } = await axios.get<{ ticket: ApiTicketDetail }>(
      `/api/tickets/${id}`,
      { withCredentials: true }
   );

   return data;
}

export function TicketDetailPage() {
   const { id } = useParams<{ id: string }>();

   const { data, isPending, isError } = useQuery({
      queryKey: ['ticket', id],
      queryFn: () => fetchTicket(id!),
   });
   const ticket = data?.ticket;

   return (
      <div className="flex flex-col gap-4">
         <Link
            to="/tickets"
            className={cn(
               buttonVariants({ variant: 'ghost', size: 'sm' }),
               'self-start -ml-2.5'
            )}
         >
            <ArrowLeft />
            Back to tickets
         </Link>

         {isPending && <TicketDetailSkeleton />}

         {isError && (
            <Alert variant="destructive">
               <AlertDescription>
                  Failed to load ticket. Please try again later.
               </AlertDescription>
            </Alert>
         )}

         {ticket && <TicketDetail ticket={ticket} />}
      </div>
   );
}
