import { FunctionComponent } from "preact"

interface TableCellProps {
  align?: "left" | "center" | "right"
  children: any
}

/**
 * Renders table cell elements
 */
const TableCell: FunctionComponent<TableCellProps> = ({ align, children }) => {
  return <td style={align ? { textAlign: align } : undefined}>{children}</td>
}

export default TableCell
