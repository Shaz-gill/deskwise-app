import 'dotenv/config';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import prisma from '../../db';
import { KnowledgeDocStatus, Role } from '../../generated/prisma/enums';
import { ingestDocument } from '../../lib/knowledge-base/ingest-document';
import { deleteDocVectors } from '../../lib/knowledge-base/pinecone';
import {
   deleteKnowledgeFile,
   saveKnowledgeFile,
} from '../../lib/knowledge-base/storage';

// Dev-only seed: generates public-facing help-center PDFs for "Pathlight
// Academy" (the fictional LMS demo tenant also used by seed-tickets.ts) and
// loads them into the knowledge base — the same end state as uploading them
// by hand via Settings, minus the HTTP round trip. One article per
// seed-tickets.ts topic, so AI classification/auto-resolve always has real
// grounding content. Idempotent by full wipe-then-recreate: every run
// deletes all existing KnowledgeDoc rows (+ their Pinecone vectors + PDF
// files) and regenerates all 10 fresh, rather than skipping existing ones —
// this means every run re-embeds everything (OpenAI + Pinecone calls each
// time), a deliberate tradeoff for reseed-safety over free no-op reruns.
//
// Policy figures below (refund window, payout schedule, certificate
// thresholds, etc.) must match seed-tickets.ts's content pools exactly —
// they're the same invented policy, authored once and reused in both
// places.

type Block =
   | { kind: 'paragraph'; text: string }
   | { kind: 'heading'; text: string }
   | { kind: 'list'; items: string[]; ordered: boolean }
   | { kind: 'faq'; items: { q: string; a: string }[] };

interface DocSpec {
   filename: string;
   title: string;
   summary: string;
   prerequisites: string[];
   steps: string[];
   expectedOutcome: string;
   troubleshooting: string[];
   faq: { q: string; a: string }[];
}

function buildBlocks(doc: DocSpec): Block[] {
   const blocks: Block[] = [{ kind: 'paragraph', text: doc.summary }];

   if (doc.prerequisites.length > 0) {
      blocks.push({ kind: 'heading', text: 'Prerequisites' });
      blocks.push({ kind: 'list', items: doc.prerequisites, ordered: false });
   }

   blocks.push({ kind: 'heading', text: 'Steps' });
   blocks.push({ kind: 'list', items: doc.steps, ordered: true });

   blocks.push({ kind: 'heading', text: 'Expected Outcome' });
   blocks.push({ kind: 'paragraph', text: doc.expectedOutcome });

   blocks.push({ kind: 'heading', text: 'Troubleshooting & Common Errors' });
   blocks.push({ kind: 'list', items: doc.troubleshooting, ordered: false });

   if (doc.faq.length > 0) {
      blocks.push({ kind: 'heading', text: 'FAQ' });
      blocks.push({ kind: 'faq', items: doc.faq });
   }

   return blocks;
}

