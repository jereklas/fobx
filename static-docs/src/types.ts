export interface DocsConfig {
  rootDir?: string
  inputDir?: string
  outputDir?: string
  assetsDir?: string
  siteTitle?: string
  siteDescription?: string
  basePath?: string
  includeMdx?: boolean
  cleanOutput?: boolean
}

export interface DocsFrontmatter {
  title?: string
  description?: string
  navTitle?: string
  navOrder?: number
  navSection?: string | string[]
  navPath?: string | string[]
  navSectionTitle?: string
  navSectionOrder?: number
  navSectionTitles?: string[]
  navSectionOrders?: number[]
  toc?: boolean
  draft?: boolean
  [key: string]: unknown
}

export interface DocsDocument {
  absolutePath: string
  sourcePath: string
  routePath: string
  slug: string
  extension: ".md" | ".mdx"
  frontmatter: DocsFrontmatter
  markdownBody: string
}

export interface DocsTocItem {
  depth: number
  id: string
  text: string
}

export interface DocsPage {
  id: string
  routePath: string
  sourcePath: string
  title: string
  description: string
  navTitle: string
  navOrder: number
  sectionPath: string[]
  sectionMeta: Array<{
    title?: string
    order?: number
  }>
  html: string
  plainText: string
  toc: DocsTocItem[]
  draft: boolean
}

export interface DocsNavItem {
  id: string
  title: string
  href?: string
  children?: DocsNavItem[]
  order: number
  isPage: boolean
}

export interface DocsBuildResult {
  pages: DocsPage[]
  nav: DocsNavItem[]
  outputDir: string
}
