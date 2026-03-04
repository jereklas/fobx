// ─── Build script for the playground ─────────────────────────────────────────
//
// Bundles each tab's entry point into dist/ as self-contained ESM files.

import * as esbuild from "esbuild"
import { denoPlugins } from "@oazmi/esbuild-plugin-deno"
import * as path from "node:path"

const root = path.resolve(import.meta.dirname!, "..")

// Map workspace bare specifiers → actual file paths
const workspaceAliases: Record<string, string> = {
  "@fobx/v2": path.join(root, "v2/index.ts"),
  "@fobx/dom": path.join(root, "dom/index.ts"),
  "@fobx/jsx": path.join(root, "jsx/index.ts"),
  "@fobx/jsx/jsx-runtime": path.join(root, "jsx/jsx-runtime.ts"),
}

// Pin React 18 — the deno plugin resolves to 19.x otherwise
const react18 = path.join(
  root,
  "node_modules/.deno/react@18.3.1/node_modules/react",
)
const reactDOM18 = path.join(
  root,
  "node_modules/.deno/react-dom@18.3.1/node_modules/react-dom",
)
const npmAliases: Record<string, string> = {
  "react": path.join(react18, "index.js"),
  "react/jsx-runtime": path.join(react18, "jsx-runtime.js"),
  "react/jsx-dev-runtime": path.join(react18, "jsx-dev-runtime.js"),
  "react-dom": path.join(reactDOM18, "index.js"),
  "react-dom/client": path.join(reactDOM18, "client.js"),
}

// Plugin that resolves workspace + npm bare specifiers before the deno plugin
const workspacePlugin: esbuild.Plugin = {
  name: "workspace-aliases",
  setup(build) {
    const allAliases = { ...workspaceAliases, ...npmAliases }
    for (const [alias, target] of Object.entries(allAliases)) {
      const escaped = alias.replace(/[/]/g, "\\/")
      const filter = new RegExp(`^${escaped}$`)
      build.onResolve({ filter }, () => ({ path: target }))
    }
  },
}

// Shared esbuild options
const sharedOptions: esbuild.BuildOptions = {
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outdir: "dist",
  sourcemap: true,
  plugins: [workspacePlugin, ...denoPlugins()],
}

async function printSizes(
  result: esbuild.BuildResult & { metafile: esbuild.Metafile },
) {
  for (const [p, meta] of Object.entries(result.metafile.outputs)) {
    if (p.endsWith(".map")) continue
    console.log(`  ${p}: ${(meta.bytes / 1024).toFixed(2)} KB`)
  }
}

async function build() {
  // ── 1. Plain TypeScript — @fobx/dom tab (no JSX) ───────────────────────────
  const domResult = await esbuild.build({
    ...sharedOptions,
    entryPoints: ["./src/dom-tab.ts"],
    metafile: true,
  })
  await printSizes(domResult)

  // ── 2. React tab — uses React 18 automatic JSX runtime ─────────────────────
  const reactResult = await esbuild.build({
    ...sharedOptions,
    entryPoints: ["./src/react-tab.tsx"],
    jsx: "automatic",
    jsxImportSource: "react", // → react/jsx-runtime (aliased to React 18)
    metafile: true,
  })
  await printSizes(reactResult)

  // ── 3. @fobx/jsx tab — uses fobx's own JSX runtime ─────────────────────────
  const jsxResult = await esbuild.build({
    ...sharedOptions,
    entryPoints: ["./src/jsx-tab.tsx"],
    jsx: "automatic",
    jsxImportSource: "@fobx/jsx", // → @fobx/jsx/jsx-runtime (aliased locally)
    metafile: true,
  })
  await printSizes(jsxResult)

  await esbuild.stop()
  console.log("✓ Playground built → dist/")
}

await build()
