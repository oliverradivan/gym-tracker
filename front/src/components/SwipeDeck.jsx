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

function getIndexFromPath(pathname) {
  if (pathname.startsWith('/history')) return 1
  if (pathname.startsWith('/logworkout')) return 2
  if (pathname.startsWith('/progress')) return 3
  if (pathname.startsWith('/settings')) return 4
  return 0
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

      const deltaX = touch.clientX - drag.current.startX
      const deltaY = touch.clientY - drag.current.startY

      if (drag.current.axis === null) {
        if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return
        drag.current.axis = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y'
      }

      if (drag.current.axis !== 'x') return

      if (e.cancelable) e.preventDefault()

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
        const duration = Date.now() - drag.current.startTime
        const velocity = Math.abs(deltaX) / duration

        const currentIndex = activeIndexRef.current

        const passedHalfPage = Math.abs(deltaX) > containerWidth * 0.5
        const isQuickFlick = velocity > 0.35 && Math.abs(deltaX) > 25

        if (passedHalfPage || isQuickFlick) {
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
      accumulatedDeltaX += e.deltaX

      const totalTrackWidth = containerWidth * PAGES.length
      const percentOffset = (-accumulatedDeltaX / totalTrackWidth) * 100

      setIsDragging(true)
      setDragPercent(percentOffset)

      if (wheelTimer) clearTimeout(wheelTimer)

      // Fast 40ms timeout fires immediately after fingers lift
      wheelTimer = setTimeout(() => {
        const currentIndex = activeIndexRef.current
        const deltaX = -accumulatedDeltaX

        const passedHalfPage = Math.abs(deltaX) > containerWidth * 0.5
        const isFlick = Math.abs(deltaX) > 50

        if (passedHalfPage || isFlick) {
          if (deltaX < 0) {
            goToIndex(currentIndex + 1)
          } else if (deltaX > 0) {
            goToIndex(currentIndex - 1)
          }
        }

        accumulatedDeltaX = 0
        setDragPercent(0)
        setIsDragging(false)
      }, 20)
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