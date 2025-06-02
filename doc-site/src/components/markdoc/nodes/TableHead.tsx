import { FunctionComponent } from "preact"

interface TableHeadProps {
  children: any
}

/**
 * Renders table header section
 */
const TableHead: FunctionComponent<TableHeadProps> = ({ children }) => {
  return <thead>{children}</thead>
}

export default TableHead
