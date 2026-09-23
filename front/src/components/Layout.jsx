import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'
import './Layout.css'

function Layout() {
  return (
    <div className="app-shell">
      <Outlet />
      <BottomNav />
    </div>
  )
}

export default Layout