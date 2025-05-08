import * as esbuild from "esbuild"
import * as utils from "@fobx/utils"

async function bundle(opts: {
  format: "esm" | "cjs"
  file: "core" | "index" | "dev/customFormatter"
  noBundler?: boolean
}) {
  const ext = opts.format === "esm" ? "js" : "cjs"
  const file = opts?.noBundler ? "index" : opts.file
  const outfile = opts?.noBundler
    ? `dist/${file}.production.${ext}`
    : `dist/${file}.${ext}`
  const bundle = opts?.noBundler ? true : file === "core"

  // minify strips out /* @__PURE__ */ annotations. Should only turn if a bundle needs to be
  // produced for a consumer not using a bundler.
  const minifyOptions = opts?.noBundler
    ? {
      minifySyntax: true,
      minifyWhitespace: true,
    }
    : { minify: false }

  const options: esbuild.BuildOptions = {
    target: utils.JS_TARGET,
    define: {
      "process.env.NODE_ENV": opts?.noBundler
        ? '"production"'
        : "process.env.NODE_ENV",
      "globalThis.window": "globalThis.window",
    },
    entryPoints: [`./${file}.ts`],
    bundle,
    outfile,
    format: opts.format,
    ...minifyOptions,
  }

  await esbuild.build(options)

  let content = await Deno.readTextFile(outfile)
  content = content.replace("./core.ts", `./core.${ext}`),
    content = content.replace(
      "./dev/customFormatter.ts",
      `./dev/customFormatter.${ext}`,
    )

  await Deno.writeTextFile(
    outfile,
    content.replace("./core.ts", `./core.${ext}`),
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
    "./production": {
      import: "./index.production.js",
      require: "./index.production.cjs",
      types: "./index.d.ts",
    },
  })

  console.log("bundling...")
  await Promise.all([
    bundle({ format: "esm", file: "dev/customFormatter" }),
    bundle({ format: "cjs", file: "dev/customFormatter" }),
    bundle({ format: "esm", file: "core" }),
    bundle({ format: "esm", file: "index" }),
    bundle({ format: "cjs", file: "core" }),
    bundle({ format: "cjs", file: "index" }),
    bundle({ format: "esm", file: "index", noBundler: true }),
    bundle({ format: "cjs", file: "index", noBundler: true }),
  ])

  await utils.printSize("dist/core.js")
  await utils.copyCommonFiles("dist")
}

await build()

await esbuild.stop()
