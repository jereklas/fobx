import * as esbuild from "esbuild"
import * as utils from "@fobx/utils"

const CORE_ENTRY = "./core.ts"

async function bundle(opts: {
  file: "core" | "index" | "internals"
  format: "esm" | "cjs"
  noBundler?: boolean
}) {
  const ext = opts.format === "esm" ? "js" : "cjs"
  const suffix = opts.noBundler ? ".production" : ""
  const outfile = `dist/${opts.file}${suffix}.${ext}`
  const bundle = opts.file === "core"

  const minifyOptions = opts.noBundler
    ? { minifySyntax: true, minifyWhitespace: true }
    : { minify: false }

  await esbuild.build({
    target: utils.JS_TARGET,
    define: {
      "process.env.NODE_ENV": opts.noBundler
        ? '"production"'
        : "process.env.NODE_ENV",
      "process.env.FOBX_DEBUG": opts.noBundler
        ? "false"
        : "process.env.FOBX_DEBUG",
      "globalThis.window": "globalThis.window",
    },
    entryPoints: [opts.file === "core" ? CORE_ENTRY : `./${opts.file}.ts`],
    bundle,
    outfile,
    format: opts.format,
    ...minifyOptions,
  })

  if (!bundle) {
    let content = await Deno.readTextFile(outfile)
    content = rewriteRuntimeImportExtensions(content, {
      ext,
      noBundler: Boolean(opts.noBundler),
    })
    await Deno.writeTextFile(outfile, content)
  }
}

function rewriteRuntimeImportExtensions(
  content: string,
  options: { ext: "js" | "cjs"; noBundler: boolean },
): string {
  return content.replaceAll(
    /(["'])(\.{1,2}\/[^"']+?)\.ts\1/g,
    (_match, quote: string, specifier: string) => {
      if (options.noBundler && specifier === "./core") {
        return `${quote}./core.production.${options.ext}${quote}`
      }

      return `${quote}${specifier}.${options.ext}${quote}`
    },
  )
}

async function build() {
  await utils.rm("dist")
  await utils.generateTypeDefinitions("dist")
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
    "./production": {
      import: "./index.production.js",
      require: "./index.production.cjs",
      types: "./index.d.ts",
    },
  })

  console.log("bundling...")
  await Promise.all([
    bundle({ file: "core", format: "esm" }),
    bundle({ file: "core", format: "cjs" }),
    bundle({ file: "core", format: "esm", noBundler: true }),
    bundle({ file: "core", format: "cjs", noBundler: true }),
    bundle({ file: "index", format: "esm" }),
    bundle({ file: "index", format: "cjs" }),
    bundle({ file: "index", format: "esm", noBundler: true }),
    bundle({ file: "index", format: "cjs", noBundler: true }),
    bundle({ file: "internals", format: "esm" }),
    bundle({ file: "internals", format: "cjs" }),
  ])

  await utils.printSize("dist/core.js")
  await utils.copyCommonFiles("dist")
}

await build()

await esbuild.stop()
