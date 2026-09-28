import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { TicketCategory } from '../generated/prisma/enums';

const model = new ChatOpenAI({ model: 'gpt-5-nano' });

const CLASSIFICATION_SCHEMA = z.object({
   category: z.enum(Object.values(TicketCategory)),
});

const structuredModel = model.withStructuredOutput(CLASSIFICATION_SCHEMA);

const SYSTEM_PROMPT =
   'You are classifying an incoming customer support ticket into ' +
   'exactly one category: "general_question" (a general, non-technical ' +
   'question), "technical_question" (a question about how something ' +
   'works, an error, or a technical issue), or "refund_request" (the ' +
   'customer is asking for a refund or to cancel a paid purchase). Pick ' +
   "the single category that best matches the ticket's subject and " +
   'message.';

export async function classifyTicket({
   subject,
   body,
}: {
   subject: string;
   body: string;
}): Promise<TicketCategory> {
   const result = await structuredModel.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(`Subject: ${subject}\n\nMessage:\n${body}`),
   ]);

   return result.category;
}
