import { ESLint } from "eslint"
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const asJson = args.includes("--json")
const targets = args.filter((a) => !a.startsWith("--"))

const eslint = new ESLint({ ruleFilter: ({ ruleId }) => ruleId === "unending/no-comments" })
const results = await eslint.lintFiles(targets.length ? targets : ["."])

const blocks = []
for (const result of results) {
  const messages = result.messages.filter((m) => m.ruleId === "unending/no-comments")
  if (!messages.length) continue
  const file = path.relative(process.cwd(), result.filePath)
  const lines = fs.readFileSync(result.filePath, "utf8").split("\n")
  let block = null
  for (const m of messages) {
    const before = lines[m.line - 1].slice(0, m.column - 1).trim()
    const after = lines[m.endLine - 1].slice(m.endColumn - 1).trim()
    const ownLine = (before === "" || before === "{") && (after === "" || after === "}")
    const text = lines
      .slice(m.line - 1, m.endLine)
      .map((l, i, all) => {
        let s = l
        if (i === all.length - 1) s = s.slice(0, m.endColumn - 1)
        if (i === 0) s = s.slice(m.column - 1)
        return s.trim()
      })
      .join("\n")
    const joins = block && ownLine && block.ownLine && m.line === block.endLine + 1 && text.startsWith("//")
    if (joins) {
      block.endLine = m.endLine
      block.text += "\n" + text
      block.comments++
    } else {
      block = { file, line: m.line, endLine: m.endLine, ownLine, text, comments: 1 }
      blocks.push(block)
    }
  }
}

const shed = (b) => (b.ownLine ? b.endLine - b.line + 1 : 0)
const totals = {
  files: new Set(blocks.map((b) => b.file)).size,
  blocks: blocks.length,
  comments: blocks.reduce((n, b) => n + b.comments, 0),
  linesShed: blocks.reduce((n, b) => n + shed(b), 0),
}

if (asJson) {
  console.log(JSON.stringify({ totals, blocks }, null, 2))
} else {
  let current = ""
  for (const b of blocks) {
    if (b.file !== current) {
      current = b.file
      console.log(`\n${b.file}`)
    }
    const where = b.line === b.endLine ? `${b.line}` : `${b.line}-${b.endLine}`
    console.log(`  ${where}${b.ownLine ? "" : " (end of line)"}: ${b.text.replace(/\s*\n\s*/g, " ")}`)
  }
  console.log(
    `\n${totals.comments} comments in ${totals.blocks} blocks across ${totals.files} files. Deleting them all sheds about ${totals.linesShed} lines.`
  )
}
