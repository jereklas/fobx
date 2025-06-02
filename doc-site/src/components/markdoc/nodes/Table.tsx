import { FunctionComponent } from "preact"

interface TableProps {
  children: any
}

/**
 * Renders table elements
 */
const Table: FunctionComponent<TableProps> = ({ children }) => {
  return (
    <div className="table-container">
      <table>{children}</table>
    </div>
  )
}

export default Table
