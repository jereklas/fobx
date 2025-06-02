import { join } from "@std/path"

/**
 * Interface representing a file found by the crawler
 */
export interface File {
  path: string
  relativePath: string // Relative to the content directory
  contentDir: string
  content: string
  fileName: string
  extension: string
}

/**
 * Crawls multiple directories to find files with specified extensions
 */
export async function crawlFiles(
  contentDirs: string[],
  options: {
    extensions?: string[] // e.g., [".md", ".mdx", ".txt"]
    excludeDirs?: string[]
    loadContent?: boolean // whether to load file content
  } = {},
): Promise<File[]> {
  const {
    extensions = [".md"], // Default to only markdown files
    excludeDirs = ["node_modules", ".git", "dist", "build"],
    loadContent = true,
  } = options

  const files: File[] = []

  for (const contentDir of contentDirs) {
    try {
      const dirFiles = await crawlDirectory(contentDir, "", {
        extensions,
        excludeDirs,
        loadContent,
      })
      files.push(...dirFiles)
    } catch (error) {
      console.warn(`Error crawling directory ${contentDir}:`, error)
    }
  }

  return files
}

/**
 * Recursively crawls a directory for files with specified extensions
 */
async function crawlDirectory(
  dir: string,
  basePath = "",
  options: {
    extensions: string[]
    excludeDirs: string[]
    loadContent: boolean
  },
): Promise<File[]> {
  const { extensions, excludeDirs, loadContent } = options
  const files: File[] = []

  try {
    for await (const entry of Deno.readDir(dir)) {
      const entryPath = join(dir, entry.name)

      if (entry.isDirectory) {
        // Skip directories that match any name in the excludeDirs array
        if (excludeDirs.includes(entry.name)) {
          continue
        }

        // Recursively crawl subdirectories
        const subdirFiles = await crawlDirectory(
          entryPath,
          basePath ? `${basePath}/${entry.name}` : entry.name,
          options,
        )
        files.push(...subdirFiles)
      } else if (
        entry.isFile && extensions.some((ext) => entry.name.endsWith(ext))
      ) {
        try {
          const relativePath = basePath
            ? `${basePath}/${entry.name}`
            : entry.name

          const fileExtension = entry.name.substring(
            entry.name.lastIndexOf("."),
          )

          const file: File = {
            path: entryPath,
            relativePath,
            contentDir: dir,
            fileName: entry.name,
            extension: fileExtension,
            content: loadContent ? await Deno.readTextFile(entryPath) : "",
          }

          files.push(file)
        } catch (error) {
          console.warn(`Error reading file ${entryPath}:`, error)
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error)
  }

  return files
}
