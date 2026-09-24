import 'dotenv/config';
import { Prisma } from '../../generated/prisma/client';
import { TicketCategory, TicketStatus } from '../../generated/prisma/enums';
import prisma from '../../db';

// Dev-only bulk seed for local testing of the tickets table's sorting
// (GET /api/tickets's sortBy/sortOrder) and subject filtering
// (TicketsPage.tsx's DataTable filterColumn="subject"). Unlike seed.ts's
// admin-user seed (which must be idempotent — it's part of real bootstrap),
// this is a manual dev tool: every run inserts TICKET_COUNT more rows, on
// purpose, so re-running to pad out more data is fine.
const TICKET_COUNT = 100;

// [subject, body] pairs, grouped by the category a real classifier would
// assign — the UNCATEGORIZED pool mimics ambiguous subject lines a real
// inbox gets before triage, which is why those tickets get category: null
// below rather than a guessed value (matches routes/tickets.ts's own rule
// that category is never guessed outside Phase 5's AI classification).
const GENERAL_QUESTION: [string, string][] = [
   [
      'How do I reset my account password?',
      "I've tried the 'forgot password' link twice but never received the reset email. Can you help?",
   ],
   [
      "What's included in the Pro plan?",
      'Trying to decide between Starter and Pro — could you send over a feature comparison?',
   ],
   [
      'Can I change my billing cycle to annual?',
      "I'm currently on monthly billing and would like to switch to annual to save money.",
   ],
   [
      'How do I add a teammate to my workspace?',
      "I don't see an 'invite' option anywhere in the settings page.",
   ],
   [
      'Where can I download my invoice?',
      'Need last month’s invoice for our accounting team but can’t find it in the billing tab.',
   ],
   [
      'Is there a mobile app available?',
      'We mostly work from our phones during the day — is there an iOS or Android app?',
   ],
   [
      'How do I export my ticket data to CSV?',
      'Want to run some reporting outside the app. Is there a bulk export option?',
   ],
   [
      'What happens to my data if I cancel?',
      'Considering cancelling but want to know if our tickets get deleted immediately or archived.',
   ],
   [
      'Do you offer a student discount?',
      "I'm using this for a university project and was wondering if there's an education pricing tier.",
   ],
   [
      'How do I change my account email address?',
      'I switched jobs and need to update the email tied to my account.',
   ],
   [
      'Can I use the API on the free plan?',
      'Looking to build a small integration — is API access gated behind a paid plan?',
   ],
   [
      "What's your data retention policy?",
      'Our compliance team is asking how long resolved tickets are kept before deletion.',
   ],
   [
      'How do I set up two-factor authentication?',
      "I'd like to enable 2FA on my account but can't find the option under security settings.",
   ],
   [
      'Do you support single sign-on (SSO)?',
      'Our IT department requires SSO for any tool we adopt company-wide.',
   ],
   [
      'How do I transfer ownership of my workspace?',
      "I'm leaving the company and need to hand off admin access to my manager.",
   ],
];

const TECHNICAL_QUESTION: [string, string][] = [
   [
      'Getting a 500 error when uploading attachments',
      'Every time I try to attach a screenshot to a reply, the request fails with a server error.',
   ],
   [
      'App crashes immediately after opening on iOS',
      'Updated to the latest version last night and now the app closes within a second of opening.',
   ],
   [
      'Webhook events are not being delivered',
      'Configured an outbound webhook for new tickets but our endpoint hasn’t received anything in 3 days.',
   ],
   [
      'Login page stuck on infinite loading spinner',
      'The spinner just keeps spinning after I enter my credentials — tried three different browsers.',
   ],
   [
      'API returns 429 errors even under low traffic',
      "We're making maybe 10 requests a minute but keep hitting rate limits unexpectedly.",
   ],
   [
      'Search results are missing recent tickets',
      "Tickets created in the last 24 hours don't show up when I search by subject.",
   ],
   [
      'Dashboard charts not rendering in Safari',
      'Everything looks fine in Chrome, but the analytics charts are just blank in Safari on macOS.',
   ],
   [
      'Email notifications arriving several hours late',
      'By the time I get notified about a new reply, the customer has already followed up twice.',
   ],
   [
      'Cannot upload files larger than 5MB',
      'Trying to attach a short screen recording but it fails silently with no error message.',
   ],
   [
      'Slack integration disconnected after last update',
      'Our #support channel stopped getting ticket alerts right after the update rolled out.',
   ],
   [
      'CSV export is truncating long descriptions',
      'Any ticket body over ~200 characters gets cut off in the exported file.',
   ],
   [
      'Two-factor codes not being accepted',
      'My authenticator app codes are being rejected even though the time looks synced correctly.',
   ],
   [
      'Session keeps expiring after a few minutes',
      "I'm getting logged out every 5 minutes or so, even while actively using the app.",
   ],
   [
      'Dark mode toggle not saving my preference',
      'I switch to dark mode, refresh the page, and it resets back to light every time.',
   ],
   [
      'Bulk delete button does nothing when clicked',
      'Selected several old tickets and hit "Delete selected" but nothing happens.',
   ],
];

