// ─── Simple static file server for the playground ───────────────────────────
//
// Usage: deno run -A serve.ts
// Opens http://localhost:3000/

const port = 3000

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  let path = url.pathname === "/" ? "/index.html" : url.pathname

  // Serve dist/ files at /dist/...
  const filePath = `${Deno.cwd()}${path}`

  try {
    const file = await Deno.readFile(filePath)
    const ext = filePath.split(".").pop() ?? ""
    const contentType: Record<string, string> = {
      html: "text/html; charset=utf-8",
      js: "application/javascript",
      css: "text/css",
      json: "application/json",
      map: "application/json",
    }
    return new Response(file, {
      headers: {
        "content-type": contentType[ext] ?? "application/octet-stream",
      },
    })
  } catch {
    return new Response("Not Found", { status: 404 })
  }
}

Deno.serve({ port }, handleRequest)
console.log(`Playground → http://localhost:${port}/`)
