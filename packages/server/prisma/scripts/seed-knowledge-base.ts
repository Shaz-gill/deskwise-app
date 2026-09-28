import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import prisma from '../../db';
import { KnowledgeDocStatus, Role } from '../../generated/prisma/enums';
import {
   ensureKnowledgeBaseDir,
   KNOWLEDGE_BASE_DIR,
} from '../../lib/knowledge-base/path';
import { ingestDocument } from '../../lib/knowledge-base/ingest-document';
import { deleteDocVectors } from '../../lib/knowledge-base/pinecone';

// Dev-only seed: generates a handful of realistic PDF support-policy docs
// and loads them straight into the knowledge base — the same end state as
// uploading them by hand via Settings, minus the HTTP round trip. Content
// mirrors the e-commerce domain seed-tickets.ts uses (shipping, returns,
// gift cards, sizing, accounts) so the docs are actually useful context for
// AI-suggested replies to those tickets. Idempotent by filename: re-running
// skips any doc whose PDF already exists, so it's safe to re-run after a
// partial failure (e.g. Pinecone not configured yet).
const DOCS: { filename: string; title: string; paragraphs: string[] }[] = [
   {
      filename: 'shipping-and-delivery-policy.pdf',
      title: 'Shipping & Delivery Policy',
      paragraphs: [
         'Standard domestic shipping takes 3-5 business days from the date an order ships, not the date it is placed. Orders placed before 1pm ET on a business day usually ship the same day; orders placed after that cutoff, or on a weekend or holiday, ship the next business day.',
         'Expedited shipping (1-2 business days) is available at checkout for an additional fee. Expedited orders placed before 1pm ET ship same day; there is no weekend delivery for expedited orders.',
         'International shipping is available to most countries and typically takes 7-14 business days depending on destination and customs processing. International orders may be subject to import duties and taxes charged by the destination country, which are the customer’s responsibility and are not included in the order total.',
         'A tracking link is emailed automatically as soon as a label is created, usually the same day the order ships. If a tracking number shows no movement for more than 5 business days, or a package is marked delivered but the customer says it never arrived, open a support ticket so the carrier claim can be filed — do not tell the customer to simply wait longer than that.',
         'We are not able to redirect a package once it has left the warehouse; if the shipping address was entered incorrectly, the customer should contact the carrier directly once the tracking number is live, or wait for the package to be returned to us as undeliverable, at which point it can be reshipped or refunded.',
      ],
   },
   {
      filename: 'returns-and-refunds-policy.pdf',
      title: 'Returns & Refunds Policy',
      paragraphs: [
         'Most items can be returned within 30 days of delivery for a full refund to the original payment method, provided the item is unworn, unwashed, and still has its original tags attached. The 30-day window is measured from the delivery date shown in tracking, not the order date.',
         'Clearance and final-sale items (marked as such on the product page at time of purchase) cannot be returned or exchanged, no exceptions. Gift cards are also non-returnable and non-refundable once purchased.',
         'To start a return, the customer should use the return link in their shipping confirmation email to generate a prepaid return label. Returns sent without using this process, or without the original packing slip, can take longer to process because the order cannot be matched automatically.',
         'Once a return arrives at the warehouse, refunds are typically processed within 3-5 business days. It can take an additional 2-10 business days for the refund to appear on the customer’s statement, depending on their bank — this is normal and not something support can speed up.',
         'Exchanges for a different size or color follow the same 30-day/unworn/tags-attached rule as returns. Rather than a direct swap, we process an exchange as a return plus a new order, so the customer will see a refund and a separate new order confirmation.',
         'If an item arrives damaged or defective, it is returnable regardless of the final-sale status or 30-day window — apologize, confirm the order number, and either issue a replacement or a full refund including any shipping the customer paid, at their preference.',
      ],
   },
   {
      filename: 'order-changes-and-cancellations.pdf',
      title: 'Order Changes & Cancellations',
      paragraphs: [
         'Orders can only be modified or cancelled while they are still in "Processing" status, which usually lasts a few hours after the order is placed. Once an order moves to "Preparing to ship" or later, it can no longer be changed or cancelled through support — the customer will need to wait for delivery and use the standard returns process instead.',
         'Shipping address changes follow the same rule: they can only be made while the order is still in Processing status. If the order has already moved past that stage, do not attempt to change the address in the system — it will not update the shipping label.',
         'Two separate orders placed by the same customer cannot be manually combined into a single shipment once either order has started processing, even if both are still unshipped, because they are already assigned to separate fulfillment batches.',
         'A cancelled order is refunded automatically and in full to the original payment method; there is no cancellation fee. The customer should see the refund reflected within 3-5 business days, following the same bank-processing timeline as a standard return refund.',
         'If a customer wants to cancel because an item is listed as backordered or out of stock, offer to cancel just that line item (partial cancellation) rather than the whole order when the order contains other in-stock items, so the rest of the order is not delayed.',
      ],
   },
   {
      filename: 'gift-cards-and-discount-codes.pdf',
      title: 'Gift Cards & Discount Codes',
      paragraphs: [
         'Digital gift cards are delivered by email, usually within a few minutes of purchase, and do not expire — the balance remains on the account indefinitely. If a gift card email has not arrived after 30 minutes, check the recipient’s spam folder before escalating; delivery delays on our end are rare.',
         'A gift card balance can be checked at any time from the account page, or by using the gift card code at checkout, which will show the remaining balance without completing a purchase.',
         'Only one discount code can be applied per order. If a customer has two codes they want to use, they will need to choose one for this order and can typically use the other on a future purchase, provided it has not expired.',
         'Discount codes and gift cards can be combined — a discount code reduces the order subtotal, and a gift card is then applied against the discounted total as a separate payment method.',
         'If a code is rejected as invalid at checkout, the most common causes are: the code has expired, it has already been used once (most codes are single-use per customer), the cart does not meet the code’s minimum purchase amount, or the code is restricted to certain product categories that are not in the cart. Ask the customer what the checkout error said before assuming the code is simply broken.',
      ],
   },
   {
      filename: 'sizing-and-product-care-guide.pdf',
      title: 'Sizing & Product Care Guide',
      paragraphs: [
         'Each product page includes a size chart specific to that item’s fit — sizing is not standardized across all products, so a customer’s usual size in one style will not always match a different style. When a customer asks whether an item runs small or large, check that specific product’s page notes rather than giving a general answer, since fit varies by fabric and cut.',
         'As a general guideline, structured items like denim and outerwear tend to run true to size, while jersey and knit items (t-shirts, hoodies) tend to run slightly oversized by design — customers between two sizes are usually advised to size down for a more fitted look, or stay true to size for a relaxed fit.',
         'Care instructions are listed on the product page and on the garment’s tag. As a general rule, most cotton and cotton-blend items should be machine washed cold and tumble dried low or hung to dry; anything with delicate trims, embroidery, or a wool blend should be hand washed or dry cleaned to avoid shrinkage or damage.',
         'When an item a customer wants is out of stock, they can enter their email on the product page to be notified automatically the moment it is restocked. Support cannot provide an exact restock date, since restock timing depends on the manufacturing and shipping schedule, but can confirm whether an item is expected to return at all versus discontinued.',
      ],
   },
   {
      filename: 'account-and-loyalty-program-faq.pdf',
      title: 'Account & Loyalty Program FAQ',
      paragraphs: [
         'Creating an account is optional — customers can check out as a guest, but an account lets them track orders, save addresses, and earn loyalty points. An account can be created after the fact using the same email address that was used for a guest order, which will automatically link past guest orders to the new account.',
         'Password resets are self-service via the "Forgot password" link on the sign-in page, which emails a reset link valid for 24 hours. If the email does not arrive, check spam first; support can manually trigger a new reset email if needed but cannot see or reset a password directly for security reasons.',
         'The loyalty program awards 1 point per dollar spent on completed orders (after any discounts, before tax and shipping). Points are credited once an order ships, not at the time of purchase, and are automatically deducted if the related items are later returned.',
         'Points can be redeemed at checkout in increments of 100 points for $5 off, up to a maximum of 50% of the order subtotal per order. Redeemed points that are later reversed due to a return are re-credited back to the customer’s account.',
         'Loyalty tiers (Bronze, Silver, Gold) are based on total points earned in the trailing 12 months and unlock perks like free expedited shipping and early access to sales. Tier status is recalculated automatically at the start of each month; support cannot manually upgrade a customer’s tier outside of that cycle.',
      ],
   },
];

