import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import './BottomNav.css'

const navLinkClass = ({ isActive }) => `bottom-nav-link${isActive ? ' active' : ''}`

function BottomNav() {
  const location = useLocation()
  const navRef = useRef(null)
  const linkRefs = useRef({})
  const [indicator, setIndicator] = useState({ left: 0, width: 0, visible: false })

  useEffect(() => {
    const measure = () => {
      const activeKey = Object.keys(linkRefs.current).find((path) =>
        path === '/dashboard' ? location.pathname === '/dashboard' : location.pathname.startsWith(path)
      )
      const node = activeKey ? linkRefs.current[activeKey] : null
      const navNode = navRef.current

      if (node && navNode) {
        const nodeRect = node.getBoundingClientRect()
        const navRect = navNode.getBoundingClientRect()

        setIndicator({
          left: nodeRect.left - navRect.left,
          width: nodeRect.width,
          visible: true,
        })
      } else {
        setIndicator((prev) => ({ ...prev, visible: false }))
      }
    }

    const frame = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
    }
  }, [location.pathname])

  return (
    <nav className="bottom-nav" ref={navRef}>
      <span
        className="bottom-nav-indicator"
        style={{
          transform: `translateX(${indicator.left}px)`,
          width: `${indicator.width}px`,
          opacity: indicator.visible ? 1 : 0,
        }}
      />

      <NavLink to="/dashboard" ref={(el) => (linkRefs.current['/dashboard'] = el)} className={navLinkClass} end>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 11.5 12 4l8 7.5" />
          <path d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9" />
        </svg>
        <span>Dashboard</span>
      </NavLink>

      <NavLink to="/history" ref={(el) => (linkRefs.current['/history'] = el)} className={navLinkClass}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </svg>
        <span>History</span>
      </NavLink>

      <div className="bottom-nav-center">
        <NavLink to="/logworkout" className="bottom-nav-center-btn" aria-label="Log workout">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </NavLink>
      </div>

      <NavLink to="/progress" ref={(el) => (linkRefs.current['/progress'] = el)} className={navLinkClass}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 16 9 10 13 13 20 6" />
          <polyline points="15 6 20 6 20 11" />
        </svg>
        <span>Progress</span>
      </NavLink>

      <NavLink to="/settings" ref={(el) => (linkRefs.current['/settings'] = el)} className={navLinkClass}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <circle cx="9" cy="6" r="2" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <circle cx="15" cy="12" r="2" />
          <line x1="4" y1="18" x2="20" y2="18" />
          <circle cx="9" cy="18" r="2" />
        </svg>
        <span>Settings</span>
      </NavLink>
    </nav>
  )
}

export default BottomNav