const DOCS: DocSpec[] = [
   {
      filename: 'refund-policy.pdf',
      title: 'Refunds at Pathlight Academy',
      summary:
         'How and when you can request a refund for a Pathlight Academy course purchase, and what to expect once a refund is approved.',
      prerequisites: [
         'A Pathlight Academy account with the purchase you want refunded',
         'The order confirmation email or order number (optional, speeds things up)',
      ],
      steps: [
         'Go to My Courses and open the course you want a refund for.',
         'Select Request Refund from the course options menu.',
         'Confirm the reason for your refund request.',
         "Submit the request — you'll get a confirmation email right away.",
      ],
      expectedOutcome:
         "If your purchase is within 14 days and you've watched less than 20% of the course, the refund is approved automatically and returned to your original payment method within 5-7 business days (an additional 3-10 days may be needed for it to appear on your statement, depending on your bank).",
      troubleshooting: [
         "Refund request says 'not eligible': usually means more than 20% of the course has been watched, or the purchase is outside the 14-day window.",
         'No refund button on the course page: gift-purchased courses and courses bought as part of a team license are refunded by contacting support directly rather than self-service.',
         'Refund approved but not received after 10 business days: contact support with your order number so we can trace the transaction with your bank.',
      ],
      faq: [
         {
            q: 'Does the 14-day window start at purchase or at first watch?',
            a: 'It starts at the purchase date, not when you first open the course.',
         },
         {
            q: "Can I get a partial refund if I've watched more than 20%?",
            a: 'No — refunds are all-or-nothing and only available under the 20%-watched threshold.',
         },
         {
            q: 'Are bundle or subscription purchases refunded the same way?',
            a: 'Bundle and subscription purchases are prorated rather than refunded in full; contact support for a breakdown.',
         },
      ],
   },
   {
      filename: 'duplicate-and-failed-charges.pdf',
      title: 'Fixing Duplicate or Failed Charges',
      summary:
         'What to do if you see more than one charge from Pathlight Academy, or a charge that never should have completed.',
      prerequisites: [
         'Your bank or card statement showing the charge(s) in question',
      ],
      steps: [
         'Check your order history in Account Settings to see which charges match a completed order.',
         'If you see two charges for what should be one order, note both charge dates/amounts.',
         "Contact support with the charge details if the duplicate hasn't resolved itself within 3 business days.",
         "For a charge still marked 'pending' on your statement, wait — most pending failed charges clear on their own.",
      ],
      expectedOutcome:
         "A duplicate charge created by a retried failed payment is detected and reversed automatically within 3 business days. A failed charge that still shows as 'pending' drops off your statement within 5-7 business days and is never actually captured.",
      troubleshooting: [
         'Two charges for the same order: almost always caused by retrying payment after a checkout error — the first attempt is reversed automatically.',
         "Charge amount doesn't match the course price: check for currency conversion by your bank, which can show a slightly different amount than the listed price.",
         'Charge with no matching order: contact support with the exact charge date/amount so we can trace it — it may belong to a different Pathlight account.',
      ],
      faq: [
         {
            q: 'Will a duplicate charge reverse itself, or do I need to request it?',
            a: "It reverses automatically within 3 business days — no request needed, though support can speed up the check if it's been longer.",
         },
         {
            q: 'Why was I charged if checkout showed an error?',
            a: "The error means the charge failed to complete — your bank may show it as pending briefly, but it's never actually captured.",
         },
      ],
   },
   {
      filename: 'course-access-after-purchase.pdf',
      title: 'Course Access After Purchase',
      summary:
         "What to expect right after buying a course, and how to fix it if the course doesn't appear in My Courses.",
      prerequisites: [],
      steps: [
         'After checkout, go to My Courses and refresh the page.',
         "Confirm you're signed into the same account used at checkout (check the email in the top-right menu).",
         "If the course still isn't listed after 15 minutes, check your order confirmation email for the account it was billed to.",
         "Contact support with your order number if access still hasn't appeared.",
      ],
      expectedOutcome:
         'Access is granted instantly on successful payment, and is lifetime access with no expiry — it even survives the instructor later unpublishing the course.',
      troubleshooting: [
         'Course missing right after purchase: payment may still be processing, which can take up to 15 minutes.',
         "Course missing even after 15+ minutes: the purchase likely went to a different account than the one you're currently signed into.",
         'Gifted course not showing for the recipient: the recipient needs to accept the gift link from their confirmation email before it appears in their account.',
      ],
      faq: [
         {
            q: 'Does my access expire?',
            a: 'No — course access is lifetime, with no expiration date.',
         },
         {
            q: 'What happens to my access if the instructor removes the course from Pathlight?',
            a: 'You keep access — purchased courses are grandfathered in even if the instructor unpublishes them later.',
         },
      ],
   },
   {
      filename: 'video-playback-troubleshooting.pdf',
      title: 'Video Playback Troubleshooting',
      summary:
         'Steps to resolve buffering, missing audio, blank players, and other common video playback problems.',
      prerequisites: [
         'A supported browser (the latest two major versions of Chrome, Firefox, Safari, or Edge) or the current version of the Pathlight mobile app',
      ],
      steps: [
         'Switch to the HTML5 player via the Settings gear icon on the video player, then Player Version.',
         "Clear your browser's cache and reload the lecture page.",
         'Confirm your connection speed is at least 5 Mbps for smooth streaming.',
         "If using the mobile app, confirm you're on the latest version from your app store.",
      ],
      expectedOutcome:
         "Playback should resume smoothly in the HTML5 player at your connection's supported resolution, with working audio, captions, and speed controls.",
      troubleshooting: [
         'Persistent buffering: almost always a connection-speed issue — 5 Mbps is the recommended minimum for standard-definition playback.',
         'No audio: try the HTML5 player — the legacy player occasionally fails to initialize audio on certain browsers.',
         'Offline downloads missing after an app update: the offline cache is cleared on major app updates; downloads need to be redone, and are capped at 5 courses at a time.',
         "Captions not appearing: confirm the lecture actually has captions available (not every lecture does) before assuming it's a bug.",
      ],
      faq: [
         {
            q: 'How many courses can I download for offline viewing at once?',
            a: 'Up to 5 courses at a time on the mobile app.',
         },
         {
            q: 'Which browsers are officially supported?',
            a: 'The latest two major versions of Chrome, Firefox, Safari, and Edge.',
         },
      ],
   },
   {
      filename: 'certificates-of-completion.pdf',
      title: 'Certificates of Completion',
      summary:
         "How certificates are earned, when they're issued, and how to fix common certificate problems.",
      prerequisites: [
         "100% of the course's lectures marked complete",
         'A passing score (70% or higher) on any graded quizzes in the course',
      ],
      steps: [
         'Complete every lecture in the course, marking each one as watched.',
         'Pass any graded quizzes at 70% or higher.',
         'Wait up to 24 hours for the certificate to generate automatically.',
         "Download it from the course's Certificate tab once it appears.",
      ],
      expectedOutcome:
         'A certificate is issued automatically within 24 hours of meeting both requirements, and can be downloaded as a PDF from the course page.',
      troubleshooting: [
         'Certificate not appearing after 24+ hours: double-check every lecture is marked complete, including any that may have been skipped.',
         "Certificate section is missing entirely: some free mini-courses are marked 'non-certified' by the instructor and don't offer certificates at all.",
         "Name is misspelled on the certificate: contact support to correct it — it's pulled from your account's display name at the time of issuance, and a one-time manual correction is available.",
         'Download button errors out: try re-downloading from a desktop browser rather than the mobile app.',
      ],
      faq: [
         {
            q: 'Do all courses offer a certificate?',
            a: "No — a small number of free mini-courses are marked non-certified by the instructor and don't issue one.",
         },
         {
            q: 'What quiz score do I need to pass?',
            a: '70% or higher on any graded quiz in the course.',
         },
      ],
   },
   {
      filename: 'login-and-two-factor-authentication.pdf',
      title: 'Login & Two-Factor Authentication (2FA)',
      summary:
         'How to set up 2FA, recover access if you lose your authenticator device, and resolve common sign-in issues.',
      prerequisites: [
         'An authenticator app that supports TOTP (e.g. Google Authenticator, Authy) — Pathlight 2FA does not support SMS codes',
      ],
      steps: [
         'Go to Settings -> Security and select Enable Two-Factor Authentication.',
         'Scan the QR code with your authenticator app.',
         'Save the 10 single-use backup codes shown at setup somewhere safe.',
         'Enter a code from your app to confirm setup is complete.',
      ],
      expectedOutcome:
         'Future sign-ins will prompt for a 6-digit code from your authenticator app in addition to your password.',
      troubleshooting: [
         "Authenticator code rejected: codes rotate every 30 seconds — make sure your device's clock is accurate.",
         'Lost your authenticator device: use one of your 10 backup codes to sign in, then re-enroll a new device from Settings.',
         "Lost both your device and your backup codes: contact support — recovery requires identity verification via your account's original email plus two account-history questions, and takes about 1 business day.",
         'Too many failed login attempts: wait 15 minutes before trying again, or request a password reset.',
      ],
      faq: [
         {
            q: 'Does Pathlight support SMS-based 2FA?',
            a: 'No — only TOTP authenticator apps are supported.',
         },
         {
            q: 'How many backup codes do I get?',
            a: '10 single-use backup codes, issued when you first enable 2FA.',
         },
         {
            q: 'How long does lost-device recovery take?',
            a: 'About 1 business day once your identity is verified.',
         },
      ],
   },
   {
      filename: 'coupons-and-discount-codes.pdf',
      title: 'Coupons & Discount Codes',
      summary:
         'Rules for applying discount codes at checkout and why a code might be rejected.',
      prerequisites: [],
      steps: [
         'Add your course (or courses) to the cart.',
         'Enter your discount code in the Coupon field at checkout.',
         'Confirm the discount is reflected in your order total before completing payment.',
      ],
      expectedOutcome:
         'A valid, unused coupon reduces your order total immediately, before you complete payment.',
      troubleshooting: [
         "'Invalid code' error: the most common causes are an expired code, a code already used once before (most are single-use per customer), or a cart that doesn't meet the code's minimum purchase amount.",
         "Code won't apply alongside another coupon: only one coupon is allowed per order.",
         "Code won't apply to a team license purchase: coupons cannot be combined with team-license bulk pricing.",
         "Found a better code after purchase: codes can't be applied retroactively to a completed order.",
      ],
      faq: [
         { q: 'How many coupons can I use per order?', a: 'One per order.' },
         {
            q: 'Can I combine a coupon with team-license bulk pricing?',
            a: "No, those discounts can't be combined.",
         },
         {
            q: "Can a coupon be applied after I've already purchased?",
            a: 'No — coupons can only be applied at checkout, not retroactively.',
         },
      ],
   },
   {
      filename: 'instructor-payouts-and-revenue-share.pdf',
      title: 'Instructor Payouts & Revenue Share',
      summary:
         'How instructor earnings are calculated and when payouts are issued.',
      prerequisites: [
         'An instructor account with at least one published, purchasable course',
         'A payout method on file (bank transfer or PayPal)',
      ],
      steps: [
         "Go to Instructor Dashboard -> Payouts and add a payout method if you haven't already.",
         'Track your earnings as sales come in under Sales Analytics.',
         'Payouts are calculated automatically at the end of each calendar month.',
         'Funds are sent on the 15th of the following month, provided your balance meets the minimum.',
      ],
      expectedOutcome:
         'You earn 70% revenue share on organic sales (students who found your course directly) and 40% on sales attributed to a Pathlight-run promotion or coupon. Payouts run monthly on the 15th, with a $50 minimum — balances under that roll over to the next month.',
      troubleshooting: [
         'Payout lower than expected: check your Sales Analytics breakdown for how many sales were promotion-attributed (40% share) versus organic (70% share).',
         'No payout issued this month: your balance may be under the $50 minimum threshold — it will roll over automatically.',
         'Payout missing entirely for a month with sales: confirm your payout method is still valid and not expired or removed.',
      ],
      faq: [
         {
            q: "What's the revenue share on organic vs. promoted sales?",
            a: '70% on organic sales, 40% on sales driven by a Pathlight promotion or coupon.',
         },
         {
            q: 'When are payouts sent?',
            a: "Monthly, on the 15th, for the prior calendar month's sales.",
         },
         {
            q: 'Is there a minimum payout amount?',
            a: 'Yes, $50 — balances below that roll over to the following month.',
         },
      ],
   },
   {
      filename: 'course-publishing-and-review.pdf',
      title: 'Course Publishing & Review Process',
      summary:
         'What happens after you submit a course for review, and what the review checks for.',
      prerequisites: [
         'A complete course draft with at least 30 minutes of total runtime',
      ],
      steps: [
         'Finish your course draft, including all lectures, descriptions, and a course thumbnail.',
         'Submit the course for review from the Instructor Dashboard.',
         'Wait up to 3 business days for a decision.',
         'If approved, your course goes live within 24 hours; if rejected, review the written feedback and resubmit anytime.',
      ],
      expectedOutcome:
         'Submitted courses are reviewed within 3 business days for audio/video quality, a minimum 30-minute total runtime, and curriculum completeness, then go live within 24 hours of approval.',
      troubleshooting: [
         "Rejected for audio/video quality: re-record or re-export affected lectures at a higher bitrate and resubmit — there's no waiting period.",
         'Rejected for curriculum completeness: this means the course outline has gaps (e.g. a syllabus item with no matching lecture) — review the written feedback for specifics.',
         'Review taking longer than 3 business days: contact support with your course name so we can check its status.',
         "Need to edit a course that's already live: minor edits (typos, new lectures) don't require re-review; substantial changes to the core curriculum may trigger a new review.",
      ],
      faq: [
         { q: 'How long does the review take?', a: 'Up to 3 business days.' },
         {
            q: 'Is there a minimum course length?',
            a: 'Yes, 30 minutes of total runtime.',
         },
         {
            q: 'Can I resubmit right after a rejection?',
            a: "Yes, anytime — there's no cooldown period.",
         },
      ],
   },
   {
      filename: 'team-and-business-licenses.pdf',
      title: 'Team & Business Licenses',
      summary:
         'How Pathlight for Business seat-based licenses work, and how to manage seats, billing, and admins.',
      prerequisites: [
         "A Pathlight for Business account (ask support to set one up if you don't have one yet)",
      ],
      steps: [
         'Go to the Team Dashboard as a team admin.',
         'Choose a seat block — 5, 20, 50, or 100 seats.',
         'Invite team members by email to fill seats; they accept via an email invite.',
         'Reassign a seat anytime by removing one member and inviting another — no cooldown period.',
      ],
      expectedOutcome:
         "Each invited member gets full course access under your team's license; unused or freed seats can be reassigned immediately.",
      troubleshooting: [
         "Seat still shows occupied after removing a member: reassignment can take a few minutes to reflect — contact support if it's been longer than that.",
         "Discount code not applying to a team purchase: coupons can't be combined with team-license bulk pricing; a 10% discount is applied automatically at 50+ seats instead.",
         'Need an annual invoice instead of monthly billing: available for plans of 20+ seats — request it from the Team Dashboard or through support.',
         "Want a second person to manage the team license: add a co-admin from the Team Dashboard's Admins tab.",
      ],
      faq: [
         {
            q: 'What seat block sizes are available?',
            a: '5, 20, 50, or 100 seats.',
         },
         {
            q: 'Is there a discount for larger teams?',
            a: 'Yes — an automatic 10% discount applies at 50+ seats; 20+ seat plans also qualify for annual invoicing.',
         },
         {
            q: 'Can I reassign a seat right after freeing it up?',
            a: "Yes, anytime — there's no cooldown period.",
         },
      ],
   },
];

