import { join } from "@std/path"
import { MarkdownFile } from "./crawler.ts"

// Source directory
const mdFileDir = "/fobx"

/**
 * Supported frontmatter properties for markdown files:
 *
 * ---
 * title: Page Title                # Override auto-detected title (optional)
 * description: Page description    # Custom description for SEO and previews
 * order: 100                       # Controls sort order in navigation (lower numbers appear first)
 * tags: ["tag1", "tag2"]           # Categorize content (comma-separated or array)
 * draft: true                      # If true, page won't be included in production builds
 * hideInNav: true                  # If true, page won't be shown in navigation
 * parent: parent-slug              # Override auto-detected parent based on file structure
 * redirect: /new-url               # Redirect to another page
 * disableTableOfContents: true     # If true, the table of contents won't be shown
 * showEditButton: false            # If false, edit button won't be displayed
 * lastModified: 2025-05-30         # Override the auto-detected file modification date
 * author: Author Name              # Content author
 * ---
 */

/**
 * Interface for site metadata
 */
export interface SiteMetadata {
  routes: RouteMetadata[]
  lastUpdated: string
  siteInfo: {
    title: string
    description: string
    version: string
    baseUrl: string
  }
  navigation: {
    mainNav: NavItem[]
    sidebar: SidebarSection[]
  }
}

/**
 * Interface for route metadata
 */
export interface RouteMetadata {
  slug: string
  title: string
  path: string
  sourcePath: string
  parentSlug?: string
  children?: string[]
  order?: number
  description?: string
  tags?: string[]
  lastModified?: string
  draft?: boolean
  hideInNav?: boolean
  redirect?: string
  disableTableOfContents?: boolean
  showEditButton?: boolean
  author?: string
}

/**
 * Interface for navigation item
 */
export interface NavItem {
  label: string
  path: string
  isExternal?: boolean
}

/**
 * Interface for sidebar section
 */
export interface SidebarSection {
  title: string
  items: NavItem[]
}

/**
 * Generate and write site metadata
 */