const MARGIN = 56;
const PAGE_SIZE: [number, number] = [612, 792]; // US Letter, points
const TITLE_SIZE = 20;
const BODY_SIZE = 11;
const LINE_HEIGHT = BODY_SIZE * 1.4;
const PARAGRAPH_GAP = LINE_HEIGHT * 0.6;

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
   paragraphs: string[]
): Promise<Uint8Array> {
   const pdfDoc = await PDFDocument.create();
   const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
   const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
   const maxWidth = PAGE_SIZE[0] - MARGIN * 2;

   let page = pdfDoc.addPage(PAGE_SIZE);
   let y = PAGE_SIZE[1] - MARGIN;

   function newPageIfNeeded(lineCount: number) {
      const needed = lineCount * LINE_HEIGHT;
      if (y - needed < MARGIN) {
         page = pdfDoc.addPage(PAGE_SIZE);
         y = PAGE_SIZE[1] - MARGIN;
      }
   }

   function drawLines(lines: string[], font: typeof regularFont, size: number) {
      for (const line of lines) {
         newPageIfNeeded(1);
         page.drawText(line, {
            x: MARGIN,
            y,
            size,
            font,
            color: rgb(0.1, 0.1, 0.1),
         });
         y -= LINE_HEIGHT;
      }
   }

   drawLines(
      wrapText(title, boldFont, TITLE_SIZE, maxWidth),
      boldFont,
      TITLE_SIZE
   );
   y -= PARAGRAPH_GAP;

   for (const paragraph of paragraphs) {
      drawLines(
         wrapText(paragraph, regularFont, BODY_SIZE, maxWidth),
         regularFont,
         BODY_SIZE
      );
      y -= PARAGRAPH_GAP;
   }

   return pdfDoc.save();
}

