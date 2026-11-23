import { cloudflareTest } from "@cloudflare/vitest-plugin"
import { defineConfig } from "vitest/config"

// Tests run inside the Workers runtime (Miniflare) with a local R2 bucket.
// The admin key and other secrets here are test-only; test/setup.ts makes
// real key pairs per test where it needs to sign.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          ADMIN_KEYS: "",
          TOKEN_ENC_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
          GITHUB_CLIENT_ID: "test-client",
          OIDC_AUDIENCE: "https://registry.unending.studio",
        },
      },
    }),
  ],
  test: { include: ["test/**/*.test.ts"] },
})
