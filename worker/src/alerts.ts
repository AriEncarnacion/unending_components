// Emails you about every admin action, through Email Routing's send_email
// binding. Alerts never block the action: if mail isn't set up or fails, the
// action still stands and the failure is logged without any request content.
import type { Env } from "./env.ts"

const oneLine = (text: string) => text.replace(/[\r\n]+/g, " ").slice(0, 200)

export async function alert(env: Env, subject: string, lines: string[]) {
  if (!env.ALERTS || !env.ALERT_FROM || !env.ALERT_TO) return
  try {
    const { EmailMessage } = await import("cloudflare:email")
    const id = `${crypto.randomUUID()}@${env.ALERT_FROM.split("@")[1] ?? "localhost"}`
    const raw = [
      `From: Unending registry <${env.ALERT_FROM}>`,
      `To: ${env.ALERT_TO}`,
      `Subject: ${oneLine(subject)}`,
      `Message-ID: <${id}>`,
      `Date: ${new Date().toUTCString()}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      ...lines.map((line) => line.replace(/\r/g, "")),
      "",
      "If you didn't do this, remove the key it names from ADMIN_KEYS in the Cloudflare dashboard, then roll back from the catalog.",
      "",
    ].join("\r\n")
    await env.ALERTS.send(new EmailMessage(env.ALERT_FROM, env.ALERT_TO, raw))
  } catch (error) {
    console.error("alert failed", (error as Error).name)
  }
}
