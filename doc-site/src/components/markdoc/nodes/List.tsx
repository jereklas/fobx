import { FunctionComponent } from "preact"

interface ListProps {
  ordered?: boolean
  children: any
}

/**
 * Renders ordered and unordered lists
 */
const List: FunctionComponent<ListProps> = ({ ordered = false, children }) => {
  const ListTag = ordered ? "ol" : "ul"
  return <ListTag>{children}</ListTag>
}

export default List
