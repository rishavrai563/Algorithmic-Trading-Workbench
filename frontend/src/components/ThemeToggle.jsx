import { useEffect, useState } from 'react'

const STORAGE_KEY = 'algotrading-theme'

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light'

  const saved = window.localStorage.getItem(STORAGE_KEY)

  return saved === 'dark' ? 'dark' : 'light'
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export default function ThemeToggle({ compact = false }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((current) =>
      current === 'dark' ? 'light' : 'dark'
    )
  }

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className={compact ? 'theme-toggle compact' : 'theme-toggle'}
      onClick={toggleTheme}
      aria-label={
        isDark
          ? 'Switch to light theme'
          : 'Switch to dark theme'
      }
      title={
        isDark
          ? 'Switch to light theme'
          : 'Switch to dark theme'
      }
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isDark ? '☀' : '☾'}
      </span>

      {!compact && (
        <span>{isDark ? 'Light' : 'Dark'}</span>
      )}
    </button>
  )
}