import { FunctionComponent } from "preact"
import {
  NavigationMetadata,
  SiteInfo,
  TableOfContentsItem,
} from "../../build/metadata.ts"
import Header from "./Header.tsx"
import Sidebar from "./Sidebar.tsx"
import TableOfContents from "./TableOfContents.tsx"

interface DocsLayoutProps {
  siteInfo: SiteInfo
  navigation: NavigationMetadata
  currentPath: string
  toc?: TableOfContentsItem[]
  children: preact.ComponentChildren
}

const DocsLayout: FunctionComponent<DocsLayoutProps> = ({
  siteInfo,
  navigation,
  currentPath,
  toc = [],
  children,
}) => {
  return (
    <div className="docs-layout">
      <Header
        siteInfo={siteInfo}
        navigation={navigation}
        currentPath={currentPath}
      />

      <Sidebar
        siteInfo={siteInfo}
        navigation={navigation}
        currentPath={currentPath}
      />

      <main className="docs-main">
        <div className="docs-content">
          {children}
        </div>
      </main>

      <TableOfContents toc={toc} />
    </div>
  )
}

export default DocsLayout
