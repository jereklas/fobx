import { FunctionComponent } from "preact"
import { NavigationMetadata, SiteInfo } from "../../build/metadata.ts"

interface HeaderProps {
  siteInfo: SiteInfo
  navigation: NavigationMetadata
  currentPath: string
}

const Header: FunctionComponent<HeaderProps> = (
  { siteInfo, navigation, currentPath },
) => {
  return (
    <header className="docs-header">
      <nav className="docs-nav">
        <a href={siteInfo.baseUrl} className="docs-logo">
          {siteInfo.title}
        </a>

        <ul className="docs-nav-links">
          {navigation.mainNav.map((item) => (
            <li key={item.path}>
              <a
                href={item.isExternal
                  ? item.path
                  : siteInfo.baseUrl === "/"
                  ? item.path
                  : `${siteInfo.baseUrl}${item.path}`}
                className="docs-nav-link"
                target={item.isExternal ? "_blank" : undefined}
                rel={item.isExternal ? "noopener noreferrer" : undefined}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="docs-search">
          <input
            type="search"
            placeholder="Search docs..."
            className="docs-search-input"
            aria-label="Search documentation"
          />
        </div>
      </nav>
    </header>
  )
}

export default Header
