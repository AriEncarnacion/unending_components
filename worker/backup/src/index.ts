// The registry's backup: a separate Worker in a separate Cloudflare account.
//
// Every hour it lists the registry bucket through R2's S3 API, with a token
// that can only read that one bucket, and copies anything new under r/, src/
// and log/ into its own bucket at backup/<key>, create-only. It also keeps a
// copy of the pointer state whenever it changes. Its bucket is locked, and
// nothing in the main account can reach it, so a compromised registry or
// main account can't touch the backups.
import { AwsClient } from "aws4fetch"

export interface Env {
  BACKUP: R2Bucket
  /** The main account's id, which hosts the registry bucket. */
  SOURCE_ACCOUNT_ID: string
  SOURCE_BUCKET: string
  /** Secrets: an R2 API token with Object Read on the registry bucket only. */
  SOURCE_ACCESS_KEY_ID: string
  SOURCE_SECRET_ACCESS_KEY: string
}

const COPIED_PREFIXES = ["r/", "src/", "log/"]
const STATE_KEY = "state/registry.json"

type Listed = { key: string; etag: string }

function source(env: Env) {
  const client = new AwsClient({ accessKeyId: env.SOURCE_ACCESS_KEY_ID, secretAccessKey: env.SOURCE_SECRET_ACCESS_KEY, service: "s3", region: "auto" })
  const base = `https://${env.SOURCE_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.SOURCE_BUCKET}`
  return {
    async list(prefix: string): Promise<Listed[]> {
      const out: Listed[] = []
      let token: string | undefined
      do {
        const url = new URL(base)
        url.searchParams.set("list-type", "2")
        url.searchParams.set("prefix", prefix)
        if (token) url.searchParams.set("continuation-token", token)
        const response = await client.fetch(url.toString())
        if (!response.ok) throw new Error(`list ${prefix}: ${response.status}`)
        const xml = await response.text()
        for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
          const key = /<Key>([\s\S]*?)<\/Key>/.exec(match[1])?.[1]
          const etag = /<ETag>([\s\S]*?)<\/ETag>/.exec(match[1])?.[1] ?? ""
          if (key) out.push({ key: decodeXml(key), etag: decodeXml(etag).replace(/"/g, "") })
        }
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? decodeXml(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1] ?? "") : undefined
      } while (token)
      return out
    },
    async get(key: string) {
      const response = await client.fetch(`${base}/${key.split("/").map(encodeURIComponent).join("/")}`)
      if (!response.ok) throw new Error(`get ${key}: ${response.status}`)
      return response.arrayBuffer()
    },
  }
}

const decodeXml = (text: string) =>
  text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")

/** Copies whatever the backup doesn't have yet. Returns how many objects it copied. */
export async function backUp(env: Env) {
  const from = source(env)
  let copied = 0
  for (const prefix of COPIED_PREFIXES) {
    for (const { key } of await from.list(prefix)) {
      const target = `backup/${key}`
      if (await env.BACKUP.head(target)) continue
      const written = await env.BACKUP.put(target, await from.get(key), { onlyIf: new Headers({ "if-none-match": "*" }) })
      if (written) copied++
    }
  }
  // The pointers and visibility change in place, so keep each version of them.
  const [state] = await from.list(STATE_KEY)
  if (state && !(await env.BACKUP.head(`backup/state/${state.etag}.json`))) {
    await env.BACKUP.put(`backup/state/${state.etag}.json`, await from.get(STATE_KEY), { onlyIf: new Headers({ "if-none-match": "*" }) })
    copied++
  }
  return copied
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      backUp(env).then(
        (copied) => console.log(`backed up ${copied} object(s)`),
        (error) => console.error("backup failed", (error as Error).message)
      )
    )
  },
} satisfies ExportedHandler<Env>
