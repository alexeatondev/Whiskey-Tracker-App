# Security

## Reporting a problem

Please don't open a public issue for security problems. Use GitHub's **Report a vulnerability** button (Security tab → Advisories) to report it privately.

## What's public, and why that's OK

This repository and the app at GitHub Pages are public. Nothing in them is a secret:

| Value | Where | Why it's safe to publish |
| --- | --- | --- |
| Cognito user pool ID, app client ID, sign-in domain, identity pool ID | `js/aws-config.js` | Public identifiers that every browser app needs. Sign-up is invite-only, and the client has no secret (PKCE). |
| S3 bucket name | `js/aws-config.js`, `index.html` (CSP) | The bucket is private and blocks all public access. The IAM role lets each signed-in user reach only `private/<their identity id>/`. |
| AI proxy URL | `js/aws-config.js` | Every request must carry a valid Cognito ID token. The function checks its signature, issuer, audience and expiry, and enforces a monthly quota per user. |

## What's secret, and where it lives

| Secret | Location | Never in |
| --- | --- | --- |
| Anthropic API key | AWS SSM Parameter Store, SecureString `/secondpour/anthropic-api-key` (encrypted with KMS). Only the AI proxy's IAM role can read it. | The repo, the CloudFormation template, the browser, logs |
| User passwords | Amazon Cognito | Anywhere in this app |
| Short-lived AWS credentials (1 hour) | The user's browser session storage | The repo |
| Sign-in tokens (refresh token: 365 days) | The user's browser local storage | The repo |

## Protections in place

- **Accounts:** invite-only (no public sign-up), 12+ character passwords, generic sign-in errors (no hints about whether a user exists), revocable tokens.
- **Data isolation:** each user's collection and photos sit in their own S3 prefix, enforced by IAM, not by app code.
- **Storage:**
  - S3 Block Public Access on, encryption at rest, HTTPS-only bucket policy;
  - versioning with 30-day recovery;
  - CORS limited to the app's origin and localhost.
- **AI proxy:**
  - signed-in users only;
  - 50 reads per user per month;
  - model, token limit and request shape fixed on the server;
  - payload size limits;
  - origin allow-list;
  - errors don't leak the key;
  - failed calls don't count against the quota.
- **Browser:**
  - Content-Security-Policy: scripts only from the app itself, network calls only to the app's AWS endpoints, no plugins, no inline script;
  - all user and AI text is HTML-escaped before display;
  - no third-party scripts or trackers.
- **Cost guardrails:** AWS budget alert at $1/month; per-user AI quota. You should also set a monthly spend limit in the Anthropic Console.

## Keeping it that way

- Never commit keys, tokens, `.env` files or credentials. `.gitignore` blocks the common ones. GitHub secret scanning and push protection are recommended.
- To rotate the Anthropic key: create a new key in the Anthropic Console, then update the SSM parameter's value. The proxy picks it up on its next cold start, or right away if the old key is revoked. Finally, delete the old key.
- After changing `infra/ai-proxy.js`, run `infra/build.sh` and `node tests/ai-proxy.cjs`, then update the stack.
