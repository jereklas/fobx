import { FunctionComponent } from "preact"

interface TableProps {
  children: any
}

/**
 * Renders table elements
 */
const Table: FunctionComponent<TableProps> = ({ children }) => {
  return (
    <div>
      <table>{children}</table>
    </div>
  )
}

export default Table
