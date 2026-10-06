# CI/CD setup

`deploy.yml` has two jobs:

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

## Status

**Confirmed working end-to-end as of 2026-10-07**, including a real
client-side code change actually reaching production — not just the
pipeline going green. A push to `master` runs `test` → `deploy`, which
builds both images, pushes them to ECR, and the SSM command pulls and
restarts `app`/`web` on the instance, verified via `docker ps` showing the
ECR-tagged images running with fresh timestamps. All 6 setup steps below are
done for this account/repo. Getting from "pipeline reports success" to
"change is actually live" took two more rounds of debugging past the
original 6-step setup — see gotchas #4 and #5 below; those were the ones
that let `deploy` report `Success` while silently deploying nothing.

## This account's values

Filled in below wherever the steps say `<ACCOUNT_ID>` / `<REGION>` /
`<GITHUB_ORG>/<REPO>` / `<INSTANCE_ID>`:

- Account ID: `798256686602`
- Region: `ap-southeast-2`
- GitHub repo: `Shaz-gill/deskwise-app`
- EC2 instance ID: `i-0bc1179bb147e01bb` (public IP `3.106.171.37` at time of
  writing — re-check if the instance is ever stopped/started, since that
  rotates)
- GitHub Actions deploy role ARN: `arn:aws:iam::798256686602:role/deskwise-deploy`

**Deviation from step 5's instructions:** this instance already had the app
manually deployed at `/home/ec2-user/deskwise-app/` (a full git checkout,
`docker compose up` run directly from there) _before_ CI/CD was set up —
`docker ps` showed live, 2-day-old containers with real Postgres data.
Migrating that to `/opt/deskwise/` would have risked orphaning the Postgres
volume (Compose ties default volume names to the project directory it runs
from), so instead `/opt/deskwise/deploy.sh` was pointed at the existing
directory. Net result: **the deploy script lives at
`/opt/deskwise/deploy.sh`, but `cd`s into `/home/ec2-user/deskwise-app`**,
which is also where the real `.env` and `docker-compose.yml` live — not
`/opt/deskwise/` as step 5 originally assumed. Keep this in sync if that
ever changes.

## Setup checklist

- [x] Step 1 — OIDC provider already existed on this account
- [x] Step 2 — IAM role created (named `deskwise-deploy`); trust policy
      needed the `@ID`-suffixed `sub` pattern, not the plain one — see
      step 2's gotcha note
- [x] Step 3 — ECR repos created
- [x] Step 4 — EC2 instance role updated (SSM + ECR-read attached to
      `deskwise-ec2-role`; confirmed instance shows Online in Fleet Manager)
- [x] Step 5 — deploy script placed at `/opt/deskwise/deploy.sh`, pointed at
      the real app directory per the deviation note above;
      `ECR_REGISTRY`/`IMAGE_TAG` added to the existing `~/deskwise-app/.env`;
      `git pull` added as its first line after gotcha #4 (see step 5)
- [x] Step 6 — GitHub secrets/variables set (`VITE_SENTRY_*` deliberately
      skipped, see step 6)

## Gotchas index

Five real issues came up getting this working on this account. Each is
documented in full at its relevant step (exact error text, root cause, fix
commands) — this is just the index so a future read doesn't have to hunt.
**#4 is the one most likely to bite again** — read it even if you skip the
rest:

1. **OIDC trust policy `sub` format** (step 2) — GitHub embeds immutable
   numeric IDs in the `sub` claim now; the plain `repo:OWNER/REPO:...`
   pattern alone gets `AccessDenied`.
2. **`.env` must be valid bash, not just `KEY=VALUE`** (step 5) —
   `deploy.sh` does `source .env`, so any value containing a space (e.g. a
   display name like `Customer Support`) must be double-quoted or bash
   misparses the line as a command.
3. **`docker compose` plugin was only installed per-user, not system-wide**
   (step 5) — it lived in `~/.docker/cli-plugins/` (visible to `ec2-user`
   only), but SSM runs commands as root, which couldn't see it. Fixed by
   copying the plugin binary to `/usr/libexec/docker/cli-plugins/`.
4. **The host's `docker-compose.yml` was a stale git checkout and silently
   caused every deploy to do nothing** (step 5) — `~/deskwise-app` was
   cloned once, before the `image:` field existed in this file, and never
   updated. `docker compose pull` had no `image:` to pull (compose just
   skips such services, no error), so `up -d` kept reusing the original
   locally-built image forever. The `deploy` job still reported `Success`
   throughout, because the script itself ran without error — it just never
   deployed anything. Fixed by adding `git pull` as the first thing
   `deploy.sh` does, so this can't go stale again.
