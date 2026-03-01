import { assert, assertEquals, assertStringIncludes } from "@std/assert"
import { join } from "@std/path"
import { buildSite } from "../src/generator.ts"

Deno.test("buildSite generates html, nav, and search assets", async () => {
  const root = await Deno.makeTempDir({ prefix: "static-docs-test-" })
  const input = join(root, "content")
  const output = join(root, "dist")

  await Deno.mkdir(join(input, "guides"), { recursive: true })
  await Deno.writeTextFile(
    join(input, "index.md"),
    `---\ntitle: Home\nnavOrder: 0\n---\n\n## Intro\n\nWelcome.`,
  )
  await Deno.writeTextFile(
    join(input, "guides", "custom.md"),
    `---\ntitle: Custom\nnavTitle: Custom Nav\nnavSection: Docs/Overrides\nnavOrder: 4\nnavSectionTitles:\n  - Docs Hub\n  - Deep Overrides\nnavSectionOrders:\n  - 2\n  - 1\n---\n\n## A\n\nText.`,
  )

  const result = await buildSite({
    rootDir: root,
    inputDir: input,
    outputDir: output,
    siteTitle: "Test Docs",
  })

  assertEquals(result.pages.length, 2)
  assert(result.nav.length > 0)
  assertEquals(result.nav[0].title, "Home")
  assertEquals(result.nav[1].title, "Docs Hub")
  assertEquals(result.nav[1].children?.[0].title, "Deep Overrides")

  const homeHtml = await Deno.readTextFile(join(output, "index.html"))
  const guideHtml = await Deno.readTextFile(
    join(output, "guides", "custom", "index.html"),
  )
  const searchJson = await Deno.readTextFile(
    join(output, "assets", "search-index.json"),
  )

  assertStringIncludes(homeHtml, "Test Docs")
  assertStringIncludes(guideHtml, "Custom Nav")
  assertStringIncludes(searchJson, "Custom")

  await Deno.remove(root, { recursive: true })
})

Deno.test("buildSite respects basePath links", async () => {
  const root = await Deno.makeTempDir({ prefix: "static-docs-test-" })
  const input = join(root, "content")
  const output = join(root, "dist")

  await Deno.mkdir(input, { recursive: true })
  await Deno.writeTextFile(join(input, "index.md"), "# Home")

  await buildSite({
    rootDir: root,
    inputDir: input,
    outputDir: output,
    basePath: "/repo/",
  })

  const html = await Deno.readTextFile(join(output, "index.html"))
  assertStringIncludes(html, 'href="/repo/assets/style.css"')

  await Deno.remove(root, { recursive: true })
})
