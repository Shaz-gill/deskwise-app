import {
   Body,
   Container,
   Head,
   Hr,
   Html,
   Preview,
   Text,
} from '@react-email/components';

// Branded shell around an already-sanitized reply body (sanitize-html.ts
// has already run on it before it was stored) — safe to inject as raw
// HTML here. This wraps the content only; it never adds its own signoff,
// since that's hardcoded per-feature in polish-reply.ts/auto-resolve-ticket.ts.
export function ReplyEmail({
   subject,
   bodyHtml,
}: {
   subject: string;
   bodyHtml: string;
}) {
   return (
      <Html>
         <Head />
         <Preview>{subject}</Preview>
         <Body style={main}>
            <Container style={container}>
               <Text style={brand}>Deskwise</Text>
               <Hr style={hr} />
               <div
                  style={content}
                  dangerouslySetInnerHTML={{ __html: bodyHtml }}
               />
            </Container>
         </Body>
      </Html>
   );
}

const main = {
   backgroundColor: '#f4f4f5',
   fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
};

const container = {
   backgroundColor: '#ffffff',
   margin: '0 auto',
   padding: '32px',
   maxWidth: '560px',
   borderRadius: '8px',
};

const brand = {
   color: '#4f46e5',
   fontSize: '18px',
   fontWeight: 600,
   margin: '0',
};

const hr = {
   borderColor: '#e4e4e7',
   margin: '16px 0 24px',
};

const content = {
   color: '#27272a',
   fontSize: '14px',
   lineHeight: '1.6',
};
