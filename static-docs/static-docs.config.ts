import { resolve } from "@std/path"
import type { DocsConfig } from "./src/types.ts"

const basePath = normalizeBasePath(Deno.env.get("DOCS_BASE_PATH") ?? "/")

const config: DocsConfig = {
  rootDir: Deno.cwd(),
  inputDir: resolve(Deno.cwd(), "content"),
  outputDir: resolve(Deno.cwd(), "dist"),
  siteTitle: "Fobx Docs",
  siteDescription: "Deno-powered static documentation site.",
  basePath,
  includeMdx: true,
  cleanOutput: true,
}

export default config

function normalizeBasePath(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || trimmed === "/") {
    return "/"
  }

  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`
}
