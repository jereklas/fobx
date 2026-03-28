import * as esbuild from "esbuild"
import * as utils from "@fobx/utils"

const ENTRY = "./index.ts"

async function bundle(opts: {
  format: "esm" | "cjs"
  noBundler?: boolean
}) {
  const ext = opts.format === "esm" ? "js" : "cjs"
  const suffix = opts.noBundler ? ".production" : ""
  const outfile = `dist/index${suffix}.${ext}`

  const minifyOptions = opts.noBundler
    ? { minifySyntax: true, minifyWhitespace: true }
    : { minify: false }

  await esbuild.build({
    target: utils.JS_TARGET,
    define: {
      "process.env.NODE_ENV": opts.noBundler
        ? '"production"'
        : "process.env.NODE_ENV",
      "globalThis.window": "globalThis.window",
    },
    entryPoints: [ENTRY],
    bundle: true,
    outfile,
    format: opts.format,
    ...minifyOptions,
  })
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
    "./production": {
      import: "./index.production.js",
      require: "./index.production.cjs",
      types: "./index.d.ts",
    },
  })

  console.log("bundling...")
  await Promise.all([
    bundle({ format: "esm" }),
    bundle({ format: "cjs" }),
    bundle({ format: "esm", noBundler: true }),
    bundle({ format: "cjs", noBundler: true }),
  ])

  await utils.printSize("dist/index.js")
  await utils.copyCommonFiles("dist")
}

await build()

await esbuild.stop()
