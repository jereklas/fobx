import * as utils from "@fobx/utils"

const bundle = async (format: "esm" | "cjs") => {
  const outfile = `dist/index${format === "esm" ? ".js" : ".cjs"}`
  await utils.runDenoCommand([
    "bundle",
    "--format",
    format,
    "--output",
    outfile,
    "--external",
    "react",
    "--declaration",
    "index.ts",
  ])
  const content = await Deno.readTextFile(outfile)
  await Deno.writeTextFile(outfile, utils.rewriteGetNodeEnvCalls(content))
}

async function build() {
  await utils.rm("dist")
  await Deno.mkdir("dist", { recursive: true })
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

  await utils.removeDeclarationCtsFiles("dist")
  await utils.printSize("dist/index.js")
  await utils.copyCommonFiles("dist")
}

await build()