5. **EC2 instance role was missing two ECR actions needed to actually pull
   image layers** (step 4) — `deskwise-ecr-read` only had
   `GetAuthorizationToken` (enough to `docker login`) and `BatchGetImage`
   (enough to read the manifest), but not `BatchCheckLayerAvailability` or
   `GetDownloadUrlForLayer` — so `docker compose pull` got as far as
   resolving the image before failing with `AccessDenied` on the actual
   layer download. This one only surfaced once gotcha #4 was fixed and a
   real pull was attempted for the first time.

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

## 2. IAM role GitHub Actions assumes — done (`deskwise-deploy`)

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
10. Delete the contents and paste the trust policy JSON above.
11. **Update policy**.
12. **Permissions** tab → **Add permissions** dropdown → **Create inline policy**.
13. Click the **JSON** tab in the policy editor → paste the permissions
    policy JSON above.
14. **Next** → name it `deskwise-deploy-permissions` → **Create policy**.
15. Back on the role's **Summary** page, copy the **ARN** — that's the
    `AWS_DEPLOY_ROLE_ARN` secret for step 6.

## 3. ECR repositories — done

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

## 4. EC2 instance role additions — done

The instance already has an IAM role for SES + S3 (see root `CLAUDE.md`).
Add to that same role:

- `AmazonSSMManagedInstanceCore` (AWS managed policy) — lets SSM reach the
  box at all. Most current AMIs ship the SSM agent already running; confirm
  the instance shows up in `aws ssm describe-instance-information`.
- Inline permission for `ecr:GetAuthorizationToken`,
  `ecr:BatchCheckLayerAvailability`, `ecr:GetDownloadUrlForLayer`, and
  `ecr:BatchGetImage` on the two repo ARNs above — all four are needed for
  `docker login`/`docker compose pull` on the host to actually read from
  ECR (see gotcha #5 below — the first two alone get you far enough to
  resolve the image manifest, but pulling the actual layers needs the other
  two).

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
         "Action": [
            "ecr:BatchCheckLayerAvailability",
            "ecr:GetDownloadUrlForLayer",
            "ecr:BatchGetImage"
         ],
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

## 5. The deploy script on the host — done

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

# Keeps docker-compose.yml (and anything else this directory needs) in sync
# with the repo on every deploy — see gotcha #4 below for why this line
# exists at all. Safe here because this repo is public over HTTPS, so it
# never prompts for credentials; a private repo would need a deploy key
# instead, or this would hang an unattended SSM run.
git pull

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

**General note for any future from-scratch setup:** the very first
`docker compose pull` only succeeds once GitHub Actions has actually pushed
images tagged `deskwise-server`/`deskwise-client` to ECR at least once —
i.e. after step 6 is done and a push to `master` runs `deploy` successfully.
Before that, running `deploy.sh` by hand fails to pull (nothing's been
pushed yet) — expected, not a bug in the script. (Already crossed on this
account — see Status at the top.)

**Gotcha #2 hit on this account — `.env` must be valid bash, not just
`KEY=VALUE`:** `deploy.sh` does `source .env` to get `AWS_REGION`/
`ECR_REGISTRY` as real shell variables for the `docker login` line. That
means bash parses the *entire* file, not just those two lines — so any
value containing a space (e.g. `SES_FROM_NAME=Customer Support`) breaks
with an error like `.env: line 31: Customer: command not found`, because
bash treats the text after the space as a separate command to run. Fix: wrap
any such value in double quotes, e.g. `SES_FROM_NAME="Customer Support"`.
To check for other lines with this problem without printing secret values:
```bash
awk -F'=' '!/^#/ && NF>1 && $0 ~ / / {print NR": "$1}' ~/deskwise-app/.env
```
and to verify the whole file is valid bash after fixing (prints `OK`, no
secrets shown):
```bash
bash -c "set -a; source ~/deskwise-app/.env; set +a; echo OK"
```

