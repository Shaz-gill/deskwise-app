# CI/CD setup

`ci-cd.yml` has two jobs:

- **test** (every PR and every push to `master`): `bun install`, a Prettier
  format check, `prisma generate` + `tsc --noEmit` for the server, and
  `tsc -b && vite build` for the client. Client lint is intentionally left
  out — `bun run lint` currently crashes because the installed
  `typescript@7.0.2` isn't supported yet by `typescript-eslint@8.67.0`; see
  the Roadmap in the root `README.md`.
- **deploy** (push to `master` only, after `test` passes): builds both
  Docker images, pushes them to ECR, then tells the EC2 host (over SSM, not
  SSH) to pull and restart them.

Everything below is **one-time setup you do by hand** — console or AWS CLI —
before the `deploy` job can run. There's no Terraform/CDK for this yet (it's
on the roadmap); until then, this doc is the only record of how it's wired,
so keep it in sync if you change any ARN, repo name, or script by hand on the
box.

This account/repo's concrete values, filled in below wherever the steps used
to say `<ACCOUNT_ID>` / `<REGION>` / `<GITHUB_ORG>/<REPO>`:

- Account ID: `798256686602`
- Region: `ap-southeast-2`
- GitHub repo: `Shaz-gill/deskwise-app`
- EC2 instance ID: `i-0bc1179bb147e01bb` (public IP `3.106.171.37` at time of
  writing — re-check if the instance is ever stopped/started, since that
  rotates)
- GitHub Actions deploy role ARN: `arn:aws:iam::798256686602:role/deskwise-deploy`

**Important deviation from step 5 below:** this instance already had the app
manually deployed at `/home/ec2-user/deskwise-app/` (a full git checkout,
`docker compose up` run directly from there) _before_ CI/CD was set up —
`docker ps` showed live, 2-day-old containers with real Postgres data.
Rather than migrate that to `/opt/deskwise/` (which risks orphaning the
Postgres volume, since Compose ties default volume names to the project
directory), `/opt/deskwise/deploy.sh` was pointed at the existing directory
instead. So: **the deploy script lives at `/opt/deskwise/deploy.sh`, but
`cd`s into `/home/ec2-user/deskwise-app`, which is also where the real
`.env` and `docker-compose.yml` live** — not `/opt/deskwise/` as originally
written below. Keep this in sync if that ever changes.

Progress on this account, as of 2026-10-06:

- [x] Step 1 — OIDC provider already existed on this account
- [x] Step 2 — IAM role created (named `deskwise-deploy`); trust policy
      required the `@ID`-suffixed `sub` pattern below, not the plain one —
      see the gotcha note under step 2
- [x] Step 3 — ECR repos created
- [x] Step 4 — EC2 instance role updated (SSM + ECR-read attached to
      `deskwise-ec2-role`; confirmed instance shows Online in Fleet Manager)
- [x] Step 5 — deploy script placed at `/opt/deskwise/deploy.sh`, pointed at
      the real app directory per the note above; `ECR_REGISTRY`/`IMAGE_TAG`
      added to the existing `~/deskwise-app/.env`
- [x] Step 6 — GitHub secrets/variables set (`VITE_SENTRY_*` deliberately
      skipped, see step 6 below)

## 1. GitHub OIDC identity provider (once per AWS account) — done

Skip this if the account already has a GitHub OIDC provider (e.g. from
another repo) — `aws iam list-open-id-connect-providers` will show
`token.actions.githubusercontent.com` if so. **Already true for this
account** (confirmed via that command), so there's nothing to run here.

```bash
aws iam create-open-id-connect-provider \
   --url "https://token.actions.githubusercontent.com" \
   --client-id-list "sts.amazonaws.com" \
   --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1"
```

**Console instead:** IAM → Identity providers → Add provider → provider
type **OpenID Connect** → Provider URL `https://token.actions.githubusercontent.com`
(click **Get thumbprint**) → Audience `sts.amazonaws.com` → Add provider.

## 2. IAM role GitHub Actions assumes

