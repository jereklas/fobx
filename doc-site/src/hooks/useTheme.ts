import { createContext } from "preact"
import { useContext, useEffect, useState } from "preact/hooks"

export type Theme = "light" | "dark"

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}

export function useThemeProvider() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage for saved theme preference
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("docs-theme")
      if (savedTheme === "light" || savedTheme === "dark") {
        return savedTheme
      }
      // Fall back to system preference
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    }
    return "light"
  })

  const toggleTheme = () => {
    setTheme(prev => prev === "light" ? "dark" : "light")
  }

  // Save theme to localStorage and apply to document
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("docs-theme", theme)
      document.documentElement.setAttribute("data-theme", theme)
    }
  }, [theme])

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const handleChange = (e: MediaQueryListEvent) => {
        // Only update if user hasn't manually set a preference
        const savedTheme = localStorage.getItem("docs-theme")
        if (!savedTheme) {
          setTheme(e.matches ? "dark" : "light")
        }
      }

      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  return { theme, toggleTheme }
}