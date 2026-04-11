import { slugify } from "./markdown.ts"
import type { DocsNavItem, DocsPage } from "./types.ts"

interface MutableNavNode {
  id: string
  title: string
  href?: string
  order: number
  defaultExpanded: boolean
  collapsible: boolean
  isPage: boolean
  children: MutableNavNode[]
}

export const buildNav = (pages: DocsPage[]): DocsNavItem[] => {
  const root: MutableNavNode = {
    id: "root",
    title: "root",
    order: -1,
    defaultExpanded: false,
    collapsible: true,
    isPage: false,
    children: [],
  }

  for (const page of pages) {
    let cursor = root

    for (const [index, part] of page.sectionPath.entries()) {
      const id = `section:${
        slugify(page.sectionPath.slice(0, index + 1).join("/"))
      }`
      let section = cursor.children.find((node) =>
        !node.isPage && node.id === id
      )
      if (!section) {
        section = {
          id,
          title: normalizeTitle(part),
          order: Number.POSITIVE_INFINITY,
          defaultExpanded: false,
          collapsible: true,
          isPage: false,
          children: [],
        }
        cursor.children.push(section)
      }

      const sectionMeta = page.sectionMeta[index]
      if (sectionMeta?.title) {
        section.title = sectionMeta.title
      }
      if (typeof sectionMeta?.order === "number") {
        section.order = sectionMeta.order
      }
      if (sectionMeta?.expanded === true) {
        section.defaultExpanded = true
      }
      if (sectionMeta?.collapsible === false) {
        section.collapsible = false
      }

      cursor = section
    }

    cursor.children.push({
      id: `page:${page.id}`,
      title: page.navTitle,
      href: page.routePath,
      order: page.navOrder,
      defaultExpanded: false,
      collapsible: false,
      isPage: true,
      children: [],
    })
  }

  return toPublicNodes(sortNode(root).children)
}

const normalizeTitle = (value: string): string => {
  if (value.startsWith("@")) {
    return value
  }

  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (part) => part.toUpperCase())
}

const sortNode = (node: MutableNavNode): MutableNavNode => {
  node.children.sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order
    }
    if (left.isPage !== right.isPage) {
      return left.isPage ? -1 : 1
    }
    return left.title.localeCompare(right.title)
  })

  node.children = node.children.map(sortNode)
  return node
}

const toPublicNodes = (nodes: MutableNavNode[]): DocsNavItem[] => {
  return nodes.map((node) => ({
    id: node.id,
    title: node.title,
    href: node.href,
    order: node.order,
    defaultExpanded: node.defaultExpanded || undefined,
    collapsible: node.isPage ? undefined : node.collapsible,
    isPage: node.isPage,
    children: node.children.length > 0
      ? toPublicNodes(node.children)
      : undefined,
  }))
}
