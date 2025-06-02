import { FunctionComponent } from "preact"
import { ParsedDocument } from "../build/markdown.ts"
import { RouteMetadata, SiteMetadata } from "../build/metadata.ts"
import MarkdocRenderer from "./markdoc/MarkdocRenderer.tsx"

interface PageContentProps {
  doc: ParsedDocument
  route: RouteMetadata
  metadata: SiteMetadata
}

/**
 * Component that renders the main content of a page
 */
const PageContent: FunctionComponent<PageContentProps> = (
  { doc, route, metadata },
) => {
  /**
   * Generate GitHub edit URL for this page
   */
  const generateEditButton = () => {
    const editUrl =
      `https://github.com/jereklas/fobx/edit/main${route.sourcePath}`

    return (
      <div class="mt-8 pt-4 border-t">
        <a
          href={editUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center text-sm text-gray-600 hover:text-blue-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            class="w-4 h-4 mr-1"
          >
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
          Edit this page on GitHub
        </a>
      </div>
    )
  }

  return (
    <article class="prose lg:prose-xl max-w-none">
      {/* Render markdown content using MarkdocRenderer */}
      <MarkdocRenderer ast={doc.ast} />

      {/* Edit button */}
      {route.showEditButton && generateEditButton()}

      {/* Last modified date if available */}
      {route.lastModified && (
        <div class="text-sm text-gray-500 mt-8">
          Last updated: {new Date(route.lastModified).toLocaleDateString()}
        </div>
      )}
    </article>
  )
}

export default PageContent
