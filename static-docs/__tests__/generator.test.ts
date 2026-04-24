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
    githubUrl: "https://github.com/example/test-docs",
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
  assertStringIncludes(homeHtml, 'href="https://github.com/example/test-docs"')
  assertStringIncludes(homeHtml, 'data-nav-toggle aria-expanded="false"')
  assertStringIncludes(homeHtml, 'class="nav-group-wrap is-collapsed"')
  assertStringIncludes(guideHtml, "Custom Nav")
  assertStringIncludes(guideHtml, 'data-nav-toggle aria-expanded="true"')
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

Deno.test("buildSite excludes staged docs directories from output", async () => {
  const root = await Deno.makeTempDir({ prefix: "static-docs-test-" })
  const input = join(root, "content")
  const output = join(root, "dist")

  await Deno.mkdir(join(input, "_staged", "jsx"), { recursive: true })
  await Deno.writeTextFile(join(input, "index.md"), "# Home")
  await Deno.writeTextFile(
    join(input, "_staged", "jsx", "index.md"),
    "---\ntitle: Staged JSX\n---\n\nHidden until moved.",
  )

  const result = await buildSite({
    rootDir: root,
    inputDir: input,
    outputDir: output,
  })

  assertEquals(result.pages.length, 1)
  assertEquals(result.pages[0].routePath, "/")

  let stagedExists = true
  try {
    await Deno.stat(join(output, "_staged", "jsx", "index.html"))
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      stagedExists = false
    } else {
      throw error
    }
  }

  assertEquals(stagedExists, false)

  await Deno.remove(root, { recursive: true })
})
