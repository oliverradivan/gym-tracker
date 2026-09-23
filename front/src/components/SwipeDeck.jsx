import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import DashboardPage from '../pages/dashboard'
import HistoryPage from '../pages/history'
import LogWorkoutPage from '../pages/logworkout'
import ProgressPage from '../pages/progress'
import SettingsPage from '../pages/settings'
import './SwipeDeck.css'

const PAGES = [
  '/dashboard',
  '/history',
  '/logworkout',
  '/progress',
  '/settings',
]

// How far you have to drag before it counts as a deliberate page change.
const PASS_RATIO = 0.4 // 40% of the viewport width
// A short, fast flick still counts, but it has to be a real flick now.
const FLICK_MIN_VELOCITY = 0.55 // px/ms
const FLICK_MIN_DISTANCE_RATIO = 0.15 // 15% of viewport width

// Edges shouldn't swipe into empty space - just a small rubber-band give.
const EDGE_RESISTANCE = 0.3
const MAX_EDGE_OVERSCROLL_PX = 48

function getIndexFromPath(pathname) {
  if (pathname.startsWith('/history')) return 1
  if (pathname.startsWith('/logworkout')) return 2
  if (pathname.startsWith('/progress')) return 3
  if (pathname.startsWith('/settings')) return 4
  return 0
}

// Dampens and caps movement once you're dragging past the first or last page.
function applyEdgeResistance(deltaX, atStart, atEnd) {
  const overscrollingStart = atStart && deltaX > 0
  const overscrollingEnd = atEnd && deltaX < 0
  if (!overscrollingStart && !overscrollingEnd) return deltaX

  const damped = deltaX * EDGE_RESISTANCE
  const clampedMagnitude = Math.min(Math.abs(damped), MAX_EDGE_OVERSCROLL_PX)
  return Math.sign(deltaX) * clampedMagnitude
}

