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

## 1. GitHub OIDC identity provider (once per AWS account)

Skip this if the account already has a GitHub OIDC provider (e.g. from
another repo) — `aws iam list-open-id-connect-providers` will show
`token.actions.githubusercontent.com` if so.

```bash
aws iam create-open-id-connect-provider \
   --url "https://token.actions.githubusercontent.com" \
   --client-id-list "sts.amazonaws.com" \
   --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1"
```

## 2. IAM role GitHub Actions assumes

Trust policy — scoped to this repo's `master` branch only, since that's the
only ref the `deploy` job ever runs on (replace `<ACCOUNT_ID>` and
`<GITHUB_ORG>/<REPO>`):

```json
{
   "Version": "2012-10-17",
   "Statement": [
      {
         "Effect": "Allow",
         "Principal": {
            "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
            "StringEquals": {
               "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
            },
            "StringLike": {
               "token.actions.githubusercontent.com:sub": "repo:<GITHUB_ORG>/<REPO>:ref:refs/heads/master"
            }
         }
      }
   ]
}
```

Permissions policy — ECR push for exactly the two repos this project uses,
plus SSM to kick off the deploy script on the one instance (replace
`<ACCOUNT_ID>`, `<REGION>`, `<INSTANCE_ID>`):

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
            "arn:aws:ecr:<REGION>:<ACCOUNT_ID>:repository/deskwise-server",
            "arn:aws:ecr:<REGION>:<ACCOUNT_ID>:repository/deskwise-client"
         ]
      },
      {
         "Sid": "TriggerDeploy",
         "Effect": "Allow",
         "Action": "ssm:SendCommand",
         "Resource": [
            "arn:aws:ec2:<REGION>:<ACCOUNT_ID>:instance/<INSTANCE_ID>",
            "arn:aws:ssm:<REGION>::document/AWS-RunShellScript"
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

## 3. ECR repositories

```bash
aws ecr create-repository --repository-name deskwise-server
aws ecr create-repository --repository-name deskwise-client
```

## 4. EC2 instance role additions

The instance already has an IAM role for SES + S3 (see root `CLAUDE.md`).
Add to that same role:

- `AmazonSSMManagedInstanceCore` (AWS managed policy) — lets SSM reach the
  box at all. Most current AMIs ship the SSM agent already running; confirm
  the instance shows up in `aws ssm describe-instance-information`.
- Inline permission for `ecr:GetAuthorizationToken` and `ecr:BatchGetImage`
  on the two repo ARNs above — this is what lets `docker login`/`docker
compose pull` on the host actually read from ECR.

## 5. The deploy script on the host

This lives only on the EC2 instance, not in this repo (same reasoning as the
`.env` file it reads) — create it once at `/opt/deskwise/deploy.sh`,
`chmod +x`:

```bash
#!/bin/bash
set -euo pipefail
cd /opt/deskwise

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

`AWS_REGION` and `ECR_REGISTRY` need to be in `/opt/deskwise/.env` (see
`.env.production.example` at the repo root) — `AWS_REGION` is likely already
there for SES; add `ECR_REGISTRY` as `<ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com`.

## 6. GitHub repo secrets & variables

Settings → Secrets and variables → Actions:

| Name                       | Kind     | Value                                                            |
| -------------------------- | -------- | ----------------------------------------------------------------- |
| `AWS_DEPLOY_ROLE_ARN`      | secret   | the role ARN from step 2                                          |
| `VITE_SENTRY_DSN`          | secret   | same value as production's client Sentry DSN (public-ish, but kept a secret here mainly so it's not casually copy-pasted into a fork's workflow run) |
| `AWS_REGION`               | variable | e.g. `us-east-1`                                                   |
| `EC2_INSTANCE_ID`          | variable | e.g. `i-0123456789abcdef0`                                          |
| `VITE_SENTRY_ENVIRONMENT`  | variable | `production`                                                       |

## Rollback

There's no automated rollback yet. Fastest manual path: re-run the deploy
step's logic by hand with an older tag —

```bash
aws ssm send-command \
   --instance-ids <INSTANCE_ID> \
   --document-name AWS-RunShellScript \
   --parameters commands='["/opt/deskwise/deploy.sh <OLDER_COMMIT_SHA>"]'
```

— as long as that SHA's images are still in ECR (no lifecycle policy prunes
them yet, so they will be, until one's added).
