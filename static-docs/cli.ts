#!/usr/bin/env -S deno run -A
import { resolve } from "@std/path"
import { serveDir } from "jsr:@std/http@^1.0.15/file-server"
import { buildSite } from "./src/generator.ts"
import type { DocsConfig } from "./src/types.ts"

const [command = "build", ...args] = Deno.args

if (command === "build") {
  const config = await loadConfig()
  const result = await buildSite(config)
  console.log(`Generated ${result.pages.length} pages in ${result.outputDir}`)
  Deno.exit(0)
}

if (command === "preview") {
  const port = Number.parseInt(readFlag(args, "--port") ?? "4173") || 4173
  const config = await loadConfig()
  const result = await buildSite(config)

  console.log(
    `Serving docs from ${result.outputDir} on http://localhost:${port}`,
  )

  await Deno.serve({
    port,
    handler: (request) =>
      serveDir(request, {
        fsRoot: result.outputDir,
        quiet: true,
        showDirListing: false,
        enableCors: true,
      }),
  }).finished
  Deno.exit(0)
}

if (command === "help" || command === "--help" || command === "-h") {
  printHelp()
  Deno.exit(0)
}

console.error(`Unknown command: ${command}`)
printHelp()
Deno.exit(1)

async function loadConfig(): Promise<DocsConfig> {
  const defaultConfig: DocsConfig = {
    rootDir: Deno.cwd(),
    inputDir: resolve(Deno.cwd(), "content"),
    outputDir: resolve(Deno.cwd(), "dist"),
    siteTitle: "Documentation",
    siteDescription: "Project documentation",
    basePath: "/",
    includeMdx: true,
    cleanOutput: true,
  }

  const configPath = resolve(Deno.cwd(), "static-docs.config.ts")
  try {
    await Deno.stat(configPath)
  } catch {
    return defaultConfig
  }

  const module = await import(`file://${configPath}`)
  const loaded = module.default || module.config || {}
  return {
    ...defaultConfig,
    ...loaded,
  }
}

function readFlag(args: string[], key: string): string | undefined {
  const exact = args.find((value) => value.startsWith(`${key}=`))
  if (exact) {
    return exact.slice(key.length + 1)
  }
  const index = args.indexOf(key)
  if (index >= 0) {
    return args[index + 1]
  }
  return undefined
}

function printHelp() {
  console.log(`
static-docs CLI

Commands:
  build              Build static docs site
  preview            Build and serve docs locally

Options:
  --port <number>    Preview server port (default: 4173)
`)
}
