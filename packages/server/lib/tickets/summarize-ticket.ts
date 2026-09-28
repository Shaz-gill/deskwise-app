import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { openAiModel } from './openai-model';

const SYSTEM_PROMPT =
   'You are helping a customer support agent quickly understand a ' +
   "ticket without reading the entire thread. Summarize the customer's " +
   'core issue or request, the key points raised across the reply ' +
   'thread, and the current state of the conversation. Keep it to a ' +
   'few sentences — do not restate the whole thread verbatim, do not ' +
   'invent information that was not in the ticket or replies. Reply ' +
   'with only the summary text, no preamble, no quotation marks, no ' +
   'markdown formatting.';

type SummarizeTicketReply = {
   senderType: string;
   authorName: string;
   body: string;
   createdAt: Date;
};

export async function summarizeTicket({
   ticketSubject,
   ticketBody,
   replies,
}: {
   ticketSubject: string;
   ticketBody: string;
   replies: SummarizeTicketReply[];
}): Promise<string> {
   const threadText =
      replies.length === 0
         ? '(No replies yet.)'
         : replies
              .map(
                 (reply) =>
                    `[${reply.senderType}] ${reply.authorName} ` +
                    `(${reply.createdAt.toISOString()}):\n${reply.body}`
              )
              .join('\n\n');

   const response = await openAiModel.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(
         `Ticket subject: ${ticketSubject}\n\n` +
            `Customer's original message:\n${ticketBody}\n\n` +
            `Reply thread:\n${threadText}`
      ),
   ]);

   return typeof response.content === 'string'
      ? response.content
      : response.text;
}
