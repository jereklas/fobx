import { FunctionComponent } from "preact"
import { SiteMetadata } from "../build/metadata.ts"

interface FooterProps {
  metadata: SiteMetadata
}

/**
 * Page footer component
 */
const Footer: FunctionComponent<FooterProps> = ({ metadata }) => {
  const year = new Date().getFullYear()

  return (
    <footer class="bg-gray-100 py-8 mt-12">
      <div class="container mx-auto px-4">
        <div class="flex flex-col md:flex-row md:justify-between items-center">
          <div class="mb-4 md:mb-0">
            <p class="text-gray-600">
              © {year} {metadata.siteInfo.title} | v{metadata.siteInfo.version}
            </p>
          </div>
          <div>
            <ul class="flex space-x-4">
              <li>
                <a
                  href="https://github.com/jereklas/fobx"
                  target="_blank"
                  rel="noopener"
                  class="text-gray-600 hover:text-blue-600"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="/sitemap.xml"
                  class="text-gray-600 hover:text-blue-600"
                >
                  Sitemap
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
