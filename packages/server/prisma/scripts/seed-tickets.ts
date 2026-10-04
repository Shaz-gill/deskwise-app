import 'dotenv/config';
import {
   Role,
   TicketCategory,
   TicketReplySenderType,
   TicketStatus,
} from '../../generated/prisma/enums';
import prisma from '../../db';
import { getAiAssistantUser } from '../../lib/tickets/ai-assistant-user';
import { AGENTS, type AgentTeam } from './seed-users';

// Dev-only bulk seed for local testing — tickets, dashboard stats, and
// ticket-detail reply threads for a fictional LMS demo tenant ("Pathlight
// Academy"). Fully idempotent: TRUNCATEs its own tables and reinserts a
// deterministic set every run (see `rand` below), rather than appending.
// Depends on `bun run seed` (AI Assistant user) and `bun run seed:users`
// (the 14 named agents) having already been run — see the README in this
// directory.
//
// Policy figures referenced in reply/resolution snippets below (refund
// window, payout schedule, certificate thresholds, etc.) must match
// seed-knowledge-base.ts's DOCS table exactly — they're the same invented
// policy, authored once and reused in both places.
const TICKET_COUNT = 140;

// ---------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — replaces Math.random() everywhere in
// this file so a TRUNCATE + reseed produces the same draw sequence every
// time. Only the fixed "now" window (randomRecentDate) drifts with the
// calendar, which is intended ("recent months," not frozen dates).
// ---------------------------------------------------------------------
const SEED = 1337; // fixed — do not change, or every reseed reshuffles content
function mulberry32(seed: number) {
   return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
   };
}
const rand = mulberry32(SEED);

function pickRandom<T>(items: T[]): T {
   const item = items[Math.floor(rand() * items.length)];
   if (!item) throw new Error('pickRandom called with an empty array');
   return item;
}

// Weights don't need to sum to 1 — normalized against their own total, so
// e.g. POOLS's per-topic weights (1, 1, ..., 0.6) work the same as
// STATUS_WEIGHTS's pre-normalized (0.5, 0.3, 0.2).
function pickWeighted<T>(weighted: [T, number][]): T {
   const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
   const roll = rand() * total;
   let cumulative = 0;
   for (const [value, weight] of weighted) {
      cumulative += weight;
      if (roll <= cumulative) return value;
   }
   // Floating-point rounding safety net — fall back to the last option.
   return weighted[weighted.length - 1]![0];
}

// Random timestamp within the last 180 days ("recent months"), so sorting
// and the Created column show meaningful variation.
function randomRecentDate(): Date {
   const now = Date.now();
   const windowMs = 180 * 24 * 60 * 60 * 1000;
   return new Date(now - rand() * windowMs);
}

function jitterMs(minHours: number, maxHours: number): number {
   return (minHours + rand() * (maxHours - minHours)) * 60 * 60 * 1000;
}

function firstName(fullName: string): string {
   return fullName.split(' ')[0]!;
}

// Tickets originate as inbound support emails (see CLAUDE.md), so agent and
// AI replies are seeded as full email replies — greeting, body, sign-off —
// rather than bare chat-style snippets. Customer replies stay as short,
// informal follow-ups (real customers rarely re-greet mid-thread).
function formatAgentEmail(
   customerName: string,
   agentName: string,
   message: string
): string {
   return `Hi ${firstName(customerName)},\n\n${message}\n\nBest,\n${firstName(agentName)}`;
}

function formatAiEmail(customerName: string, message: string): string {
   return `Hi ${firstName(customerName)},\n\n${message}\n\nBest regards,\nCustomer Support`;
}

// ---------------------------------------------------------------------
// Senders — a believable Pathlight customer base: students, instructors,
// and business/team-account admins. Persona drives which topics a sender
// is likely to show up in (see pickFromPersona below); it's a seed-only
// tag, not a schema field.
// ---------------------------------------------------------------------
type Persona = 'student' | 'instructor' | 'team_admin';

interface Sender {
   name: string;
   email: string;
   persona: Persona;
}