const REFUND_REQUEST: [string, string][] = [
   [
      'Requesting a refund for accidental duplicate charge',
      'I was charged twice for this month’s subscription — can you refund the duplicate?',
   ],
   [
      'Charged twice for the same subscription this month',
      'My card statement shows two identical charges from you on the same day.',
   ],
   [
      'Want a refund after cancelling within the trial period',
      'I cancelled two days into the trial but was still charged the full amount.',
   ],
   [
      'Billed for a plan I never upgraded to',
      'I’m on the Starter plan but was billed at the Pro rate this cycle.',
   ],
   [
      'Refund request — service was unusable for a week',
      'The outage last week meant we couldn’t use the product at all — requesting a partial refund.',
   ],
   [
      'Please refund my annual plan, switching providers',
      "We've decided to move to a different tool and would like a pro-rated refund on the annual plan.",
   ],
   [
      'Charged after I already cancelled my subscription',
      'I cancelled last month through the billing portal but was charged again yesterday.',
   ],
   [
      'Requesting partial refund for downtime last week',
      'Given the extended downtime, could we get a credit or partial refund for that period?',
   ],
   [
      'Refund needed — wrong card was charged',
      'An old, cancelled card on file was charged instead of my current one — please refund and update it.',
   ],
   [
      "Overcharged due to a coupon that didn't apply",
      'I applied a 20% discount code at checkout but was still charged the full price.',
   ],
   [
      'Refund request for unused seats on my plan',
      "We downsized our team but are still being billed for seats we're not using.",
   ],
   [
      'Accidentally purchased the wrong plan tier',
      'Meant to buy Starter but clicked Enterprise by mistake — can this be refunded and corrected?',
   ],
   [
      "Requesting refund — product didn't meet expectations",
      "This isn't quite what we needed for our team — is a refund possible within 14 days of purchase?",
   ],
   [
      'Double billed after updating my payment method',
      'Updated my card last week and got charged on both the old and new card.',
   ],
   [
      'Refund request for a renewal I forgot to cancel',
      'I meant to cancel before the renewal date but missed it by a day — any chance of a refund?',
   ],
];

const UNCATEGORIZED: [string, string][] = [
   [
      'Question about my account',
      'Hi, I had a question about my account, can someone get back to me?',
   ],
   ['Need help ASAP', 'This is urgent, please respond as soon as you can.'],
   [
      'Following up on my previous email',
      "Just following up since I haven't heard back yet — any update?",
   ],
   ['Quick question', 'Hey, quick question when you get a chance.'],
   [
      'Issue with my account',
      "Something's wrong with my account, not sure what exactly.",
   ],
   ['Help needed', 'Could really use some help with something on my end.'],
   ['Re: your email', 'Replying to your last message — see below for context.'],
   [
      'Urgent - please respond',
      'Marking this urgent, please get back to me soon.',
   ],
   ['Problem', "I'm having a problem and I'm not sure who else to contact."],
   [
      'Can someone assist me?',
      'Not sure if this is the right place, but could someone assist me?',
   ],
];

