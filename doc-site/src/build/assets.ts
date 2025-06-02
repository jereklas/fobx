import * as esbuild from "esbuild"
import { join } from "@std/path"

/**
 * Bundle JS and CSS assets using esbuild
 */
export async function bundleAssets(
  dirs: Record<string, string>,
  entryPoints: Record<string, string> = {},
): Promise<void> {
  console.log("Bundling JavaScript and CSS assets...")

  try {
    // Bundle JavaScript with code splitting
    await esbuild.build({
      entryPoints,
      bundle: true,
      minify: true,
      format: "esm",
      target: "es2020",
      outdir: join(dirs.public, "scripts"),
      allowOverwrite: true,
      splitting: true,
      chunkNames: "chunks/[name]-[hash]",
      treeShaking: true,
      jsx: "automatic",
      jsxImportSource: "preact",
      absWorkingDir: "/fobx",
      resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    })

    // Bundle main CSS file separately
    await esbuild.build({
      entryPoints: ["doc-site/src/styles/main.css"],
      bundle: true,
      minify: true,
      outfile: join(dirs.public, "styles", "main.css"),
      allowOverwrite: true,
      absWorkingDir: "/fobx",
    })
  } catch (error) {
    console.error("Error bundling assets:", error)
    throw error
  } finally {
    // Cleanup esbuild
    esbuild.stop()
  }
}

/**
 * Clean up temporary files after build
 */
export async function cleanupTempFiles(
  dirs: Record<string, string>,
): Promise<void> {
  try {
    const tempDir = join(dirs.public, "temp")
    const contentDir = join(dirs.public, "content")

    // Remove temp directories
    await Deno.remove(tempDir, { recursive: true })

    // Remove content directory (no longer needed with Preact rendering)
    try {
      await Deno.remove(contentDir, { recursive: true })
      console.log(
        "Removed content directory (no longer needed with Preact rendering)",
      )
    } catch (e) {
      // It's okay if the directory doesn't exist
      console.log("Content directory doesn't exist or couldn't be removed")
    }

    console.log("Temporary files cleaned up")
  } catch (error) {
    console.warn("Warning: Could not clean up some temporary files", error)
  }
}
