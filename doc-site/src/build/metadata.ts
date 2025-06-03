import { relative } from "@std/path"
import { crawlFiles } from "@fobx/utils"
import {
  calculateReadingTime,
  FileWithFrontmatter,
  Frontmatter,
  processFrontmatter,
} from "./frontmatter.ts"
import type * as Markdoc from "@markdoc/markdoc"
import { parseMarkdoc } from "./markdoc.ts"

// Source directory
const mdFileDir = "/fobx"

/**
 * Options for metadata generation
 */
export interface MetadataOptions {
  contentDirs: string[]
  excludeDirs?: string[]
  extensions?: string[]
  baseUrl?: string
}

export interface SiteInfo {
  title: string
  description: string
  version: string
  baseUrl: string
}

export interface NavigationMetadata {
  mainNav: NavItem[]
  sidebar: SidebarSection[]
}

/**
 * Interface for site metadata
 */
export interface SiteMetadata {
  routes: RouteMetadata[]
  lastUpdated: string
  siteInfo: SiteInfo
  navigation: NavigationMetadata
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
  lastModified?: string
  readingTime?: {
    minutes: number
    words: number
  }
  frontmatter: Frontmatter
  content: {
    ast: Markdoc.RenderableTreeNode
    toc: TableOfContentsItem[]
  }
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
  options: MetadataOptions,
): Promise<SiteMetadata> {
  const {
    contentDirs,
    excludeDirs = ["node_modules", ".git", "dist", "build", "coverage"],
    extensions = [".mdoc"],
    baseUrl,
  } = options

  // Find all markdown files and process their frontmatter
  const files = await crawlMarkdownFiles(contentDirs, excludeDirs, extensions)

  // Create route metadata for each file
  const routes: RouteMetadata[] = files.map((file) => {
    // Extract directory structure to potentially build a hierarchy
    const relativePath = file.path.replace(mdFileDir, "").replace(/^\//, "")
    const pathSegments = relativePath.split("/")
    const parentDir = pathSegments.length > 1
      ? pathSegments.slice(0, -1).join("/")
      : undefined

    // Extract file stats for last modified date if available
    let lastModified: string | undefined = undefined
    try {
      const fileInfo = Deno.statSync(file.path)
      if (fileInfo.mtime) {
        lastModified = fileInfo.mtime.toISOString()
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
    const parentSlug = file.frontmatter.parent || inferredParentSlug ||
      (parentDir && pathSegments.length === 2 &&
          file.fileName.toLowerCase() === "readme.md"
        ? undefined // README.md files in top-level dirs are themselves parents
        : parentDir
        ? parentDir.toLowerCase().replace(/\s+/g, "-").replace(/[^\w\-]/g, "")
        : undefined)

    return {
      slug: file.slug || "",
      path: `/${file.slug || ""}`,
      title: file.title,
      sourcePath: file.path,
      parentSlug,
      lastModified,
      readingTime: file.readingTime,
      frontmatter: {
        // Core fields
        description: file.description,
        order: file.frontmatter.order,
        tags: file.frontmatter.tags,
        draft: file.frontmatter.draft,
        hideInNav: file.frontmatter.hideInNav,
        parent: file.frontmatter.parent,
        redirect: file.frontmatter.redirect,
        author: file.frontmatter.author,
        disableTableOfContents: file.frontmatter.disableTableOfContents,
        showEditButton: file.frontmatter.showEditButton !== false,
        // Navigation enhancements
        prevPage: file.frontmatter.prevPage,
        nextPage: file.frontmatter.nextPage,
        // SEO enhancements
        keywords: file.frontmatter.keywords,
        canonical: file.frontmatter.canonical,
        // Categorization
        category: file.frontmatter.category,
        subcategory: file.frontmatter.subcategory,
        // Display options
        template: file.frontmatter.template,
        tocDepth: file.frontmatter.tocDepth,
        // Version information
        versionAdded: file.frontmatter.versionAdded,
        versionUpdated: file.frontmatter.versionUpdated,
        versionDeprecated: file.frontmatter.versionDeprecated,
        // Additional content features
        hasInteractiveExamples: file.frontmatter.hasInteractiveExamples,
        hasPlayground: file.frontmatter.hasPlayground,
        // Publishing metadata
        publishDate: file.frontmatter.publishDate,
        expiryDate: file.frontmatter.expiryDate,
        // Allow for custom frontmatter properties
        ...file.frontmatter,
      },
      content: {
        ast: {} as Markdoc.RenderableTreeNode,
        toc: [] as TableOfContentsItem[],
      },
    }
  })

  // Filter out draft content in production builds
  const isProduction = Deno.env.get("ENVIRONMENT") === "production"
  const filteredRoutes = isProduction
    ? routes.filter((route) => !route.frontmatter.draft)
    : routes

  // Organize routes into parent-child relationships
  const routesWithChildren = organizeRouteHierarchy(filteredRoutes)

  // Check if we have a root index page, if not create one that redirects to the first appropriate page
  const hasRootIndex = routesWithChildren.some((route) =>
    route.slug === "index"
  )
  if (!hasRootIndex) {
    // Find the most appropriate page to redirect to
    // First try to find a top-level route without a parent
    const topLevelRoutes = routesWithChildren.filter((route) =>
      !route.parentSlug
    )
    let redirectTarget = topLevelRoutes[0] // Default to first top-level route if available

    // If there are no top-level routes, use the first available route
    if (!redirectTarget && routesWithChildren.length > 0) {
      redirectTarget = routesWithChildren[0]
    }

    // Create a synthetic index route that redirects if we found a target
    if (redirectTarget) {
      routesWithChildren.push({
        slug: "index",
        path: "/",
        title: "Documentation Home",
        sourcePath: "generated-index", // Mark as generated
        frontmatter: {
          // Set redirect to the target page
          redirect: redirectTarget.path,
          hideInNav: true,
          description: "FobX Documentation - Redirecting to homepage",
          showEditButton: false,
        },
        content: {
          ast: {} as Markdoc.RenderableTreeNode,
          toc: [] as TableOfContentsItem[],
        },
      })
      console.log(`Created redirect index.html -> ${redirectTarget.path}`)
    }
  }

  // Parse markdown files and add transformed AST content to each route
  await parseMarkdoc(files, routesWithChildren, { baseUrl: baseUrl || "/" })

  // Generate navigation structure from routes
  const { mainNav, sidebar } = generateNavigation(
    routesWithChildren.filter((route) => !route.frontmatter.hideInNav),
  )

  // Create the full metadata object
  const metadata: SiteMetadata = {
    routes: routesWithChildren,
    lastUpdated: new Date().toISOString(),
    siteInfo: {
      title: "FobX Documentation",
      description: "Documentation for FobX state management library",
      version: "1.0.0", // This could be read from package.json or deno.jsonc
      baseUrl: baseUrl || "/",
    },
    navigation: {
      mainNav,
      sidebar,
    },
  }

  return metadata
}

/**
 * Crawls multiple directories to find markdown files and process their metadata
 */
export async function crawlMarkdownFiles(
  contentDirs: string[],
  excludeDirs: string[],
  extensions: string[],
): Promise<FileWithFrontmatter[]> {
  const files = await crawlFiles(contentDirs, {
    extensions,
    excludeDirs,
    loadContent: true,
  })

  // Process files to extract frontmatter and generate slugs
  const markdownFiles = files.map((file) => {
    // Process frontmatter, title and description in a single pass
    const { frontmatter, title, description } = processFrontmatter(
      file.content,
      file.fileName,
    )

    // Calculate reading time
    const readingTime = calculateReadingTime(file.content)

    // Create a better slug from the file path
    // This ensures nested directories create proper URL structures
    const rootDir = contentDirs[0] // Use the first content directory as root
    const relativePath = relative(rootDir, file.path)

    // Create slug from the relative path without extension
    let slug = ""
    if (file.fileName.toLowerCase() === "readme.md") {
      // For README.md, use the directory name as the slug
      // If it's the root README, just use "index"
      const pathParts = relativePath.split("/").filter(Boolean)
      slug = pathParts.length > 1
        ? pathParts.slice(0, -1).join("-").toLowerCase()
        : "index"
    } else {
      // For other files, use the relative path, replacing directories with dashes
      slug = relativePath
        .replace(/\.(md|mdoc)$/, "")
        .replace(/\//g, "-")
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\w\-]/g, "")
    }

    // Return the file with processed frontmatter
    return {
      ...file,
      frontmatter,
      title,
      slug,
      description,
      readingTime,
    }
  })

  return markdownFiles
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
    if (
      a.frontmatter.order !== undefined && b.frontmatter.order !== undefined
    ) {
      return a.frontmatter.order - b.frontmatter.order
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
    // TODO: this should be read from deno.jsonc
    path: "https://github.com/jereklas/fobx",
    isExternal: true,
  })

  // Create sidebar sections
  const sidebar: SidebarSection[] = []

  // Group items by their top-level parent
  const topLevelRoutes = routes.filter((route) => !route.parentSlug)

  // Handle routes with existing top-level parents
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

  // Handle orphaned child routes (routes with parentSlug but no existing parent)
  const orphanedRoutes = routes.filter((route) =>
    route.parentSlug && !routes.some((r) => r.slug === route.parentSlug)
  )

  // Group orphaned routes by their parentSlug
  const orphanedGroups = new Map<string, RouteMetadata[]>()
  orphanedRoutes.forEach((route) => {
    if (!orphanedGroups.has(route.parentSlug!)) {
      orphanedGroups.set(route.parentSlug!, [])
    }
    orphanedGroups.get(route.parentSlug!)!.push(route)
  })

  // Create sections for orphaned groups
  orphanedGroups.forEach((groupRoutes, parentSlug) => {
    // Sort routes by order or title
    const sortedRoutes = groupRoutes.sort((a, b) => {
      if (
        a.frontmatter.order !== undefined && b.frontmatter.order !== undefined
      ) {
        return a.frontmatter.order - b.frontmatter.order
      }
      return a.title.localeCompare(b.title)
    })

    const section: SidebarSection = {
      title: parentSlug.charAt(0).toUpperCase() + parentSlug.slice(1), // Capitalize first letter
      items: sortedRoutes.map((route) => ({
        label: route.title,
        path: route.path,
      })),
    }

    sidebar.push(section)
  })

  return { mainNav, sidebar }
}
