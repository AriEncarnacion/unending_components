// Installs dependencies, starts the dev server and opens the home page once it's ready.
// Run with: npm run up. Ctrl+C stops the server.
import { spawn, spawnSync } from "node:child_process"

const npm = process.platform === "win32" ? "npm.cmd" : "npm"

const install = spawnSync(npm, ["install"], { stdio: "inherit" })
if (install.status !== 0) process.exit(install.status ?? 1)

const dev = spawn(npm, ["run", "dev"], { stdio: ["inherit", "pipe", "inherit"] })
let opened = false

dev.stdout.on("data", (chunk) => {
  process.stdout.write(chunk)
  if (opened) return
  // Next prints "- Local: http://127.0.0.1:3000" (the port moves if 3000 is taken).
  const url = chunk.toString().match(/Local:\s+(http:\/\/\S+)/)?.[1]
  if (!url) return
  opened = true
  const opener = { darwin: "open", win32: "start" }[process.platform] ?? "xdg-open"
  spawn(opener, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref()
})

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => dev.kill(signal))
dev.on("exit", (code) => process.exit(code ?? 0))
