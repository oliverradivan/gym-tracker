import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider, useTheme } from './themeContext'

function createMatchMedia(initialMatches = false) {
  const listeners = new Set()
  const mediaQuery = {
    matches: initialMatches,
    addEventListener: vi.fn((event, listener) => {
      if (event === 'change') listeners.add(listener)
    }),
    removeEventListener: vi.fn((event, listener) => {
      if (event === 'change') listeners.delete(listener)
    }),
  }

  return {
    mediaQuery,
    setMatches(matches) {
      mediaQuery.matches = matches
      for (const listener of listeners) {
        listener({ matches })
      }
    },
  }
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = ''
  vi.restoreAllMocks()
})

describe('theme preference', () => {
  it('follows device theme changes when system is selected', () => {
    const systemPreference = createMatchMedia(false)
    vi.stubGlobal('matchMedia', vi.fn(() => systemPreference.mediaQuery))
    localStorage.setItem('theme', 'system')

    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    act(() => systemPreference.setMatches(true))
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    act(() => systemPreference.setMatches(false))
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('persists an explicit theme preference', () => {
    const systemPreference = createMatchMedia(true)
    vi.stubGlobal('matchMedia', vi.fn(() => systemPreference.mediaQuery))

    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })

    act(() => result.current.setThemePreference('system'))
    expect(localStorage.getItem('theme')).toBe('system')
    expect(result.current.themePreference).toBe('system')
    expect(result.current.theme).toBe('dark')
  })
})
