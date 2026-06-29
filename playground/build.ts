import * as utils from "@fobx/utils"

// ─── Build script for the playground ─────────────────────────────────────────
//
// Bundles each tab's entry point into dist/ as self-contained ESM files.

async function printSizes(files: string[]) {
  for (const file of files) {
    try {
      const stat = await Deno.stat(file)
      console.log(`  ${file}: ${(stat.size / 1024).toFixed(2)} KB`)
    } catch {
      // ignore missing files
    }
  }
}

async function build() {
  try {
    await Deno.remove("dist", { recursive: true })
  } catch {
    // dist may not exist
  }

  await utils.runDenoCommand([
    "bundle",
    "--platform",
    "browser",
    "--outdir",
    "dist",
    "./src/dom-tab.ts",
    "./src/react-tab.tsx",
    "./src/jsx-tab.tsx",
  ])

  for (const file of ["dist/dom-tab.js", "dist/react-tab.js", "dist/jsx-tab.js"]) {
    const content = await Deno.readTextFile(file)
    await Deno.writeTextFile(file, utils.rewriteGetNodeEnvCalls(content))
  }

  await printSizes([
    "dist/dom-tab.js",
    "dist/react-tab.js",
    "dist/jsx-tab.js",
  ])

  console.log("✓ Playground built → dist/")
}

await build()
