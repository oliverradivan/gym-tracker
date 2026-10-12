const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

const FRAG = `
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_speed;
uniform float u_intensity;
uniform float u_warp;
uniform float u_spread;
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

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 1.92 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = u_time * u_speed;

  vec2 st = p - vec2(aspect * 0.5, 0.8);

  float n1 = fbm(st * 0.88 + vec2(t * 0.09, -t * 0.06));
  float n2 = fbm(st * 1.05 + vec2(-t * 0.07, t * 0.08) + 5.1);
  vec2 warp = vec2(n1, n2) * u_warp;
  float n = fbm(st * 0.7 + warp * 0.85 + t * 0.035);

  vec3 col = mix(u_c0, u_c1, smoothstep(0.18, 0.72, n));
  col = mix(col, u_c2, smoothstep(0.28, 0.88, n2));
  col = mix(col, u_c3, smoothstep(0.35, 0.8, n1) * 0.55);

  vec2 a = st * vec2(1.05, 1.55);
  vec2 b = (st + vec2(0.28 * aspect, -0.06)) * vec2(1.35, 1.9);
  vec2 c = (st + vec2(-0.24 * aspect, -0.1)) * vec2(1.4, 2.05);
  float field =
    exp(-dot(a, a) * u_spread) +
    exp(-dot(b, b) * (u_spread + 0.55)) * 0.75 +
    exp(-dot(c, c) * (u_spread + 0.7)) * 0.6;

  float height = smoothstep(0.04, 0.62, uv.y);
  float breathe = 0.9 + 0.1 * sin(t * 0.65 + n * 2.0);

  float alpha = field * height * u_intensity * breathe * (0.5 + 0.5 * n);
  alpha = clamp(alpha, 0.0, 1.0);

  col *= mix(0.95, 1.18, u_dark);

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

function readPalette(root, toneKey) {
  const styles = getComputedStyle(root)
  const push = cssColorToRgb(styles.getPropertyValue("--aurora-push"))
  const pull = cssColorToRgb(styles.getPropertyValue("--aurora-pull"))
  const leg = cssColorToRgb(styles.getPropertyValue("--aurora-leg"))
  const cardio = cssColorToRgb(styles.getPropertyValue("--aurora-cardio"))
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

function lerp(a, b, t) {
  return a + (b - a) * t
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
  let start = performance.now()
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
    const scale = 0.48
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
    const speed = reduced.matches ? 0 : active ? 0.95 : 0.32
    const intensity = (dark ? 0.78 : 0.48) * (active ? 1.32 : 1)
    const warp = active ? 1.05 : 0.62
    const spread = active ? 1.35 : 1.85
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
