/**
 * A flexible file server with file watching capabilities for development environments.
 * This server can be used to serve static files and supports SPA routing.
 */
import { extname, isAbsolute, join } from "@std/path"
import { debounce } from "jsr:@std/async/debounce"

/**
 * Configuration options for the file server
 */
export interface FileServerOptions {
  /** Port to run the server on */
  port?: number
  /** Root directory to serve files from */
  rootDir: string
  /** Whether to enable SPA routing (serve index.html for 404s) */
  enableSpaRouting?: boolean
  /** Function to call when a file is changed in any watched directory */
  onFileChange?: (path: string, event: Deno.FsEvent) => void
  /** Function to call specifically when a file is changed in the root directory */
  onRootDirFileChange?: (path: string, event: Deno.FsEvent) => void
  /**
   * Watch configuration specified as an object with paths as keys and extension arrays as values
   *
   * @example
   * ```ts
   * watch: {
   *   './src': ['.ts', '.css'],
   *   '/absolute/path': ['.js'],
   *   './public': [] // Watch all files in this directory
   * }
   * ```
   */
  watch?: Record<string, string[]>
  /** File extensions to watch in the root directory (empty array means watch all files) */
  rootDirExtensions?: string[]
  /** Whether to print debug logs */
  verbose?: boolean
}

// MIME types for common file extensions
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".map": "application/json", // Source map files
}

/**
 * Starts a file server with optional file watching
 *
 * @example
 * ```ts
 * import { startFileServer } from "@fobx/utils/file-server"
 *
 * startFileServer({
 *   port: 3000,
 *   rootDir: "./public",
 *   enableSpaRouting: true,
 *   watch: {
 *     "./src": [".ts", ".css", ".html"],
 *     "/absolute/path/to/other": [".js"]
 *   },
 *   onFileChange: (path, event) => console.log(`File ${path} changed: ${event.kind}`)
 * })
 * ```
 */
