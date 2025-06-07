import * as esbuild from "esbuild"
import { join } from "@std/path"

/**
 * Bundle JS and CSS assets using esbuild
 */
export async function bundle(
  options: {
    outdir: string
    entryPoints: string[]
  },
): Promise<{ chunkDependencies: Record<string, string[]> }> {
  const { outdir, entryPoints } = options
  const chunkDependencies: Record<string, string[]> = {}

  try {
    // Separate site.ts from other entry points
    const siteJsEntry = entryPoints.find((entry) => entry.includes("site.ts"))
    const reactEntryPoints = entryPoints.filter((entry) =>
      !entry.includes("site.ts")
    )

    // Bundle React/Preact JavaScript with code splitting
    if (reactEntryPoints.length > 0) {
      const result = await esbuild.build({
        entryPoints: reactEntryPoints,
        bundle: true,
        minify: true,
        format: "esm",
        target: "es2024",
        outdir: join(outdir, "scripts"),
        splitting: true,
        chunkNames: "chunks/[name]-[hash]",
        jsx: "automatic",
        jsxImportSource: "preact",
        absWorkingDir: "/fobx",
        metafile: true, // Enable metafile to get chunk information
      })

      // Extract chunk dependencies from metafile
      if (result.metafile) {
        for (
          const [outputPath, output] of Object.entries(result.metafile.outputs)
        ) {
          if (output.entryPoint) {
            const entryPointName =
              output.entryPoint.split("/").pop()?.replace(".tsx", "") || ""
            const dependencies: string[] = []

            // Get all imports for this entry point
            if (output.imports) {
              for (const imp of output.imports) {
                if (imp.kind === "import-statement") {
                  // Get just the filename from the absolute path
                  const importFileName = imp.path.split("/").pop() || ""
                  const outputFileName = outputPath.split("/").pop() || ""

                  // Only add if it's a different file (not self-import)
                  if (
                    importFileName !== outputFileName &&
                    importFileName.endsWith(".js")
                  ) {
                    // Check if it's a chunk file (in chunks directory)
                    if (imp.path.includes("/chunks/")) {
                      dependencies.push(`chunks/${importFileName}`)
                    } else {
                      dependencies.push(importFileName)
                    }
                  }
                }
              }
            }

            chunkDependencies[entryPointName] = dependencies
          }
        }
      }
    }

    // Bundle site.js separately as a regular script (not ES module)
    if (siteJsEntry) {
      await esbuild.build({
        entryPoints: [siteJsEntry],
        bundle: true,
        minify: true,
        format: "iife", // Immediately Invoked Function Expression for direct script inclusion
        target: "es2020", // Slightly lower target for broader compatibility
        outdir: join(outdir, "scripts"),
        absWorkingDir: "/fobx",
      })
    }

    // Bundle main CSS file separately
    await esbuild.build({
      entryPoints: ["doc-site/src/styles/docs.css"],
      bundle: true,
      minify: true,
      outfile: join(outdir, "assets", "styles.css"),
      absWorkingDir: "/fobx",
    })

    return { chunkDependencies }
  } catch (error) {
    console.error("Error bundling assets:", error)
    throw error
  } finally {
    // Cleanup esbuild
    esbuild.stop()
  }
}
