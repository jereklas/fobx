import { crawlFiles, File } from "@fobx/utils"
import { relative } from "@std/path"

/**
 * Interface extending the base File with Markdown-specific properties
 */
export interface MarkdownFile extends File {
  title?: string
  slug?: string
}

/**
 * Crawls multiple directories to find markdown files
 */
export async function crawlMarkdownFiles(
  contentDirs: string[],
  excludeDirs: string[] = ["node_modules", ".git", "dist", "build", "coverage"],
): Promise<MarkdownFile[]> {
  const files = await crawlFiles(contentDirs, {
    extensions: [".md", ".mdoc"],
    excludeDirs,
    loadContent: true,
  })

  // Convert File to MarkdownFile with title and slug
  const markdownFiles = files.map((file) => {
    const title = extractTitle(file.content, file.fileName)

    // Create a better slug from the file path
    // This ensures nested directories create proper URL structures
    const rootDir = contentDirs[0] // Use the first content directory as root
    const relativePath = relative(rootDir, file.path)

    // Create slug from the relative path without extension
    // For README.md files, use the directory name
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

    return {
      ...file,
      title,
      slug,
    }
  })

  return markdownFiles
}

/**
 * Attempts to extract a title from markdown content
 */
function extractTitle(content: string, fallbackFileName: string): string {
  // Try to extract a title from the markdown content
  // First check for # Title format
  const titleMatch = content.match(/^#\s+(.+)$/m)
  if (titleMatch) {
    return titleMatch[1].trim()
  }

  // Try to find a YAML frontmatter title
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (frontmatterMatch) {
    const frontmatterContent = frontmatterMatch[1]
    const titleLine = frontmatterContent.split("\n")
      .find((line) => line.startsWith("title:"))

    if (titleLine) {
      const title = titleLine.substring(6).trim()
      // Remove any surrounding quotes if present
      return title.replace(/^["'](.*)["']$/, "$1")
    }
  }

  // Fallback to prettified filename
  return fallbackFileName
    .replace(/\.(md|mdoc)$/, "")
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
