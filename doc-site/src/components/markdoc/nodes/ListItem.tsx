import { FunctionComponent } from "preact"

interface ListItemProps {
  children: any
}

/**
 * Renders list item elements
 */
const ListItem: FunctionComponent<ListItemProps> = ({ children }) => {
  return <li>{children}</li>
}

export default ListItem
