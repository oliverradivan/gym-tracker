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

      <div className="aurora__glow" aria-hidden="true">
        <div className="aurora__blobs">
          <span className="aurora__blob aurora__blob--push" />
          <span className="aurora__blob aurora__blob--pull" />
          <span className="aurora__blob aurora__blob--leg" />
          <span className="aurora__blob aurora__blob--cardio" />
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
/* Page API: <AuroraBackground tone active>                              */
/* ------------------------------------------------------------------ */

export default function AuroraBackground({
  children,
  active = false,
  tone,
}) {
  const ctx = useContext(AuroraContext)
  const pageActive = useContext(AuroraPageActive)
  const toneKey = tone ? String(tone).toLowerCase() : undefined

  useEffect(() => {
    if (!ctx || !pageActive) return undefined

    ctx.set({ tone: toneKey, active })

    return ctx.clear
  }, [ctx, pageActive, toneKey, active])

  if (ctx) {
    return <div className="aurora-proxy">{children}</div>
  }

  return (
    <AuroraLayer active={active} tone={toneKey}>
      {children}
    </AuroraLayer>
  )
}