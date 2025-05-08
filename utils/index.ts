import { parse } from "@std/jsonc"

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

/**
 * Generates type definitions for the project.
 * @param outDir - The output directory for the generated type definitions.
 */
export async function generateTypeDefinitions(outDir: string) {
  const CONFIG_PATH = "./tsconfig.json"

  const tsconfig = JSON.stringify({
    compilerOptions: {
      target: JS_TARGET,
      declaration: true,
      emitDeclarationOnly: true,
      outDir,
      allowImportingTsExtensions: true,
      types: [new URL("../global.d.ts", import.meta.url).pathname],
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
  await Deno.writeTextFile(CONFIG_PATH, tsconfig)

  const command = new Deno.Command("deno", {
    args: ["run", "-A", "npm:typescript/bin/tsc", "--project", CONFIG_PATH],
    stdout: "inherit",
    stderr: "inherit",
  })
  const { code } = await command.output()

  if (code !== 0) {
    Deno.exit(code)
  }

  await Deno.remove(CONFIG_PATH)
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
  contents.homepage = "https://github.com/jereklas/fobx#readme"
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
  await Deno.copyFile("./README.md", `${outDir}/README.md`)
}