export function startFileServer(options: FileServerOptions): () => void {
  const {
    port = 3000,
    rootDir,
    enableSpaRouting = true,
    onFileChange,
    onRootDirFileChange,
    watch,
    rootDirExtensions = [],
    verbose = false,
  } = options

  console.log(`Serving files from ${rootDir}`)

  // Start watching files if configuration is provided
  let watcher: Deno.FsWatcher | undefined
  let rootDirWatcher: Deno.FsWatcher | undefined

  // Watch specified directories
  if (onFileChange && watch && Object.keys(watch).length > 0) {
    watcher = startFileWatcher(rootDir, watch, onFileChange, verbose)
  }

  // Watch root directory if requested
  if (onRootDirFileChange) {
    if (verbose) {
      console.log(`Watching root directory: ${rootDir}`)
      if (rootDirExtensions.length > 0) {
        console.log(`  Extensions: ${rootDirExtensions.join(", ")}`)
      } else {
        console.log(`  Watching all files`)
      }
    }

    rootDirWatcher = Deno.watchFs(rootDir)

    // Create a debounced version of the onRootDirFileChange callback
    const debouncedOnRootDirFileChange = debounce(
      (path: string, event: Deno.FsEvent) => {
        // Check if the file extension matches what we're looking for
        const ext = extname(path).toLowerCase()

        // If no extensions specified or extension matches, call the callback
        if (rootDirExtensions.length === 0 || rootDirExtensions.includes(ext)) {
          onRootDirFileChange(path, event)
        }
      },
      100,
    ) // Start watching the root directory
    ;(async () => {
      try {
        for await (const event of rootDirWatcher) {
          // Process each path in the event
          for (const path of event.paths) {
            debouncedOnRootDirFileChange(path, event)
          }
        }
      } catch (err) {
        // Handle any errors that might occur during watching
        if (
          !(err instanceof Deno.errors.BadResource) &&
          !(err instanceof Deno.errors.Interrupted)
        ) {
          console.error("Error in root directory watcher:", err)
        }
      }
    })()
  }

  // Start the server
  const server = Deno.serve({ port }, async (req) => {
    const url = new URL(req.url)
    let pathname = url.pathname

    // Add debug info in console
    if (verbose) {
      console.log(
        `${new Date().toLocaleTimeString()} - ${req.method} ${pathname}`,
      )
    }

    // Try to serve the file directly
    let filePath = join(rootDir, pathname)
    let fileExists = await fileExistsAsync(filePath)

    // Debug logging
    if (verbose) {
      console.log(`Looking for file: ${filePath}`)
      console.log(`File exists: ${fileExists}`)
    }

    // Handle root route "/" by serving index.html
    if (pathname === "/" || pathname === "") {
      const indexPath = join(rootDir, "index.html")
      if (verbose) {
        console.log(`Root route detected, trying index.html: ${indexPath}`)
      }
      if (await fileExistsAsync(indexPath)) {
        filePath = indexPath
        fileExists = true
        if (verbose) {
          console.log(`Found index.html for root route: ${filePath}`)
        }
      }
    } // If the file doesn't exist and doesn't have an extension, try different approaches
    else if (!fileExists && !pathname.includes(".")) {
      // Try with .html extension first (for routes like /core-docs-controlling-comparisons)
      const htmlFilePath = `${filePath}.html`
      if (verbose) {
        console.log(`Trying with .html extension: ${htmlFilePath}`)
      }
      if (await fileExistsAsync(htmlFilePath)) {
        filePath = htmlFilePath
        fileExists = true
        if (verbose) {
          console.log(`Found HTML file: ${filePath}`)
        }
      } // If no HTML file exists, try as a directory with index.html
      else if (!pathname.endsWith("/")) {
        const dirIndexPath = join(rootDir, `${pathname}/index.html`)
        if (verbose) {
          console.log(`Trying directory index: ${dirIndexPath}`)
        }
        if (await fileExistsAsync(dirIndexPath)) {
          filePath = dirIndexPath
          fileExists = true
          if (verbose) {
            console.log(`Found directory index: ${filePath}`)
          }
        }
      } // If still no match and it's a directory without trailing slash, add it
      else {
        const trailingIndexPath = join(rootDir, pathname, "index.html")
        if (verbose) {
          console.log(`Trying trailing index: ${trailingIndexPath}`)
        }
        if (await fileExistsAsync(trailingIndexPath)) {
          filePath = trailingIndexPath
          fileExists = true
          if (verbose) {
            console.log(`Found trailing index: ${filePath}`)
          }
        }
      }
    }

    // If we found a file, serve it
    if (fileExists) {
      try {
        const file = await Deno.open(filePath, { read: true })
        const stat = await Deno.stat(filePath)

        // Determine content type based on file extension
        const ext = extname(filePath).toLowerCase()
        const contentType = MIME_TYPES[ext] || "application/octet-stream"

        if (verbose) {
          console.log(`Serving file: ${filePath}`)
          console.log(`File extension: ${ext}`)
          console.log(`Content type: ${contentType}`)
          console.log(`File size: ${stat.size}`)
        }

        const headers = new Headers()
        headers.set("content-length", stat.size.toString())
        headers.set("content-type", contentType)

        // Add cache control for JS files
        if (ext === ".js" || ext === ".mjs") {
          headers.set("cache-control", "no-cache, max-age=0")
        }

        // Set CORS and debug headers
        enhanceHeadersForDebug(headers)

        return new Response(file.readable, {
          status: 200,
          headers,
        })
      } catch (e) {
        console.error("Error serving file:", e)
        return new Response(`Internal Server Error: ${(e as Error).message}`, {
          status: 500,
          headers: { "content-type": "text/plain" },
        })
      }
    }

    // If enableSpaRouting is true and no matching file was found, serve the index.html
    if (enableSpaRouting) {
      try {
        const indexPath = join(rootDir, "index.html")
        if (verbose) {
          console.log(`SPA routing: serving index.html from ${indexPath}`)
        }
        const indexFile = await Deno.open(indexPath, { read: true })
        const stat = await Deno.stat(indexPath)
        const headers = new Headers()
        headers.set("content-length", stat.size.toString())
        headers.set("content-type", "text/html")
        enhanceHeadersForDebug(headers)
        return new Response(indexFile.readable, {
          status: 200,
          headers,
        })
      } catch (e) {
        if (verbose) {
          console.log(`Could not serve index.html for SPA routing: ${e}`)
        }
        return new Response("Not Found", { status: 404 })
      }
    }

    // If we got here, the file was not found
    if (verbose) {
      console.log(`File not found: ${pathname}`)
    }
    return new Response("Not Found", { status: 404 })
  })

  // Return a function that closes both the server and the watchers
  return () => {
    server.shutdown()
    if (watcher) {
      watcher.close()
    }
    if (rootDirWatcher) {
      rootDirWatcher.close()
    }
    console.log("\nFile server stopped")
  }
}