Trust policy — scoped to this repo's `master` branch only, since that's the
only ref the `deploy` job ever runs on:

```json
{
   "Version": "2012-10-17",
   "Statement": [
      {
         "Effect": "Allow",
         "Principal": {
            "Federated": "arn:aws:iam::798256686602:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
            "StringEquals": {
               "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
            },
            "StringLike": {
               "token.actions.githubusercontent.com:sub": [
                  "repo:Shaz-gill/deskwise-app:ref:refs/heads/master",
                  "repo:Shaz-gill@*/deskwise-app@*:ref:refs/heads/master"
               ]
            }
         }
      }
   ]
}
```

**Gotcha hit on this account:** the first version of this trust policy used
only the plain `repo:Shaz-gill/deskwise-app:ref:refs/heads/master` pattern
and got `AccessDenied: Not authorized to perform sts:AssumeRoleWithWebIdentity`
on every run. CloudTrail (`Event history`, filter `AssumeRoleWithWebIdentity`)
showed the real `sub` claim GitHub sends is
`repo:Shaz-gill@181646995/deskwise-app@1337083899:ref:refs/heads/master` —
GitHub now embeds immutable numeric IDs for the account and repo alongside
their names. The second pattern above (`@*` right after each name) matches
that format; the `@` anchor makes it safe from accidentally matching an
unrelated account/repo, since `@` can't appear mid-name. The Gameverse
project's role instead hardcodes the literal IDs with `StringEquals` (no
wildcard) — either approach works, but the wildcard version here tolerates
GitHub changing the ID format again without needing another trust-policy
edit.

Permissions policy — ECR push for exactly the two repos this project uses,
plus SSM to kick off the deploy script on the one instance:

```json
{
   "Version": "2012-10-17",
   "Statement": [
      {
         "Sid": "EcrAuth",
         "Effect": "Allow",
         "Action": "ecr:GetAuthorizationToken",
         "Resource": "*"
      },
      {
         "Sid": "EcrPush",
         "Effect": "Allow",
         "Action": [
            "ecr:BatchCheckLayerAvailability",
            "ecr:InitiateLayerUpload",
            "ecr:UploadLayerPart",
            "ecr:CompleteLayerUpload",
            "ecr:PutImage",
            "ecr:BatchGetImage"
         ],
         "Resource": [
            "arn:aws:ecr:ap-southeast-2:798256686602:repository/deskwise-server",
            "arn:aws:ecr:ap-southeast-2:798256686602:repository/deskwise-client"
         ]
      },
      {
         "Sid": "TriggerDeploy",
         "Effect": "Allow",
         "Action": "ssm:SendCommand",
         "Resource": [
            "arn:aws:ec2:ap-southeast-2:798256686602:instance/i-0bc1179bb147e01bb",
            "arn:aws:ssm:ap-southeast-2::document/AWS-RunShellScript"
         ]
      },
      {
         "Sid": "ReadDeployResult",
         "Effect": "Allow",
         "Action": "ssm:GetCommandInvocation",
         "Resource": "*"
      }
   ]
}
```

(`GetCommandInvocation` can't be scoped to the instance — the command ID,
not the instance, is the only identifier AWS lets you filter on here.)

Create the role with that trust policy, attach that permissions policy, and
note its ARN — it's the `AWS_DEPLOY_ROLE_ARN` secret below.

```bash
aws iam create-role \
   --role-name deskwise-deploy \
   --assume-role-policy-document file://trust-policy.json

aws iam put-role-policy \
   --role-name deskwise-deploy \
   --policy-name deskwise-deploy-permissions \
   --policy-document file://permissions-policy.json

aws iam get-role --role-name deskwise-deploy \
   --query 'Role.Arn' --output text
```

**Console steps:**

1. IAM → left sidebar **Roles** → **Create role**.
2. Trusted entity type: **Web identity**.
3. Identity provider: `token.actions.githubusercontent.com`.
4. Audience: `sts.amazonaws.com`.
5. Click **Next**.
6. Don't check any managed policy on the "Add permissions" screen — click
   **Next** again (permissions get added as an inline policy in step 13).
