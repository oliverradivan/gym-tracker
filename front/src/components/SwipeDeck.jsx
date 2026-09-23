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

  // Stores drag offset as a percentage of TOTAL TRACK WIDTH (0% to 100%)
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
  // Touch swipe
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

      // Axis Lock Detection
      if (drag.current.axis === null) {
        if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return
        drag.current.axis = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y'
      }

      if (drag.current.axis !== 'x') return

      // Prevent scrolling page vertically while horizontal swipe is active
      if (e.cancelable) e.preventDefault()

      drag.current.deltaX = deltaX

      // Convert pixel drag distance to track percentage
      // Total track width = containerWidth * 5 pages
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
        const velocity = Math.abs(deltaX) / duration // px / ms

        const currentIndex = activeIndexRef.current

        // 50% screen drag threshold OR quick intentional flick (>0.4 px/ms)
        const passedHalfPage = Math.abs(deltaX) > containerWidth * 0.5
        const isQuickFlick = velocity > 0.4 && Math.abs(deltaX) > 30

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

      // Re-enable smooth transition snapping
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
  // Mac trackpad swipe
  // -------------------------
  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    let accumulatedX = 0
    let cooldown = false
    let timeoutId = null

    const handleWheel = (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.2) return

      e.preventDefault()
      if (cooldown) return

      accumulatedX += e.deltaX

      if (Math.abs(accumulatedX) >= 180) {
        const currentIndex = activeIndexRef.current

        if (accumulatedX > 0) {
          goToIndex(currentIndex + 1)
        } else {
          goToIndex(currentIndex - 1)
        }

        accumulatedX = 0
        cooldown = true
        timeoutId = setTimeout(() => {
          cooldown = false
        }, 500)
      }
    }

    node.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      node.removeEventListener('wheel', handleWheel)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  // -------------------------
  // Position Calculation
  // -------------------------
  // Each page takes up 20% of the total 500% track width
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