export async function generateMetadata(
  files: MarkdownFile[],
  dirs: Record<string, string>,
  outputIndividualFiles = true,
): Promise<SiteMetadata> {
  console.log("Generating site metadata...")

  // Create route metadata for each file
  const routes: RouteMetadata[] = files.map((file) => {
    // Extract directory structure to potentially build a hierarchy
    const relativePath = file.path.replace(mdFileDir, "").replace(/^\//, "")
    const pathSegments = relativePath.split("/")
    const parentDir = pathSegments.length > 1
      ? pathSegments.slice(0, -1).join("/")
      : undefined

    // Parse frontmatter for additional metadata
    const frontmatter = extractFrontmatter(file.content)

    // Extract file stats for last modified date if available
    let lastModified: string | undefined = undefined
    try {
      // If frontmatter specifies lastModified, use that instead
      if (frontmatter.lastModified) {
        lastModified = new Date(frontmatter.lastModified).toISOString()
      } else {
        const fileInfo = Deno.statSync(file.path)
        if (fileInfo.mtime) {
          lastModified = fileInfo.mtime.toISOString()
        }
      }
    } catch (e) {
      console.warn(
        `Could not get file stats for ${file.path}: ${(e as Error).message}`,
      )
    }

    // Use frontmatter parent if specified, otherwise use directory structure
    let inferredParentSlug = undefined

    // If path is like /core/docs/something.md, the parent should be "core"
    if (pathSegments.length > 2 && pathSegments[1] === "docs") {
      inferredParentSlug = pathSegments[0]
    } // For files in subdirectories (but not in a docs folder)
    else if (parentDir && file.fileName.toLowerCase() !== "readme.md") {
      inferredParentSlug = pathSegments[0]
    }

    // Final parent slug priority: frontmatter > inference > directory structure
    const parentSlug = frontmatter.parent || inferredParentSlug ||
      (parentDir && pathSegments.length === 2 &&
          file.fileName.toLowerCase() === "readme.md"
        ? undefined // README.md files in top-level dirs are themselves parents
        : parentDir
        ? parentDir.toLowerCase().replace(/\s+/g, "-").replace(/[^\w\-]/g, "")
        : undefined)

    return {
      slug: file.slug || "",
      title: frontmatter.title || file.title || "Untitled",
      path: `/${file.slug || ""}`,
      sourcePath: file.path,
      parentSlug,
      order: frontmatter.order,
      description: frontmatter.description || extractDescription(file.content),
      tags: frontmatter.tags,
      lastModified,
      draft: frontmatter.draft || false,
      hideInNav: frontmatter.hideInNav || false,
      redirect: frontmatter.redirect,
      disableTableOfContents: frontmatter.disableTableOfContents || false,
      showEditButton: frontmatter.showEditButton !== false, // Default to true
      author: frontmatter.author,
    }
  })

  // Filter out draft content in production builds
  const isProduction = Deno.env.get("ENVIRONMENT") === "production"
  const filteredRoutes = isProduction
    ? routes.filter((route) => !route.draft)
    : routes

  // Organize routes into parent-child relationships
  const routesWithChildren = organizeRouteHierarchy(filteredRoutes)

  // Generate navigation structure from routes
  const { mainNav, sidebar } = generateNavigation(
    routesWithChildren.filter((route) => !route.hideInNav),
  )

  // Create the full metadata object
  const metadata: SiteMetadata = {
    routes: routesWithChildren,
    lastUpdated: new Date().toISOString(),
    siteInfo: {
      title: "FobX Documentation",
      description: "Documentation for FobX state management library",
      version: "1.0.0", // This could be read from package.json or deno.jsonc
      baseUrl: "/",
    },
    navigation: {
      mainNav,
      sidebar,
    },
  }

  // Write the main metadata.json file
  const metadataPath = join(dirs.public, "metadata.json")
  await Deno.writeTextFile(metadataPath, JSON.stringify(metadata, null, 2))
  console.log(`Main metadata written to ${metadataPath}`)

  // Optionally write individual metadata files
  if (outputIndividualFiles) {
    // Write individual route metadata files
    for (const route of routesWithChildren) {
      const routeMetadataPath = join(
        dirs.metadata,
        `${route.slug || "index"}.json`,
      )
      await Deno.writeTextFile(
        routeMetadataPath,
        JSON.stringify(
          {
            ...route,
            // Include direct children data for easier navigation
            childPages: route.children
              ? route.children.map((childSlug) => {
                const childRoute = routesWithChildren.find((r) =>
                  r.slug === childSlug
                )
                return childRoute
                  ? {
                    slug: childRoute.slug,
                    title: childRoute.title,
                    path: childRoute.path,
                    description: childRoute.description,
                  }
                  : null
              }).filter(Boolean)
              : [],
          },
          null,
          2,
        ),
      )
    }
    console.log(`Individual metadata files written to ${dirs.metadata}/`)
  }

  return metadata
}

/**
 * Extract frontmatter from markdown content
 */
function extractFrontmatter(content: string): Record<string, any> {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!frontmatterMatch) {
    return {}
  }

  const frontmatterContent = frontmatterMatch[1]
  const result: Record<string, any> = {}

  // Process each line of the frontmatter
  frontmatterContent.split("\n").forEach((line) => {
    const match = line.match(/^(\w+):\s*(.*)/)
    if (match) {
      const [, key, value] = match

      // Parse the value based on its content
      if (value.trim() === "true") {
        result[key] = true
      } else if (value.trim() === "false") {
        result[key] = false
      } else if (/^\d+$/.test(value.trim())) {
        result[key] = parseInt(value.trim(), 10)
      } else if (value.trim().startsWith("[") && value.trim().endsWith("]")) {
        try {
          // Parse as JSON array
          result[key] = JSON.parse(value.trim())
        } catch {
          // Fallback to comma-separated string parsing
          result[key] = value.trim()
            .substring(1, value.trim().length - 1)
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        }
      } else {
        // Remove surrounding quotes if present
        result[key] = value.trim().replace(/^["'](.*)["']$/, "$1")
      }
    }
  })

  return result
}

/**
 * Extract description from markdown content
 */
function extractDescription(content: string): string | undefined {
  // Try to extract description from frontmatter
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (frontmatterMatch) {
    const frontmatterContent = frontmatterMatch[1]
    const descriptionLine = frontmatterContent
      .split("\n")
      .find((line) => line.startsWith("description:"))

    if (descriptionLine) {
      const description = descriptionLine.substring(12).trim()
      // Remove any surrounding quotes if present
      return description.replace(/^["'](.*)["']$/, "$1")
    }
  }

  // If no frontmatter description, try to use the first paragraph
  const contentWithoutFrontmatter = content.replace(
    /^---\s*\n[\s\S]*?\n---/,
    "",
  ).trim()
  const firstParagraphMatch = contentWithoutFrontmatter.match(
    /^(?:(?!#).)*?([^\n]+)/,
  )
  if (firstParagraphMatch) {
    const firstParagraph = firstParagraphMatch[1].trim()
    // Truncate if too long
    return firstParagraph.length > 160
      ? firstParagraph.substring(0, 157) + "..."
      : firstParagraph
  }

  return undefined
}

/**
 * Organize routes into a hierarchy
 */
function organizeRouteHierarchy(routes: RouteMetadata[]): RouteMetadata[] {
  const routesCopy = [...routes]

  // First pass: establish parent-child relationships
  routesCopy.forEach((route) => {
    if (route.parentSlug) {
      // Find parent route
      const parentRoute = routesCopy.find((r) => r.slug === route.parentSlug)
      if (parentRoute) {
        // Initialize children array if needed
        if (!parentRoute.children) {
          parentRoute.children = []
        }
        // Add this route's slug to parent's children
        parentRoute.children.push(route.slug)
      }
    }
  })

  // Sort routes - top-level first, then by any specified order or by title
  return routesCopy.sort((a, b) => {
    // Sort by parent/child (parents first)
    const aHasParent = !!a.parentSlug
    const bHasParent = !!b.parentSlug
    if (aHasParent !== bHasParent) {
      return aHasParent ? 1 : -1
    }

    // If both have same parent status, sort by order if specified
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order
    }

    // Finally sort alphabetically by title
    return a.title.localeCompare(b.title)
  })
}

/**
 * Generate navigation structure from routes
 */
function generateNavigation(routes: RouteMetadata[]): {
  mainNav: NavItem[]
  sidebar: SidebarSection[]
} {
  // Create main navigation items (top level routes)
  const mainNav: NavItem[] = routes
    .filter((route) => !route.parentSlug)
    .slice(0, 5) // Limit main nav to first 5 top-level items
    .map((route) => ({
      label: route.title,
      path: route.path,
    }))

  // Add a "Documentation" item if not already included
  if (!mainNav.some((item) => item.label === "Documentation")) {
    mainNav.unshift({
      label: "Documentation",
      path: "/",
    })
  }

  // Add GitHub link
  mainNav.push({
    label: "GitHub",
    path: "https://github.com/jereklas/fobx",
    isExternal: true,
  })

  // Create sidebar sections
  const sidebar: SidebarSection[] = []

  // Group items by their top-level parent
  const topLevelRoutes = routes.filter((route) => !route.parentSlug)

  topLevelRoutes.forEach((topRoute) => {
    const section: SidebarSection = {
      title: topRoute.title,
      items: [],
    }

    // Add the top route itself
    section.items.push({
      label: "Overview",
      path: topRoute.path,
    })

    // Add all direct children
    if (topRoute.children) {
      const childItems = topRoute.children
        .map((childSlug) => routes.find((r) => r.slug === childSlug))
        .filter(Boolean)
        .map((childRoute) => ({
          label: childRoute!.title,
          path: childRoute!.path,
        }))

      section.items.push(...childItems)
    }

    // Only add sections with items
    if (section.items.length > 0) {
      sidebar.push(section)
    }
  })

  return { mainNav, sidebar }
}
