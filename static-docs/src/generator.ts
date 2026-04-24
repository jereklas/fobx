import { emptyDir, ensureDir } from "@std/fs"
import { dirname, fromFileUrl, join } from "@std/path"
import { buildPages, loadDocuments, routeToOutputPath } from "./content.ts"
import { resolveConfig } from "./config.ts"
import { buildNav } from "./nav.ts"
import {
  renderPageHtml,
  renderRouteIndex,
  renderSearchIndex,
} from "./template.ts"
import type { DocsBuildResult, DocsConfig } from "./types.ts"

const currentDir = dirname(fromFileUrl(import.meta.url))
const runtimeDir = join(currentDir, "runtime")

export const buildSite = async (
  config: DocsConfig = {},
): Promise<DocsBuildResult> => {
  const resolved = resolveConfig(config)

  const documents = await loadDocuments(
    resolved.inputDir,
    resolved.includeMdx,
    resolved.excludedSourceDirs,
  )
  const pages = buildPages(documents)
  const nav = buildNav(pages)

  if (resolved.cleanOutput) {
    await emptyDir(resolved.outputDir)
  }

  await ensureDir(resolved.outputDir)
  await ensureDir(resolved.assetsDir)

  const styleCss = await Deno.readTextFile(join(runtimeDir, "style.css"))
  const appJs = await Deno.readTextFile(join(runtimeDir, "app.js"))

  await Deno.writeTextFile(join(resolved.assetsDir, "style.css"), styleCss)
  await Deno.writeTextFile(join(resolved.assetsDir, "app.js"), appJs)
  await Deno.writeTextFile(
    join(resolved.assetsDir, "search-index.json"),
    renderSearchIndex(pages),
  )
  await Deno.writeTextFile(
    join(resolved.assetsDir, "route-index.json"),
    renderRouteIndex(pages),
  )

  for (const page of pages) {
    const outputPath = routeToOutputPath(resolved.outputDir, page.routePath)
    await ensureDir(dirname(outputPath))
    const html = renderPageHtml(page, {
      siteTitle: resolved.siteTitle,
      siteDescription: resolved.siteDescription,
      githubUrl: resolved.githubUrl,
      nav,
      pages,
      basePath: resolved.basePath,
    })
    await Deno.writeTextFile(outputPath, html)
  }

  return {
    pages,
    nav,
    outputDir: resolved.outputDir,
  }
}