7. Role name: `deskwise-deploy`.
8. **Create role**, then click into the new role from the Roles list.
9. **Trust relationships** tab → **Edit trust policy**.
10.   Delete the contents and paste the trust policy JSON above.
11.   **Update policy**.
12.   **Permissions** tab → **Add permissions** dropdown → **Create inline policy**.
13.   Click the **JSON** tab in the policy editor → paste the permissions
      policy JSON above.
14.   **Next** → name it `deskwise-deploy-permissions` → **Create policy**.
15.   Back on the role's **Summary** page, copy the **ARN** — that's the
      `AWS_DEPLOY_ROLE_ARN` secret for step 6.

## 3. ECR repositories

```bash
aws ecr create-repository --repository-name deskwise-server --region ap-southeast-2
aws ecr create-repository --repository-name deskwise-client --region ap-southeast-2
```

**Console steps:**

1. ECR → confirm the region dropdown (top right) says **Asia Pacific
   (Sydney) ap-southeast-2**.
2. Left sidebar **Repositories** → **Create repository**.
3. Visibility: **Private**. Repository name: `deskwise-server`.
4. Leave the rest default → **Create repository**.
5. **Create repository** again, name `deskwise-client`, same settings.

## 4. EC2 instance role additions

The instance already has an IAM role for SES + S3 (see root `CLAUDE.md`).
Add to that same role:

- `AmazonSSMManagedInstanceCore` (AWS managed policy) — lets SSM reach the
  box at all. Most current AMIs ship the SSM agent already running; confirm
  the instance shows up in `aws ssm describe-instance-information`.
- Inline permission for `ecr:GetAuthorizationToken` and `ecr:BatchGetImage`
  on the two repo ARNs above — this is what lets `docker login`/`docker
compose pull` on the host actually read from ECR.

**Console steps:**

1. EC2 → **Instances** → click your instance.
2. **Security** tab (in the details panel) → click the **IAM Role** link
   (opens that role in IAM).
3. **Permissions** tab → **Add permissions** dropdown → **Attach policies**.
4. Search `AmazonSSMManagedInstanceCore` → check it → **Add permissions**.
5. **Add permissions** dropdown again → **Create inline policy**.
6. **JSON** tab → paste:

```json
{
   "Version": "2012-10-17",
   "Statement": [
      {
         "Effect": "Allow",
         "Action": "ecr:GetAuthorizationToken",
         "Resource": "*"
      },
      {
         "Effect": "Allow",
         "Action": "ecr:BatchGetImage",
         "Resource": [
            "arn:aws:ecr:ap-southeast-2:798256686602:repository/deskwise-server",
            "arn:aws:ecr:ap-southeast-2:798256686602:repository/deskwise-client"
         ]
      }
   ]
}
```

7. **Next** → name it `deskwise-ecr-read` → **Create policy**.
8. Verify: Systems Manager → **Fleet Manager** → the instance should show
   status **Online** — if it doesn't, the SSM agent isn't running or the
   instance has no outbound network path, a separate problem from the IAM
   permissions above.

## 5. The deploy script on the host

This lives only on the EC2 instance, not in this repo (same reasoning as the
`.env` file it reads) — create it once at `/opt/deskwise/deploy.sh`,
`chmod +x`. **On this instance specifically, the app's real directory is
`/home/ec2-user/deskwise-app` (see the note near the top of this doc), so
the `cd` line below was changed to match** — if you're setting this up fresh
elsewhere with the app actually living at `/opt/deskwise`, use that path
instead:

```bash
#!/bin/bash
set -euo pipefail
cd /home/ec2-user/deskwise-app

# docker compose itself auto-loads .env for ${VAR} interpolation, but these
# two also need to be plain shell vars for the `docker login` line below.
set -a
source .env
set +a

IMAGE_TAG="${1:-latest}"
export IMAGE_TAG

aws ecr get-login-password --region "$AWS_REGION" \
   | docker login --username AWS --password-stdin "$ECR_REGISTRY"

docker compose pull app web
docker compose up -d app web
docker image prune -f
```

