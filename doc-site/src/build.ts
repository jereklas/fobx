import { join } from "@std/path"
import { ensureDir } from "@std/fs"
import { generateMetadata, MetadataOptions } from "./build/metadata.ts"
import { bundle } from "./build/esbuild.ts"
import {
  generateHtmlContent,
  generatePreactEntrypoint,
  SCRIPTS,
} from "./build/preact.tsx"

// Directory paths
const rootDir = new URL("..", import.meta.url).pathname
const publicDir = join(rootDir, "public")
const mdFileDir = "/fobx"

// Build output directories
const dirs = {
  public: publicDir,
  temp: join(Deno.cwd(), "temp"),
}

/**
 * Build the static site from markdown files
 *
 * Process:
 * 1. Generate metadata.json with routes/slugs and transformed AST content
 * 2. Generate Preact entry points and HTML shells
 * 3. Use esbuild to bundle all JS/CSS assets with code splitting
 * 4. Replace script placeholders with actual script references
 * 5. Clean up temporary files
 */
export async function buildStaticFiles(baseUrl = "/"): Promise<void> {
  console.log("Building static files...")

  await ensureDirectories()

  // 1. Generate metadata with transformed AST content
  const options: MetadataOptions = { contentDirs: [mdFileDir], baseUrl }
  const metadata = await generateMetadata(options)
  const metadataPath = join(dirs.public, "metadata.json")
  await Deno.writeTextFile(metadataPath, JSON.stringify(metadata, null, 2))

  // 2. Generate HTML shells and Preact entrypoints
  const entryPoints: string[] = []
  const htmlFiles: { path: string; content: string; slug: string }[] = []

  await Promise.allSettled(metadata.routes.map(async (route) => {
    // Generate proper HTML file path - handle root path "/" specially
    const htmlFileName = route.path === "/"
      ? "index.html"
      : `${route.path.replace(/^\//, "")}.html`
    const htmlFilePath = join(dirs.public, htmlFileName)

    const htmlContent = await generateHtmlContent(
      route,
      metadata.siteInfo,
      metadata.lastUpdated,
      metadata.navigation,
    )

    // Store HTML content for later processing
    htmlFiles.push({
      path: htmlFilePath,
      content: htmlContent,
      slug: route.slug,
    })

    const entrypointFilePath = join(Deno.cwd(), "temp", `${route.slug}.tsx`)
    entryPoints.push(entrypointFilePath)

    const entrypoint = generatePreactEntrypoint(
      route,
      metadata.siteInfo,
      metadata.lastUpdated,
      metadata.navigation,
    )
    return Deno.writeTextFile(entrypointFilePath, entrypoint)
  }))

  // 3. Bundle JS/CSS assets with esbuild (with code splitting)
  const { chunkDependencies } = await bundle({
    outdir: dirs.public,
    entryPoints: [...entryPoints, "doc-site/src/scripts/site.ts"],
  })

  // 4. Replace script placeholders with actual script references
  for (const htmlFile of htmlFiles) {
    let updatedContent = htmlFile.content

    // Replace site script placeholder with reference to site.js
    updatedContent = updatedContent.replace(
      `<script>${SCRIPTS.site}</script>`,
      `<script rel="preload" type="module" src="${
        join(baseUrl, "/scripts/site.js")
      }"></script>`,
    )

    // Generate script tags for dependencies and the main page script
    const scriptTags = generateScriptTags(
      htmlFile.slug,
      chunkDependencies,
      baseUrl,
    )

    // Replace page script placeholder with dependency chain script tags
    updatedContent = updatedContent.replace(
      `<script>${SCRIPTS.page}</script>`,
      scriptTags,
    )

    // Write the updated HTML file
    await Deno.writeTextFile(htmlFile.path, updatedContent)
  }

  // 5. Clean up temporary files
  for await (const entry of Deno.readDir(dirs.temp)) {
    Deno.removeSync(join(dirs.temp, entry.name), { recursive: true })
  }
}

/**
 * Generate script tags in the correct dependency order
 */
function generateScriptTags(
  slug: string,
  chunkDependencies: Record<string, string[]>,
  baseUrl: string,
): string {
  const dependencies = chunkDependencies[slug] || []
  const scriptTags: string[] = []

  // Add dependency scripts first (chunks)
  for (const dep of dependencies) {
    scriptTags.push(
      `<script rel="preload" type="module" src="${
        join(baseUrl, "scripts", dep)
      }"></script>`,
    )
  }

  // Add the main page script last
  scriptTags.push(
    `<script rel="preload" type="module" src="${
      join(baseUrl, "scripts", `${slug}.js`)
    }"></script>`,
  )

  return scriptTags.join("\n    ")
}

/**
 * Ensure all required directories exist
 */
async function ensureDirectories(): Promise<void> {
  ensureDir(dirs.public)
  for await (const entry of Deno.readDir(dirs.public)) {
    Deno.removeSync(join(dirs.public, entry.name), { recursive: true })
  }

  ensureDir(dirs.temp)
  for await (const entry of Deno.readDir(dirs.temp)) {
    Deno.removeSync(join(dirs.temp, entry.name), { recursive: true })
  }
}

// Execute the build if this is the main module
if (import.meta.main) {
  await buildStaticFiles("/fobx")
}
