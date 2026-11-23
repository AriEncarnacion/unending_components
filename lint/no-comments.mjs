const directive =
  /^\s*(?:eslint-disable|eslint-enable|eslint\s|global\s|globals\s|exported\s|@ts-(?:expect-error|ignore|nocheck|check)\b|prettier-ignore\b|[#@]__PURE__|webpack[A-Z]\w*:|turbopackIgnore:)/
const tripleSlash = /^\/\s*<reference\s/

export const isDirective = (comment) =>
  comment.type === "Shebang" ||
  directive.test(comment.value) ||
  (comment.type === "Line" && tripleSlash.test(comment.value))

const rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow code comments. Tool directives (eslint-disable, @ts-expect-error, /// <reference>) are allowed.",
      url: "https://github.com/AriEncarnacion/unending_components/blob/main/docs/adr/0001-no-code-comments.md",
    },
    schema: [],
    messages: {
      comment:
        "No code comments. Say it in code (a name, a type, a test), or record the decision in docs/adr/. See /delete-comment.",
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (isDirective(comment)) continue
          context.report({ loc: comment.loc, messageId: "comment" })
        }
      },
    }
  },
}

const plugin = { rules: { "no-comments": rule } }

export default plugin