function SwipeDeck() {
  const location = useLocation()
  const navigate = useNavigate()

  const activeIndex = getIndexFromPath(location.pathname)
  const activeIndexRef = useRef(activeIndex)

  useEffect(() => {
    activeIndexRef.current = activeIndex
  }, [activeIndex])

  const containerRef = useRef(null)

  const drag = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    axis: null,
    deltaX: 0,
    dispatched: false,
  })

  const [dragPercent, setDragPercent] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const goToIndex = (index) => {
    const currentIndex = activeIndexRef.current
    const clamped = Math.max(0, Math.min(PAGES.length - 1, index))

    if (clamped !== currentIndex) {
      navigate(PAGES[clamped])
    }
  }

  // -------------------------
  // Touch Swipe
  // -------------------------
  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const handleTouchStart = (e) => {
      const touch = e.touches[0]

      drag.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        axis: null,
        deltaX: 0,
        dispatched: false,
      }
    }

    const handleTouchMove = (e) => {
      const touch = e.touches[0]
      const containerWidth = node.clientWidth || window.innerWidth

      const rawDeltaX = touch.clientX - drag.current.startX
      const deltaY = touch.clientY - drag.current.startY

      if (drag.current.axis === null) {
        if (Math.abs(rawDeltaX) < 8 && Math.abs(deltaY) < 8) return
        drag.current.axis = Math.abs(rawDeltaX) > Math.abs(deltaY) ? 'x' : 'y'
      }

      if (drag.current.axis !== 'x') return

      if (e.cancelable) e.preventDefault()

      const currentIndex = activeIndexRef.current
      const deltaX = applyEdgeResistance(
        rawDeltaX,
        currentIndex === 0,
        currentIndex === PAGES.length - 1
      )

      drag.current.deltaX = deltaX

      const totalTrackWidth = containerWidth * PAGES.length
      const percentOffset = (deltaX / totalTrackWidth) * 100

      setIsDragging(true)
      setDragPercent(percentOffset)
    }

    const handleTouchEnd = () => {
      if (drag.current.axis === 'x' && !drag.current.dispatched) {
        const containerWidth = node.clientWidth || window.innerWidth
        const deltaX = drag.current.deltaX
        const duration = Math.max(1, Date.now() - drag.current.startTime)
        const velocity = Math.abs(deltaX) / duration

        const currentIndex = activeIndexRef.current

        const passedThreshold = Math.abs(deltaX) > containerWidth * PASS_RATIO
        const isConfidentFlick =
          velocity > FLICK_MIN_VELOCITY &&
          Math.abs(deltaX) > containerWidth * FLICK_MIN_DISTANCE_RATIO

        if (passedThreshold || isConfidentFlick) {
          if (deltaX < 0) {
            drag.current.dispatched = true
            goToIndex(currentIndex + 1)
          } else if (deltaX > 0) {
            drag.current.dispatched = true
            goToIndex(currentIndex - 1)
          }
        }
      }

      drag.current = {
        startX: 0,
        startY: 0,
        startTime: 0,
        axis: null,
        deltaX: 0,
        dispatched: false,
      }

      setDragPercent(0)
      setIsDragging(false)
    }

    node.addEventListener('touchstart', handleTouchStart, { passive: true })
    node.addEventListener('touchmove', handleTouchMove, { passive: false })
    node.addEventListener('touchend', handleTouchEnd)

    return () => {
      node.removeEventListener('touchstart', handleTouchStart)
      node.removeEventListener('touchmove', handleTouchMove)
      node.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  // -------------------------
  // Mac Trackpad Fast Live Swipe
  // -------------------------
  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    let accumulatedDeltaX = 0
    let wheelTimer = null

    const handleWheel = (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.2) return

      e.preventDefault()

      const containerWidth = node.clientWidth || window.innerWidth
      const currentIndex = activeIndexRef.current

      // Keep the raw accumulator undamped so repeated events keep adding up
      // correctly; only the *visual* and *decision* deltas get resisted.
      const rawAccumulated = accumulatedDeltaX + e.deltaX
      const visualDeltaX = applyEdgeResistance(
        -rawAccumulated,
        currentIndex === 0,
        currentIndex === PAGES.length - 1
      )
      accumulatedDeltaX = rawAccumulated

      const totalTrackWidth = containerWidth * PAGES.length
      const percentOffset = (visualDeltaX / totalTrackWidth) * 100

      setIsDragging(true)
      setDragPercent(percentOffset)

      if (wheelTimer) clearTimeout(wheelTimer)

      wheelTimer = setTimeout(() => {
        const currentIndex = activeIndexRef.current
        const deltaX = applyEdgeResistance(
          -accumulatedDeltaX,
          currentIndex === 0,
          currentIndex === PAGES.length - 1
        )

        const passedThreshold = Math.abs(deltaX) > containerWidth * PASS_RATIO
        const isFlick = Math.abs(deltaX) > containerWidth * FLICK_MIN_DISTANCE_RATIO

        if (passedThreshold || isFlick) {
          if (deltaX < 0) {
            goToIndex(currentIndex + 1)
          } else if (deltaX > 0) {
            goToIndex(currentIndex - 1)
          }
        }

        accumulatedDeltaX = 0
        setDragPercent(0)
        setIsDragging(false)
      }, 40)
    }

    node.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      node.removeEventListener('wheel', handleWheel)
      if (wheelTimer) clearTimeout(wheelTimer)
    }
  }, [])

  const baseTranslatePercent = -(activeIndex * 20)
  const finalTranslate = baseTranslatePercent + dragPercent

  return (
    <div className="swipe-deck" ref={containerRef}>
      <div
        className={`swipe-deck-track${isDragging ? ' dragging' : ''}`}
        style={{
          transform: `translate3d(${finalTranslate}%, 0, 0)`,
        }}
      >
        <div className="swipe-deck-page"><DashboardPage /></div>
        <div className="swipe-deck-page"><HistoryPage /></div>
        <div className="swipe-deck-page"><LogWorkoutPage /></div>
        <div className="swipe-deck-page"><ProgressPage /></div>
        <div className="swipe-deck-page"><SettingsPage /></div>
      </div>
    </div>
  )
}

export default SwipeDeck