import { join, normalize } from "@std/path"
import type { DocsConfig } from "./types.ts"

export const resolveConfig = (
  config: DocsConfig = {},
): Required<DocsConfig> => {
  const rootDir = normalize(config.rootDir ?? Deno.cwd())
  const inputDir = normalize(config.inputDir ?? join(rootDir, "content"))
  const outputDir = normalize(config.outputDir ?? join(rootDir, "dist"))
  const assetsDir = normalize(config.assetsDir ?? join(outputDir, "assets"))
  const excludedSourceDirs = normalizeExcludedSourceDirs(
    config.excludedSourceDirs,
  )
  const basePath = normalizeBasePath(config.basePath)
  const githubUrl = normalizeExternalUrl(config.githubUrl)

  return {
    rootDir,
    inputDir,
    outputDir,
    assetsDir,
    excludedSourceDirs,
    siteTitle: config.siteTitle ?? "Documentation",
    siteDescription: config.siteDescription ?? "Technical documentation",
    githubUrl,
    basePath,
    includeMdx: config.includeMdx ?? true,
    cleanOutput: config.cleanOutput ?? true,
  }
}

const normalizeBasePath = (value: string | undefined): string => {
  if (!value || value === "/") {
    return "/"
  }

  let basePath = value.trim()
  if (!basePath.startsWith("/")) {
    basePath = `/${basePath}`
  }
  if (!basePath.endsWith("/")) {
    basePath = `${basePath}/`
  }
  return basePath
}

const normalizeExternalUrl = (value: string | undefined): string => {
  return value?.trim() ?? ""
}

const normalizeExcludedSourceDirs = (value: string[] | undefined): string[] => {
  const raw = value ?? ["_staged"]
  const normalized = raw
    .map((entry) => entry.trim())
    .filter(Boolean)

  return normalized.length > 0 ? normalized : ["_staged"]
}