const MARGIN = 56;
const PAGE_SIZE: [number, number] = [612, 792]; // US Letter, points
const TITLE_SIZE = 20;
const H2_SIZE = 14;
const BODY_SIZE = 11;
const BULLET_INDENT = 16;

function lineHeightFor(size: number): number {
   return size * 1.4;
}
const PARAGRAPH_GAP = lineHeightFor(BODY_SIZE) * 0.6;
const SECTION_GAP_BEFORE = lineHeightFor(BODY_SIZE) * 1.2;
const SECTION_GAP_AFTER = lineHeightFor(BODY_SIZE) * 0.4;

// pdf-lib measures text but doesn't wrap it for us across drawText calls —
// this greedily packs words onto each line up to the available width.
function wrapText(
   text: string,
   font: Awaited<ReturnType<PDFDocument['embedFont']>>,
   size: number,
   maxWidth: number
): string[] {
   const words = text.split(' ');
   const lines: string[] = [];
   let current = '';

   for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
         lines.push(current);
         current = word;
      } else {
         current = candidate;
      }
   }
   if (current) lines.push(current);

   return lines;
}

async function renderDocPdf(
   title: string,
   blocks: Block[]
): Promise<Uint8Array> {
   const pdfDoc = await PDFDocument.create();
   const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
   const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
   const maxWidth = PAGE_SIZE[0] - MARGIN * 2;

   let page = pdfDoc.addPage(PAGE_SIZE);
   let y = PAGE_SIZE[1] - MARGIN;

   function newPageIfNeeded(requiredHeight: number) {
      if (y - requiredHeight < MARGIN) {
         page = pdfDoc.addPage(PAGE_SIZE);
         y = PAGE_SIZE[1] - MARGIN;
      }
   }

   function drawWrapped(
      lines: string[],
      font: typeof regularFont,
      size: number,
      x = MARGIN
   ) {
      const lh = lineHeightFor(size);
      for (const line of lines) {
         newPageIfNeeded(lh);
         page.drawText(line, { x, y, size, font, color: rgb(0.1, 0.1, 0.1) });
         y -= lh;
      }
   }

   // Headings reserve space for themselves plus one body line so a heading
   // never ends up stranded alone at the bottom of a page.
   function drawHeading(text: string) {
      const lines = wrapText(text, boldFont, H2_SIZE, maxWidth);
      const headingHeight = lines.length * lineHeightFor(H2_SIZE);
      newPageIfNeeded(headingHeight + lineHeightFor(BODY_SIZE));
      y -= SECTION_GAP_BEFORE;
      for (const line of lines) {
         page.drawText(line, {
            x: MARGIN,
            y,
            size: H2_SIZE,
            font: boldFont,
            color: rgb(0, 0, 0),
         });
         y -= lineHeightFor(H2_SIZE);
      }
      y -= SECTION_GAP_AFTER;
   }

   function drawParagraph(text: string, size = BODY_SIZE) {
      drawWrapped(
         wrapText(text, regularFont, size, maxWidth),
         regularFont,
         size
      );
      y -= PARAGRAPH_GAP;
   }

   function drawList(items: string[], ordered: boolean) {
      items.forEach((item, idx) => {
         const prefix = ordered ? `${idx + 1}. ` : '• ';
         const lines = wrapText(
            `${prefix}${item}`,
            regularFont,
            BODY_SIZE,
            maxWidth - BULLET_INDENT
         );
         lines.forEach((line, lineIdx) => {
            const x = lineIdx === 0 ? MARGIN : MARGIN + BULLET_INDENT;
            newPageIfNeeded(lineHeightFor(BODY_SIZE));
            page.drawText(line, {
               x,
               y,
               size: BODY_SIZE,
               font: regularFont,
               color: rgb(0.1, 0.1, 0.1),
            });
            y -= lineHeightFor(BODY_SIZE);
         });
         y -= lineHeightFor(BODY_SIZE) * 0.3;
      });
      y -= PARAGRAPH_GAP * 0.4;
   }

   function drawFaq(items: { q: string; a: string }[]) {
      items.forEach((item) => {
         drawWrapped(
            wrapText(`Q: ${item.q}`, boldFont, BODY_SIZE, maxWidth),
            boldFont,
            BODY_SIZE
         );
         y -= PARAGRAPH_GAP * 0.3;
         drawWrapped(
            wrapText(`A: ${item.a}`, regularFont, BODY_SIZE, maxWidth),
            regularFont,
            BODY_SIZE
         );
         y -= PARAGRAPH_GAP;
      });
   }

   drawWrapped(
      wrapText(title, boldFont, TITLE_SIZE, maxWidth),
      boldFont,
      TITLE_SIZE
   );
   y -= PARAGRAPH_GAP;

   for (const block of blocks) {
      switch (block.kind) {
         case 'paragraph':
            drawParagraph(block.text);
            break;
         case 'heading':
            drawHeading(block.text);
            break;
         case 'list':
            drawList(block.items, block.ordered);
            break;
         case 'faq':
            drawFaq(block.items);
            break;
      }
   }

   return pdfDoc.save();
}

