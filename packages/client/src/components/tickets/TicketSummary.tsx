import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { RefreshCwIcon, SparklesIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';

async function summarizeTicket(ticketId: string): Promise<string> {
   const { data } = await axios.post<{ summary: string }>(
      `/api/tickets/${ticketId}/summarize`,
      {},
      { withCredentials: true }
   );

   return data.summary;
}

export function TicketSummary({ ticketId }: { ticketId: string }) {
   const summarizeMutation = useMutation({
      mutationFn: () => summarizeTicket(ticketId),
   });

   if (!summarizeMutation.data) {
      return (
         <div className="flex flex-col gap-2">
            <Button
               variant="outline"
               size="sm"
               className="self-start"
               disabled={summarizeMutation.isPending}
               onClick={() => summarizeMutation.mutate()}
            >
               <SparklesIcon />
               {summarizeMutation.isPending ? 'Summarizing…' : 'Summarize'}
            </Button>

            {summarizeMutation.isError && (
               <Alert variant="destructive">
                  <AlertDescription>
                     Failed to summarize ticket. Please try again.
                  </AlertDescription>
               </Alert>
            )}
         </div>
      );
   }

   return (
      <div className="flex flex-col gap-2 rounded-lg border border-l-4 border-primary/40 bg-primary/5 p-3">
         <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
               <SparklesIcon className="size-3.5" />
               AI summary
            </span>
            <Button
               variant="ghost"
               size="icon-sm"
               aria-label="Regenerate summary"
               disabled={summarizeMutation.isPending}
               onClick={() => summarizeMutation.mutate()}
            >
               <RefreshCwIcon
                  className={cn(summarizeMutation.isPending && 'animate-spin')}
               />
            </Button>
         </div>

         <p className="text-sm whitespace-pre-wrap text-foreground">
            {summarizeMutation.data}
         </p>

         {summarizeMutation.isError && (
            <Alert variant="destructive">
               <AlertDescription>
                  Failed to regenerate summary. Please try again.
               </AlertDescription>
            </Alert>
         )}
      </div>
   );
}
