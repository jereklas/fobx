import { join } from "@std/path"
import { ensureDir } from "@std/fs"
import { ParsedDocument } from "./markdown.ts"
import { RouteMetadata, SiteMetadata } from "./metadata.ts"

/**
 * Generate Preact entry points and HTML shell files for each page
 */
export async function generatePreactEntrypoints(
  parsedDocuments: Map<string, ParsedDocument>,
  metadata: SiteMetadata,
  dirs: Record<string, string>,
): Promise<Record<string, string>> {
  console.log("Generating Preact entry points...")

  // Ensure temp directory exists
  const tempDir = join(dirs.public, "temp")
  await ensureDir(tempDir)

  // Instead of an array, use an object map for entryPoints
  const entryPoints: Record<string, string> = {}

  // Create an entry point and HTML shell for each page
  for (const [slug, doc] of parsedDocuments.entries()) {
    const route = metadata.routes.find((r) => r.slug === slug)
    if (!route) continue

    // Skip redirection pages
    if (route.redirect) {
      await generateRedirectPage(route, dirs)
      continue
    }

    // Generate the Preact entry point
    const entryPoint = await generatePreactEntry(
      slug,
      doc,
      route,
      metadata,
      tempDir,
    )
    // Store entry point in object map using slug as output name
    entryPoints[slug] = entryPoint

    // Generate basic HTML shell that will hydrate the Preact app
    await generateHtmlShell(slug, doc, route, metadata, dirs)
  }

  // Generate 404 page
  await generate404Page(metadata, dirs)

  // Check if we need to create an index entry point
  const indexPath = join(dirs.public, "index.html")

  try {
    await Deno.stat(indexPath)
    // If the file exists, check if we have an index entry point
    if (!entryPoints["index"]) {
      // Find the first route to use as the index content
      const firstContentRoute = metadata.routes.find((r) => !r.redirect)

      if (firstContentRoute) {
        // Find the corresponding doc
        const firstDoc = parsedDocuments.get(firstContentRoute.slug)
        if (firstDoc) {
          // Generate an index entry point for the home page
          const indexEntryPoint = await generatePreactEntry(
            "index",
            firstDoc,
            firstContentRoute,
            metadata,
            tempDir,
          )
          // Add to entryPoints with "index" as the output name
          entryPoints["index"] = indexEntryPoint
          console.log("Generated index entry point for home page")
        }
      }
    }
  } catch {
    // If index.html doesn't exist, generate a default index that redirects to the first content page
    const firstRoute = metadata.routes[0]
    if (firstRoute) {
      await generateIndexRedirect(firstRoute.path, dirs)
      console.log("Generated root index.html with redirect")
    }
  }

  console.log(
    `Generated ${Object.keys(entryPoints).length} Preact entry points`,
  )
  return entryPoints
}

/**
 * Generate a Preact entry point file for a specific page
 */
async function generatePreactEntry(
  slug: string,
  doc: ParsedDocument,
  route: RouteMetadata,
  metadata: SiteMetadata,
  tempDir: string,
): Promise<string> {
  // Create the entry point file content
  const entryContent = `// Auto-generated entry point for ${slug}
import { render } from 'preact'
import App from '/fobx/doc-site/src/components/App.tsx'

// Load the page data
const metadata = ${JSON.stringify(metadata, null, 2)}
const route = ${JSON.stringify(route, null, 2)}
const doc = {
  slug: ${JSON.stringify(doc.slug)},
  title: ${JSON.stringify(doc.title)},
  // Serialize AST in a safe way
  ast: ${JSON.stringify(doc.ast)},
  toc: ${JSON.stringify(doc.toc)}
}

// Render the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('app')
  render(<App metadata={metadata} route={route} doc={doc} />, container)
})
`

  // Write the entry file
  const entryPath = join(tempDir, `${slug}.tsx`)
  await Deno.writeTextFile(entryPath, entryContent)

  return entryPath
}

/**
 * Generate a minimal HTML shell that will hydrate with Preact
 */
