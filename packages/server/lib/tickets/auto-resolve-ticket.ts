import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { openAiModel } from './openai-model';

const AUTO_RESOLVE_SCHEMA = z.object({
   canResolve: z.boolean(),
   // OpenAI's structured-output mode requires every property to be
   // present (in `required`) — nullable, not optional — so "no reply"
   // is represented as null rather than an omitted field.
   reply: z
      .string()
      .nullable()
      .describe(
         'The full customer-facing reply to send when canResolve is ' +
            'true; null when canResolve is false.'
      ),
});

const structuredModel = openAiModel.withStructuredOutput(AUTO_RESOLVE_SCHEMA);

const SYSTEM_PROMPT =
   'You are deciding whether an incoming customer support ticket can be ' +
   'fully and confidently resolved right now, using ONLY the knowledge ' +
   'base excerpts provided below — no outside knowledge, and no ' +
   'guessing. Set canResolve to true only if the excerpts directly and ' +
   "completely answer the customer's question or request. If the " +
   'excerpts are irrelevant, incomplete, or the request needs a human ' +
   '(e.g. an account-specific action, a refund decision, or anything ' +
   'not covered verbatim by the excerpts), set canResolve to false and ' +
   'omit the reply. When canResolve is true, write the reply as a ' +
   'complete, ready-to-send email: a brief greeting addressed to the ' +
   "customer by their first name, the answer to the customer's question " +
   'grounded strictly in the excerpts, and a closing sign-off. The ' +
   'email must always be signed off from "Customer Support" (never the ' +
   "AI, a person's name, or any other signature) — end with something " +
   'like:\nBest regards,\nCustomer Support';

export async function autoResolveTicket({
   subject,
   body,
   senderName,
   context,
}: {
   subject: string;
   body: string;
   senderName: string;
   context: string[];
}): Promise<{ canResolve: boolean; reply: string | null }> {
   const contextBlock = context
      .map((chunk, i) => `[Excerpt ${i + 1}]\n${chunk}`)
      .join('\n\n');

   return structuredModel.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(
         `Customer name: ${senderName}\nSubject: ${subject}\n\n` +
            `Message:\n${body}\n\nKnowledge base excerpts:\n${contextBlock}`
      ),
   ]);
}
