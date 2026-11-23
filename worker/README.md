# Unending registry Worker

Serves every design system's registry at `https://registry.unending.studio`, issues read-only tokens to org members, and takes new versions only from requests signed by an enrolled Mac's Secure Enclave key (and Stock only from GitHub Actions on `main`). The plan and security model are in the Unending Registry Plan.

```
src/index.ts       routing; refuses GitHub tokens everywhere; no redirects
src/read.ts        /r/<system>/..., /systems.json (visibility checked before any cache)
src/admin.ts       /admin/*: ship, roll back, pull, allowlist, revoke tokens
src/admin-auth.ts  signed-request checks: enrolled key, signature, 60s clock, one-time nonce
src/publish.ts     claim the version (create-only), write files, log, move the pointer last
src/stock.ts       /publish/stock with a GitHub OIDC token
src/login.ts       /login/*: GitHub device flow, read:org only, unr_ tokens
src/tokens.ts      token storage (hash only) and the daily membership check (Cache API)
src/shared/        the wire format and upload validation, shared with the catalog
backup/            the backup Worker, for a second Cloudflare account
```

## Develop

```bash
npm ci
npm test          # Worker and backup tests, inside workerd
npm run typecheck
npm run dev       # local Worker on http://127.0.0.1:8787 with a local bucket
```

For a local Worker, put `ADMIN_KEYS` and `TOKEN_ENC_KEY` in `worker/.dev.vars` (git-ignored), and start the catalog with `UNENDING_REGISTRY_URL=http://127.0.0.1:8787`. To ship without Touch ID while testing, make a throwaway key with `.generated/bin/unending-signer create <file> --test-without-presence` and point `UNENDING_ADMIN_KEY_FILE` at it. Never enrol a key like that in the real Worker.

## Deploy, once

Everything below is in your Cloudflare account. Log in with `npx wrangler login`.

1. **The bucket.** It has no public access and no r2.dev URL by default; leave it that way.
   ```bash
   npx wrangler r2 bucket create unending-registry
   npx wrangler r2 bucket lock add unending-registry versions r/ --retention-days 365
   npx wrangler r2 bucket lock add unending-registry sources src/ --retention-days 365
   npx wrangler r2 bucket lifecycle add unending-registry nonces nonces/ --expire-days 2
   ```
   The locks stop anything, the Worker included, from deleting or overwriting a version for a year.
2. **Email alerts.** In the dashboard, enable Email Routing on `unending.studio` and verify your personal address as a destination.
3. **The GitHub OAuth app** for `/unending:login`: github.com → Settings → Developer settings → OAuth Apps → New. Name it "Unending registry", homepage `https://registry.unending.studio`, callback `https://registry.unending.studio/login`, and tick **Enable Device Flow**. No client secret is needed. Put its client id in `GITHUB_CLIENT_ID` in `wrangler.jsonc`. If the org restricts OAuth apps, an org owner approves it once.
4. **Secrets.**
   ```bash
   npx wrangler secret put ADMIN_KEYS      # your Mac's public key, from Ship → Set up this Mac
   npx wrangler secret put TOKEN_ENC_KEY   # paste the output of: openssl rand -base64 32
   npx wrangler secret put ALERT_TO        # your verified Email Routing address
   ```
5. **Deploy.** `npm run deploy`. Wrangler attaches `registry.unending.studio` as the Worker's custom domain.
6. **Stock.** Set the repo variable that turns on `.github/workflows/publish-stock.yml`:
   ```bash
   gh variable set REGISTRY_URL --body https://registry.unending.studio
   ```
   Stock's packages must be on the allowlist first: the first Ship from the catalog asks you to allow the same set. Then publish Stock once with Actions → Publish Stock → Run workflow (on `main`), or `gh workflow run publish-stock.yml --ref main`. After that it publishes whenever Stock changes on `main`.
7. **Spend guards.**
   - Stay on Workers Free, which fails requests past 100,000 a day instead of billing them.
   - Add a rate-limiting rule (Security → WAF → Rate limiting rules) on `registry.unending.studio/r/*`, for example 300 requests per 10 seconds per IP, blocking for 10 seconds.
   - Add notifications (Notifications → Add): Workers usage, R2 usage, and a $5 billing threshold.
   - Don't create a Global API Key. Use scoped API tokens only.
8. **Backups**, in a second Cloudflare account:
   1. In the main account, create an R2 API token with **Object Read** on `unending-registry` only.
   2. In the second account: `npx wrangler r2 bucket create unending-registry-backup`, then lock it with `npx wrangler r2 bucket lock add unending-registry-backup all "" --retention-indefinite`.
   3. Set `SOURCE_ACCOUNT_ID` (the main account's id) in `backup/wrangler.jsonc`, then add the secrets `SOURCE_ACCESS_KEY_ID` and `SOURCE_SECRET_ACCESS_KEY` with `--config backup/wrangler.jsonc`.
   4. `npm run deploy:backup` while logged in to the second account. It copies new versions hourly.

## When a Mac goes away

The Cloudflare dashboard is the recovery path, so keep its login and 2FA (a synced passkey, plus recovery codes) in your personal password manager, never only on the work laptop.

1. On the new Mac, open Ship in the catalog and choose **Set up this Mac**. It shows the new public key and pins it in `plugin/keys.json`.
2. In the dashboard, set the Worker's `ADMIN_KEYS` secret to the new key, and remove the old one.
3. Open a PR with `plugin/keys.json`. Mark the old key with `retiredAt`, and list the SHA-256 of each release payload it signed in its `releases`, so apps keep trusting what it already shipped.

## Revoking reader access

A registry token stops working within a day of its holder leaving the org, and after 30 days regardless. To revoke sooner, use `POST /admin/tokens/revoke` with `{ "org": "<org>" }` or `{ "userId": <github id> }` (signed), or delete the objects under `tokens/` in the dashboard.
