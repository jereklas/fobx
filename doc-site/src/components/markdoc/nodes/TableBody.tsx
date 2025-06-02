import { FunctionComponent } from "preact"

interface TableBodyProps {
  children: any
}

/**
 * Renders table body section
 */
const TableBody: FunctionComponent<TableBodyProps> = ({ children }) => {
  return <tbody>{children}</tbody>
}

export default TableBody
