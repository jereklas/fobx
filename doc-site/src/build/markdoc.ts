import Markdoc from "@markdoc/markdoc"
import { FileWithFrontmatter } from "./frontmatter.ts"
import { RouteMetadata, TableOfContentsItem } from "./metadata.ts"

/**
 * Load Markdoc configuration from markdoc.config.json file
 */
async function loadMarkdocConfig() {
  const file = await import("../../markdoc.schema.mjs")
  return file.default as Markdoc.Config
}

/**
 * Create a link resolver function that can transform relative .mdoc links to proper route paths
 */
function createLinkResolver(
  routes: RouteMetadata[],
  currentRoute: RouteMetadata,
  baseUrl: string,
) {
  return (href: string): string => {
    // Handle relative links to .mdoc files
    if (href.endsWith(".mdoc")) {
      // Remove .mdoc extension and any leading ./
      let targetFile = href.replace(/^\.\//, "").replace(/\.mdoc$/, "")

      // If it's just a filename (no path), we need to find the actual route
      // by looking at the current route's context
      if (!targetFile.includes("/")) {
        // Extract the parent directory from current route's source path
        const currentSourceDir = currentRoute.sourcePath.split("/").slice(0, -1)
          .join("/")

        // Try to find a route that matches this file in the same directory structure
        const targetRoute = routes.find((route) => {
          const routeSourceDir = route.sourcePath.split("/").slice(0, -1).join(
            "/",
          )
          const routeFileName = route.sourcePath.split("/").pop()?.replace(
            /\.mdoc$/,
            "",
          )

          return routeSourceDir === currentSourceDir &&
            routeFileName === targetFile
        })

        if (targetRoute) {
          // Apply baseUrl to the route path
          return baseUrl === "/"
            ? targetRoute.path
            : `${baseUrl}${targetRoute.path}`
        }
      }

      // If we can't find a specific route, fall back to the generic transformation
      // Convert path separators to dashes for nested files
      let slug = targetFile.replace(/\//g, "-").toLowerCase()
      const fallbackPath = `/${slug}`
      return baseUrl === "/" ? fallbackPath : `${baseUrl}${fallbackPath}`
    }

    // Handle other relative links (like ./some-path)
    if (href.startsWith("./") && !href.includes(".")) {
      // Remove leading ./ and ensure it starts with /
      const relativePath = `/${href.replace(/^\.\//, "")}`
      return baseUrl === "/" ? relativePath : `${baseUrl}${relativePath}`
    }

    return href
  }
}

/**
 * Parse markdown files using Markdoc and store transformed AST in route metadata
 */
export async function parseMarkdoc(
  files: FileWithFrontmatter[],
  routes: RouteMetadata[],
  siteInfo: { baseUrl: string },
): Promise<void> {
  // Load the Markdoc configuration from the external file
  const baseMarkdocConfig = await loadMarkdocConfig()

  for (const file of files) {
    const route = routes.find((r) => r.slug === file.slug)
    if (!route) continue // Skip if no corresponding route

    // Skip processing if this is a draft in production mode
    const isProduction = Deno.env.get("ENVIRONMENT") === "production"
    if (isProduction && route.frontmatter.draft) continue

    // Create a copy of the config for this route
    const markdocConfig = { ...baseMarkdocConfig }

    // Initialize variables in the Markdoc config if not present
    if (!markdocConfig.variables) {
      // @ts-expect-error - type says variables is readonly, but we're constructing it
      markdocConfig.variables = {}
    }

    // Insert frontmatter into markdocConfig.variables
    markdocConfig.variables.frontmatter = file.frontmatter

    // Create a custom link resolver for this route with baseUrl
    const linkResolver = createLinkResolver(routes, route, siteInfo.baseUrl)

    // Override the link node configuration to use our custom transformer
    if (!markdocConfig.nodes) {
      // @ts-expect-error - type says nodes is readonly, but we're constructing it
      markdocConfig.nodes = {}
    }

    // @ts-expect-error - we're dynamically adding link transformation
    markdocConfig.nodes.link = {
      ...baseMarkdocConfig.nodes?.link,
      transform: (node: any, config: any) => {
        const attributes = node.transformAttributes(config)
        const children = node.transformChildren(config)

        // Transform the href using our custom resolver
        if (attributes.href) {
          attributes.href = linkResolver(attributes.href)
        }

        return {
          name: "Link",
          attributes,
          children,
        }
      },
    }

    // Parse the markdown content
    // Note: We could remove frontmatter to avoid parsing it in the AST,
    // but Markdoc already ignores YAML frontmatter by default
    const ast = Markdoc.parse(file.content)

    // Transform the AST using the Markdoc config with frontmatter variables
    const transformed = Markdoc.transform(ast, markdocConfig as Markdoc.Config)

    // Generate table of contents from the transformed AST (unless disabled in frontmatter)
    const toc = file.frontmatter.disableTableOfContents
      ? []
      : generateTableOfContents(transformed)

    // Store the transformed AST and TOC directly in the route metadata
    route.content = {
      ast: transformed,
      toc,
    }
  }
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
