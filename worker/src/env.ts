// Bindings and settings. Secrets (marked) are set with `wrangler secret put`
// or in the Cloudflare dashboard, never in the repo.
export interface Env {
  /** The registry bucket: r/ and src/ (create-only, bucket-locked), log/, state/, tokens/, nonces/. */
  REGISTRY: R2Bucket
  /** Secret. Enrolled admin public keys, base64url, separated by commas or newlines. */
  ADMIN_KEYS: string
  /** Secret. 32 random bytes, base64, that encrypt stored read:org tokens. */
  TOKEN_ENC_KEY: string
  /** The registry's own GitHub OAuth app, with device flow enabled. Not secret. */
  GITHUB_CLIENT_ID: string
  /** owner/name of the catalog repo, whose main branch publishes Stock. */
  GITHUB_REPOSITORY: string
  /** That repo's numeric id, which survives renames. */
  GITHUB_REPOSITORY_ID: string
  /** The audience GitHub OIDC tokens must carry. */
  OIDC_AUDIENCE: string
  /** Optional. Email Routing's send_email binding, for alerts. */
  ALERTS?: SendEmail
  /** Optional. Sender on the registry's domain, such as registry@unending.studio. */
  ALERT_FROM?: string
  /** Secret, optional. Your verified Email Routing destination. */
  ALERT_TO?: string
}
