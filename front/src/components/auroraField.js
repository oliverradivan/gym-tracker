const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

// ONE soft blob that slowly drifts around the whole page.
// Its position, size, stretch and outline all change over time, and its colour
// is passed in from JavaScript (which cycles through the four category colours,
// or holds a single tone when an exercise / scrolled category is chosen).
const FRAG = `
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_intensity;
uniform float u_warp;
uniform float u_spread;
uniform float u_roam;
uniform float u_dark;
uniform vec3 u_color;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  float s = min(u_res.x, u_res.y);
  vec2 p = gl_FragCoord.xy / s;   // units of the shorter side, origin bottom-left
  vec2 size = u_res / s;          // canvas size in those same units
  float t = u_time;

  // ---- where the blob is ----
  // Several slow waves with different speeds added together, so the path
  // wanders around the page instead of repeating a simple loop.
  vec2 wander = vec2(
    sin(t * 0.31) + 0.35 * sin(t * 0.73 + 1.3),
    cos(t * 0.23 + 0.8) + 0.35 * cos(t * 0.59 + 2.1)
  ) / 1.35;
  vec2 c = size * 0.5 + wander * size * 0.5 * u_roam;

  // ---- how big it is ----
  // "breathe" swells and shrinks the blob. Bigger breathe = smaller spread value.
  float breathe = 1.0 + 0.30 * sin(t * 0.41) + 0.15 * sin(t * 0.97 + 2.0);
  float spread = u_spread / (breathe * breathe);

  // ---- its shape ----
  // Two layers of noise push the pixels around, so the edge looks liquid.
  vec2 q = p * 0.9;
  vec2 w1 = vec2(
    noise(q + t * 0.30),
    noise(q + 7.3 - t * 0.25)
  ) - 0.5;
  vec2 w2 = vec2(
    noise(q * 1.5 + w1 * 1.2 + t * 0.35 + 3.1),
    noise(q * 1.5 + w1 * 1.2 - t * 0.30 + 9.7)
  ) - 0.5;
  vec2 d = (p + (w1 * 0.9 + w2 * 0.35) * u_warp) - c;

  // Slowly rotate the blob, and slowly change how stretched it is
  // (long ribbon <-> roundish blob).
  float ang = t * 0.2;
  float ca = cos(ang);
  float sa = sin(ang);
  d = vec2(ca * d.x + sa * d.y, -sa * d.x + ca * d.y);
  d.x *= mix(0.6, 1.0, 0.5 + 0.5 * sin(t * 0.33 + 1.0));
  d.y *= mix(1.0, 0.8, 0.5 + 0.5 * sin(t * 0.27 + 4.0));

  // A gentle ripple along the long side so it snakes a little.
  d.y += sin(d.x * 2.5 + t * 0.8) * 0.06 * u_warp;

  float a = exp(-dot(d, d) * spread);
  float alpha = clamp(a * u_intensity, 0.0, 1.0);

  vec3 col = min(u_color * mix(1.0, 1.12, u_dark), vec3(1.0));

  // tiny dither to avoid banding in the soft falloff
  alpha = clamp(alpha + (hash(gl_FragCoord.xy) - 0.5) / 255.0, 0.0, 1.0);

  gl_FragColor = vec4(col * alpha, alpha);
}
`

function compile(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function cssColorToRgb(value) {
  const raw = String(value || "").trim()
  const hex = raw.match(/^#([0-9a-f]{3,8})$/i)
  if (hex) {
    let h = hex[1]
    if (h.length === 3 || h.length === 4) {
      h = h
        .slice(0, 3)
        .split("")
        .map((c) => c + c)
        .join("")
    } else {
      h = h.slice(0, 6)
    }
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
    ]
  }
  const rgb = raw.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i)
  if (rgb) {
    const scale = Number(rgb[1]) > 1 ? 255 : 1
    return [Number(rgb[1]) / scale, Number(rgb[2]) / scale, Number(rgb[3]) / scale]
  }
  return [0.5, 0.5, 0.5]
}

function mixRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// ---- tweak these to taste ----
// How long the blob spends on each colour before melting into the next one
// (only used when no exercise / category colour is chosen).
const SECONDS_PER_COLOUR = 10
// How fast the colour glides to a new target. Lower = slower, softer change.
const COLOUR_RATE = 2.2
// Overall animation speed. Lower = calmer.
const SPEED_IDLE = 0.5
const SPEED_ACTIVE = 0.7
// Blob size: higher spread = smaller blob, lower = bigger, more coverage.
const SPREAD = 3.2
// How much of the page the blob roams over (1 = edge to edge).
const ROAM = 0.85
// ------------------------------

