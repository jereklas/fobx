import { FunctionComponent } from "preact"

interface TableHeaderProps {
  align?: "left" | "center" | "right"
  children: any
}

/**
 * Renders table header cell elements
 */
const TableHeader: FunctionComponent<TableHeaderProps> = (
  { align, children },
) => {
  return <th style={align ? { textAlign: align } : undefined}>{children}</th>
}

export default TableHeader
