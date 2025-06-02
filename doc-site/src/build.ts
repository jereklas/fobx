import { join } from "@std/path"
import { crawlMarkdownFiles } from "./build/crawler.ts"
import { ensureDir } from "@std/fs"
import { generateMetadata } from "./build/metadata.ts"
import { parseMarkdownFiles } from "./build/markdown.ts"
// Import the new Preact generator instead of HTML templates
import { generatePreactEntrypoints } from "./build/preact-generator.ts"
import { bundleAssets, cleanupTempFiles } from "./build/assets.ts"

// Directory paths
const rootDir = new URL("..", import.meta.url).pathname
const publicDir = join(rootDir, "public")
const mdFileDir = "/fobx"

// Build output directories
const dirs = {
  public: publicDir,
  metadata: join(publicDir, "metadata"),
  scripts: join(rootDir, "src/scripts"),
  styles: join(rootDir, "src/styles"),
}

/**
 * Build the static site from markdown files
 *
 * Process:
 * 1. Find all markdown files in the repository
 * 2. Generate metadata.json with routes/slugs
 * 3. Parse the markdown files with Markdoc
 * 4. Generate Preact entry points and HTML shells
 * 5. Use esbuild to bundle all JS/CSS assets with code splitting
 * 6. Clean up temporary files
 */
export async function buildStaticFiles(): Promise<void> {
  console.log("Building static files...")

  ensureDir(dirs.public)
  for await (const entry of Deno.readDir(dirs.public)) {
    Deno.removeSync(join(dirs.public, entry.name), { recursive: true })
  }

  await ensureDirectories()

  // 1. Find all markdown and markdoc files in the repo
  const sourceFiles = await crawlMarkdownFiles([mdFileDir])

  // 2. Generate metadata.json and individual file metadata
  const metadata = await generateMetadata(sourceFiles, dirs)

  // 3. Parse markdown files with Markdoc and output HTML/JSON
  const parsedDocuments = await parseMarkdownFiles(
    sourceFiles,
    metadata.routes,
    dirs,
  )

  // 4. Generate Preact entry points and HTML shells
  const entryPoints = await generatePreactEntrypoints(
    parsedDocuments,
    metadata,
    dirs,
  )

  // 5. Bundle JS/CSS assets with esbuild (with code splitting)
  await bundleAssets(dirs, entryPoints)

  // 6. Clean up temporary files
  await cleanupTempFiles(dirs)

  console.log("Static site build complete")
  return
}

/**
 * Ensure all required directories exist
 */
async function ensureDirectories(): Promise<void> {
  // Ensure all directories exist
  for (const [name, path] of Object.entries(dirs)) {
    await ensureDir(path)
  }
}

// Execute the build if this is the main module
if (import.meta.main) {
  await buildStaticFiles()
}
