# AWS Setup (SES + S3)

## Status for this project

Current `packages/server/.env` values (actual keys never go in this file — see `.env` directly):

| Variable | Value |
|---|---|
| `AWS_REGION` | `ap-southeast-2` |
| `SES_FROM_EMAIL` | `support@shahzadtariq.com` |
| `SES_FROM_NAME` | `Deskwise Customer Support` |
| `KNOWLEDGE_BASE_S3_BUCKET` | `deskwise-kb` |

- Domain `shahzadtariq.com` already lives in Route 53 and is **verified** in SES (DKIM + custom MAIL FROM `mail.shahzadtariq.com` set up).
- Verified test-recipient email: `1994.shahzadtariq@gmail.com` (use this as the "customer" address for test tickets while SES is in sandbox mode — see step 2 below).
- S3 bucket `deskwise-kb` lives in the same region, `ap-southeast-2`.
- IAM user `deskwise-app` (keys in `.env`, confirmed working via `aws sts get-caller-identity`) has `AmazonSESFullAccess` + `AmazonS3FullAccess`.

Rest of this doc is the general step-by-step in case any of the above ever needs to be redone (new AWS account, new domain, bucket recreated, etc).

Personal setup notes for wiring up the two AWS features this project uses:

- **SES** (`packages/server/lib/email/send-email.ts`) — sends outbound ticket-reply emails.
- **S3** (`packages/server/lib/knowledge-base/storage.ts`) — stores knowledge-base documents.

Both are optional/no-op when unconfigured (see `CLAUDE.md`), but here's how to actually turn them on.

## 0. Prerequisite: an AWS account

Sign up at aws.amazon.com if you don't have one. Free-tier/basic support is fine.

## 1. Create one IAM user + access key (used by both SES and S3)

1. AWS Console → search **IAM** → **Users** → **Create user**.
2. Name it e.g. `deskwise-app`.
3. Permissions: **Attach policies directly** → check `AmazonSESFullAccess` and `AmazonS3FullAccess`.
4. Create the user, open it, go to **Security credentials** tab → **Create access key**.
5. Choose **"Application running outside AWS"**.
6. Copy the **Access Key ID** and **Secret Access Key** immediately — AWS never shows the secret again.

Note: these keys are only for local dev. In production (e.g. an EC2 instance), omit `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` from `.env` entirely and let the SDK pick up credentials from the instance's IAM role instead — same pattern noted in `packages/server/.env.example`.

## 2. Set up SES (outbound email)

### If you own a domain already in Route 53 (recommended — this is what was done for `shahzadtariq.com`)

1. AWS Console → **SES** → note the region (top-right) → **Identities** → **Create identity**.
2. Choose **Domain**, enter your domain, leave default DKIM setup checked → **Create identity**.
3. SES lists the DNS records it needs → click **Publish DNS records to Route 53** (auto-creates them, no manual copy-paste).
4. Wait a few minutes, refresh → status should show **Verified**.
5. Once the domain is verified, you can send from *any* address `@yourdomain.com` without separately verifying it (e.g. `support@yourdomain.com`).
6. Optional, more production-grade: on the identity page, set a **Custom MAIL FROM domain** (e.g. `mail.yourdomain.com`) and let SES publish those records to Route 53 too.

### If you don't have a domain

1. Same **Create identity** flow, but choose **Email address** instead, enter the address, and click the confirmation link AWS emails you.

### Sandbox mode (applies either way)

New AWS accounts start SES in **sandbox mode**: you can only send *to* addresses that are also verified in SES, no matter how you verify the "from" side. For testing:

1. Also add your own personal inbox as an **Email address** identity (verify it the same way) — use that as the test "customer" recipient.
2. When ready to email real, non-verified customers, go to **SES → Account dashboard → Request production access** and fill in the short form. Usually approved within a day. Not needed for local dev/testing.

## 3. Set up S3 (knowledge-base document storage)

1. AWS Console → **S3** → **Create bucket**.
2. Give it a globally unique name (bucket names are shared across all AWS accounts).
3. Pick the **same region** as SES.
4. Leave **Block all public access** ON — these files should never be public.
5. Create the bucket. No extra bucket policy needed — the IAM user from step 1 already has `AmazonS3FullAccess`.

## 4. Fill in `packages/server/.env`

```
AWS_REGION=<region you picked, e.g. us-east-1>
AWS_ACCESS_KEY_ID=<from step 1>
AWS_SECRET_ACCESS_KEY=<from step 1>
SES_FROM_EMAIL=<a verified email, or any address @your-verified-domain>
SES_FROM_NAME=<display name, defaults to "Customer Support" if unset>
KNOWLEDGE_BASE_S3_BUCKET=<bucket name from step 3>
```

Leaving `AWS_REGION`/`SES_FROM_EMAIL` unset disables SES only (logs and skips the send). Leaving `KNOWLEDGE_BASE_S3_BUCKET` unset falls back to local disk storage at `/knowledge-base`. Neither is required for the app to run.

Restart the server (`bun run dev`) after editing `.env`.

## 5. Verify it's actually live

```bash
aws sts get-caller-identity                                  # confirms the access key works
aws s3api head-bucket --bucket deskwise-kb                   # confirms the bucket exists & is reachable
aws sesv2 get-email-identity --email-identity shahzadtariq.com   # confirms SES verification status
```

Last confirmed working: 2026-10-04 — IAM resolves to `deskwise-app`, bucket reachable in `ap-southeast-2`, SES domain `VerificationStatus: SUCCESS` with DKIM `SigningEnabled: true`.

## 6. End-to-end test

**SES** — create a test ticket "from" your verified test recipient, then reply to it in the dashboard and confirm the email actually lands in that inbox:

```bash
curl -X POST http://localhost:3000/api/tickets/inbound-email \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: <WEBHOOK_SECRET from .env>" \
  -d '{"from":"1994.shahzadtariq@gmail.com","fromName":"Test Customer","subject":"Test ticket","body":"Does email work?"}'
```

Log into the dashboard (`ADMIN_EMAIL`/`ADMIN_PASSWORD` from `.env`), find the ticket, reply, and check the test inbox.

**S3** — seed the demo knowledge base, which uploads real PDFs to the bucket:

```bash
cd packages/server
bun run seed:knowledge-base
aws s3 ls s3://deskwise-kb/
```

The 10 seeded docs should show up both in the `aws s3 ls` output and on the dashboard's Knowledge Base page.
