import * as esbuild from "esbuild"
import * as utils from "@fobx/utils"

const bundle = (format: "esm" | "cjs") => {
  return esbuild.build({
    entryPoints: ["./index.ts"],
    bundle: true,
    format,
    define: {
      "process.env.NODE_ENV": "process.env.NODE_ENV",
    },
    external: ["@fobx/core", "react"],
    minify: false,
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
