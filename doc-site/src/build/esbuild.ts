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
): Promise<void> {
  const { outdir, entryPoints } = options
  try {
    // Bundle JavaScript with code splitting
    await esbuild.build({
      entryPoints,
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
    })

    // Bundle main CSS file separately
    await esbuild.build({
      entryPoints: ["doc-site/src/styles/docs.css"],
      bundle: true,
      minify: true,
      outfile: join(outdir, "assets", "styles.css"),
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