const SENDERS: Sender[] = [
   // Students
   { name: 'Emily Chen', email: 'emily.chen88@gmail.com', persona: 'student' },
   { name: 'Marcus Webb', email: 'marcus.webb@yahoo.com', persona: 'student' },
   { name: 'Priya Nair', email: 'priya.nair@outlook.com', persona: 'student' },
   {
      name: 'Diego Alvarez',
      email: 'diego.alvarez@gmail.com',
      persona: 'student',
   },
   { name: 'Sofia Rossi', email: 'sofia.rossi@icloud.com', persona: 'student' },
   { name: 'Tom Baker', email: 'tom.baker@yahoo.com', persona: 'student' },
   { name: 'Aisha Khan', email: 'aisha.khan21@gmail.com', persona: 'student' },
   {
      name: "Liam O'Connor",
      email: 'liam.oconnor@gmail.com',
      persona: 'student',
   },
   { name: 'Hana Suzuki', email: 'hana.suzuki@icloud.com', persona: 'student' },
   {
      name: 'Carlos Mendes',
      email: 'carlos.mendes@outlook.com',
      persona: 'student',
   },
   {
      name: 'Noah Fischer',
      email: 'noah.fischer@gmail.com',
      persona: 'student',
   },
   {
      name: 'Fatima Al-Sayed',
      email: 'fatima.alsayed@icloud.com',
      persona: 'student',
   },
   {
      name: 'Ethan Brooks',
      email: 'ethan.brooks@yahoo.com',
      persona: 'student',
   },
   { name: 'Zara Ahmed', email: 'zara.ahmed@outlook.com', persona: 'student' },
   {
      name: 'Lucas Silva',
      email: 'lucas.silva@outlook.com',
      persona: 'student',
   },
   {
      name: 'Ingrid Larsen',
      email: 'ingrid.larsen@icloud.com',
      persona: 'student',
   },
   { name: 'Ravi Patel', email: 'ravi.patel@gmail.com', persona: 'student' },
   {
      name: 'Chloe Martin',
      email: 'chloe.martin@gmail.com',
      persona: 'student',
   },

   // Instructors
   {
      name: 'Nadia Petrova',
      email: 'nadia.petrova.teaches@gmail.com',
      persona: 'instructor',
   },
   {
      name: 'Sam Okafor',
      email: 'sam.okafor.courses@gmail.com',
      persona: 'instructor',
   },
   {
      name: 'Ji-woo Park',
      email: 'jiwoo.park@yahoo.com',
      persona: 'instructor',
   },
   {
      name: 'Ben Turner',
      email: 'ben.turner.training@gmail.com',
      persona: 'instructor',
   },
   {
      name: 'Grace Kim',
      email: 'grace.kim.instructs@outlook.com',
      persona: 'instructor',
   },
   {
      name: 'Mei Lin',
      email: 'mei.lin.academy@gmail.com',
      persona: 'instructor',
   },
   {
      name: 'Oliver Bennett',
      email: 'oliver.bennett.dev@gmail.com',
      persona: 'instructor',
   },
   {
      name: 'Isabel Moreno',
      email: 'isabel.moreno@icloud.com',
      persona: 'instructor',
   },
   {
      name: 'Victor Nwosu',
      email: 'victor.nwosu.teaches@gmail.com',
      persona: 'instructor',
   },
   {
      name: 'Hannah Weiss',
      email: 'hannah.weiss.courses@outlook.com',
      persona: 'instructor',
   },

   // Team / business admins
   {
      name: "Dana O'Brien",
      email: 'dana.obrien@brightpath-consulting.com',
      persona: 'team_admin',
   },
   {
      name: 'Marcus Lee',
      email: 'mkt-ops@nova-retail-group.com',
      persona: 'team_admin',
   },
   {
      name: 'Priya Sharma',
      email: 'priya.sharma@zenith-financial.co',
      persona: 'team_admin',
   },
   {
      name: 'Robert Hayes',
      email: 'rhayes@summitlogix.com',
      persona: 'team_admin',
   },
   {
      name: 'Jenna Wu',
      email: 'jenna.wu@clearwave-media.com',
      persona: 'team_admin',
   },
   {
      name: 'Tariq Malik',
      email: 'tmalik@forgeworks-consulting.com',
      persona: 'team_admin',
   },
   {
      name: 'Linda Park',
      email: 'l.park@brightline-health.com',
      persona: 'team_admin',
   },
   {
      name: 'Carlos Jimenez',
      email: 'cjimenez@atlasgear-corp.com',
      persona: 'team_admin',
   },
];

function pickFromPersona(persona: Persona): Sender {
   const biased = rand() < 0.8;
   const pool = biased ? SENDERS.filter((s) => s.persona === persona) : SENDERS;
   return pickRandom(pool);
}

