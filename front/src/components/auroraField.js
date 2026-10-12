const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

// Four soft blobs, one per corner. Each one drifts around its own corner and
// keeps its own colour (no big shared noise cloud mixing them together).
//   c0 = top-left     (red,    push)
//   c1 = top-right    (blue,   pull)
//   c2 = bottom-right (yellow, leg)
//   c3 = bottom-left  (green,  cardio)
const FRAG = `
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_speed;
uniform float u_intensity;
uniform float u_warp;
uniform float u_spread;
uniform float u_roam;
uniform float u_dark;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;

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

// One soft blob anchored near a corner.
// "inward" points from the corner toward the middle of the page.
float blob(vec2 p, vec2 corner, vec2 inward, float seed, float t) {
  // wander around the corner
  vec2 orbit = vec2(
    sin(t * 0.9 + seed * 6.1),
    cos(t * 0.7 + seed * 3.7)
  ) * u_roam;

  // sits slightly inside the corner, and breathes in/out a little
  float inset = 0.05 + 0.07 * (0.5 + 0.5 * sin(t * 0.5 + seed * 4.0));
  vec2 c = corner + inward * inset + orbit;

  // gentle warp so the shape is organic, not a perfect circle
  vec2 w = vec2(
    noise(p * 2.2 + seed + t * 0.15),
    noise(p * 2.2 + seed + 7.3 - t * 0.12)
  ) - 0.5;
  vec2 d = (p + w * u_warp * 0.35) - c;
  d.y *= 1.15;

  return exp(-dot(d, d) * u_spread);
}

void main() {
  float s = min(u_res.x, u_res.y);
  vec2 p = gl_FragCoord.xy / s;     // units of the shorter side, origin bottom-left
  vec2 size = u_res / s;            // canvas size in those same units
  float t = u_time * u_speed;

  float a0 = blob(p, vec2(0.0, size.y),    vec2( 1.0, -1.0), 0.13, t);
  float a1 = blob(p, vec2(size.x, size.y), vec2(-1.0, -1.0), 0.47, t);
  float a2 = blob(p, vec2(size.x, 0.0),    vec2(-1.0,  1.0), 0.71, t);
  float a3 = blob(p, vec2(0.0, 0.0),       vec2( 1.0,  1.0), 0.93, t);

  a0 = clamp(a0 * u_intensity, 0.0, 1.0);
  a1 = clamp(a1 * u_intensity, 0.0, 1.0);
  a2 = clamp(a2 * u_intensity, 0.0, 1.0);
  a3 = clamp(a3 * u_intensity, 0.0, 1.0);

  float alpha = 1.0 - (1.0 - a0) * (1.0 - a1) * (1.0 - a2) * (1.0 - a3);

  // Colour = weighted average, so each blob keeps its own colour and only
  // blends where two of them actually overlap.
  float wsum = max(a0 + a1 + a2 + a3, 0.0001);
  vec3 col = (u_c0 * a0 + u_c1 * a1 + u_c2 * a2 + u_c3 * a3) / wsum;
  col *= mix(1.0, 1.12, u_dark);

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

// Order matters: [top-left, top-right, bottom-right, bottom-left]
function readPalette(root, toneKey) {
  const styles = getComputedStyle(root)
  const push = cssColorToRgb(styles.getPropertyValue("--aurora-push"))     // red
  const pull = cssColorToRgb(styles.getPropertyValue("--aurora-pull"))     // blue
  const leg = cssColorToRgb(styles.getPropertyValue("--aurora-leg"))       // yellow
  const cardio = cssColorToRgb(styles.getPropertyValue("--aurora-cardio")) // green
  const white = [1, 1, 1]
  const ink = [0.08, 0.09, 0.1]

  if (!toneKey) return [push, pull, leg, cardio]

  const tone = cssColorToRgb(
    styles.getPropertyValue(`--aurora-${toneKey}`) ||
      styles.getPropertyValue("--aurora-other")
  )
  return [
    tone,
    mixRgb(tone, white, 0.28),
    mixRgb(tone, ink, 0.18),
    mixRgb(tone, mixRgb(pull, push, 0.5), 0.35),
  ]
}

function lerpRgb(a, b, t) {
  return mixRgb(a, b, t)
}

export function startAuroraField(canvas, root, getParams) {
  if (!canvas || !root) return () => {}

  let gl = null
  let loc = null
  let colors = readPalette(root, getParams().toneKey)
  let raf = 0
  let running = false
  let visible = false
  const start = performance.now()
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
      speed: gl.getUniformLocation(program, "u_speed"),
      intensity: gl.getUniformLocation(program, "u_intensity"),
      warp: gl.getUniformLocation(program, "u_warp"),
      spread: gl.getUniformLocation(program, "u_spread"),
      roam: gl.getUniformLocation(program, "u_roam"),
      dark: gl.getUniformLocation(program, "u_dark"),
      c0: gl.getUniformLocation(program, "u_c0"),
      c1: gl.getUniformLocation(program, "u_c1"),
      c2: gl.getUniformLocation(program, "u_c2"),
      c3: gl.getUniformLocation(program, "u_c3"),
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
    const params = getParams()
    const target = readPalette(root, params.toneKey)
    const mix = params.toneKey ? 0.08 : 0.045
    colors = colors.map((c, i) => lerpRgb(c, target[i], mix))

    const active = params.active
    const dark = params.dark ? 1 : 0

    // ---- tweak these to taste ----
    const speed = reduced.matches ? 0 : active ? 1.0 : 0.55
    const intensity = Math.min((dark ? 0.85 : 0.65) * (active ? 1.15 : 1), 1)
    const warp = active ? 1.0 : 0.6
    // higher = smaller blobs (about 9 gives roughly 35% coverage)
    const spread = active ? 7.5 : 9.0
    // how far each colour wanders around its corner
    const roam = active ? 0.18 : 0.14
    // ------------------------------

    const time = (now - start) / 1000

    resize()
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform2f(loc.res, canvas.width, canvas.height)
    gl.uniform1f(loc.time, time)
    gl.uniform1f(loc.speed, speed)
    gl.uniform1f(loc.intensity, intensity)
    gl.uniform1f(loc.warp, warp)
    gl.uniform1f(loc.spread, spread)
    gl.uniform1f(loc.roam, roam)
    gl.uniform1f(loc.dark, dark)
    gl.uniform3fv(loc.c0, colors[0])
    gl.uniform3fv(loc.c1, colors[1])
    gl.uniform3fv(loc.c2, colors[2])
    gl.uniform3fv(loc.c3, colors[3])
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