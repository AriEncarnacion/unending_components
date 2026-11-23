// Publishes Stock (public/r/*.json) to the registry from GitHub Actions.
// Run by .github/workflows/publish-stock.yml on pushes to main. There's no
// stored key: the run asks GitHub for an OIDC token, and the registry checks
// it came from this repo's main branch, a push, and this workflow.
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

const registry = (process.env.REGISTRY_URL ?? "").replace(/\/+$/, "")
const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL
const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
if (!/^https:\/\//.test(registry)) throw new Error("REGISTRY_URL must be the registry's https URL.")
if (!requestUrl || !requestToken) throw new Error("No OIDC token available. The job needs permissions: id-token: write.")

const oidc = await fetch(`${requestUrl}&audience=${encodeURIComponent(registry)}`, { headers: { authorization: `Bearer ${requestToken}` } })
if (!oidc.ok) throw new Error(`GitHub didn't issue an OIDC token (${oidc.status}).`)
const { value: token } = await oidc.json()

const dir = path.join(process.cwd(), "public/r")
const files = {}
for (const name of readdirSync(dir).sort()) if (name.endsWith(".json")) files[`r/${name}`] = readFileSync(path.join(dir, name), "utf8")

const response = await fetch(`${registry}/publish/stock`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify({ files }),
  redirect: "error",
})
const body = await response.json().catch(() => ({}))
if (!response.ok) {
  console.error(`The registry refused Stock (${response.status}): ${body.error ?? "no reason given"}`)
  for (const line of [...(body.problems ?? []), ...(body.unknownPackages ?? []).map((p) => `not on the allowlist: ${p}`)]) console.error(`  - ${line}`)
  process.exit(1)
}
console.log(body.unchanged ? `Stock unchanged (version ${body.version}).` : `Published Stock version ${body.current}.`)
