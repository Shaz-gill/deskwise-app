import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { CalendarPlus, RefreshCw } from 'lucide-react';
import moment from 'moment';
import type { TicketCategory, TicketStatus } from 'core';
import type { ApiTicketDetail } from '../../pages/TicketDetailPage';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { TicketDetailsPanel } from './TicketDetailsPanel';
import { TicketReplies } from './TicketReplies';

export type TicketUpdatePayload = {
   assignedToId?: string | null;
   status?: TicketStatus;
   category?: TicketCategory | null;
};

async function updateTicket(
   ticketId: string,
   payload: TicketUpdatePayload
): Promise<ApiTicketDetail> {
   const { data } = await axios.patch<{ ticket: ApiTicketDetail }>(
      `/api/tickets/${ticketId}`,
      payload,
      { withCredentials: true }
   );

   return data.ticket;
}

export function TicketDetail({ ticket }: { ticket: ApiTicketDetail }) {
   const queryClient = useQueryClient();
   const ticketId = String(ticket.id);

   const updateMutation = useMutation({
      mutationFn: (payload: TicketUpdatePayload) =>
         updateTicket(ticketId, payload),
      onSuccess: async (updatedTicket) => {
         queryClient.setQueryData<{ ticket: ApiTicketDetail } | undefined>(
            ['ticket', ticketId],
            (old) => old && { ticket: { ...old.ticket, ...updatedTicket } }
         );
         await queryClient.invalidateQueries({ queryKey: ['tickets'] });
      },
   });

   return (
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_280px]">
         <Card>
            <CardHeader>
               <CardTitle className="text-xl">{ticket.subject}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
               <div className="flex items-start justify-between gap-4 text-sm">
                  <div className="flex flex-col">
                     <span className="text-foreground">
                        {ticket.senderName}
                     </span>
                     <span className="text-xs text-muted-foreground">
                        {ticket.senderEmail}
                     </span>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                     <span
                        className="flex items-center gap-1.5"
                        title="Created"
                     >
                        <CalendarPlus className="size-3.5" />
                        {moment(ticket.createdAt).format('lll')}
                     </span>
                     <span
                        className="flex items-center gap-1.5"
                        title="Last updated"
                     >
                        <RefreshCw className="size-3.5" />
                        {moment(ticket.updatedAt).format('lll')}
                     </span>
                  </div>
               </div>

               <Separator />

               <p className="whitespace-pre-wrap text-sm text-foreground">
                  {ticket.body}
               </p>

               <Separator />

               <TicketReplies ticketId={ticketId} replies={ticket.replies} />
            </CardContent>
         </Card>

         <TicketDetailsPanel ticket={ticket} updateMutation={updateMutation} />
      </div>
   );
}