`AWS_REGION` and `ECR_REGISTRY` need to be in that same directory's `.env`
(see `.env.production.example` at the repo root for the full list) —
`AWS_REGION` is likely already there for SES; `ECR_REGISTRY` was added as
`798256686602.dkr.ecr.ap-southeast-2.amazonaws.com`.

**Console steps (no SSH needed):**

1. Systems Manager → **Fleet Manager** → click your instance.
2. **Node actions** (top right) → **Start terminal session** — this is
   Session Manager; it opens a browser shell on the box, which is also why
   step 4's `AmazonSSMManagedInstanceCore` permission has to already be
   attached.
3. `sudo su` to get root.
4. `mkdir -p /opt/deskwise` (if it doesn't exist yet), then
   `nano /opt/deskwise/deploy.sh`.
5. Paste the script contents above, save (`Ctrl+O`, Enter, `Ctrl+X`).
6. `chmod +x /opt/deskwise/deploy.sh`.
7. Edit the app's `.env` (wherever it actually lives — see the path note
   above) and make sure it has `ECR_REGISTRY=<account>.dkr.ecr.<region>.amazonaws.com`
   and `AWS_REGION` set.

**Before this works end-to-end for the first time:** the very first
`docker compose pull` will only succeed once GitHub Actions has actually
pushed images tagged `deskwise-server`/`deskwise-client` to ECR at least
once — i.e. after step 6 is done and a push to `master` runs the `deploy`
job successfully. Until then, running `deploy.sh` by hand will fail to pull
(nothing's been pushed yet) — that's expected, not a bug in the script.

## 6. GitHub repo secrets & variables

Settings → Secrets and variables → Actions:

| Name                      | Kind     | Value                                            |
| ------------------------- | -------- | ------------------------------------------------ |
| `AWS_DEPLOY_ROLE_ARN`     | secret   | `arn:aws:iam::798256686602:role/deskwise-deploy` |
| `VITE_SENTRY_DSN`         | secret   | _(skipped for now, see below)_                   |
| `AWS_REGION`              | variable | `ap-southeast-2`                                 |
| `EC2_INSTANCE_ID`         | variable | `i-0bc1179bb147e01bb`                            |
| `VITE_SENTRY_ENVIRONMENT` | variable | _(skipped for now, see below)_                   |

**`VITE_SENTRY_DSN`/`VITE_SENTRY_ENVIRONMENT` deliberately left unset** —
they're only used as client Docker build-args (`ci-cd.yml` lines 102-103);
left unset, GitHub passes empty strings, the build still succeeds, and
`Sentry.init()` just no-ops client-side with no DSN, same as local dev with
none configured. Add them later if/when Sentry gets wired up for real.

**GitHub portal steps:**

1. Go to `github.com/Shaz-gill/deskwise-app` → **Settings** tab (repo
   settings, not your account's).
2. Left sidebar → **Secrets and variables** → **Actions**.
3. On the **Secrets** tab → **New repository secret**:
   - `AWS_DEPLOY_ROLE_ARN` = `arn:aws:iam::798256686602:role/deskwise-deploy`.
4. Switch to the **Variables** tab → **New repository variable**:
   - `AWS_REGION` = `ap-southeast-2`.
   - `EC2_INSTANCE_ID` = `i-0bc1179bb147e01bb`.

## Rollback

There's no automated rollback yet. Fastest manual path: re-run the deploy
step's logic by hand with an older tag —

```bash
aws ssm send-command \
   --instance-ids i-0bc1179bb147e01bb \
   --document-name AWS-RunShellScript \
   --parameters commands='["/opt/deskwise/deploy.sh <OLDER_COMMIT_SHA>"]'
```

— as long as that SHA's images are still in ECR (no lifecycle policy prunes
them yet, so they will be, until one's added).
