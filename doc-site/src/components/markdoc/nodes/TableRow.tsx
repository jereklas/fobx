import { FunctionComponent } from "preact"

interface TableRowProps {
  children: any
}

/**
 * Renders table row elements
 */
const TableRow: FunctionComponent<TableRowProps> = ({ children }) => {
  return <tr>{children}</tr>
}

export default TableRow