/**
 * Helper function to check if a file exists asynchronously
 */
async function fileExistsAsync(path: string): Promise<boolean> {
  try {
    await Deno.stat(path)
    return true
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return false
    }
    throw e
  }
}

/**
 * Helper function to add debug-friendly headers
 */
function enhanceHeadersForDebug(headers: Headers) {
  // Enable CORS for development
  headers.set("access-control-allow-origin", "*")
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS")
  headers.set("access-control-allow-headers", "Content-Type")

  // Disable caching to ensure fresh content during development
  headers.set("cache-control", "no-store, must-revalidate")
  headers.set("pragma", "no-cache")
  headers.set("expires", "0")
}

/**
 * Resolves a path that might be absolute or relative to rootDir
 */
function resolvePath(rootDir: string, path: string): string {
  return isAbsolute(path) ? path : join(rootDir, path)
}

/**
 * Starts watching files for changes
 */
function startFileWatcher(
  rootDir: string,
  watchConfig: Record<string, string[]>,
  onFileChange: (path: string, event: Deno.FsEvent) => void,
  verbose = false,
): Deno.FsWatcher {
  // Log what we're watching
  const pathsToWatch: string[] = []
  const pathExtensionMap = new Map()

  Object.entries(watchConfig).forEach(([path, extensions]) => {
    const resolvedPath = resolvePath(rootDir, path)
    pathsToWatch.push(resolvedPath)
    pathExtensionMap.set(resolvedPath, extensions)

    if (verbose) {
      console.log(`Watching for changes in: ${resolvedPath}`)
      if (extensions && extensions.length > 0) {
        console.log(`  Extensions: ${extensions.join(", ")}`)
      } else {
        console.log(`  Watching all files`)
      }
    }
  })

  // Create a watcher for each path
  const watcher = Deno.watchFs(pathsToWatch)

  // Create a debounced version of the onFileChange callback
  // This prevents rapid-fire events from causing too many callbacks
  const debouncedOnFileChange = debounce(
    (path: string, event: Deno.FsEvent) => {
      // Check if the file extension matches what we're looking for
      const ext = extname(path).toLowerCase()

      // Determine which watch path this file belongs to
      let shouldProcess = false
      for (const [watchPath, extensions] of pathExtensionMap.entries()) {
        if (path.startsWith(watchPath)) {
          // If extensions array is empty, watch all files
          // Otherwise, check if this file extension is in the list
          if (extensions.length === 0 || extensions.includes(ext)) {
            shouldProcess = true
            break
          }
        }
      }

      if (shouldProcess) {
        onFileChange(path, event)
      }
    },
    100,
  ) // 100ms debounce time - adjust as needed
   // Start watching for events
  ;(async () => {
    try {
      for await (const event of watcher) {
        // Process each path in the event
        for (const path of event.paths) {
          debouncedOnFileChange(path, event)
        }
      }
    } catch (err) {
      // Handle any errors that might occur during watching
      if (
        !(err instanceof Deno.errors.BadResource) &&
        !(err instanceof Deno.errors.Interrupted)
      ) {
        console.error("Error in file watcher:", err)
      }
    }
  })()

  return watcher
}