// Realistic-looking sender pool, reused across tickets (mirrors real
// support inboxes where the same customer files more than one ticket).
const SENDERS: [string, string][] = [
   ['Emily Chen', 'emily.chen@northwind.io'],
   ['Marcus Webb', 'marcus.webb@brightpath.co'],
   ['Priya Nair', 'priya.nair@outlook.com'],
   ['Diego Alvarez', 'diego.alvarez@gmail.com'],
   ['Sofia Rossi', 'sofia.rossi@vertexlabs.com'],
   ['Tom Baker', 'tom.baker@yahoo.com'],
   ['Aisha Khan', 'aisha.khan@cloudnine.dev'],
   ["Liam O'Connor", 'liam.oconnor@gmail.com'],
   ['Hana Suzuki', 'hana.suzuki@meridian.jp'],
   ['Carlos Mendes', 'carlos.mendes@outlook.com'],
   ['Grace Kim', 'grace.kim@stellarworks.com'],
   ['Noah Fischer', 'noah.fischer@gmail.com'],
   ['Fatima Al-Sayed', 'fatima.alsayed@icloud.com'],
   ['Ethan Brooks', 'ethan.brooks@brightpath.co'],
   ['Mei Lin', 'mei.lin@northwind.io'],
   ['Oliver Bennett', 'oliver.bennett@gmail.com'],
   ['Zara Ahmed', 'zara.ahmed@vertexlabs.com'],
   ['Lucas Silva', 'lucas.silva@outlook.com'],
   ['Ingrid Larsen', 'ingrid.larsen@meridian.jp'],
   ['Ravi Patel', 'ravi.patel@gmail.com'],
   ['Chloe Martin', 'chloe.martin@stellarworks.com'],
   ['Ben Turner', 'ben.turner@icloud.com'],
   ['Nadia Petrova', 'nadia.petrova@cloudnine.dev'],
   ['Sam Okafor', 'sam.okafor@gmail.com'],
   ['Ji-woo Park', 'jiwoo.park@yahoo.com'],
];

// [pool, category] — category is null for the uncategorized pool, same
// "never guessed" rule the inbound-email route follows.
const POOLS: [[string, string][], TicketCategory | null][] = [
   [GENERAL_QUESTION, TicketCategory.general_question],
   [TECHNICAL_QUESTION, TicketCategory.technical_question],
   [REFUND_REQUEST, TicketCategory.refund_request],
   [UNCATEGORIZED, null],
];

// open-heavy but with a healthy mix of resolved/closed, like a real queue.
const STATUS_WEIGHTS: [TicketStatus, number][] = [
   [TicketStatus.open, 0.5],
   [TicketStatus.resolved, 0.3],
   [TicketStatus.closed, 0.2],
];

function pickRandom<T>(items: T[]): T {
   const item = items[Math.floor(Math.random() * items.length)];
   if (!item) throw new Error('pickRandom called with an empty array');
   return item;
}

function pickWeighted<T>(weighted: [T, number][]): T {
   const roll = Math.random();
   let cumulative = 0;
   for (const [value, weight] of weighted) {
      cumulative += weight;
      if (roll <= cumulative) return value;
   }
   // Floating-point rounding safety net — fall back to the last option.
   return weighted[weighted.length - 1]![0];
}

// Random timestamp within the last 90 days, so "newest first" sorting and
// the Created column actually show meaningful variation instead of every
// row sharing the same seed-run timestamp.
function randomRecentDate(): Date {
   const now = Date.now();
   const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
   return new Date(now - Math.random() * ninetyDaysMs);
}

async function main() {
   const rows: Prisma.TicketCreateManyInput[] = [];

   for (let i = 0; i < TICKET_COUNT; i++) {
      const [pool, category] = pickRandom(POOLS);
      const [subject, body] = pickRandom(pool);
      const [senderName, senderEmail] = pickRandom(SENDERS);
      const status = pickWeighted(STATUS_WEIGHTS);
      const createdAt = randomRecentDate();

      rows.push({
         subject,
         body,
         senderName,
         senderEmail,
         category,
         status,
         createdAt,
         updatedAt: createdAt,
      });
   }

   await prisma.ticket.createMany({ data: rows });

   console.log(`Seeded ${rows.length} tickets.`);
}

main()
   .catch((error) => {
      console.error(error);
      process.exitCode = 1;
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
