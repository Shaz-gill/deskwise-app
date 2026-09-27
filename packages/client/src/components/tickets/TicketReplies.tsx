import { cn } from '@/lib/utils';
import { TicketReplySenderType } from 'core';
import moment from 'moment';
import { getReplySenderInfo } from '../../lib/ticket-format';
import type { ApiTicketReply } from '../../pages/TicketDetailPage';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { TicketReplyForm } from './TicketReplyForm';

export function TicketReplies({
   ticketId,
   replies,
}: {
   ticketId: string;
   replies: ApiTicketReply[];
}) {
   return (
      <div className="flex flex-col gap-4">
         <h2 className="text-sm font-medium text-foreground">Replies</h2>

         {replies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No replies yet.</p>
         ) : (
            <ul className="flex flex-col gap-3">
               {replies.map((reply) => {
                  const sender = getReplySenderInfo(
                     reply.senderType,
                     reply.author.role
                  );
                  const isStaff =
                     reply.senderType !== TicketReplySenderType.customer;
                  return (
                     <li
                        key={reply.id}
                        className={cn(
                           'flex flex-col gap-2 rounded-lg border p-3',
                           isStaff
                              ? 'border-l-4 border-primary/40 bg-primary/5'
                              : 'border-border'
                        )}
                     >
                        <div className="flex items-center justify-between gap-2">
                           <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                 {reply.author.name}
                              </span>
                              <Badge variant={sender.badgeVariant}>
                                 <sender.icon />
                                 {sender.label}
                              </Badge>
                           </div>
                           <span className="text-xs text-muted-foreground">
                              {moment(reply.createdAt).format('lll')}
                           </span>
                        </div>
                        <Separator />
                        {reply.bodyHtml ? (
                           <div
                              // Reuses quill.snow.css's `.ql-editor` typography/list
                              // rules (already loaded via RichTextEditor on this
                              // page) for rendering, but that stylesheet sets
                              // zero margin on p/ol/ul at the same specificity as
                              // plain Tailwind spacing utilities (`space-y-2` loses
                              // that fight) — `!` forces the breathing room back
                              // between blocks, and fixes Quill's hardcoded link
                              // color (#06c) to match the app's teal primary.
                              className="ql-editor !p-0 text-sm text-foreground [&>*+*]:!mt-2 [&_a]:!text-primary [&_a]:underline"
                              dangerouslySetInnerHTML={{
                                 __html: reply.bodyHtml,
                              }}
                           />
                        ) : (
                           <p className="whitespace-pre-wrap text-sm text-foreground">
                              {reply.body}
                           </p>
                        )}
                     </li>
                  );
               })}
            </ul>
         )}

         <TicketReplyForm ticketId={ticketId} />
      </div>
   );
}
