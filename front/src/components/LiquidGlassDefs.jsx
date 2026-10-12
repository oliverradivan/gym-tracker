import { useEffect } from 'react'
import './liquidGlass.css'

/*
 * Displacement maps for the glass refraction.
 *
 * Red channel  = horizontal push, green channel = vertical push.
 * 128 (mid grey) means "no push"; the values ramp away from it near the
 * edges, so only the rim of the glass bends the background, like a lens.
 * `edge` is how far in from each side the bend reaches (in %).
 */
function buildMap(edge) {
  const near = edge
  const far = 100 - edge
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">
<defs>
<linearGradient id="x" x1="0" y1="0" x2="1" y2="0">
<stop offset="0%" stop-color="rgb(255,0,0)"/>
<stop offset="${near}%" stop-color="rgb(128,0,0)"/>
<stop offset="${far}%" stop-color="rgb(128,0,0)"/>
<stop offset="100%" stop-color="rgb(0,0,0)"/>
</linearGradient>
<linearGradient id="y" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="rgb(0,255,0)"/>
<stop offset="${near}%" stop-color="rgb(0,128,0)"/>
<stop offset="${far}%" stop-color="rgb(0,128,0)"/>
<stop offset="100%" stop-color="rgb(0,0,0)"/>
</linearGradient>
</defs>
<rect width="100" height="100" fill="rgb(0,0,0)"/>
<rect width="100" height="100" fill="url(#x)"/>
<rect width="100" height="100" fill="url(#y)" style="mix-blend-mode:screen"/>
</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// Big surfaces need a thin bend band, small ones (buttons) need a wide one.
const PANEL_MAP = buildMap(5)
const CONTROL_MAP = buildMap(24)

/*
 * Mount once per page. It renders the (invisible) SVG filters and turns on
 * the real refraction only in Chromium browsers. Safari and Firefox cannot
 * use SVG filters inside `backdrop-filter`, so there they get the blurred,
 * highlighted glass without the bending.
 */
function LiquidGlassDefs() {
  useEffect(() => {
    const ua = navigator.userAgent
    const isChromium = /Chrome\//.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
    const reduceTransparency = window.matchMedia(
      '(prefers-reduced-transparency: reduce)'
    ).matches

    if (isChromium && !reduceTransparency) {
      document.documentElement.setAttribute('data-lg-refract', 'true')
    }
  }, [])

  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
      style={{ position: 'absolute', pointerEvents: 'none' }}
    >
      <defs>
        <filter
          id="lg-refract-panel"
          x="0"
          y="0"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feImage href={PANEL_MAP} preserveAspectRatio="none" result="map" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale="64"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        <filter
          id="lg-refract-control"
          x="0"
          y="0"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feImage href={CONTROL_MAP} preserveAspectRatio="none" result="map" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale="34"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  )
}

export default LiquidGlassDefs