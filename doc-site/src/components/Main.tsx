import { lazy, Suspense } from "preact/compat"
import {
  NavigationMetadata,
  RouteMetadata,
  SiteInfo,
} from "../build/metadata.ts"

const Page = lazy(() => import("./Page.tsx"))

export type MainProps = {
  siteInfo: SiteInfo
  route: RouteMetadata
  navigation: NavigationMetadata
  lastUpdated: string
}

export const Main = (
  { siteInfo, route, navigation, lastUpdated }: MainProps,
) => {
  return (
    <Suspense fallback={<div className="loading">Loading...</div>}>
      <Page siteInfo={siteInfo} route={route} navigation={navigation} />
    </Suspense>
  )
}
