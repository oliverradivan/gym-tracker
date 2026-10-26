import { Link } from 'react-router-dom'
import './404.css'
import PageBackground from '../components/PageBackground'
import LiquidGlassDefs from '../components/LiquidGlassDefs'

function NotFoundPage() {
  return (
    <PageBackground>
      <LiquidGlassDefs />
      <div className="not-found-page">
        {/* Sits behind the glass so the card has something to bend */}
        <span className="not-found-ghost" aria-hidden="true">
          404
        </span>

        <div className="not-found-card">
          <h1>Page not found</h1>
          <p>The page you are looking for does not exist.</p>
          <Link to="/login" className="primary-btn">
            Turn Back
          </Link>
        </div>
      </div>
    </PageBackground>
  )
}

export default NotFoundPage