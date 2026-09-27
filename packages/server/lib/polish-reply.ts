import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const model = new ChatOpenAI({ model: 'gpt-5-nano' });

const SYSTEM_PROMPT =
   'You are helping a customer support agent polish a draft reply before ' +
   "they send it. Improve the draft's grammar, clarity, professionalism, " +
   "and tone, while preserving the agent's meaning and intent, and format " +
   'the result as a proper support email: open with a greeting addressed ' +
   'to the customer by name, organize the body into clear paragraphs, and ' +
   'close with a professional sign-off (e.g. "Best regards,") followed by ' +
   'the agent\'s own name — never a generic name like "Support Team". ' +
   "Use the ticket's subject and the customer's original message only as " +
   'context for what the reply is responding to — do not answer the ' +
   "customer's question yourself or invent new information the draft did " +
   'not already contain. Reply with only the polished email text, no ' +
   'preamble, no quotation marks, no markdown formatting, no subject line.';

export async function polishReply({
   draft,
   ticketSubject,
   ticketBody,
   customerName,
   agentName,
}: {
   draft: string;
   ticketSubject: string;
   ticketBody: string;
   customerName: string;
   agentName: string;
}): Promise<string> {
   const response = await model.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(
         `Ticket subject: ${ticketSubject}\n\n` +
            `Customer's name: ${customerName}\n\n` +
            `Customer's original message:\n${ticketBody}\n\n` +
            `Agent's name (use this in the sign-off): ${agentName}\n\n` +
            `Agent's draft reply to polish:\n${draft}`
      ),
   ]);

   return typeof response.content === 'string'
      ? response.content
      : response.text;
}
