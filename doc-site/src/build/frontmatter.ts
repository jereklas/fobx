/**
 * Represents parsed frontmatter data from markdown files
 */
export interface Frontmatter {
  // Core fields (mirrored from top-level for backward compatibility)
  title?: string
  description?: string
  tags?: string[]
  parent?: string
  author?: string
  // Navigation enhancements
  order?: number
  redirect?: string
  hideInNav?: boolean
  showEditButton?: boolean
  disableTableOfContents?: boolean
  prevPage?: { path: string; title: string }
  nextPage?: { path: string; title: string }
  // SEO enhancements
  keywords?: string[]
  canonical?: string
  // Categorization
  category?: string
  subcategory?: string
  // Display options
  template?: string
  tocDepth?: number
  // Version information
  draft?: boolean
  versionAdded?: string
  versionUpdated?: string
  versionDeprecated?: string
  // Additional content features
  hasInteractiveExamples?: boolean
  hasPlayground?: boolean
  // Publishing metadata
  publishDate?: string
  expiryDate?: string
}

/**
 * Processes markdown content to extract frontmatter, title, and description
 * in a single pass with appropriate fallbacks
 */
export function processFrontmatter(
  content: string,
  fileName: string,
): {
  frontmatter: Frontmatter
  title: string
  description?: string
} {
  // deno-lint-ignore no-explicit-any
  const result: Record<string, any> = {} satisfies Frontmatter
  let title: string
  let description: string | undefined

  // Extract frontmatter if it exists
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (frontmatterMatch) {
    const frontmatterContent = frontmatterMatch[1]

    // Process each line of the frontmatter
    frontmatterContent.split("\n").forEach((line) => {
      const match = line.match(/^(\w+):\s*(.*)/)
      if (match) {
        const [, key, value] = match as [string, keyof Frontmatter, string]

        // Parse the value based on its content
        if (value.trim() === "true") {
          result[key] = true
        } else if (value.trim() === "false") {
          result[key] = false
        } else if (/^\d+$/.test(value.trim())) {
          result[key] = parseInt(value.trim(), 10)
        } else if (value.trim().startsWith("{") && value.trim().endsWith("}")) {
          try {
            // Parse as JSON object
            result[key] = JSON.parse(value.trim())
          } catch {
            // Fallback to string if JSON parsing fails
            result[key] = value.trim().replace(/^["'](.*)["']$/, "$1")
          }
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
  }

  // Determine title (frontmatter > markdown heading > filename)
  if (result.title) {
    title = result.title
  } else {
    const titleMatch = content.match(/^#\s+(.+)$/m)
    if (titleMatch) {
      title = titleMatch[1].trim()
      // Store the extracted title back in frontmatter
      result.title = title
    } else {
      title = fileName
        .replace(/\.(md|mdoc)$/, "")
        .split(/[-_]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
      // Store the filename-based title back in frontmatter
      result.title = title
    }
  }

  // Determine description (frontmatter > first paragraph)
  if (result.description) {
    description = result.description
  } else {
    const contentWithoutFrontmatter = content.replace(
      /^---\s*\n[\s\S]*?\n---/,
      "",
    ).trim()

    const firstParagraphMatch = contentWithoutFrontmatter.match(
      /^(?:(?!#).)*?([^\n]+)/,
    )

    if (firstParagraphMatch) {
      description = firstParagraphMatch[1].trim()
      // Truncate if too long
      if (description.length > 160) {
        description = description.substring(0, 157) + "..."
      }
      // Store the extracted description back in frontmatter
      result.description = description
    }
  }

  return {
    frontmatter: result,
    title,
    description,
  }
}

/**
 * Calculate reading time based on content length and complexity
 * @param content The content to calculate reading time for
 * @returns Object with minutes and word count
 */
export function calculateReadingTime(content: string) {
  // Remove code blocks, frontmatter, and markdown syntax to get more accurate word count
  const cleanContent = content
    .replace(/^---\s*\n[\s\S]*?\n---/m, "") // Remove frontmatter
    .replace(/!\[.*?\]\(.*?\)/g, "") // Remove image links
    .replace(/\[.*?\]\(.*?\)/g, "") // Remove markdown links
    .trim()

  // Count words
  const words = cleanContent.split(/\s+/).filter(Boolean).length

  // Calculate reading time (average reading speed: 200-250 words per minute)
  // We use 225 as a middle ground
  const readingSpeed = 200
  const minutes = Math.max(1, Math.ceil(words / readingSpeed))

  return {
    minutes,
    words,
  }
}

/**
 * Interface for the core file metadata with frontmatter already processed
 */
export interface FileWithFrontmatter {
  path: string
  fileName: string
  content: string
  frontmatter: Frontmatter
  title: string
  slug: string
  description?: string
  readingTime?: {
    minutes: number
    words: number
  }
}
