import { walk } from "@std/fs"
import { dirname, extname, join, relative } from "@std/path"
import matter from "gray-matter"
import { renderDocument, slugify } from "./markdown.ts"
import type { DocsDocument, DocsPage } from "./types.ts"

const SUPPORTED_EXTENSIONS = new Set([".md", ".mdx"])

export const loadDocuments = async (
  inputDir: string,
  includeMdx: boolean,
): Promise<DocsDocument[]> => {
  const docs: DocsDocument[] = []

  for await (
    const entry of walk(inputDir, { includeDirs: false, followSymlinks: false })
  ) {
    const extension = extname(entry.path).toLowerCase() as ".md" | ".mdx"
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      continue
    }
    if (!includeMdx && extension === ".mdx") {
      continue
    }

    const sourcePath = relative(inputDir, entry.path).replaceAll("\\", "/")
    const sourceText = await Deno.readTextFile(entry.path)
    const parsed = matter(sourceText)
    const routePath = sourceToRoute(sourcePath)

    docs.push({
      absolutePath: entry.path,
      sourcePath,
      routePath,
      slug: slugify(routePath),
      extension,
      frontmatter: parsed.data,
      markdownBody: parsed.content,
    })
  }

  docs.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath))
  return docs
}

export const buildPages = (documents: DocsDocument[]): DocsPage[] => {
  return documents
    .filter((doc) => doc.frontmatter.draft !== true)
    .map((doc, index) => {
      const rendered = renderDocument(doc)
      const fallbackTitle = inferTitleFromSource(doc.sourcePath)
      const title = stringValue(doc.frontmatter.title) ?? fallbackTitle
      const navTitle = stringValue(doc.frontmatter.navTitle) ?? title
      const description = stringValue(doc.frontmatter.description) ?? ""
      const navOrder = numberValue(doc.frontmatter.navOrder) ?? index
      const sectionPath = resolveSectionPath(doc)
      const sectionMeta = resolveSectionMeta(doc, sectionPath)

      return {
        id: doc.slug || `page-${index}`,
        routePath: doc.routePath,
        sourcePath: doc.sourcePath,
        title,
        description,
        navTitle,
        navOrder,
        sectionPath,
        sectionMeta,
        html: rendered.html,
        plainText: rendered.plainText,
        toc: doc.frontmatter.toc === false ? [] : rendered.toc,
        draft: false,
      }
    })
}

const sourceToRoute = (sourcePath: string): string => {
  const extension = extname(sourcePath)
  const withoutExtension = sourcePath.slice(0, -extension.length)

  if (withoutExtension === "index") {
    return "/"
  }

  if (withoutExtension.endsWith("/index")) {
    return `/${withoutExtension.slice(0, -6)}/`
  }

  return `/${withoutExtension}/`
}

const inferTitleFromSource = (sourcePath: string): string => {
  const extension = extname(sourcePath)
  const withoutExt = sourcePath.slice(0, -extension.length)
  const leaf = withoutExt.split("/").at(-1) ?? withoutExt
  return leaf
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (value) => value.toUpperCase())
}

const resolveSectionPath = (doc: DocsDocument): string[] => {
  const navSectionValue = doc.frontmatter.navSection ?? doc.frontmatter.navPath
  if (Array.isArray(navSectionValue)) {
    return navSectionValue.map((part) => `${part}`.trim()).filter(Boolean)
  }
  if (typeof navSectionValue === "string") {
    return navSectionValue.split("/").map((part) => part.trim()).filter(Boolean)
  }

  const folder = dirname(doc.sourcePath)
  if (folder === ".") {
    return []
  }
  return folder.split("/").filter(Boolean)
}

const resolveSectionMeta = (
  doc: DocsDocument,
  sectionPath: string[],
): Array<{ title?: string; order?: number }> => {
  const titles = arrayOfStrings(doc.frontmatter.navSectionTitles)
  const orders = arrayOfNumbers(doc.frontmatter.navSectionOrders)
  const tailTitle = stringValue(doc.frontmatter.navSectionTitle)
  const tailOrder = numberValue(doc.frontmatter.navSectionOrder)

  return sectionPath.map((_, index) => {
    const isTail = index === sectionPath.length - 1
    return {
      title: titles[index] ?? (isTail ? tailTitle : undefined),
      order: orders[index] ?? (isTail ? tailOrder : undefined),
    }
  })
}

const stringValue = (value: unknown): string | undefined => {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined
}

const numberValue = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  return undefined
}

const arrayOfStrings = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
}

const arrayOfNumbers = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((
      item,
    ) => (typeof item === "number" && Number.isFinite(item) ? item : NaN))
    .filter((item) => Number.isFinite(item))
}

export const routeToOutputPath = (
  outputDir: string,
  routePath: string,
): string => {
  if (routePath === "/") {
    return join(outputDir, "index.html")
  }
  const cleaned = routePath.replace(/^\/+|\/+$/g, "")
  return join(outputDir, cleaned, "index.html")
}
