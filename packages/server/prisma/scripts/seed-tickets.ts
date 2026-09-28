import 'dotenv/config';
import { Prisma } from '../../generated/prisma/client';
import {
   Role,
   TicketCategory,
   TicketStatus,
} from '../../generated/prisma/enums';
import prisma from '../../db';

// Dev-only bulk seed for local testing of the tickets table's sorting
// (GET /api/tickets's sortBy/sortOrder) and subject filtering
// (TicketsPage.tsx's DataTable filterColumn="subject"). Unlike seed.ts's
// admin-user seed (which must be idempotent — it's part of real bootstrap),
// this is a manual dev tool: every run inserts TICKET_COUNT more rows, on
// purpose, so re-running to pad out more data is fine. Content is themed
// as an e-commerce store's support inbox (orders, shipping, returns).
const TICKET_COUNT = 100;

// [subject, body] pairs, grouped by the category a real classifier would
// assign — the UNCATEGORIZED pool mimics ambiguous subject lines a real
// inbox gets before triage, which is why those tickets get category: null
// below rather than a guessed value (matches routes/tickets.ts's own rule
// that category is never guessed outside Phase 5's AI classification).
const GENERAL_QUESTION: [string, string][] = [
   [
      'Do you ship internationally?',
      "I'm based in Germany — do you ship outside the US, and roughly how long does delivery take?",
   ],
   [
      'Is the Denim Jacket true to size?',
      'Trying to decide between a medium and a large — does it run small or large?',
   ],
   [
      'Can I use two discount codes on one order?',
      'I have a welcome code and a referral code — can both be applied at checkout?',
   ],
   [
      'Do gift cards expire?',
      'Received a $50 gift card last year and want to make sure it’s still valid before I use it.',
   ],
   [
      'How long does standard shipping take?',
      'Just placed an order and want to know roughly when it should arrive.',
   ],
   [
      'Can I change my shipping address after placing an order?',
      'I entered my old address by mistake and the order hasn’t shipped yet.',
   ],
   [
      'Will the black hoodie in size L be restocked?',
      'It’s been sold out for a couple weeks — any idea when more will come in?',
   ],
   [
      'What’s your return policy for clearance items?',
      'Wondering if items bought during the clearance sale can still be returned.',
   ],
   [
      'Can two separate orders be combined into one shipment?',
      'I placed two orders today by accident — can they ship together to save on fees?',
   ],
   [
      'Do you offer gift wrapping?',
      'This order is a birthday present — is gift wrapping available at checkout?',
   ],
   [
      'Is my payment information stored securely?',
      'Just want to confirm you don’t store full card numbers before I check out.',
   ],
   [
      'Do you have a size chart for the running shoes?',
      'Trying to figure out my size before ordering — my usual size varies between brands.',
   ],
   [
      'How do I redeem a referral discount?',
      'A friend sent me a referral link but I don’t see the discount applied at checkout.',
   ],
   [
      'Can I pick up an online order in store?',
      'I’m local to your Austin location — is in-store pickup an option?',
   ],
   [
      'Do you price-match other retailers?',
      'Found the same jacket cheaper elsewhere — do you offer price matching?',
   ],
];

const TECHNICAL_QUESTION: [string, string][] = [
   [
      'Checkout page keeps freezing at the payment step',
      'Tried three times and the cart just spins on "Processing Payment" and never completes.',
   ],
   [
      'Discount code says invalid even though it’s active',
      'The code WELCOME10 worked for a friend yesterday but it’s rejected on my cart.',
   ],
   [
      'Order tracking page shows no updates',
      'Tracking number was emailed 4 days ago but the page still says "label created".',
   ],
   [
      'Can’t upload a photo for my return request',
      'The return portal keeps failing when I try to attach a photo of the damaged item.',
   ],
   [
      'App crashes when I open my order history',
      'Every time I tap "My Orders" in the app it closes immediately.',
   ],
   [
      'Wishlist items disappeared after the app update',
      'Had about 15 items saved and they’re all gone since updating yesterday.',
   ],
   [
      'Charged in the wrong currency at checkout',
      'The site showed prices in USD but my card was charged in EUR at a strange rate.',
   ],
   [
      'Can’t apply store credit to my order',
      'I have $30 in store credit but there’s no option to use it during checkout.',
   ],
   [
      'Search results don’t match what I typed',
      'Searching "blue backpack" brings up completely unrelated items.',
   ],
   [
      'Never received an order confirmation email',
      'Payment shows on my bank statement but I never got a confirmation email.',
   ],
   [
      'Size filter isn’t working on the website',
      'Filtering by size "M" still shows items in every size.',
   ],
   [
      'Saved payment card won’t stay saved',
      'I’ve tried adding my card three times and it just doesn’t save to my account.',
   ],
   [
      'Live chat widget won’t load on mobile',
      'The chat bubble shows up on desktop but never appears when I browse from my phone.',
   ],
   [
      'Received someone else’s order confirmation email',
      'Got an email confirming an order I never placed, with someone else’s address on it.',
   ],
];