async function main() {
   const uploader =
      (await prisma.user.findFirst({ where: { role: Role.admin } })) ??
      (await prisma.user.findFirst());

   if (!uploader) {
      throw new Error(
         'No users found — run `bun run seed` or `bun run seed:users` first so there is an uploader to attribute these docs to.'
      );
   }

   // Full wipe before recreating, so this script is idempotent (same 10
   // articles every run) rather than skip-if-exists — clean up Pinecone
   // vectors and the on-disk file for every existing doc before dropping
   // its row.
   const existingDocs = await prisma.knowledgeDoc.findMany();
   for (const doc of existingDocs) {
      try {
         await deleteDocVectors(doc.id);
      } catch (err) {
         console.error(`Failed to clean up vectors for ${doc.filename}:`, err);
      }
      await prisma.knowledgeDoc.delete({ where: { id: doc.id } });
      await deleteKnowledgeFile(doc.path);
   }

   let created = 0;

   for (const doc of DOCS) {
      const pdfBytes = await renderDocPdf(doc.title, buildBlocks(doc));
      const storedPath = await saveKnowledgeFile(
         Buffer.from(pdfBytes),
         doc.filename
      );

      const row = await prisma.knowledgeDoc.create({
         data: {
            filename: doc.filename,
            path: storedPath,
            status: KnowledgeDocStatus.processing,
            uploadedById: uploader.id,
         },
      });

      // Ingest inline rather than via the pg-boss queue (jobs/ingest-document
      // -job.ts) — this is a one-off script, not the running server, so
      // there's no worker listening; running the same pipeline directly
      // keeps this script self-contained.
      try {
         const { chunkCount } = await ingestDocument({
            docId: row.id,
            storedPath,
            filename: doc.filename,
         });
         await prisma.knowledgeDoc.update({
            where: { id: row.id },
            data: { status: KnowledgeDocStatus.ready, chunkCount },
         });
         console.log(`Seeded ${doc.filename} (${chunkCount} chunks).`);
      } catch (err) {
         const message =
            err instanceof Error ? err.message : 'Ingestion failed';
         await prisma.knowledgeDoc.update({
            where: { id: row.id },
            data: { status: KnowledgeDocStatus.failed, error: message },
         });
         console.error(`Ingestion failed for ${doc.filename}: ${message}`);
      }

      created++;
   }

   console.log(
      `Done. Recreated ${created} article(s) (${existingDocs.length} previous doc(s) wiped first).`
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
