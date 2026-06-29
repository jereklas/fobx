import { parse } from "@std/jsonc"
import { fromFileUrl, join } from "@std/path"
export * from "./file-server.ts"
export * from "./file-crawler.ts"

const REPO_ROOT = fromFileUrl(new URL("../", import.meta.url))

/**
 * Removes a file or directory if it exists. Directories will be removed recursively.
 * @param path - path to the file or directory to remove
 */
export async function rm(path: string) {
  try {
    const stat = await Deno.stat(path)
    if (stat.isDirectory) {
      await Deno.remove(path, { recursive: true })
    }
    if (stat.isFile) {
      await Deno.remove(path)
    }
  } catch {
    // nothing to remove
  }
}

export async function removeDeclarationCtsFiles(outDir: string) {
  for await (const entry of Deno.readDir(outDir)) {
    if (!entry.isFile) continue
    if (entry.name.endsWith(".d.cts")) {
      await Deno.remove(`${outDir}/${entry.name}`)
    }
  }
}

export async function runDenoCommand(args: string[]) {
  const command = new Deno.Command("deno", {
    args,
    stdout: "inherit",
    stderr: "inherit",
  })
  const { code } = await command.output()
  if (code !== 0) {
    Deno.exit(code)
  }
}

/**
 * Prints the size of a file in bytes.
 * @param path - path to the file
 */
export async function printSize(file: string) {
  const { size: fileSize } = await Deno.stat(file)

  const fileContent = await Deno.readFile(file)
  const rs = new Response(fileContent).body // convert buffer to stream
  if (!rs) throw new Error("Failed to obtain file stream")
  const cs = new CompressionStream("gzip")
  const compressedStream = rs.pipeThrough(cs)
  const gzippedBuffer = await new Response(compressedStream).arrayBuffer()

  const gzipSize = new Uint8Array(gzippedBuffer).byteLength
  console.log(
    `Size [gzip]: ${(fileSize / 1024).toFixed(2)} kb [${
      (gzipSize / 1024).toFixed(2)
    } kb]`,
  )
}

/**
 * The target JavaScript version to compile to.
 */
export const JS_TARGET = "es2022"

// deno-lint-ignore no-explicit-any
export async function generatePackageJson(outDir: string, exports: any) {
  // deno-lint-ignore no-explicit-any
  const contents = parse(await Deno.readTextFile("./deno.jsonc")) as any
  if (!contents) {
    console.error("Failed to parse deno.jsonc")
    Deno.exit(1)
  }
  delete contents.imports
  delete contents.exports
  delete contents.tasks
  delete contents.compilerOptions

  contents.license = "BSD-3-Clause"
  contents.author = "Jeremy Klas"
  contents.sideEffects = false
  contents.exports = exports
  contents.homepage = "https://jereklas.github.io/fobx"
  contents.repository = {
    "type": "git",
    "url": "https://github.com/jereklas/fobx",
  }
  contents.bugs = {
    "url": "https://github.com/jereklas/fobx/issues",
  }

  Deno.writeTextFile(
    `${outDir}/package.json`,
    JSON.stringify(contents, null, 2),
  )
}

/**
 * Rewrites a bundled JS/CJS file so that downstream bundlers (Vite, Rollup,
 * esbuild, …) can statically eliminate debug-only and dev-only branches when
 * `NODE_ENV` is defined (e.g. `define: { 'process.env.NODE_ENV': '"production"' }`).
 *
 * Steps performed (order matters):
 *  1. Remove the inlined `getNodeEnv` function definition before its name
 *     appears in a call-site replacement and would corrupt the `function` keyword.
 *  2. Replace all `getNodeEnv()` call sites with `process.env.NODE_ENV`.
 *  3. Remove the `var isNotProduction = …` declaration.
 *  4. Inline `isNotProduction` at every use site as `process.env.NODE_ENV !== "production"`,
 *     so each occurrence becomes independently foldable (e.g. `false && warn()` → dead code).
 */
export function rewriteGetNodeEnvCalls(content: string): string {
  let result = content.replace(/\nfunction getNodeEnv\(\) \{[^}]+\}/, "")
  result = result.replaceAll("getNodeEnv()", "process.env.NODE_ENV")
  result = result.replace(/\nvar isNotProduction = process\.env\.NODE_ENV !== "production";/, "")
  result = result.replaceAll("isNotProduction", `process.env.NODE_ENV !== "production"`)
  return result
}

export async function copyCommonFiles(outDir: string) {
  await Deno.copyFile(join(REPO_ROOT, "LICENSE"), `${outDir}/LICENSE`)

  for (const readmePath of ["./README.md", join(REPO_ROOT, "README.md")]) {
    try {
      await Deno.copyFile(readmePath, `${outDir}/README.md`)
      return
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error
      }
    }
  }
}
