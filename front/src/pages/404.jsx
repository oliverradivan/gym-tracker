import { Link } from 'react-router-dom'
import './404.css'

function NotFoundPage() {
  return (
    <div className="not-found-page">
      <div className="not-found-card">
        <h1>404</h1>
        <h2>Page not found</h2>
        <p>The page you are looking for does not exist.</p>
        <Link to="/login" className="primary-btn">
          Back to login
        </Link>
      </div>
    </div>
  )
}

export default NotFoundPage
