import {
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
//
// Centering uses a plain table with an explicit `<td align="center">`
// around Container, rather than react-email's <Body> (which wraps
// children in a <td> with no align of its own) or Container's own
// margin:auto alone — Gmail's web client doesn't reliably honor
// margin:auto centering on a nested table, but a parent `align="center"`
// cell is the standard bulletproof fix every ESP template uses.
export function ReplyEmail({
   subject,
   bodyHtml,
}: {
   subject: string;
   bodyHtml: string;
}) {
   return (
      <Html>
         <Head>
            {/* bodyHtml for a human agent reply is raw Quill output
               (plain <p>/<ul>/<ol>, no inline styles) — without this
               reset, Gmail/browser default UA margins on those tags
               (~1em) make paragraphs look far more spaced out than the
               AI-reply path, whose react-email Text components already
               carry their own tight inline margins. */}
            <style>{`
               .reply-content p { margin: 0 0 12px; }
               .reply-content ul, .reply-content ol { margin: 0 0 12px; padding-left: 20px; }
               .reply-content li { margin: 0 0 4px; }
               .reply-content :last-child { margin-bottom: 0; }
            `}</style>
         </Head>
         <Preview>{subject}</Preview>
         <body style={main}>
            <table
               role="presentation"
               width="100%"
               cellPadding="0"
               cellSpacing="0"
               style={outerTable}
            >
               <tbody>
                  <tr>
                     <td align="center" style={outerCell}>
                        <Container style={container}>
                           <Text style={brand}>Deskwise</Text>
                           <Hr style={hr} />
                           <div
                              className="reply-content"
                              style={content}
                              dangerouslySetInnerHTML={{ __html: bodyHtml }}
                           />
                        </Container>
                     </td>
                  </tr>
               </tbody>
            </table>
         </body>
      </Html>
   );
}

const main = {
   backgroundColor: '#f4f4f5',
   fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
};

const outerTable = {
   backgroundColor: '#f4f4f5',
};

const outerCell = {
   padding: '32px 16px',
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
