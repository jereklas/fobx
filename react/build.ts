import * as esbuild from "esbuild"
import * as utils from "@fobx/utils"
import { denoPlugins } from "@oazmi/esbuild-plugin-deno"

const bundle = (format: "esm" | "cjs") => {
  const [
    entry_plugin,
    http_plugin,
    jsr_plugin,
    npm_plugin,
    resolver_pipeline_plugin,
  ] = denoPlugins()

  return esbuild.build({
    entryPoints: ["./index.ts"],
    bundle: true,
    format,
    define: {
      // TODO: we want the following define for NODE_ENV for bundles that target consumers using bundlers
      // TODO: we would want these to be true/false for non-bundler consumers (true for develop build, false for production)
      // makes string persist in final bundle instead of replacing with environment variable value
      "process.env.NODE_ENV": "process.env.NODE_ENV",
    },
    external: ["@fobx/core", "react"],
    minify: false,
    plugins: [
      entry_plugin,
      http_plugin,
      jsr_plugin,
      npm_plugin,
      resolver_pipeline_plugin,
    ],
    outfile: `dist/index${format === "esm" ? ".js" : ".cjs"}`,
  })
}

async function build() {
  await utils.rm("dist")
  await utils.generateTypeDefinitions("dist")
  await utils.generatePackageJson("dist", {
    ".": {
      "import": "./index.js",
      "require": "./index.cjs",
      "types": "./index.d.ts",
    },
  })

  await Promise.all([
    bundle("esm"),
    bundle("cjs"),
  ])

  await utils.printSize("dist/index.js")
  await utils.copyCommonFiles("dist")
}

await build()

await esbuild.stop()
