import { Fragment } from 'react';
import { Text } from '@react-email/components';

// Renders autoResolveTicket()'s plain text (blank-line-separated
// paragraphs) as react-email Text components rather than hand-built
// HTML strings — JSX escapes the text content for us, so no manual
// entity-escaping is needed. render()'d once at reply-creation time to
// produce the bodyHtml stored on the TicketReply (see
// jobs/auto-resolve-ticket-job.tsx), the same field the rich-text
// editor populates for human agent replies.
export function AiReplyContent({ text }: { text: string }) {
   return (
      <>
         {text.split(/\n{2,}/).map((paragraph, i) => (
            <Text key={i} style={paragraphStyle}>
               {paragraph.split('\n').map((line, j, lines) => (
                  <Fragment key={j}>
                     {line}
                     {j < lines.length - 1 && <br />}
                  </Fragment>
               ))}
            </Text>
         ))}
      </>
   );
}

const paragraphStyle = {
   margin: '0 0 16px',
};
