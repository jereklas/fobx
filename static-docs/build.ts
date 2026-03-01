import config from "./static-docs.config.ts"
import { buildSite } from "./src/generator.ts"

const result = await buildSite(config)
console.log(`Generated ${result.pages.length} pages in ${result.outputDir}`)