**Gotcha #3 hit on this account — `docker compose` plugin installed
per-user, not system-wide:** the `deploy` job triggers this script via SSM,
which runs commands as **root** — but `docker compose` (the Compose v2
plugin) had only been installed into `/home/ec2-user/.docker/cli-plugins/`,
which only `ec2-user` can see. Running the script manually over SSH (as
`ec2-user`) worked fine; running it via SSM failed with
`docker: 'compose' is not a docker command.` Fix: copy the plugin binary to
the system-wide location so every user (root included) can see it:
```bash
sudo cp ~/.docker/cli-plugins/docker-compose /usr/libexec/docker/cli-plugins/docker-compose
sudo chmod +x /usr/libexec/docker/cli-plugins/docker-compose
sudo docker compose version   # should now print the version, confirming the fix
```

**Gotcha #4 hit on this account — the host's `docker-compose.yml` was stale
and every deploy silently did nothing:** `~/deskwise-app` was `git clone`d
once, on day one, before this project's `docker-compose.yml` had `image:`
fields at all (it only had `build:` back then). Nobody ever ran `git pull`
on the host afterward, so it stayed frozen at that old commit indefinitely.
Symptom: `deploy` kept reporting `Success` in GitHub Actions, real images
kept getting built and pushed to ECR, but `docker ps` on the instance always
showed the same old locally-built image names (`deskwise-app-app`,
`deskwise-app-web`) with ancient `CREATED` timestamps — `docker compose
pull app web` had no `image:` key to pull on either service, so it silently
skipped them (`Skipped No image to be pulled`, not an error), and `up -d`
just kept the already-running old container since nothing told it to
rebuild. The only reason this got noticed at all was a client-side change
not showing up on the live site.
Fix: added `git pull` as the first line of `deploy.sh` (above), so the
host's checkout can never drift from the repo again. Confirm it's safe for
your repo before relying on this — a public repo over HTTPS needs no
credentials and `git pull` just works; a private repo would hang waiting
for a username/password on an unattended SSM run unless a deploy key or
cached credential helper is set up first. Test with a plain
`cd ~/deskwise-app && git pull` over SSH; if that prompts for anything,
don't add the line to `deploy.sh` until that's sorted.
One-time recovery used on this account, for reference (don't need to repeat
this now that `git pull` is in the script):
```bash
cd ~/deskwise-app
git checkout -- docker-compose.yml   # discard the stale uncommitted copy
git pull                             # bring in the real, current file
sudo /opt/deskwise/deploy.sh latest  # force an immediate redeploy
```

**Gotcha #5 hit on this account — EC2 instance role missing two ECR
actions:** once gotcha #4 was fixed and `docker compose pull` finally had a
real `image:` to resolve, it failed with:
```
error pulling image configuration: download failed after attempts=1: denied:
... is not authorized to perform: ecr:GetDownloadUrlForLayer on resource:
arn:aws:ecr:ap-southeast-2:798256686602:repository/deskwise-client because
no identity-based policy allows the ecr:GetDownloadUrlForLayer action
```
`deskwise-ecr-read` (step 4) only granted `GetAuthorizationToken` and
`BatchGetImage` — enough to log in and resolve the image manifest, but not
enough to actually download the layer blobs. Fixed by adding
`ecr:BatchCheckLayerAvailability` and `ecr:GetDownloadUrlForLayer` to that
same inline policy (the JSON in step 4 above already reflects the fix).
Updated from a local machine authenticated as an IAM admin user (the EC2
instance's own role can't modify its own IAM policy):
```bash
aws iam put-role-policy \
  --role-name deskwise-ec2-role \
  --policy-name deskwise-ecr-read \
  --policy-document file://ecr-read-policy.json   # the step-4 JSON above
```

## 6. GitHub repo secrets & variables — done

Settings → Secrets and variables → Actions:

| Name                      | Kind     | Value                                            |
| ------------------------- | -------- | ------------------------------------------------ |
| `AWS_DEPLOY_ROLE_ARN`     | secret   | `arn:aws:iam::798256686602:role/deskwise-deploy` |
| `VITE_SENTRY_DSN`         | secret   | _(skipped for now, see below)_                   |
| `AWS_REGION`              | variable | `ap-southeast-2`                                 |
| `EC2_INSTANCE_ID`         | variable | `i-0bc1179bb147e01bb`                            |
| `VITE_SENTRY_ENVIRONMENT` | variable | _(skipped for now, see below)_                   |

**`VITE_SENTRY_DSN`/`VITE_SENTRY_ENVIRONMENT` deliberately left unset** —
they're only used as client Docker build-args (`deploy.yml` lines 102-103);
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
