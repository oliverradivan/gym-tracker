import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import './AuroraBackground.css'
import { startAuroraField } from './auroraField'
import { AuroraContext, AuroraPageActive } from '../context/AuroraContext'

const CATEGORY_ATTR = 'data-aurora-category'

/* ------------------------------------------------------------------ */
/* The actual background layer (canvas + CSS fallback)                 */
/* ------------------------------------------------------------------ */

function AuroraLayer({
  children,
  active = false,
  tone,
  off = false,
  shell = false,
}) {
  const toneKey = tone ? String(tone).toLowerCase() : undefined
  const rootRef = useRef(null)
  const canvasRef = useRef(null)

  const paramsRef = useRef({
    active,
    toneKey,
    off,
    dark: false,
  })

  // Keep the animation's parameters synchronized after React commits.
  useEffect(() => {
    paramsRef.current.active = active
    paramsRef.current.toneKey = toneKey
    paramsRef.current.off = off
  }, [active, toneKey, off])

  // Initialize the canvas animation once.
  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current

    if (!root || !canvas) return undefined

    const readDark = () =>
      document.documentElement.classList.contains('dark')

    paramsRef.current.dark = readDark()

    const stop = startAuroraField(
      canvas,
      root,
      () => paramsRef.current
    )

    const observer = new MutationObserver(() => {
      paramsRef.current.dark = readDark()
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => {
      observer.disconnect()
      stop()
    }
  }, [])

  const classes = [
    'aurora',
    active ? 'aurora--active' : '',
    off ? 'aurora--off' : '',
    shell ? 'aurora--shell' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={rootRef}
      className={classes}
      data-tone={toneKey}
    >
      <canvas
        ref={canvasRef}
        className="aurora__canvas"
        aria-hidden="true"
      />

      {/* CSS fallback (no WebGL): a single drifting blob */}
      <div className="aurora__glow" aria-hidden="true">
        <div className="aurora__blobs">
          <span className="aurora__blob" />
        </div>
      </div>

      <div className="aurora__content">{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Shell: mounted once inside SwipeDeck, behind all pages               */
/* ------------------------------------------------------------------ */

export function AuroraShell({ children }) {
  // null means no page currently wants the aurora.
  const [state, setState] = useState(null)

  const value = useMemo(
    () => ({
      set: setState,
      clear: () => setState(null),
    }),
    []
  )

  return (
    <AuroraContext.Provider value={value}>
      <AuroraLayer
        shell
        off={!state}
        active={Boolean(state?.active)}
        tone={state?.tone}
      >
        {children}
      </AuroraLayer>
    </AuroraContext.Provider>
  )
}

/* ------------------------------------------------------------------ */
/* Scroll spy: which category is most on screen right now?              */
/* ------------------------------------------------------------------ */

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

      // Add up how much screen area each category is taking up.
      container.querySelectorAll(`[${CATEGORY_ATTR}]`).forEach((el) => {
        const rect = el.getBoundingClientRect()
        const visibleH = Math.min(rect.bottom, viewH) - Math.max(rect.top, 0)
        const visibleW = Math.min(rect.right, viewW) - Math.max(rect.left, 0)
        if (visibleH <= 0 || visibleW <= 0) return

        const key = String(el.getAttribute(CATEGORY_ATTR)).toLowerCase()
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

      if (!best) return // nothing on screen: keep the current colour

      // Only switch when the new category clearly wins (10% more area),
      // so the colour doesn't flicker when two are about equal.
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

    // capture: true catches scrolling inside any scrollable element,
    // not just the window.
    document.addEventListener('scroll', schedule, { capture: true, passive: true })
    window.addEventListener('resize', schedule, { passive: true })

    // Exercises loading in / filtering also change what's on screen.
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

/* ------------------------------------------------------------------ */
/* Page API: <AuroraBackground tone active scrollTone>                  */
/* ------------------------------------------------------------------ */

export default function AuroraBackground({
  children,
  active = false,
  tone,
  scrollTone = false,
}) {
  const ctx = useContext(AuroraContext)
  const pageActive = useContext(AuroraPageActive)
  const contentRef = useRef(null)

  const toneKey = tone ? String(tone).toLowerCase() : undefined

  // Inside the swipe deck, only the visible page should be listening.
  const spyEnabled = scrollTone && (ctx ? Boolean(pageActive) : true)
  const spiedTone = useScrollTone(contentRef, spyEnabled)

  // An explicit `tone` wins; otherwise use the scrolled-to category (if any).
  const effectiveTone = toneKey ?? (scrollTone ? spiedTone : undefined)

  useEffect(() => {
    if (!ctx || !pageActive) return undefined

    ctx.set({ tone: effectiveTone, active })
    return undefined
  }, [ctx, pageActive, effectiveTone, active])

  // Clear only when this page stops being the active one (or unmounts).
  useEffect(() => {
    if (!ctx || !pageActive) return undefined

    return ctx.clear
  }, [ctx, pageActive])

  if (ctx) {
    return (
      <div ref={contentRef} className="aurora-proxy">
        {children}
      </div>
    )
  }

  return (
    <AuroraLayer active={active} tone={effectiveTone}>
      <div ref={contentRef} className="aurora-proxy">
        {children}
      </div>
    </AuroraLayer>
  )
}