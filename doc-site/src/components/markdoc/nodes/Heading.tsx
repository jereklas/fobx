import { FunctionComponent } from "preact"

interface HeadingProps {
  id: string
  level?: 1 | 2 | 3 | 4 | 5 | 6
  children: any
}

/**
 * Renders heading elements (h1-h6) with the proper level and id for anchor links
 */
const Heading: FunctionComponent<HeadingProps> = (
  props,
) => {
  const { id, level, children } = props
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"

  return <Tag id={id}>{children}</Tag>
}

export default Heading