async function generateHtmlShell(
  slug: string,
  doc: ParsedDocument,
  route: RouteMetadata,
  metadata: SiteMetadata,
  dirs: Record<string, string>,
): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${doc.title} | ${metadata.siteInfo.title}</title>
  <meta name="description" content="${
    route.description || metadata.siteInfo.description
  }">
  ${
    route.tags?.length
      ? `<meta name="keywords" content="${route.tags.join(", ")}">`
      : ""
  }
  <link rel="stylesheet" href="/styles/main.css">
  <link rel="canonical" href="${metadata.siteInfo.baseUrl}${route.path}" />
</head>
<body>
  <div id="app">
    <!-- Preact will render content here -->
    <noscript>
      <p>This site requires JavaScript to be enabled.</p>
    </noscript>
  </div>
  <script type="module" src="/scripts/${slug}.js"></script>
</body>
</html>`

  // Write to the public directory
  const pagePath = slug === "index"
    ? join(dirs.public, "index.html")
    : join(dirs.public, slug, "index.html")

  // Ensure the directory exists for non-index pages
  if (slug !== "index") {
    await ensureDir(join(dirs.public, slug))
  }

  await Deno.writeTextFile(pagePath, html)
}

/**
 * Generate a redirect page
 */
async function generateRedirectPage(
  route: RouteMetadata,
  dirs: Record<string, string>,
): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redirecting...</title>
  <meta http-equiv="refresh" content="0;url=${route.redirect}">
  <link rel="canonical" href="${route.redirect}" />
</head>
<body>
  <p>Redirecting to <a href="${route.redirect}">${route.redirect}</a></p>
  <script>window.location.href = "${route.redirect}";</script>
</body>
</html>`

  const pagePath = route.slug === ""
    ? join(dirs.public, "index.html")
    : join(dirs.public, route.slug, "index.html")

  // Ensure the directory exists for non-index pages
  if (route.slug !== "") {
    await ensureDir(join(dirs.public, route.slug))
  }

  await Deno.writeTextFile(pagePath, html)
  console.log(`Generated redirect from /${route.slug} to ${route.redirect}`)
}

/**
 * Generate a 404 page
 */
async function generate404Page(
  metadata: SiteMetadata,
  dirs: Record<string, string>,
): Promise<void> {
  // For 404, we'll use a simple non-Preact page since it doesn't need dynamic content
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>Page Not Found | ${metadata.siteInfo.title}</title>
  <link rel="stylesheet" href="/styles/main.css">
</head>
<body>
  <header class="bg-white shadow-md">
    <div class="container mx-auto px-4 py-3 flex items-center justify-between">
      <a href="/" class="text-xl font-bold">${metadata.siteInfo.title}</a>
    </div>
  </header>

  <main class="container mx-auto px-4 py-8">
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <h1 class="text-4xl font-bold mb-4">404 - Page Not Found</h1>
      <p class="text-lg mb-8">The page you're looking for doesn't exist or has been moved.</p>
      <a href="/" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded">
        Return to Home
      </a>
    </div>
  </main>
  
  <footer class="bg-gray-100 py-8 mt-12">
    <div class="container mx-auto px-4 text-center">
      <p class="text-gray-600">
        © ${new Date().getFullYear()} ${metadata.siteInfo.title}
      </p>
    </div>
  </footer>
</body>
</html>`

  const pagePath = join(dirs.public, "404.html")
  await Deno.writeTextFile(pagePath, html)
  console.log("Generated 404 page")
}

/**
 * Generate a root index.html that redirects to the first available page
 */
async function generateIndexRedirect(
  redirectPath: string,
  dirs: Record<string, string>,
): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redirecting to documentation...</title>
  <meta http-equiv="refresh" content="0;url=${redirectPath}">
</head>
<body>
  <p>Redirecting to <a href="${redirectPath}">documentation</a>...</p>
  <script>window.location.href = "${redirectPath}";</script>
</body>
</html>`

  const pagePath = join(dirs.public, "index.html")
  await Deno.writeTextFile(pagePath, html)
}
