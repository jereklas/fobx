import { FunctionComponent } from "preact"
import type {
  NavigationMetadata,
  RouteMetadata,
  SiteInfo,
} from "../build/metadata.ts"
import DocsLayout from "./layout/DocsLayout.tsx"
import MarkdocRenderer from "./markdoc/MarkdocRenderer.tsx"

interface PageProps {
  route: RouteMetadata
  siteInfo: SiteInfo
  navigation: NavigationMetadata
}

/**
 * Individual page component that renders a documentation page
 */
const Page: FunctionComponent<PageProps> = (
  { route, siteInfo, navigation },
) => {
  return (
    <DocsLayout
      siteInfo={siteInfo}
      navigation={navigation}
      currentPath={route.path}
      toc={route.content.toc}
    >
      <article className="docs-content">
        {/* Main content with reading time injected after H1 */}
        <div className="content">
          <MarkdocRenderer
            ast={route.content.ast}
            readingTime={route.readingTime}
          />
        </div>

        {(route.frontmatter.prevPage || route.frontmatter.nextPage) && (
          <nav className="page-nav">
            {route.frontmatter.prevPage && (
              <a
                href={route.frontmatter.prevPage.path}
                className="page-nav-prev"
              >
                ← {route.frontmatter.prevPage.title}
              </a>
            )}
            {route.frontmatter.nextPage && (
              <a
                href={route.frontmatter.nextPage.path}
                className="page-nav-next"
              >
                {route.frontmatter.nextPage.title} →
              </a>
            )}
          </nav>
        )}
      </article>
    </DocsLayout>
  )
}

export default Page