// ---------------------------------------------------------------------
// Ticket content, grouped by topic. Each topic maps to one of the 3 real
// TicketCategory values (kept unchanged) plus an informal team (see
// seed-users.ts's AGENTS) and preferred sender persona. `humanResolution`
// is the final agent reply on a human-resolved thread; `aiResolution` (when
// present) is the single reply on the smaller slice of tickets resolved by
// the AI Assistant, mirroring auto-resolve-ticket.ts's KB-grounded style.
// ---------------------------------------------------------------------
type Topic =
   | 'refunds'
   | 'duplicate_charges'
   | 'course_access'
   | 'video_playback'
   | 'certificates'
   | 'login_2fa'
   | 'coupons'
   | 'instructor_payouts'
   | 'course_publishing'
   | 'team_licenses'
   | 'uncategorized';

interface TopicPool {
   topic: Topic;
   category: TicketCategory | null;
   team: AgentTeam;
   persona: Persona | null; // null = no persona bias (uncategorized)
   pairs: [string, string][];
   humanResolution: string;
   aiResolution: string | null; // null = never resolved via the AI path
}

const POOLS: [TopicPool, number][] = [
   [
      {
         topic: 'refunds',
         category: TicketCategory.refund_request,
         team: 'billing',
         persona: 'student',
         pairs: [
            [
               'Requesting a refund for a course I barely started',
               'I bought the Advanced Excel course two days ago but only watched the first lecture — can I get a refund?',
            ],
            [
               'Refund window — does it start at purchase or first watch?',
               'I bought a course three weeks ago but only just got around to starting it. Is it too late for a refund?',
            ],
            [
               "Refund request — course wasn't what I expected",
               "The description made the UX Design course sound beginner-friendly but it's way more advanced than I can follow. Requesting a refund.",
            ],
            [
               'Accidentally bought the same course twice',
               'I must have double-clicked at checkout — I have two charges for Intro to Python within a minute of each other. Please refund one.',
            ],
            [
               'Refund for a course purchased under the wrong account',
               'I meant to buy this on my work account but it went through on my personal one instead. Can you refund it so I can repurchase correctly?',
            ],
            [
               "Can I get a refund if I've watched more than a few lectures?",
               "I'm past the 20% mark on the Data Analytics course but still think it isn't right for me — is a partial refund possible?",
            ],
            [
               'Refund requested — bought during a free trial by mistake',
               'I thought I was still in my free trial but got charged for a full course. Requesting a refund.',
            ],
            [
               'Refund status check — submitted 10 days ago',
               "I requested a refund for the Marketing Fundamentals course over a week ago and haven't heard anything back.",
            ],
         ],
         humanResolution:
            "Good news — I've processed your refund. Since you're well within our 14-day window and under 20% watched, it'll go back to your original payment method within 5-7 business days.",
         aiResolution:
            "You're eligible for a refund — purchases are refundable within 14 days if less than 20% of the course has been watched. I've gone ahead and processed it; funds should post to your original payment method within 5-7 business days.",
      },
      1,
   ],
   [
      {
         topic: 'duplicate_charges',
         category: TicketCategory.refund_request,
         team: 'billing',
         persona: 'student',
         pairs: [
            [
               'Charged twice for the same course',
               'My card statement shows two identical charges for the UX Design Bootcamp, both dated today.',
            ],
            [
               'Payment failed but I was still charged',
               'Checkout showed an error and told me to try again, but now I see a pending charge on my card.',
            ],
            [
               'Charged in a different amount than listed',
               'The course page said $49.99 but my bank shows a charge of $64.99 — not sure why.',
            ],
            [
               'Retried a failed payment and now see two pending charges',
               'My card was declined the first time so I used a different card, and now both show as pending.',
            ],
            [
               'Subscription charged after I cancelled',
               'I cancelled my Pathlight Pro subscription last month but was still billed this cycle.',
            ],
            [
               'Duplicate charge after a browser refresh at checkout',
               'The payment page was slow to load so I refreshed and resubmitted — now I see two charges.',
            ],
            [
               'Charged for a course that failed to load after purchase',
               "Payment went through but the course never appeared in my account, and I don't want to be charged for something I can't access.",
            ],
            [
               "Bank shows a charge that doesn't match any order confirmation",
               'I see a Pathlight charge on my statement but no matching email confirmation or order in my account.',
            ],
         ],
         humanResolution:
            'I can confirm the duplicate charge and have reversed the extra one — it should drop off your statement within 3 business days.',
         aiResolution:
            'I checked your account and confirmed the duplicate charge. Duplicate charges from a retried payment are automatically reversed within 3 business days — no action needed on your end.',
      },
      1,
   ],
   [
      {
         topic: 'course_access',
         category: TicketCategory.technical_question,
         team: 'technical',
         persona: 'student',
         pairs: [
            [
               "Purchased a course but it's not showing in My Courses",
               "I bought the Full-Stack Web Dev course 20 minutes ago and it still isn't appearing in my dashboard.",
            ],
            [
               'Bought a course on the wrong account',
               "I think I was logged into an old account when I purchased — the course isn't showing on the account I usually use.",
            ],
            [
               "Lost access to a course I've had for months",
               "I was halfway through the Data Science course and suddenly it's gone from my account.",
            ],
            [
               'Course still locked after payment confirmation email',
               'I got the receipt email but the course content is still greyed out when I try to open it.',
            ],
            [
               'Gifted course not showing up for the recipient',
               "I bought a course as a gift for my sister but she says she can't see it in her account.",
            ],
            [
               "Course access says 'processing' for over an hour",
               "My payment cleared on my bank's end but the course page still says access is processing.",
            ],
            [
               'Can I access a course if the instructor unpublished it?',
               "I bought a course last year and now the instructor page says it's unpublished — do I still have access?",
            ],
            [
               'Mobile app shows different courses than the website',
               'On the Pathlight app I only see 3 of my 6 purchased courses, but all 6 show on the website.',
            ],
         ],
         humanResolution:
            "Your access is now fixed — it looks like the purchase went through on a different account than the one you were signed into. I've moved the course over, so it should be visible under My Courses now.",
         aiResolution:
            "Course access is granted instantly after payment, so this is usually a sign the purchase went to a different account than the one you're signed into, or that payment is still processing (can take up to 15 minutes). Please check My Courses again in a few minutes — if it's still missing, reply here and we'll take a closer look.",
      },
      1,
   ],
   [
      {
         topic: 'video_playback',
         category: TicketCategory.technical_question,
         team: 'technical',
         persona: 'student',
         pairs: [
            [
               'Videos keep buffering even on fast wifi',
               'Every lecture in the Photography Basics course stalls every 30 seconds despite a solid connection.',
            ],
            [
               'No sound on course videos',
               "Every video plays fine visually but there's no audio at all, on both my laptop and phone.",
            ],
            [
               "Can't download lectures for offline viewing",
               'The download button on the mobile app just spins and never finishes for the Negotiation Skills course.',
            ],
            [
               'Video quality stuck on 360p',
               "There's no option to change resolution and everything looks blurry compared to before.",
            ],
            [
               'Playback speed controls disappeared',
               'I used to be able to watch lectures at 1.5x speed but that option is gone now.',
            ],
            [
               'Video player is completely blank',
               'The lecture page loads but the video area is just a black box with no controls.',
            ],
            [
               "Captions won't turn on for any lecture",
               "I rely on captions and the CC button isn't doing anything in any course I've tried.",
            ],
            [
               'Offline downloads disappeared after an app update',
               "I had 4 courses downloaded for a flight and after updating the app they're all gone.",
            ],
         ],
         humanResolution:
            "Switching to the HTML5 player and clearing your browser cache should resolve the playback issue — I've also double-checked your connection requirements and confirmed everything looks fine on our end.",
         aiResolution:
            "Most playback issues clear up by switching to the HTML5 player (Settings -> Player Version) and clearing your browser cache. We recommend at least 5 Mbps for smooth streaming. Give that a try and let us know if it's still acting up.",
      },
      1,
   ],
   [
      {
         topic: 'certificates',
         category: TicketCategory.technical_question,
         team: 'technical',
         persona: 'student',
         pairs: [
            [
               'Completed a course but no certificate was issued',
               "I finished every lecture in the Agile Fundamentals course two days ago and still don't see a certificate.",
            ],
            [
               'Certificate has my name misspelled',
               'The certificate for my Project Management course spells my last name wrong — can it be corrected?',
            ],
            [
               'Quiz passed but certificate still locked',
               'I scored 85% on the final quiz for Intro to SQL but the certificate section still shows as incomplete.',
            ],
            [
               'Certificate missing after a course was updated',
               'The instructor added new lectures and now my old completion certificate seems to have disappeared.',
            ],
            [
               'Can I get a certificate for a free course?',
               "I completed the free Public Speaking mini-course and don't see a certificate option anywhere.",
            ],
            [
               'Certificate download link is broken',
               'I can see the certificate preview but the download button gives an error.',
            ],
            [
               'How long does it take for a certificate to appear?',
               'I finished the last lecture of the Leadership Essentials course about 20 hours ago.',
            ],
            [
               'Need proof of completion for my employer today',
               'My HR department needs my certificate for the Cybersecurity Basics course by end of day.',
            ],
         ],
         humanResolution:
            'I can confirm your quiz score and lecture completion both meet the requirements, so your certificate has been manually issued — you should see it in your account now.',
         aiResolution:
            "Certificates are issued automatically once 100% of lectures are complete and any graded quizzes are passed at 70% or higher, usually within 24 hours. If it's been longer than that, let us know and we'll take a closer look.",
      },
      1,
   ],
   [
      {
         topic: 'login_2fa',
         category: TicketCategory.technical_question,
         team: 'technical',
         persona: 'student',
         pairs: [
            [
               "Can't log in — password reset email never arrives",
               "I've requested a password reset three times and nothing shows up, even in spam.",
            ],
            [
               'Locked out after enabling two-factor authentication',
               'I set up 2FA last week and now my authenticator app shows a different code than what Pathlight expects.',
            ],
            [
               'Lost my phone with the authenticator app',
               "My phone was stolen and I can't get past the 2FA prompt to sign in — I don't remember saving backup codes.",
            ],
            [
               "Account says 'too many login attempts'",
               "I mistyped my password a few times and now I'm locked out entirely, even with the correct password.",
            ],
            [
               "Backup codes aren't working",
               "I'm trying to use one of my saved backup codes to get past 2FA but it keeps saying invalid code.",
            ],
            [
               'Can I switch from SMS codes to an authenticator app?',
               'I keep missing my 2FA text messages due to spotty signal — is there another option?',
            ],
            [
               'New phone, lost access to my authenticator',
               "I upgraded phones without transferring my authenticator app and now I can't get a 2FA code.",
            ],
            [
               'Login works on web but not on the mobile app',
               'My password is accepted on the website but the app just spins after I enter my credentials.',
            ],
         ],
         humanResolution:
            "I've verified your identity and cleared your 2FA lockout — you should be able to sign in normally now, and I'd recommend saving a fresh set of backup codes this time.",
         aiResolution:
            "If you've lost access to your authenticator app, we can help recover your account after verifying your identity — this typically takes about 1 business day. In the meantime, if you saved your 10 backup codes at setup, any one of those will get you back in.",
      },
      1,
   ],
   [
      {
         topic: 'coupons',
         category: TicketCategory.technical_question,
         team: 'billing',
         persona: 'student',
         pairs: [
            [
               'Coupon code says invalid at checkout',
               "The code SPRING25 isn't being accepted even though the promo email says it's active.",
            ],
            [
               'Discount code worked for a friend but not for me',
               "My coworker used WELCOME15 successfully yesterday but it's rejected on my cart.",
            ],
            [
               'Can I use two coupons on one order?',
               'I have a welcome code and an instructor promo code — can both apply to the same purchase?',
            ],
            [
               'Coupon expired while I was deciding',
               'I had FALL20 saved for a few days and now it says expired — can it be reactivated?',
            ],
            [
               'Want to apply a coupon to a purchase I already made',
               'I found a better discount code after I already bought the course — can it be applied retroactively?',
            ],
            [
               "Coupon won't apply with a team license purchase",
               "I'm trying to use a 10% off code on a 20-seat team license order and it's not applying.",
            ],
            [
               'Coupon says minimum purchase not met',
               "The code requires a $30 minimum but my cart total is $35 and it's still rejected.",
            ],
            [
               'Where do I find active discount codes?',
               "I'd like to know if there are any current promotions before I buy a course.",
            ],
         ],
         humanResolution:
            "I checked the code and it looks like it had already been used once before, which is why it was rejected — only one coupon applies per order. I've applied a replacement discount to make up for the mix-up.",
         aiResolution:
            "Coupons are limited to one per order and can't be combined with team-license bulk pricing. If a code is being rejected, the most common reasons are that it's expired, already used, or the cart doesn't meet its minimum purchase amount — let us know the exact checkout error and we can dig further.",
      },
      1,
   ],
   [
      {
         topic: 'instructor_payouts',
         category: TicketCategory.general_question,
         team: 'instructor_success',
         persona: 'instructor',
         pairs: [
            [
               "Payout didn't arrive on the usual date",
               "My monthly payout is normally on the 15th but it's now the 18th and I haven't received anything.",
            ],
            [
               'Confused about my revenue share percentage',
               "My last payout seems lower than expected — can you confirm what percentage I'm earning per sale?",
            ],
            [
               'Payout below the minimum threshold',
               'My dashboard shows a balance but no payout was issued this month — is there a minimum amount required?',
            ],
            [
               'How do promotional sales affect my earnings?',
               'A chunk of my sales this month came through a site-wide Pathlight promotion — does that change my revenue share?',
            ],
            [
               'Need to update my payout method',
               'I want to switch from PayPal to direct bank transfer for future payouts.',
            ],
            [
               'Missing payout for last month entirely',
               'I had several sales last month but my payout history shows nothing for that period.',
            ],
            [
               'Tax form questions for instructor earnings',
               "I'm trying to figure out what tax documentation Pathlight provides for instructor income.",
            ],
            [
               "Payout amount doesn't match my sales dashboard",
               'The number in my payout history is noticeably lower than what my sales analytics page shows.',
            ],
         ],
         humanResolution:
            'I checked your payout history and confirmed the numbers — your organic sales are paying out at 70%, and anything attributed to a Pathlight promotion pays at 40%, which explains the difference you noticed. Everything is tracking correctly.',
         aiResolution:
            "Instructor payouts run monthly on the 15th, with a $50 minimum threshold (balances below that roll over automatically). Revenue share is 70% on organic sales and 40% on sales driven by a Pathlight promotion. That should account for what you're seeing — let us know if the numbers still don't add up.",
      },
      1,
   ],
   [
      {
         topic: 'course_publishing',
         category: TicketCategory.general_question,
         team: 'instructor_success',
         persona: 'instructor',
         pairs: [
            [
               'Course submitted a week ago with no review update',
               "I submitted my new course for review 7 business days ago and haven't heard anything.",
            ],
            [
               'Course was rejected — need more detail on why',
               'I got a rejection notice but the feedback is too vague for me to know what to fix.',
            ],
            [
               'How long after approval until my course goes live?',
               'My course was just approved and I want to know when students will actually be able to see it.',
            ],
            [
               'Can I resubmit immediately after a rejection?',
               'My course was rejected for audio quality — once I fix it, is there a waiting period to resubmit?',
            ],
            [
               'Minimum course length requirement',
               "I'm putting together a short course and want to confirm the minimum total runtime before I submit.",
            ],
            [
               "Course stuck in 'In Review' far past the usual timeline",
               "It's been over two weeks and my course status hasn't changed from In Review.",
            ],
            [
               "Want to update a course that's already live",
               'Do I need to resubmit for review if I just want to add one new lecture to a published course?',
            ],
            [
               'Review feedback mentions curriculum completeness — what does that mean?',
               "My rejection feedback flagged 'incomplete curriculum structure' and I'm not sure what's missing.",
            ],
         ],
         humanResolution:
            "Thanks for your patience — I checked your submission and it's now been reviewed and approved. It should go live within 24 hours.",
         aiResolution:
            "Course reviews typically take up to 3 business days, checking audio/video quality, a minimum 30-minute runtime, and curriculum completeness. If you're past that window, let us know and we'll flag it for a manual look.",
      },
      1,
   ],
   [
      {
         topic: 'team_licenses',
         category: TicketCategory.general_question,
         team: 'billing',
         persona: 'team_admin',
         pairs: [
            [
               'How do I add more seats to our team plan?',
               "We're on a 20-seat Pathlight for Business plan and need to add 5 more people.",
            ],
            [
               'Removing a former employee from our team license',
               'One of our licensed users left the company — how do I free up their seat for someone new?',
            ],
            [
               'Requesting an annual invoice instead of monthly billing',
               'Our finance team needs a single annual invoice rather than recurring monthly charges for our 25-seat plan.',
            ],
            [
               'Do larger team plans get a discount?',
               "We're considering upgrading from 20 to 50 seats — is there a price break at that size?",
            ],
            [
               'Team admin access — how do I add a co-admin?',
               'I manage our team license alone right now and want to give a colleague admin access too.',
            ],
            [
               'Seat reassignment taking longer than expected',
               'I freed up a seat from a former employee two days ago and it still shows as occupied.',
            ],
            [
               'Bulk discount code not applying to team purchase',
               "We're buying 20 seats and trying to use a discount code, but it's not reducing the total.",
            ],
            [
               'Switching from individual licenses to a team plan',
               'Several of us separately bought the same course — can we consolidate into a team license instead?',
            ],
         ],
         humanResolution:
            "I've updated your team license — the extra seats are active now, and I went ahead and set you up with annual invoicing as requested.",
         aiResolution:
            "Team licenses are sold in seat blocks of 5/20/50/100, with seats reassignable anytime and a 10% automatic discount at 50+ seats. Annual invoicing is available for 20+ seats — let us know if you'd like that set up.",
      },
      1,
   ],
   [
      {
         topic: 'uncategorized',
         category: null,
         team: 'general',
         persona: null,
         pairs: [
            [
               'Question about my account',
               'Hi, I have a question about my account, could someone help?',
            ],
            [
               'Need help ASAP',
               'This is urgent, please respond as soon as you can.',
            ],
            [
               'Following up',
               "Just following up since I haven't heard back yet — any update?",
            ],
            [
               'Quick question',
               'Hey, quick question about something on my account when you get a chance.',
            ],
            [
               'Issue with my course',
               "Something's wrong with one of my courses, not totally sure what.",
            ],
            [
               'Help needed',
               'Could really use some help with something on my end.',
            ],
            [
               'Re: your email',
               'Replying to your last message — see below for context.',
            ],
            [
               'Urgent - please respond',
               'Marking this urgent, please get back to me soon.',
            ],
            [
               'Problem on my end',
               "I'm having a problem and not sure who else to contact.",
            ],
            [
               'Can someone assist me?',
               'Not sure if this is the right place, but could someone assist me?',
            ],
         ],
         humanResolution:
            "Thanks for reaching out — I've looked into this and taken care of it. Let me know if anything else comes up!",
         aiResolution: null,
      },
      0.6,
   ],
];

