import MarkdownIt from "markdown-it"
import hljs from "highlight.js"
import type { DocsDocument, DocsTocItem } from "./types.ts"

const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

const markdownEngine = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: (str: string, lang: string): string => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const value = hljs.highlight(str, {
          language: lang,
          ignoreIllegals: true,
        }).value
        return `<pre><code class="hljs">${value}</code></pre>`
      } catch (_) {
        // fall through to default
      }
    }
    return `<pre><code class="hljs">${escapeHtml(str)}</code></pre>`
  },
})

const headingOpen = markdownEngine.renderer.rules.heading_open

export const renderDocument = (doc: DocsDocument): {
  html: string
  toc: DocsTocItem[]
  plainText: string
} => {
  const toc: DocsTocItem[] = []
  const seenIds = new Map<string, number>()

  markdownEngine.renderer.rules.heading_open = (
    tokens: any,
    idx: any,
    options: any,
    env: any,
    self: any,
  ) => {
    const token = tokens[idx]
    const inline = tokens[idx + 1]
    const depth = Number.parseInt(token.tag.replace("h", ""))
    const rawText = inline?.content?.trim() ?? ""
    const id = uniqueSlug(rawText, seenIds)
    token.attrSet("id", id)

    if (depth >= 2 && depth <= 4 && rawText.length > 0) {
      toc.push({ depth, id, text: rawText })
    }

    if (headingOpen) {
      return headingOpen(tokens, idx, options, env, self)
    }
    return self.renderToken(tokens, idx, options)
  }

  const markdownBody = doc.extension === ".mdx"
    ? preprocessMdx(doc.markdownBody)
    : doc.markdownBody
  const html = markdownEngine.render(markdownBody)

  markdownEngine.renderer.rules.heading_open = headingOpen

  return {
    html,
    toc,
    plainText: toPlainText(html),
  }
}

const uniqueSlug = (value: string, seenIds: Map<string, number>): string => {
  const base = slugify(value) || "section"
  const current = seenIds.get(base)
  if (current === undefined) {
    seenIds.set(base, 1)
    return base
  }
  const next = current + 1
  seenIds.set(base, next)
  return `${base}-${next}`
}

export const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const toPlainText = (html: string): string => {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const preprocessMdx = (source: string): string => {
  return source
    .replace(/^import\s+.+$/gm, "")
    .replace(/^export\s+.+$/gm, "")
    .replace(/\{[^\n]*\}/g, "")
}
