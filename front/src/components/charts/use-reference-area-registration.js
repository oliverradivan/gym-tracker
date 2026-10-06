import { useCallback, useMemo, useState } from 'react'
import { extractReferenceAreaConfigs } from './reference-area-config'

export function useReferenceAreaRegistration(children) {
  const [registeredReferenceAreas, setRegisteredReferenceAreas] = useState(
    () => new Map()
  )

  const registerReferenceArea = useCallback((id, config) => {
    setRegisteredReferenceAreas((previous) => {
      const existing = previous.get(id)
      if (
        existing &&
        existing.yAxisId === config.yAxisId &&
        existing.y1 === config.y1 &&
        existing.y2 === config.y2 &&
        existing.axisLabelColor === config.axisLabelColor
      ) {
        return previous
      }
      const next = new Map(previous)
      next.set(id, config)
      return next
    })
  }, [])

  const unregisterReferenceArea = useCallback((id) => {
    setRegisteredReferenceAreas((previous) => {
      if (!previous.has(id)) {
        return previous
      }
      const next = new Map(previous)
      next.delete(id)
      return next
    })
  }, [])

  const referenceAreaRegistration = useMemo(
    () => ({ registerReferenceArea, unregisterReferenceArea }),
    [registerReferenceArea, unregisterReferenceArea]
  )

  const referenceAreas = useMemo(() => {
    const extracted = extractReferenceAreaConfigs(children)
    const registered = [...registeredReferenceAreas.values()]
    if (registered.length === 0) return extracted
    if (extracted.length === 0) return registered
    return [...extracted, ...registered]
  }, [children, registeredReferenceAreas])

  return { referenceAreaRegistration, referenceAreas }
}
