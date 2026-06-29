import * as utils from "@fobx/utils"

function rewriteRuntimeImportExtensions(
  content: string,
  options: { ext: "js" | "cjs"; noBundler: boolean },
): string {
  return content.replaceAll(
    /(["'])(\.{1,2}\/[^"']+?)\.ts\1/g,
    (_match, quote: string, specifier: string) => {
      if (options.noBundler && specifier === "./core") {
        return `${quote}./core.${options.ext}${quote}`
      }

      return `${quote}${specifier}.${options.ext}${quote}`
    },
  )
}

async function bundle(opts: {
  file: "core" | "index" | "internals"
  format: "esm" | "cjs"
  noBundler?: boolean
  declaration?: boolean
}) {
  const ext = opts.format === "esm" ? "js" : "cjs"
  const outfile = `dist/${opts.file}.${ext}`
  const entry = opts.file === "core" ? "./core.ts" : `./${opts.file}.ts`

  const args = [
    "bundle",
    "--format",
    opts.format,
    "--output",
    outfile,
    ...(opts.declaration ? ["--declaration"] : []),
    entry,
  ]

  if (opts.noBundler) {
    args.push("--inline-imports=false")
  }

  await utils.runDenoCommand(args)

  let content = await Deno.readTextFile(outfile)
  if (opts.noBundler) {
    content = rewriteRuntimeImportExtensions(content, { ext, noBundler: true })
  }
  content = utils.rewriteGetNodeEnvCalls(content)
  await Deno.writeTextFile(outfile, content)
}

async function createDeclarationWrapper(
  sourceFile: string,
  targetFile: string,
) {
  let content = await Deno.readTextFile(sourceFile)
  content = content.replaceAll(/from "(\.\/[^"']+?)\.ts"/g, 'from "$1.d.ts"')
  content = content.replaceAll(/from '(\.\/[^"']+?)\.ts'/g, "from '$1.d.ts'")
  await Deno.writeTextFile(targetFile, content)
}

async function build() {
  await utils.rm("dist")
  await Deno.mkdir("dist", { recursive: true })
  await utils.generatePackageJson("dist", {
    ".": {
      import: "./index.js",
      require: "./index.cjs",
      types: "./index.d.ts",
    },
    "./internals": {
      import: "./internals.js",
      require: "./internals.cjs",
      types: "./internals.d.ts",
    },
  })

  console.log("bundling...")
  await Promise.all([
    bundle({ file: "core", format: "esm", declaration: true }),
    bundle({ file: "core", format: "cjs" }),
    bundle({ file: "index", format: "esm", noBundler: true }),
    bundle({ file: "index", format: "cjs", noBundler: true }),
    bundle({ file: "internals", format: "esm", noBundler: true }),
    bundle({ file: "internals", format: "cjs", noBundler: true }),
  ])

  await createDeclarationWrapper("index.ts", "dist/index.d.ts")
  await createDeclarationWrapper("internals.ts", "dist/internals.d.ts")
  await utils.removeDeclarationCtsFiles("dist")
  await utils.printSize("dist/core.js")
  await utils.copyCommonFiles("dist")
}

await build()
