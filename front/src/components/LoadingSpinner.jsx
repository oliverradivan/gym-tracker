import './loadingSpinner.css'

function LoadingSpinner({ size = 48, label = 'Loading...', showLabel = false }) {
  return (
    <div className="loading-spinner-wrap">
      <img
        src="/loading.webp"
        alt={label}
        className="loading-spinner-img"
        style={{ width: size, height: size }}
      />
      {showLabel && <span className="loading-spinner-label">{label}</span>}
    </div>
  )
}

export default LoadingSpinner