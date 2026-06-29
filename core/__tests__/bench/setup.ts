/**
 * Benchmark setup — builds @fobx/core via the standard build pipeline and then
 * produces a single-file production bundle via `deno bundle`.
 *
 * Imported by each bench file; Deno's module cache means these steps run only
 * once per `deno bench` invocation even when multiple bench files import this.
 */
import { fromFileUrl, toFileUrl } from "@std/path"

const coreDir = fromFileUrl(new URL("../../", import.meta.url))
const distCorePath = fromFileUrl(new URL("../../dist/core.js", import.meta.url))
const outPath = "/tmp/fobx-bench-production.js"

// Step 1: Build the dist files via the standard pipeline.
const buildCmd = new Deno.Command("deno", {
  args: ["task", "build"],
  cwd: coreDir,
  stdout: "inherit",
  stderr: "inherit",
})
const { code: buildCode } = await buildCmd.output()
if (buildCode !== 0) {
  throw new Error(`deno task build failed with exit code ${buildCode}`)
}

// Step 2: Write a minimal re-export entry point and run deno bundle against it
// to produce a clean self-contained module at outPath.
const tmpIndexPath = await Deno.makeTempFile({ suffix: ".ts" })
await Deno.writeTextFile(
  tmpIndexPath,
  `export * from "${toFileUrl(distCorePath).href}"\n`,
)
const bundleCmd = new Deno.Command("deno", {
  args: ["bundle", "--output", outPath, tmpIndexPath],
  stdout: "inherit",
  stderr: "inherit",
})
const { code: bundleCode } = await bundleCmd.output()
await Deno.remove(tmpIndexPath).catch(() => {})
if (bundleCode !== 0) {
  throw new Error(`deno bundle failed with exit code ${bundleCode}`)
}

/** File URL of the bundled production build — pass directly to `import()`. */
export const productionBundleUrl: string = toFileUrl(outPath).href
