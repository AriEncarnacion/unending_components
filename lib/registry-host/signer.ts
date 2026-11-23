// The catalog's side of the admin key: builds the Secure Enclave signer from
// signer/main.swift on first use, and runs it. Server only (dev server).
//
// The key file holds an encrypted handle only this Mac's Secure Enclave can
// use; the private key never exists outside it. Every `sign` run asks for
// Touch ID (or your password) once.
import { execFile, spawn } from "node:child_process"
import { existsSync, mkdirSync, statSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"

const run = promisify(execFile)
const root = process.cwd()
const source = path.join(root, "signer/main.swift")
const binary = path.join(root, ".generated/bin/unending-signer")

/** Where this Mac's admin key lives: outside the repo, so a clone or a new worktree never has it. */
export const keyFile = process.env.UNENDING_ADMIN_KEY_FILE || path.join(os.homedir(), "Library/Application Support/Unending/admin-key.se")

export type KeyInfo = { keyId: string; publicKey: string }

async function ensureSigner() {
  if (existsSync(binary) && statSync(binary).mtimeMs >= statSync(source).mtimeMs) return binary
  mkdirSync(path.dirname(binary), { recursive: true })
  try {
    await run("xcrun", ["swiftc", "-O", source, "-o", binary], { timeout: 180_000 })
  } catch (error) {
    throw new Error(
      `Couldn't build the signer. Install Xcode's command line tools (xcode-select --install). ${(error as { stderr?: string }).stderr ?? ""}`.trim()
    )
  }
  return binary
}

/** Whether this machine can build and run the signer at all. */
export async function signerAvailable() {
  if (process.platform !== "darwin") return "Shipping needs a Mac: the admin key lives in its Secure Enclave."
  try {
    await run("xcrun", ["--find", "swiftc"], { timeout: 20_000 })
    return null
  } catch {
    return "Shipping needs Xcode's command line tools to build the signer. Run xcode-select --install."
  }
}

function invoke(args: string[], input?: string) {
  return new Promise<string>((resolve, reject) => {
    void ensureSigner().then((bin) => {
      const child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] })
      let out = ""
      let err = ""
      child.stdout.on("data", (chunk) => (out += chunk))
      child.stderr.on("data", (chunk) => (err += chunk))
      child.on("error", reject)
      child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err.trim() || `The signer exited with ${code}.`))))
      child.stdin.end(input ?? "")
    }, reject)
  })
}

export async function keyInfo(): Promise<KeyInfo | null> {
  if (!existsSync(keyFile)) return null
  return JSON.parse(await invoke(["public-key", keyFile])) as KeyInfo
}

/** Makes this Mac's admin key. Refuses if one exists, so a key is never replaced by accident. */
export async function createKey(): Promise<KeyInfo> {
  if (existsSync(keyFile)) throw new Error(`This Mac already has an admin key at ${keyFile}.`)
  return JSON.parse(await invoke(["create", keyFile])) as KeyInfo
}

/** Signs every message with one Touch ID prompt. `reason` is shown in the prompt. */
export async function sign(messages: string[], reason: string): Promise<string[]> {
  if (!existsSync(keyFile)) throw new Error("This Mac has no admin key yet. Use Set up this Mac in Ship.")
  const input = JSON.stringify(messages.map((m) => Buffer.from(m, "utf8").toString("base64")))
  return JSON.parse(await invoke(["sign", keyFile, reason.slice(0, 120)], input)) as string[]
}
