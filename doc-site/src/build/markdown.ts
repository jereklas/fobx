import Markdoc from "@markdoc/markdoc"
import { MarkdownFile } from "./crawler.ts"
import { RouteMetadata } from "./metadata.ts"

/**
 * Interface for parsed document
 */
export interface ParsedDocument {
  slug: string
  title: string
  content: string
  ast: Markdoc.RenderableTreeNode // Updated to use the proper type for transformed AST
  toc: TableOfContentsItem[]
}

/**
 * Interface for table of contents item
 */
export interface TableOfContentsItem {
  id: string
  level: number
  title: string
  children?: TableOfContentsItem[]
}

/**
 * Load Markdoc configuration from markdoc.config.json file
 */
async function loadMarkdocConfig() {
  const file = await import("../../markdoc.schema.mjs")
  return file.default
}

/**
 * Parse markdown files using Markdoc
 */
export async function parseMarkdownFiles(
  files: MarkdownFile[],
  routes: RouteMetadata[],
  _dirs: Record<string, string>, // Prefixed with underscore since it's unused
): Promise<Map<string, ParsedDocument>> {
  // Load the Markdoc configuration from the external file
  const markdocConfig = await loadMarkdocConfig()

  const parsedDocuments = new Map<string, ParsedDocument>()

  for (const file of files) {
    const route = routes.find((r) => r.slug === file.slug)
    if (!route) continue // Skip if no corresponding route

    // Skip processing if this is a draft in production mode
    const isProduction = Deno.env.get("ENVIRONMENT") === "production"
    if (isProduction && route.draft) continue

    // Parse the markdown content
    const ast = Markdoc.parse(file.content)

    // Transform the AST using the Markdoc config
    const transformed = Markdoc.transform(ast, markdocConfig as Markdoc.Config)

    // Generate table of contents from the transformed AST (unless disabled in frontmatter)
    const toc = route.disableTableOfContents
      ? []
      : generateTableOfContents(transformed)

    // Create parsed document
    const parsedDoc: ParsedDocument = {
      slug: file.slug || "",
      title: file.title || "Untitled",
      content: file.content,
      ast: transformed, // Use transformed AST instead of raw AST
      toc,
    }

    parsedDocuments.set(file.slug || "index", parsedDoc)
  }

  return parsedDocuments
}

// Define a more specific type for the transformed AST heading node
interface HeadingNode {
  name: string
  attributes?: {
    id?: string
    level?: number
    [key: string]: unknown
  }
  children?: (HeadingNode | string)[]
}

/**
 * Generate table of contents from transformed AST
 */
function generateTableOfContents(
  ast: Markdoc.RenderableTreeNode,
): TableOfContentsItem[] {
  const headings: TableOfContentsItem[] = []

  // Function to recursively traverse the transformed AST
  function traverseAST(node: Markdoc.RenderableTreeNode) {
    if (!node) return

    // Check if node is a heading element
    if (
      typeof node === "object" &&
      node !== null &&
      "name" in node &&
      node.name === "Heading"
    ) {
      const headingNode = node as HeadingNode

      // Extract heading level and id from attributes
      const level = headingNode.attributes?.level ?? 0
      const id = headingNode.attributes?.id ?? ""

      // Skip h1 headings as they're typically page titles
      if (level === 1) return

      // Extract heading text from children
      let title = ""

      function extractText(
        children: (HeadingNode | string)[] | undefined,
      ): string {
        if (!children || !Array.isArray(children)) return ""

        return children.map((child) => {
          if (typeof child === "string") {
            return child
          } else if (
            typeof child === "object" && child && "children" in child
          ) {
            return extractText(child.children)
          }
          return ""
        }).join("")
      }

      if ("children" in headingNode && Array.isArray(headingNode.children)) {
        title = extractText(headingNode.children).trim()
      }

      // Add to our headings list
      headings.push({
        id: String(id),
        level: Number(level),
        title,
      })
    }

    // Recursively process children
    if (
      typeof node === "object" && node !== null && "children" in node &&
      Array.isArray(node.children)
    ) {
      node.children.forEach(traverseAST)
    }
  }

  // Start traversal from the root node
  traverseAST(ast)

  // Convert flat list of headings to hierarchical TOC
  return organizeTableOfContents(headings)
}

/**
 * Organize flat list of headings into a hierarchical table of contents
 */
function organizeTableOfContents(
  headings: TableOfContentsItem[],
): TableOfContentsItem[] {
  if (headings.length === 0) return []

  const result: TableOfContentsItem[] = []
  const parentStack: TableOfContentsItem[] = []

  for (const heading of headings) {
    // Create a new entry
    const entry: TableOfContentsItem = {
      ...heading,
      children: [],
    }

    // Find the appropriate parent for this heading
    while (
      parentStack.length > 0 &&
      parentStack[parentStack.length - 1].level >= heading.level
    ) {
      parentStack.pop()
    }

    if (parentStack.length === 0) {
      // This is a top-level heading
      result.push(entry)
      parentStack.push(entry)
    } else {
      // Add as a child to the current parent
      const parent = parentStack[parentStack.length - 1]
      parent.children = parent.children || []
      parent.children.push(entry)
      parentStack.push(entry)
    }
  }

  return result
}
