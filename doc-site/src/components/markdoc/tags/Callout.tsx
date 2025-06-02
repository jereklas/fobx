import { FunctionComponent } from "preact"

interface CalloutProps {
  type: "note" | "warning" | "error" | "info"
  title?: string
  children: any
}

/**
 * Renders custom callout blocks with different styles based on type
 */
const Callout: FunctionComponent<CalloutProps> = ({
  type = "note",
  title,
  children,
}) => {
  const styles = {
    note: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    error: "bg-red-50 border-red-200 text-red-800",
    info: "bg-green-50 border-green-200 text-green-800",
  }

  const icons = {
    note: "ℹ️",
    warning: "⚠️",
    error: "🛑",
    info: "💡",
  }

  return (
    <div className={`p-4 my-4 border-l-4 ${styles[type]}`}>
      <div className="flex items-center font-bold mb-2">
        <span className="mr-2">{icons[type]}</span>
        {title || type.charAt(0).toUpperCase() + type.slice(1)}
      </div>
      <div>{children}</div>
    </div>
  )
}

export default Callout
