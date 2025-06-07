import { renderToStringAsync } from "preact-render-to-string"
import { join } from "@std/path"
import type { NavigationMetadata, RouteMetadata, SiteInfo } from "./metadata.ts"
import { Main } from "../components/Main.tsx"

export const SCRIPTS = {
  common: "COMMON_SCRIPT_PLACEHOLDER",
  site: "SITE_SCRIPT_PLACEHOLDER",
  page: "PAGE_SCRIPT_PLACEHOLDER",
}

/**
 * Generate HTML for a page using preact-render-to-string
 *
 * @param route The route metadata for the current page
 * @param siteInfo General site information
 * @param lastUpdated Last updated timestamp for the site
 * @param navigation Navigation data for the site
 * @returns HTML string for the page
 */
export async function generateHtmlContent(
  route: RouteMetadata,
  siteInfo: SiteInfo,
  lastUpdated: string,
  navigation: NavigationMetadata,
): Promise<string> {
  // Handle redirect pages
  if (route.frontmatter.redirect) {
    const redirectUrl = route.frontmatter.redirect.startsWith("/")
      ? join(siteInfo.baseUrl, route.frontmatter.redirect)
      : route.frontmatter.redirect

    // Create a redirect page using JSX
    const html = await renderToStringAsync(
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>{route.title} | {siteInfo.title}</title>
          <meta
            name="description"
            content={route.frontmatter.description || siteInfo.description}
          />
          <meta http-equiv="refresh" content={`0;url=${redirectUrl}`} />
          <link rel="canonical" href={redirectUrl} />
          <style>
            {`
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 650px;
              margin: 2rem auto;
              padding: 0 1rem;
              text-align: center;
            }
            a {
              color: #0366d6;
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
          `}
          </style>
          <script
            dangerouslySetInnerHTML={{
              __html: `window.location.replace("${redirectUrl}");`,
            }}
          />
        </head>
        <body>
          <h1>Redirecting...</h1>
          <p>
            You are being redirected to <a href={redirectUrl}>{redirectUrl}</a>
          </p>
        </body>
      </html>,
    )

    // Add DOCTYPE declaration as it can't be directly included in the JSX
    return `<!DOCTYPE html>${html}`
  }

  // Create meta tags for the page
  const metaTags = [
    <meta key="charset" charset="UTF-8" />,
    <meta
      key="viewport"
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    />,
    <meta
      key="base-url"
      name="base-url"
      content={siteInfo.baseUrl}
    />,
    <meta
      key="description"
      name="description"
      content={route.frontmatter.description || siteInfo.description}
    />,
    <meta
      key="og:title"
      property="og:title"
      content={route.title || siteInfo.title}
    />,
    <meta
      key="og:description"
      property="og:description"
      content={route.frontmatter.description || siteInfo.description}
    />,
    <meta key="og:type" property="og:type" content="website" />,
    <meta
      key="og:url"
      property="og:url"
      content={`${join(siteInfo.baseUrl, route.path)}`}
    />,
  ]

  // Render the HTML
  const html = await renderToStringAsync(
    <html lang="en">
      <head>
        {metaTags}
        <title>
          {route.title ? `${route.title} | ${siteInfo.title}` : siteInfo.title}
        </title>
        <link
          rel="stylesheet"
          href={`${join(siteInfo.baseUrl, "/assets/styles.css")}`}
        />

        {/* Placeholder script tags to replace at build time */}
        <script>{SCRIPTS.site}</script>
        <script>{SCRIPTS.page}</script>
      </head>
      <body>
        <div id="root">
          <Main
            siteInfo={siteInfo}
            route={route}
            navigation={navigation}
            lastUpdated={lastUpdated}
          />
        </div>
      </body>
    </html>,
  )

  // Add DOCTYPE declaration as it can't be directly included in the JSX
  return `<!DOCTYPE html>${html}`
}

/**
 * Generate Preact entry points for each route
 *
 * @param routes List of route metadata
 * @returns Record of entry point names to their file paths
 */
export function generatePreactEntrypoint(
  route: RouteMetadata,
  siteInfo: SiteInfo,
  lastUpdated: string,
  navigation: NavigationMetadata,
): string {
  return `import { hydrate } from "preact"
import { Main } from "../src/components/Main.tsx"

hydrate(
  <Main
    siteInfo={${JSON.stringify(siteInfo)}}
    route={${JSON.stringify(route)}}
    navigation={${JSON.stringify(navigation)}}
    lastUpdated="${lastUpdated}"
  />,
  document.getElementById("root")!
)`
}
