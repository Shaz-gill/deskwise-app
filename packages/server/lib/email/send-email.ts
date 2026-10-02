import sgMail from '@sendgrid/mail';

// Direct SDK use, not LangChain — SendGrid is a transactional email
// provider, not an AI/LLM provider, so the project's LangChain-only rule
// for AI features doesn't apply. Mirrors lib/knowledge-base/pinecone.ts's
// style: a module-level client configured from env vars, no abstraction
// beyond what's needed. Reads SENDGRID_API_KEY from the environment.
sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL as string;
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Customer Support';

// Shared by jobs/send-reply-email-job.ts. Called from inside a pg-boss
// worker only — never on the request path — so a slow or failing SendGrid
// call never blocks an agent's reply submission or the auto-resolve job.
export async function sendEmail(params: {
   to: string;
   toName: string;
   subject: string;
   text: string;
   html?: string | null;
}): Promise<void> {
   await sgMail.send({
      to: { email: params.to, name: params.toName },
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: params.subject,
      text: params.text,
      html: params.html ?? undefined,
   });
}
