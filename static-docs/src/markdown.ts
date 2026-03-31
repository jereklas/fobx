import MarkdownIt from "markdown-it"
import hljs from "highlight.js"
import type { DocsDocument, DocsTocItem } from "./types.ts"

interface MarkdownToken {
  tag: string
  content?: string
  attrSet(name: string, value: string): void
}

interface MarkdownRendererContext {
  renderToken(
    tokens: readonly MarkdownToken[],
    idx: number,
    options: unknown,
  ): string
}

type MarkdownRule = (
  tokens: readonly MarkdownToken[],
  idx: number,
  options: unknown,
  env: unknown,
  self: MarkdownRendererContext,
) => string

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

const headingOpen = markdownEngine.renderer.rules.heading_open as
  | MarkdownRule
  | undefined
const tableOpen = markdownEngine.renderer.rules.table_open as
  | MarkdownRule
  | undefined
const tableClose = markdownEngine.renderer.rules.table_close as
  | MarkdownRule
  | undefined

const renderTableOpen: MarkdownRule = (
  tokens,
  idx,
  options,
  env,
  self,
) => {
  const rendered = tableOpen
    ? tableOpen(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options)
  return `<div class="table-wrap">${rendered}`
}

const renderTableClose: MarkdownRule = (
  tokens,
  idx,
  options,
  env,
  self,
) => {
  const rendered = tableClose
    ? tableClose(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options)
  return `${rendered}</div>`
}

markdownEngine.renderer.rules.table_open = renderTableOpen
markdownEngine.renderer.rules.table_close = renderTableClose

export const renderDocument = (doc: DocsDocument): {
  html: string
  toc: DocsTocItem[]
  plainText: string
} => {
  const toc: DocsTocItem[] = []
  const seenIds = new Map<string, number>()

  const renderHeadingOpen: MarkdownRule = (
    tokens,
    idx,
    options,
    env,
    self,
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

  markdownEngine.renderer.rules.heading_open = renderHeadingOpen

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
