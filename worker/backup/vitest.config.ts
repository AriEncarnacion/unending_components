import { cloudflareTest } from "@cloudflare/vitest-plugin"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: { SOURCE_ACCOUNT_ID: "acct", SOURCE_ACCESS_KEY_ID: "id", SOURCE_SECRET_ACCESS_KEY: "secret" },
      },
    }),
  ],
  test: { include: ["test/**/*.test.ts"] },
})