const GENERIC_ACK_REPLIES: string[] = [
   'Thanks for reaching out — sorry for the trouble. Let me look into this and get back to you shortly.',
   'Got it, thanks for flagging this. Can you confirm a few more details so I can dig in?',
   "Appreciate you writing in — looking into this now, I'll follow up shortly with next steps.",
   'Thanks for the details so far. Could you also let me know roughly when this started happening?',
   'Sorry about this! Pulling up your account now, give me a moment.',
   "Thanks for your patience — I'm on it and will have an update for you shortly.",
];

const GENERIC_CUSTOMER_FOLLOWUPS: string[] = [
   "Thanks for looking into it — here's a bit more detail in case it helps.",
   'Sure, happy to clarify — let me know if you need anything else from me.',
   'Still waiting to hear back on this, just wanted to follow up.',
   'Thanks for the update. Any idea on timing?',
   'That makes sense, thanks for explaining — appreciate the help.',
   "Okay, thank you! Let me know once it's sorted.",
];

// open-heavy but with a healthy mix of resolved/closed, like a real queue.
const STATUS_WEIGHTS: [TicketStatus, number][] = [
   [TicketStatus.open, 0.5],
   [TicketStatus.resolved, 0.3],
   [TicketStatus.closed, 0.2],
];

interface GeneratedReply {
   body: string;
   senderType: TicketReplySenderType;
   authorId: string;
   createdAt: Date;
}

