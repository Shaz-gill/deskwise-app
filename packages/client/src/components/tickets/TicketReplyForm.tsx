import { useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import {
   createTicketReplySchema,
   type CreateTicketReplyFormValues,
} from 'core';
import type {
   ApiTicketDetail,
   ApiTicketReply,
} from '../../pages/TicketDetailPage';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Field, FieldError } from '../ui/field';
import {
   RichTextEditor,
   type RichTextEditorHandle,
} from '../ui/rich-text-editor';

async function createTicketReply(
   ticketId: string,
   values: CreateTicketReplyFormValues
): Promise<ApiTicketReply> {
   const { data } = await axios.post<{ reply: ApiTicketReply }>(
      `/api/tickets/${ticketId}/replies`,
      values,
      { withCredentials: true }
   );

   return data.reply;
}

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
   const queryClient = useQueryClient();
   const editorRef = useRef<RichTextEditorHandle>(null);

   const {
      setValue,
      handleSubmit,
      reset,
      formState: { errors },
   } = useForm<CreateTicketReplyFormValues>({
      resolver: zodResolver(createTicketReplySchema),
      defaultValues: { body: '' },
   });

   const mutation = useMutation({
      mutationFn: (values: CreateTicketReplyFormValues) =>
         createTicketReply(ticketId, values),
      onSuccess: (reply) => {
         queryClient.setQueryData<{ ticket: ApiTicketDetail } | undefined>(
            ['ticket', ticketId],
            (old) =>
               old && {
                  ticket: {
                     ...old.ticket,
                     replies: [...old.ticket.replies, reply],
                  },
               }
         );
         reset();
         editorRef.current?.clear();
      },
   });

   function onSubmit(values: CreateTicketReplyFormValues) {
      mutation.mutate(values);
   }

   return (
      <form
         onSubmit={handleSubmit(onSubmit)}
         className="flex flex-col gap-2"
         noValidate
      >
         <Field data-invalid={!!errors.body}>
            <RichTextEditor
               ref={editorRef}
               id="reply-body"
               placeholder="Write a reply…"
               aria-invalid={!!errors.body}
               onChange={(html, text) => {
                  setValue('body', text, { shouldValidate: true });
                  setValue('bodyHtml', html);
               }}
            />
            <FieldError errors={[errors.body]} />
         </Field>

         {mutation.isError && (
            <Alert variant="destructive">
               <AlertDescription>
                  Failed to send reply. Please try again.
               </AlertDescription>
            </Alert>
         )}

         <Button
            type="submit"
            disabled={mutation.isPending}
            className="self-end"
         >
            {mutation.isPending ? 'Sending…' : 'Send reply'}
         </Button>
      </form>
   );
}
