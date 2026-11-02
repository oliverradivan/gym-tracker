/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react'

const ThemeContext = createContext(null)
const THEME_STORAGE_KEY = 'theme'

const getSavedThemePreference = () => {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    return ['light', 'dark', 'system'].includes(savedTheme) ? savedTheme : 'light'
  } catch {
    return 'light'
  }
}

const getSystemTheme = () => (
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
)

const applyTheme = (themeName) => {
  const root = document.documentElement
  if (themeName === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  root.style.colorScheme = themeName
}

export function ThemeProvider({ children }) {
  const [themePreference, setThemePreferenceState] = useState(
    getSavedThemePreference
  )
  const [systemTheme, setSystemTheme] = useState(getSystemTheme)
  const theme = themePreference === 'system' ? systemTheme : themePreference

  useLayoutEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = (event) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    updateSystemTheme(mediaQuery)
    mediaQuery.addEventListener?.('change', updateSystemTheme)
    return () => mediaQuery.removeEventListener?.('change', updateSystemTheme)
  }, [])

  const setThemePreference = (preference) => {
    if (!['light', 'dark', 'system'].includes(preference)) {
      throw new Error(`Unsupported theme preference: ${preference}`)
    }
    localStorage.setItem(THEME_STORAGE_KEY, preference)
    setThemePreferenceState(preference)
  }

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setThemePreference(newTheme)
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themePreference,
        setThemePreference,
        toggleTheme,
        isLoading: false,
      }}
    >
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
