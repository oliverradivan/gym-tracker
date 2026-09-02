/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)
const getSavedTheme = () => {
  try {
    return localStorage.getItem('theme') || 'light'
  } catch {
    return 'light'
  }
}

const applyTheme = (themeName) => {
  const root = document.documentElement
  if (themeName === 'dark') {
    root.classList.add('dark-mode')
  } else {
    root.classList.remove('dark-mode')
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getSavedTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    applyTheme(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isLoading: false }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