// The colour the blob should be heading towards right now.
// - With a tone (exercise chosen, or category scrolled into view): that colour.
// - Without one: slowly cycle push -> pull -> leg -> cardio -> push ...
function readTarget(root, toneKey, cycleSeconds) {
  const styles = getComputedStyle(root)

  if (toneKey) {
    return cssColorToRgb(
      styles.getPropertyValue(`--aurora-${toneKey}`) ||
        styles.getPropertyValue("--aurora-other")
    )
  }

  const palette = [
    cssColorToRgb(styles.getPropertyValue("--aurora-push")), // red
    cssColorToRgb(styles.getPropertyValue("--aurora-pull")), // blue
    cssColorToRgb(styles.getPropertyValue("--aurora-leg")), // yellow
    cssColorToRgb(styles.getPropertyValue("--aurora-cardio")), // green
  ]
  const pos = (cycleSeconds / SECONDS_PER_COLOUR) % palette.length
  const i = Math.floor(pos)
  const frac = pos - i
  // hold each colour for a moment, then melt into the next
  return mixRgb(palette[i], palette[(i + 1) % palette.length], smoothstep(0.35, 1, frac))
}

// Shared across mounts: if the component is ever remounted (page change),
// the animation continues from the same moment and the colour doesn't snap back.
const shared = {
  time: 0, // animation time (speeds up / slows down smoothly)
  cycle: 0, // real seconds, drives the idle colour cycle
  speed: null,
  colors: null,
}

export function startAuroraField(canvas, root, getParams) {
  if (!canvas || !root) return () => {}

  let gl = null
  let loc = null
  let colors = shared.colors
  let raf = 0
  let running = false
  let visible = false
  let last = 0
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")

  const initGl = () => {
    if (gl) return true
    gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    })
    if (!gl) return false

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return false

    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    )

    loc = {
      pos: gl.getAttribLocation(program, "a_pos"),
      res: gl.getUniformLocation(program, "u_res"),
      time: gl.getUniformLocation(program, "u_time"),
      intensity: gl.getUniformLocation(program, "u_intensity"),
      warp: gl.getUniformLocation(program, "u_warp"),
      spread: gl.getUniformLocation(program, "u_spread"),
      roam: gl.getUniformLocation(program, "u_roam"),
      dark: gl.getUniformLocation(program, "u_dark"),
      color: gl.getUniformLocation(program, "u_color"),
    }

    gl.useProgram(program)
    gl.enableVertexAttribArray(loc.pos)
    gl.vertexAttribPointer(loc.pos, 2, gl.FLOAT, false, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.clearColor(0, 0, 0, 0)
    return true
  }

  const resize = () => {
    const rect = root.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const scale = 0.5
    const w = Math.max(1, Math.floor(rect.width * dpr * scale))
    const h = Math.max(1, Math.floor(rect.height * dpr * scale))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
  }

  const draw = (now) => {
    if (!initGl()) return

    // Seconds since the last frame (capped so a hidden tab doesn't cause a jump).
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0.016
    last = now

    const params = getParams()
    if (params.off) return

    const active = params.active
    const dark = params.dark ? 1 : 0

    // Ease the speed between idle and active instead of snapping.
    const targetSpeed = reduced.matches ? 0 : active ? SPEED_ACTIVE : SPEED_IDLE
    if (shared.speed === null) shared.speed = targetSpeed
    shared.speed += (targetSpeed - shared.speed) * (1 - Math.exp(-dt * 1.5))
    shared.time += dt * shared.speed
    if (!reduced.matches) shared.cycle += dt

    // Glide the colour towards its target (works the same for the idle
    // colour cycle, a chosen exercise, or a category scrolled into view).
    const target = readTarget(root, params.toneKey, shared.cycle)
    if (!colors) colors = target
    colors = mixRgb(colors, target, 1 - Math.exp(-dt * COLOUR_RATE))
    shared.colors = colors

    const intensity = Math.min((dark ? 0.8 : 0.6) * (active ? 1.15 : 1), 1)
    // higher = more swirly / stretched-out shapes
    const warp = active ? 1.1 : 0.9

    resize()
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform2f(loc.res, canvas.width, canvas.height)
    gl.uniform1f(loc.time, shared.time)
    gl.uniform1f(loc.intensity, intensity)
    gl.uniform1f(loc.warp, warp)
    gl.uniform1f(loc.spread, SPREAD)
    gl.uniform1f(loc.roam, ROAM)
    gl.uniform1f(loc.dark, dark)
    gl.uniform3fv(loc.color, colors)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  const loop = (now) => {
    draw(now)
    if (running && !reduced.matches) raf = requestAnimationFrame(loop)
  }

  const play = () => {
    if (running || !visible) return
    if (!initGl()) return
    running = true
    last = 0
    root.classList.add("aurora--gpu")
    if (reduced.matches) {
      draw(performance.now())
      running = false
      return
    }
    raf = requestAnimationFrame(loop)
  }

  const pause = () => {
    running = false
    cancelAnimationFrame(raf)
  }

  const onVisibility = () => {
    if (document.hidden) pause()
    else if (visible) play()
  }

  let io
  if (typeof IntersectionObserver === "function") {
    io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting && entry.intersectionRatio > 0.12
        if (visible && !document.hidden) play()
        else pause()
      },
      { threshold: [0, 0.12, 0.4] }
    )
    io.observe(root)
  } else {
    visible = true
    play()
  }

  window.addEventListener("resize", resize, { passive: true })
  document.addEventListener("visibilitychange", onVisibility)

  return () => {
    pause()
    io?.disconnect()
    window.removeEventListener("resize", resize)
    document.removeEventListener("visibilitychange", onVisibility)
    root.classList.remove("aurora--gpu")
  }
}