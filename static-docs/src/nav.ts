import { slugify } from "./markdown.ts"
import type { DocsNavItem, DocsPage } from "./types.ts"

interface MutableNavNode {
  id: string
  title: string
  href?: string
  order: number
  isPage: boolean
  children: MutableNavNode[]
}

export const buildNav = (pages: DocsPage[]): DocsNavItem[] => {
  const root: MutableNavNode = {
    id: "root",
    title: "root",
    order: -1,
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

      cursor = section
    }

    cursor.children.push({
      id: `page:${page.id}`,
      title: page.navTitle,
      href: page.routePath,
      order: page.navOrder,
      isPage: true,
      children: [],
    })
  }

  return toPublicNodes(sortNode(root).children)
}

const normalizeTitle = (value: string): string => {
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
    isPage: node.isPage,
    children: node.children.length > 0
      ? toPublicNodes(node.children)
      : undefined,
  }))
}