async function main() {
   await ensureKnowledgeBaseDir();

   const uploader =
      (await prisma.user.findFirst({ where: { role: Role.admin } })) ??
      (await prisma.user.findFirst());

   if (!uploader) {
      throw new Error(
         'No users found — run `bun run seed` or `bun run seed:users` first so there is an uploader to attribute these docs to.'
      );
   }

   let created = 0;
   let skipped = 0;

   for (const doc of DOCS) {
      const existing = await prisma.knowledgeDoc.findFirst({
         where: { filename: doc.filename },
      });
      if (existing) {
         const fileExists = await fs
            .access(existing.path)
            .then(() => true)
            .catch(() => false);

         if (fileExists) {
            console.log(`Skipping ${doc.filename} — already seeded.`);
            skipped++;
            continue;
         }

         // The DB row survived but the file (and this script's own
         // idempotency check) didn't — e.g. the gitignored knowledge-base/
         // directory was wiped, or this DB was reused on a fresh clone
         // without it. Clean up the stale row/vectors instead of silently
         // leaving a "Ready" doc whose View button 404s, then fall through
         // to recreate it fresh below.
         console.log(
            `${doc.filename} has a DB row but no file on disk — recreating.`
         );
         try {
            await deleteDocVectors(existing.id);
         } catch (err) {
            console.error(
               `Failed to clean up stale vectors for ${doc.filename}:`,
               err
            );
         }
         await prisma.knowledgeDoc.delete({ where: { id: existing.id } });
      }

      const pdfBytes = await renderDocPdf(doc.title, doc.paragraphs);
      const storedFilename = `${crypto.randomUUID()}-${doc.filename}`;
      const filePath = path.join(KNOWLEDGE_BASE_DIR, storedFilename);
      await fs.writeFile(filePath, pdfBytes);

      const row = await prisma.knowledgeDoc.create({
         data: {
            filename: doc.filename,
            path: filePath,
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
            filePath,
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
      `Done. Created ${created}, skipped ${skipped} (already existed).`
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
