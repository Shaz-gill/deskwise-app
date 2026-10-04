import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';

// Direct SDK use, not LangChain — SES is a transactional email provider,
// not an AI/LLM provider, so the project's LangChain-only rule for AI
// features doesn't apply. Mirrors lib/knowledge-base/pinecone.ts's style:
// a module-level client configured from env vars, no abstraction beyond
// what's needed. Credentials come from the SDK's default provider chain
// (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY locally, an EC2 instance role
// in production) — never set explicitly here.
const AWS_REGION = process.env.AWS_REGION;
const FROM_EMAIL = process.env.SES_FROM_EMAIL;
const FROM_NAME = process.env.SES_FROM_NAME || 'Customer Support';

// Mirrors lib/sentry.ts's "silently no-op when unconfigured" shape — local
// dev and CI don't need real AWS credentials to run the app; sendEmail
// just skips the send until SES is actually configured, rather than
// throwing and getting retried forever by pg-boss.
const sesClient =
   AWS_REGION && FROM_EMAIL ? new SESv2Client({ region: AWS_REGION }) : null;

// Shared by jobs/send-reply-email-job.ts. Called from inside a pg-boss
// worker only — never on the request path — so a slow or failing SES call
// never blocks an agent's reply submission or the auto-resolve job.
export async function sendEmail(params: {
   to: string;
   toName: string;
   subject: string;
   text: string;
   html?: string | null;
}): Promise<void> {
   if (!sesClient) {
      console.log(
         `SES not configured (AWS_REGION/SES_FROM_EMAIL unset) — skipping email to ${params.to}`
      );
      return;
   }

   await sesClient.send(
      new SendEmailCommand({
         FromEmailAddress: `${FROM_NAME} <${FROM_EMAIL}>`,
         Destination: { ToAddresses: [`${params.toName} <${params.to}>`] },
         Content: {
            Simple: {
               Subject: { Data: params.subject, Charset: 'UTF-8' },
               Body: {
                  Text: { Data: params.text, Charset: 'UTF-8' },
                  ...(params.html && {
                     Html: { Data: params.html, Charset: 'UTF-8' },
                  }),
               },
            },
         },
      })
   );
}