interface GeneratedThread {
   replies: GeneratedReply[];
   assignedToId: string | null;
}

function generateThread(params: {
   pool: TopicPool;
   status: TicketStatus;
   createdAt: Date;
   agentsByTeam: Record<
      AgentTeam,
      { id: string; email: string; name: string }[]
   >;
   aiAssistantUserId: string;
   customerUserId: string;
   customerName: string;
}): GeneratedThread {
   const {
      pool,
      status,
      createdAt,
      agentsByTeam,
      aiAssistantUserId,
      customerUserId,
      customerName,
   } = params;

   const now = Date.now();
   const clamp = (ts: number) => Math.min(ts, now - 60 * 60 * 1000);

   // AI-resolved path — mirrors auto-resolve-ticket.ts's single-shot,
   // KB-grounded resolution. Only ever applies to `resolved` tickets (the
   // real pipeline never produces `closed`), and only for topics that have
   // an aiResolution snippet defined.
   if (status === TicketStatus.resolved && pool.aiResolution && rand() < 0.15) {
      const ts = new Date(clamp(createdAt.getTime() + jitterMs(1, 6)));
      return {
         replies: [
            {
               body: formatAiEmail(customerName, pool.aiResolution),
               senderType: TicketReplySenderType.ai,
               authorId: aiAssistantUserId,
               createdAt: ts,
            },
         ],
         assignedToId: aiAssistantUserId,
      };
   }

   const countOptions: [number, number][] =
      status === TicketStatus.open
         ? [
              [0, 0.15],
              [2, 0.55],
              [4, 0.3],
           ]
         : [
              [3, 0.6],
              [5, 0.4],
           ];
   const count = pickWeighted(countOptions);

   if (count === 0) {
      return { replies: [], assignedToId: null };
   }

   const teamAgents = agentsByTeam[pool.team];
   if (!teamAgents || teamAgents.length === 0) {
      throw new Error(
         `No seeded agents found for team "${pool.team}" — run "bun run seed:users" first.`
      );
   }
   const agent = pickRandom(teamAgents);

   const replies: GeneratedReply[] = [];
   let prevTs = createdAt.getTime();

   for (let i = 0; i < count; i++) {
      const jitter = i === 0 ? jitterMs(2, 36) : jitterMs(1, 48);
      const ts = clamp(prevTs + jitter);
      prevTs = ts;

      const isAgentTurn = i % 2 === 0;
      const isLast = i === count - 1;

      if (isAgentTurn) {
         const rawBody =
            isLast && status !== TicketStatus.open
               ? pool.humanResolution
               : pickRandom(GENERIC_ACK_REPLIES);
         replies.push({
            body: formatAgentEmail(customerName, agent.name, rawBody),
            senderType: TicketReplySenderType.user,
            authorId: agent.id,
            createdAt: new Date(ts),
         });
      } else {
         replies.push({
            body: pickRandom(GENERIC_CUSTOMER_FOLLOWUPS),
            senderType: TicketReplySenderType.customer,
            authorId: customerUserId,
            createdAt: new Date(ts),
         });
      }
   }

   return { replies, assignedToId: agent.id };
}

