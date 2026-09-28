import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
   TicketReplySenderType,
   type TicketCategory,
   type TicketStatus,
} from 'core';
import { CalendarPlus, MailIcon, RefreshCw, UserIcon } from 'lucide-react';
import moment from 'moment';
import type { ApiTicketDetail } from '../../pages/TicketDetailPage';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { TicketDetailsPanel } from './TicketDetailsPanel';
import { TicketReplies } from './TicketReplies';
import { TicketSummary } from './TicketSummary';

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
   const resolvedByAi = ticket.replies.some(
      (reply) => reply.senderType === TicketReplySenderType.ai
   );

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
               <CardTitle className="flex items-center gap-2 text-xl">
                  {ticket.subject}
                  {resolvedByAi && (
                     <Badge variant="secondary">Resolved by AI</Badge>
                  )}
               </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
               <div className="flex items-start justify-between gap-4 text-sm">
                  <div className="grid grid-cols-[auto_1fr] items-center gap-x-1.5 gap-y-1">
                     <UserIcon className="size-3.5 text-muted-foreground" />
                     <span className="text-foreground">
                        {ticket.senderName}
                     </span>
                     <MailIcon className="size-3.5 text-muted-foreground" />
                     <span className="text-xs text-muted-foreground">
                        {ticket.senderEmail}
                     </span>
                  </div>
                  <div className="grid grid-cols-[auto_1fr] items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                     <CalendarPlus className="size-3.5" />
                     <span title="Created">
                        {moment(ticket.createdAt).format('lll')}
                     </span>
                     <RefreshCw className="size-3.5" />
                     <span title="Last updated">
                        {moment(ticket.updatedAt).format('lll')}
                     </span>
                  </div>
               </div>

               <Separator />

               <p className="whitespace-pre-wrap text-sm text-foreground">
                  {ticket.body}
               </p>

               <TicketSummary ticketId={ticketId} />

               <Separator />

               <TicketReplies ticketId={ticketId} replies={ticket.replies} />
            </CardContent>
         </Card>

         <TicketDetailsPanel ticket={ticket} updateMutation={updateMutation} />
      </div>
   );
}
