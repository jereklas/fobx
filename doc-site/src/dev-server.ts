import { startFileServer } from "@fobx/utils/file-server"
import { join } from "@std/path"
import { configure } from "@fobx/core"
import { deepEqual } from "fast-equals"
import { buildStaticFiles } from "./build.ts"

configure({ comparer: { structural: deepEqual } })

const PORT = 3000
const rootDir = new URL("..", import.meta.url).pathname
const publicDir = join(rootDir, "public")
const srcDir = join(rootDir, "src")

// Build the static site initially
console.log("Starting initial build...")
await buildStaticFiles()
console.log("Initial build complete, starting server...")

// Watch for changes in source files and log them
const stopServer = startFileServer({
  port: PORT,
  rootDir: publicDir,
  enableSpaRouting: false,
  watch: {
    [srcDir]: [],
    "/fobx": [".md"],
  },
  verbose: true,
  onFileChange: async (path, event) => {
    console.log(`[${new Date().toLocaleTimeString()}] File changed: ${path}`)
    console.log(`Change type: ${event.kind}`)

    // Rebuild static files when changes are detected
    await buildStaticFiles()
  },
  onRootDirFileChange(path, event) {
    // TODO: send SSE message to clients so that they can reload
  },
})

// Handle (Ctrl+C) to gracefully shut down the server
Deno.addSignalListener("SIGINT", () => {
  stopServer()
  Deno.exit(0)
})