const REFUND_REQUEST: [string, string][] = [
   [
      'Received the wrong item in my order',
      'Ordered the navy blue backpack but received a red one instead — need a replacement or refund.',
   ],
   [
      'Item arrived damaged',
      'The ceramic mug was shattered inside the box when it arrived — requesting a refund.',
   ],
   [
      'Package shows delivered but never arrived',
      'Tracking says it was delivered yesterday but there’s nothing at my door — need a refund or reship.',
   ],
   [
      'Charged twice for the same order',
      'My bank statement shows two identical charges for order #48213.',
   ],
   [
      'Want to return an item that doesn’t fit',
      'The jacket I ordered runs too small — is a refund possible within your return window?',
   ],
   [
      'Refund never processed after my return was received',
      'Returned the shoes three weeks ago and tracking confirms delivery, but no refund yet.',
   ],
   [
      'Order was cancelled but I was still charged',
      'Cancelled within the hour like the site says is allowed, but the charge still went through.',
   ],
   [
      'Wrong size shipped for a pre-order',
      'Pre-ordered a size 9 but received a size 7 once it finally shipped.',
   ],
   [
      'Refund requested for a late delivery',
      'Paid extra for express shipping but it arrived 6 days late — requesting a shipping refund.',
   ],
   [
      'Missing item from a multi-item order',
      'The order confirmation listed 3 items but only 2 arrived in the box.',
   ],
   [
      'Refund for a discontinued item that never shipped',
      'Ordered a listed item that turned out to be discontinued — money was taken but nothing shipped.',
   ],
   [
      'Double charged after using a gift card and a credit card',
      'Used a gift card plus my credit card, but it looks like both were charged the full amount.',
   ],
   [
      'Requesting a refund — quality doesn’t match the photos',
      'The fabric feels completely different from what was shown on the product page.',
   ],
   [
      'Return label was never emailed to me',
      'Requested a return three days ago and still haven’t received the prepaid shipping label.',
   ],
];

const UNCATEGORIZED: [string, string][] = [
   [
      'Question about my order',
      'Hi, I have a question about an order I placed, can someone help?',
   ],
   ['Need help ASAP', 'This is urgent, please respond as soon as you can.'],
   [
      'Following up on my order',
      'Just following up since I haven’t heard back yet — any update?',
   ],
   [
      'Quick question',
      'Hey, quick question about my recent purchase when you get a chance.',
   ],
   [
      'Issue with my order',
      'Something’s wrong with my order, not totally sure what.',
   ],
   ['Help needed', 'Could really use some help with something on my end.'],
   ['Re: your email', 'Replying to your last message — see below for context.'],
   [
      'Urgent - please respond',
      'Marking this urgent, please get back to me soon.',
   ],
   [
      'Problem with my package',
      'I’m having a problem with my package and not sure who else to contact.',
   ],
   [
      'Can someone assist me?',
      'Not sure if this is the right place, but could someone assist me?',
   ],
];

// Realistic-looking customer pool, reused across tickets (mirrors real
// support inboxes where the same customer files more than one ticket).
const SENDERS: [string, string][] = [
   ['Emily Chen', 'emily.chen88@gmail.com'],
   ['Marcus Webb', 'marcus.webb@yahoo.com'],
   ['Priya Nair', 'priya.nair@outlook.com'],
   ['Diego Alvarez', 'diego.alvarez@gmail.com'],
   ['Sofia Rossi', 'sofia.rossi@icloud.com'],
   ['Tom Baker', 'tom.baker@yahoo.com'],
   ['Aisha Khan', 'aisha.khan21@gmail.com'],
   ["Liam O'Connor", 'liam.oconnor@gmail.com'],
   ['Hana Suzuki', 'hana.suzuki@icloud.com'],
   ['Carlos Mendes', 'carlos.mendes@outlook.com'],
   ['Grace Kim', 'grace.kim.retail@gmail.com'],
   ['Noah Fischer', 'noah.fischer@gmail.com'],
   ['Fatima Al-Sayed', 'fatima.alsayed@icloud.com'],
   ['Ethan Brooks', 'ethan.brooks@yahoo.com'],
   ['Mei Lin', 'mei.lin.shops@gmail.com'],
   ['Oliver Bennett', 'oliver.bennett@gmail.com'],
   ['Zara Ahmed', 'zara.ahmed@outlook.com'],
   ['Lucas Silva', 'lucas.silva@outlook.com'],
   ['Ingrid Larsen', 'ingrid.larsen@icloud.com'],
   ['Ravi Patel', 'ravi.patel@gmail.com'],
   ['Chloe Martin', 'chloe.martin@gmail.com'],
   ['Ben Turner', 'ben.turner@icloud.com'],
   ['Nadia Petrova', 'nadia.petrova@yahoo.com'],
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
   // Non-admin users seeded by seed-users.ts, so non-open tickets can look
   // like a real queue with agents actually assigned to them. Falls back
   // to leaving everything unassigned if that script hasn't been run yet.
   const agents = await prisma.user.findMany({
      where: { role: Role.user, deletedAt: null },
      select: { id: true },
   });

   const rows: Prisma.TicketCreateManyInput[] = [];

   for (let i = 0; i < TICKET_COUNT; i++) {
      const [pool, category] = pickRandom(POOLS);
      const [subject, body] = pickRandom(pool);
      const [senderName, senderEmail] = pickRandom(SENDERS);
      const status = pickWeighted(STATUS_WEIGHTS);
      const createdAt = randomRecentDate();

      const assignedToId =
         status !== TicketStatus.open &&
         agents.length > 0 &&
         Math.random() < 0.7
            ? pickRandom(agents).id
            : null;

      rows.push({
         subject,
         body,
         senderName,
         senderEmail,
         category,
         status,
         assignedToId,
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
