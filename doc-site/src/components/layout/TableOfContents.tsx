import { FunctionComponent } from "preact"
import { TableOfContentsItem } from "../../build/metadata.ts"

interface TableOfContentsProps {
  toc: TableOfContentsItem[]
  currentHeading?: string
}

const TableOfContents: FunctionComponent<TableOfContentsProps> = (
  { toc, currentHeading },
) => {
  if (!toc || toc.length === 0) {
    return null
  }

  const renderTocItems = (items: TableOfContentsItem[]) => {
    return items.map((item) => (
      <li key={item.id}>
        <a
          href={`#${item.id}`}
          className={`toc-link ${currentHeading === item.id ? "active" : ""}`}
          data-level={item.level}
        >
          {item.title}
        </a>
        {item.children && item.children.length > 0 && (
          <ul className="toc-nav">
            {renderTocItems(item.children)}
          </ul>
        )}
      </li>
    ))
  }

  return (
    <aside className="docs-toc">
      <h3 className="toc-title">On this page</h3>
      <nav>
        <ul className="toc-nav">
          {renderTocItems(toc)}
        </ul>
      </nav>
    </aside>
  )
}

export default TableOfContents
