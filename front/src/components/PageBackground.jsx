import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import './pageBackground.css'
import { BackgroundContext, BackgroundPageActive } from '../context/BackgroundContext'

const CATEGORY_ATTR = 'data-background-category'

function BackgroundLayer({ children, tone, shell = false }) {
  const toneKey = tone ? String(tone).toLowerCase() : undefined

  return (
    <div
      className={`page-background${shell ? ' page-background--shell' : ''}`}
      data-tone={toneKey}
    >
      <div className="page-background__content">{children}</div>
    </div>
  )
}

export function BackgroundShell({ children }) {
  const [state, setState] = useState(null)
  const value = useMemo(
    () => ({
      set: setState,
      clear: () => setState(null),
    }),
    []
  )

  return (
    <BackgroundContext.Provider value={value}>
      <BackgroundLayer shell tone={state?.tone}>
        {children}
      </BackgroundLayer>
    </BackgroundContext.Provider>
  )
}

function useScrollTone(containerRef, enabled) {
  const [scrollTone, setScrollTone] = useState(undefined)
  const currentRef = useRef(undefined)

  useEffect(() => {
    const container = containerRef.current
    if (!enabled || !container) return undefined

    let frame = 0

    const measure = () => {
      frame = 0

      const viewW = window.innerWidth
      const viewH = window.innerHeight
      const totals = {}

      container.querySelectorAll(`[${CATEGORY_ATTR}]`).forEach((element) => {
        const rect = element.getBoundingClientRect()
        const visibleH = Math.min(rect.bottom, viewH) - Math.max(rect.top, 0)
        const visibleW = Math.min(rect.right, viewW) - Math.max(rect.left, 0)
        if (visibleH <= 0 || visibleW <= 0) return

        const key = String(element.getAttribute(CATEGORY_ATTR)).toLowerCase()
        totals[key] = (totals[key] || 0) + visibleH * visibleW
      })

      let best
      let bestArea = 0
      for (const key of Object.keys(totals)) {
        if (totals[key] > bestArea) {
          best = key
          bestArea = totals[key]
        }
      }

      if (!best) return

      const current = currentRef.current
      if (current && current !== best && bestArea < (totals[current] || 0) * 1.1) {
        return
      }

      if (best !== current) {
        currentRef.current = best
        setScrollTone(best)
      }
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    document.addEventListener('scroll', schedule, { capture: true, passive: true })
    window.addEventListener('resize', schedule, { passive: true })

    const mutations = new MutationObserver(schedule)
    mutations.observe(container, { childList: true, subtree: true })
    schedule()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      document.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', schedule)
      mutations.disconnect()
    }
  }, [containerRef, enabled])

  return scrollTone
}

export default function PageBackground({ children, tone, scrollTone = false }) {
  const context = useContext(BackgroundContext)
  const pageActive = useContext(BackgroundPageActive)
  const contentRef = useRef(null)
  const toneKey = tone ? String(tone).toLowerCase() : undefined
  const spyEnabled = scrollTone && (context ? Boolean(pageActive) : true)
  const spiedTone = useScrollTone(contentRef, spyEnabled)
  const effectiveTone = toneKey ?? (scrollTone ? spiedTone : undefined)

  useEffect(() => {
    if (!context || !pageActive) return undefined

    context.set({ tone: effectiveTone })
    return undefined
  }, [context, pageActive, effectiveTone])

  useEffect(() => {
    if (!context || !pageActive) return undefined

    return context.clear
  }, [context, pageActive])

  if (context) {
    return (
      <div ref={contentRef} className="page-background-proxy">
        {children}
      </div>
    )
  }

  return (
    <BackgroundLayer tone={effectiveTone}>
      <div ref={contentRef} className="page-background-proxy">
        {children}
      </div>
    </BackgroundLayer>
  )
}
