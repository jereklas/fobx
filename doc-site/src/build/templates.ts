import { join } from "@std/path"
import { ParsedDocument } from "./markdown.ts"
import { RouteMetadata, SiteMetadata } from "./metadata.ts"

/**
 * Generate HTML pages for the static site
 */
export async function generatePages(
  parsedDocuments: Map<string, ParsedDocument>,
  metadata: SiteMetadata,
  dirs: Record<string, string>,
): Promise<void> {
  console.log("Generating HTML pages...")

  // Create index page and all content pages
  for (const [slug, doc] of parsedDocuments.entries()) {
    const route = metadata.routes.find((r) => r.slug === slug)
    if (!route) continue

    // Check if this is a redirect page
    if (route.redirect) {
      await generateRedirectPage(route, dirs)
      continue
    }

    // Generate full HTML page
    const html = generatePageHtml(doc, route, metadata)

    // Write to the public directory
    const pagePath = slug === "index"
      ? join(dirs.public, "index.html")
      : join(dirs.public, slug, "index.html")

    // Ensure the directory exists for non-index pages
    if (slug !== "index") {
      await Deno.mkdir(join(dirs.public, slug), { recursive: true })
    }

    await Deno.writeTextFile(pagePath, html)
  }

  // Generate 404 page
  await generate404Page(metadata, dirs)

  // Generate root index.html if it doesn't exist
  const indexPath = join(dirs.public, "index.html")
  try {
    await Deno.stat(indexPath)
    // If no error, the file exists, so don't generate a new one
  } catch {
    // File doesn't exist, generate a default index that redirects to the first content page
    const firstRoute = metadata.routes[0]
    if (firstRoute) {
      await generateIndexRedirect(firstRoute.path, dirs)
      console.log("Generated root index.html with redirect")
    }
  }

  console.log("HTML pages generated successfully")
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
    await Deno.mkdir(join(dirs.public, route.slug), { recursive: true })
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
  ${generateHeader(metadata)}
  <main class="container mx-auto px-4 py-8">
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <h1 class="text-4xl font-bold mb-4">404 - Page Not Found</h1>
      <p class="text-lg mb-8">The page you're looking for doesn't exist or has been moved.</p>
      <a href="/" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded">
        Return to Home
      </a>
    </div>
  </main>
  ${generateFooter(metadata)}
</body>
</html>`

  const pagePath = join(dirs.public, "404.html")
  await Deno.writeTextFile(pagePath, html)
  console.log("Generated 404 page")
}

/**
 * Generate complete HTML for a page
 */
function generatePageHtml(
  doc: ParsedDocument,
  route: RouteMetadata,
  metadata: SiteMetadata,
): string {
  return `<!DOCTYPE html>
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
  <script>
    // Metadata for client-side rendering
    window.pageMetadata = {
      slug: "${route.slug}",
      title: "${doc.title}"
    };
  </script>
</head>
<body>
  ${generateHeader(metadata)}
  
  <div class="container mx-auto px-4 flex flex-col md:flex-row">
    <!-- Sidebar -->
    <aside class="w-full md:w-64 p-4">
      ${generateSidebar(metadata, route.slug)}
    </aside>
    
    <!-- Main content -->
    <main class="flex-1 p-4">
      <article class="prose lg:prose-xl max-w-none">
        <h1>${doc.title}</h1>
        ${doc.html}
      </article>
      
      ${route.showEditButton ? generateEditButton(route) : ""}
      
      <!-- Last modified date if available -->
      ${
    route.lastModified
      ? `
      <div class="text-sm text-gray-500 mt-8">
        Last updated: ${new Date(route.lastModified).toLocaleDateString()}
      </div>
      `
      : ""
  }
    </main>
    
    <!-- Table of Contents (if enabled and available) -->
    ${
    !route.disableTableOfContents && doc.toc.length > 0
      ? `
    <aside class="hidden lg:block w-64 p-4">
      <div class="sticky top-24">
        <h3 class="text-lg font-semibold mb-3">On this page</h3>
        <nav class="toc">
          ${generateTableOfContents(doc.toc)}
        </nav>
      </div>
    </aside>
    `
      : ""
  }
  </div>
  
  ${generateFooter(metadata)}
</body>
</html>`
}

/**
 * Generate HTML for the header
 */
function generateHeader(metadata: SiteMetadata): string {
  return `
  <header class="bg-white shadow-md">
    <div class="container mx-auto px-4 py-3 flex items-center justify-between">
      <a href="/" class="text-xl font-bold">${metadata.siteInfo.title}</a>
      <nav class="hidden md:block">
        <ul class="flex space-x-6">
          ${
    metadata.navigation.mainNav.map((item) => `
            <li>
              <a href="${item.path}" ${
      item.isExternal ? 'target="_blank" rel="noopener"' : ""
    }
                class="hover:text-blue-600 transition-colors">
                ${item.label}${item.isExternal ? " ↗" : ""}
              </a>
            </li>
          `).join("")
  }
        </ul>
      </nav>
      <button class="md:hidden" id="mobile-menu-button" aria-label="Menu">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-6 w-6">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
        </svg>
      </button>
    </div>
    <!-- Mobile menu (hidden by default) -->
    <div class="hidden" id="mobile-menu">
      <nav class="container mx-auto px-4 py-3">
        <ul class="space-y-2">
          ${
    metadata.navigation.mainNav.map((item) => `
            <li>
              <a href="${item.path}" ${
      item.isExternal ? 'target="_blank" rel="noopener"' : ""
    }
                class="block py-2 hover:text-blue-600 transition-colors">
                ${item.label}${item.isExternal ? " ↗" : ""}
              </a>
            </li>
          `).join("")
  }
        </ul>
      </nav>
    </div>
  </header>`
}

/**
 * Generate HTML for the sidebar
 */
function generateSidebar(metadata: SiteMetadata, currentSlug: string): string {
  return `
  <nav class="sidebar">
    ${
    metadata.navigation.sidebar.map((section) => `
      <div class="mb-6">
        <h3 class="font-semibold text-lg mb-2">${section.title}</h3>
        <ul class="space-y-1">
          ${
      section.items.map((item) => `
            <li>
              <a 
                href="${item.path}" 
                class="block py-1 px-2 rounded ${
        item.path === `/${currentSlug}`
          ? "bg-blue-100 text-blue-800"
          : "hover:bg-gray-100"
      }"
              >
                ${item.label}
              </a>
            </li>
          `).join("")
    }
        </ul>
      </div>
    `).join("")
  }
  </nav>
  `
}

/**
 * Generate HTML for the table of contents
 */
function generateTableOfContents(
  tocItems: Array<
    { id: string; title: string; level: number; children?: any[] }
  >,
): string {
  return `
  <ul class="space-y-1 text-sm">
    ${
    tocItems.map((item) => `
      <li>
        <a 
          href="#${item.id}" 
          class="block py-1 hover:text-blue-600 ${
      item.level === 2 ? "font-medium" : ""
    }"
        >
          ${item.title}
        </a>
        ${
      item.children && item.children.length
        ? `
          <ul class="pl-4 space-y-1 pt-1">
            ${
          item.children.map((child) => `
              <li>
                <a 
                  href="#${child.id}" 
                  class="block py-1 hover:text-blue-600"
                >
                  ${child.title}
                </a>
              </li>
            `).join("")
        }
          </ul>
        `
        : ""
    }
      </li>
    `).join("")
  }
  </ul>`
}

/**
 * Generate HTML for the "Edit this page" button
 */
function generateEditButton(route: RouteMetadata): string {
  // Calculate GitHub edit URL - assumes GitHub repository structure
  const editUrl =
    `https://github.com/jereklas/fobx/edit/main${route.sourcePath}`

  return `
  <div class="mt-8 pt-4 border-t">
    <a 
      href="${editUrl}" 
      target="_blank" 
      rel="noopener noreferrer"
      class="inline-flex items-center text-sm text-gray-600 hover:text-blue-600"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 mr-1">
        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
      </svg>
      Edit this page on GitHub
    </a>
  </div>`
}

/**
 * Generate HTML for the footer
 */
function generateFooter(metadata: SiteMetadata): string {
  const year = new Date().getFullYear()

  return `
  <footer class="bg-gray-100 py-8 mt-12">
    <div class="container mx-auto px-4">
      <div class="flex flex-col md:flex-row md:justify-between items-center">
        <div class="mb-4 md:mb-0">
          <p class="text-gray-600">
            © ${year} ${metadata.siteInfo.title} | v${metadata.siteInfo.version}
          </p>
        </div>
        <div>
          <ul class="flex space-x-4">
            <li>
              <a href="https://github.com/jereklas/fobx" target="_blank" rel="noopener" class="text-gray-600 hover:text-blue-600">
                GitHub
              </a>
            </li>
            <li>
              <a href="/sitemap.xml" class="text-gray-600 hover:text-blue-600">
                Sitemap
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </footer>`
}