async function main() {
   // TRUNCATE (not DELETE) so re-running produces the same autoincrement
   // ids every time (RESTART IDENTITY) — needs table-owner/sufficient
   // privilege; if that's not available locally, swap this for
   // `prisma.$transaction([prisma.ticketReply.deleteMany(), prisma.ticket.deleteMany()])`
   // instead (slower, doesn't reset sequences, works under any privilege).
   await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "ticket_reply", "ticket" RESTART IDENTITY CASCADE'
   );

   const aiAssistantUser = await getAiAssistantUser();

   // One real User (role: customer) per seeded sender, upserted by email —
   // not touched by the TRUNCATE above (separate table) — so customer-side
   // TicketReply rows show the sender's actual name/email in the UI
   // instead of a generic placeholder. These never get an Account row, so
   // they can never sign in (see lib/auth.ts's Role.customer sign-in block).
   const customerUserIdByEmail = new Map<string, string>();
   for (const sender of SENDERS) {
      const now = new Date();
      const user = await prisma.user.upsert({
         where: { email: sender.email },
         update: {},
         create: {
            id: crypto.randomUUID(),
            name: sender.name,
            email: sender.email,
            emailVerified: false,
            role: Role.customer,
            createdAt: now,
            updatedAt: now,
         },
      });
      customerUserIdByEmail.set(sender.email, user.id);
   }

   // Live DB ids for the 14 named agents from seed-users.ts, grouped by
   // their informal team so each topic can pick a realistic assignee.
   const agentRows = await prisma.user.findMany({
      where: { email: { in: AGENTS.map((a) => a.email) }, deletedAt: null },
      select: { id: true, email: true, name: true },
   });
   const agentByEmail = new Map(agentRows.map((a) => [a.email, a]));

   const agentsByTeam: Record<
      AgentTeam,
      { id: string; email: string; name: string }[]
   > = {
      billing: [],
      technical: [],
      instructor_success: [],
      general: [],
   };
   for (const agent of AGENTS) {
      const row = agentByEmail.get(agent.email);
      if (!row) {
         throw new Error(
            `Agent "${agent.email}" not found — run "bun run seed:users" first.`
         );
      }
      agentsByTeam[agent.team].push(row);
   }

   let created = 0;

   for (let i = 0; i < TICKET_COUNT; i++) {
      const pool = pickWeighted(POOLS);
      const [subject, body] = pickRandom(pool.pairs);
      const sender = pool.persona
         ? pickFromPersona(pool.persona)
         : pickRandom(SENDERS);
      const status = pickWeighted(STATUS_WEIGHTS);
      const createdAt = randomRecentDate();

      const thread = generateThread({
         pool,
         status,
         createdAt,
         agentsByTeam,
         aiAssistantUserId: aiAssistantUser.id,
         customerUserId: customerUserIdByEmail.get(sender.email)!,
         customerName: sender.name,
      });

      const updatedAt =
         thread.replies.length > 0
            ? thread.replies[thread.replies.length - 1]!.createdAt
            : createdAt;

      const ticket = await prisma.ticket.create({
         data: {
            subject,
            body,
            senderName: sender.name,
            senderEmail: sender.email,
            category: pool.category,
            status,
            assignedToId: thread.assignedToId,
            createdAt,
            updatedAt,
         },
      });

      if (thread.replies.length > 0) {
         await prisma.ticketReply.createMany({
            data: thread.replies.map((reply) => ({
               body: reply.body,
               ticketId: ticket.id,
               authorId: reply.authorId,
               senderType: reply.senderType,
               createdAt: reply.createdAt,
            })),
         });
      }

      created++;
   }

   console.log(
      `Seeded ${created} tickets with reply threads, and ${customerUserIdByEmail.size} customer users.`
   );
}

main()
   .catch((error) => {
      console.error(error);
      process.exitCode = 1;
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
