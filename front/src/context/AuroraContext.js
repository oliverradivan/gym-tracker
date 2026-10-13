import { createContext } from 'react'

export const AuroraContext = createContext(null)

// SwipeDeck uses this to identify the visible page.
// Defaults to true outside a SwipeDeck.
export const AuroraPageActive = createContext(true)