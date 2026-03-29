import { parse } from "@std/jsonc"
export * from "./file-server.ts"
export * from "./file-crawler.ts"

function getDeclarationCompilerOptions() {
  const globalTypesPath = new URL("../global.d.ts", import.meta.url).pathname
  let packageCompilerOptions: Record<string, unknown> = {}

  try {
    const denoConfig = parse(Deno.readTextFileSync("./deno.jsonc")) as {
      compilerOptions?: Record<string, unknown>
    } | null
    packageCompilerOptions = denoConfig?.compilerOptions ?? {}
  } catch {
    // Some packages may not define per-package compiler options.
  }

  const rawLibs = Array.isArray(packageCompilerOptions.lib)
    ? packageCompilerOptions.lib.filter((lib): lib is string => {
      return typeof lib === "string" && !lib.startsWith("deno.")
    })
    : []

  const rawTypes = Array.isArray(packageCompilerOptions.types)
    ? packageCompilerOptions.types.filter((type): type is string => {
      return typeof type === "string"
    })
    : []

  return {
    ...packageCompilerOptions,
    target: JS_TARGET,
    lib: Array.from(
      new Set([
        ...rawLibs,
        "esnext",
        "dom",
        "dom.asynciterable",
        "dom.iterable",
      ]),
    ),
    declaration: true,
    emitDeclarationOnly: true,
    outDir: "dist",
    allowImportingTsExtensions: true,
    rewriteRelativeImportExtensions: true,
    moduleResolution: "bundler",
    types: Array.from(new Set([globalTypesPath, ...rawTypes])),
  }
}

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
    `Size [gzip]: ${(fileSize / 1024).toFixed(2)} [${
      (gzipSize / 1024).toFixed(2)
    }] kB`,
  )
}

/**
 * The target JavaScript version to compile to.
 */
export const JS_TARGET = "es2022"

async function rewriteDeclarationImportExtensions(dir: string) {
  for await (const entry of Deno.readDir(dir)) {
    const fullPath = `${dir}/${entry.name}`

    if (entry.isDirectory) {
      await rewriteDeclarationImportExtensions(fullPath)
      continue
    }

    if (!entry.isFile || !fullPath.endsWith(".d.ts")) {
      continue
    }

    const source = await Deno.readTextFile(fullPath)
    const rewritten = source.replace(
      /((?:from\s+|import\s*\()["'])(\.{1,2}\/[^"']+)\.ts(["'])/g,
      "$1$2.d.ts$3",
    )

    if (rewritten !== source) {
      await Deno.writeTextFile(fullPath, rewritten)
    }
  }
}

/**
 * Generates type definitions for the project.
 * @param outDir - The output directory for the generated type definitions.
 */
export async function generateTypeDefinitions(outDir: string) {
  const CONFIG_PATH = "./tsconfig.json"

  const tsconfig = JSON.stringify({
    compilerOptions: {
      ...getDeclarationCompilerOptions(),
      outDir,
      // paths: {
      //   "@fobx/core": ["/fobx/core/index.ts"],
      // },
    },
    exclude: [
      "convertImports.ts",
      "build.ts",
      "**/__tests__",
      "dist",
      "**/*.test.ts",
      "**/*bench.ts",
    ],
  })
  let code = 0

  try {
    await Deno.writeTextFile(CONFIG_PATH, tsconfig)

    const command = new Deno.Command("deno", {
      args: ["run", "-A", "npm:typescript/bin/tsc", "--project", CONFIG_PATH],
      stdout: "inherit",
      stderr: "inherit",
    })
    ;({ code } = await command.output())
  } finally {
    await rm(CONFIG_PATH)
  }

  if (code !== 0) {
    Deno.exit(code)
  }

  await rewriteDeclarationImportExtensions(outDir)
}

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
    "url": "git+https://github.com/jereklas/fobx.git",
  }
  contents.bugs = {
    "url": "https://github.com/jereklas/fobx/issues",
  }

  Deno.writeTextFile(
    `${outDir}/package.json`,
    JSON.stringify(contents, null, 2),
  )
}

export async function copyCommonFiles(outDir: string) {
  await Deno.copyFile("/fobx/LICENSE", `${outDir}/LICENSE`)

  for (const readmePath of ["./README.md", "/fobx/README.md"]) {
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
