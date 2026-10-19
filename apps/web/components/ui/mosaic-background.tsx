"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface MosaicBackgroundProps {
  className?: string
}

// Seeded PRNG — deterministic output for consistent renders
function createRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

const CELL_SIZE = 18
const JITTER = 6
const SEED = 42

export function MosaicBackground({ className = "" }: MosaicBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mounted, setMounted] = useState(false)
  const [isDarkClass, setIsDarkClass] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const update = () => {
      setIsDarkClass(document.documentElement.classList.contains("dark"))
    }
    update()

    const observer = new MutationObserver(() => update())
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

  // Decorative background: prevent SSR/CSR mismatch when theme resolves.
  // On the server + initial client render, we force a stable color scheme.
  const effectiveIsDark = mounted ? isDarkClass : false
  const radialFg = effectiveIsDark ? "255,255,255" : "0,0,0"
  const radialAlpha = effectiveIsDark ? 0.015 : 0.010

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const parent = canvas.parentElement
    if (!parent) return

    const fg = effectiveIsDark ? [255, 255, 255] : [0, 0, 0]

    const dpr = window.devicePixelRatio || 1
    const w = parent.clientWidth
    const h = parent.clientHeight

    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Reset transform so repeated renders don't accumulate scaling
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)

    const rand = createRng(SEED)

    // Step 1: Generate jittered point grid
    const cols = Math.ceil(w / CELL_SIZE) + 1
    const rows = Math.ceil(h / CELL_SIZE) + 1

    const points: [number, number][][] = []
    for (let r = 0; r <= rows; r++) {
      points[r] = []
      for (let c = 0; c <= cols; c++) {
        let px = c * CELL_SIZE
        let py = r * CELL_SIZE

        // Jitter interior points for organic feel
        if (r > 0 && r < rows && c > 0 && c < cols) {
          px += (rand() - 0.5) * 2 * JITTER
          py += (rand() - 0.5) * 2 * JITTER
        }

        points[r][c] = [px, py]
      }
    }

    ctx.clearRect(0, 0, w, h)

    // Step 2: Draw triangulated mosaic
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const p00 = points[r][c]
        const p10 = points[r][c + 1]
        const p01 = points[r + 1][c]
        const p11 = points[r + 1][c + 1]

        // Alternate diagonal direction per cell for variety
        const alt = (r + c) % 2 === 0
        const tris: [number, number][][] = alt
          ? [
              [p00, p10, p01],
              [p10, p11, p01],
            ]
          : [
              [p00, p10, p11],
              [p00, p11, p01],
            ]

        for (const tri of tris) {
          const fillOpacity = 0.008 + rand() * 0.01 // 0.008-0.018
          const strokeOpacity = 0.025 + rand() * 0.015 // 0.025-0.040

          ctx.beginPath()
          ctx.moveTo(tri[0][0], tri[0][1])
          ctx.lineTo(tri[1][0], tri[1][1])
          ctx.lineTo(tri[2][0], tri[2][1])
          ctx.closePath()

          ctx.fillStyle = `rgba(${fg[0]},${fg[1]},${fg[2]},${fillOpacity.toFixed(4)})`
          ctx.fill()

          ctx.strokeStyle = `rgba(${fg[0]},${fg[1]},${fg[2]},${strokeOpacity.toFixed(3)})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      }
    }
  }, [effectiveIsDark])

  useEffect(() => {
    render()

    let timeout: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(timeout)
      timeout = setTimeout(render, 200)
    }

    window.addEventListener("resize", handleResize)
    return () => {
      clearTimeout(timeout)
      window.removeEventListener("resize", handleResize)
    }
  }, [render])

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Subtle radial gradient for depth (no text/logo rendering) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            `radial-gradient(ellipse 60% 50% at 50% 40%, rgba(${radialFg},${radialAlpha}), transparent)`,
        }}
      />
    </div>
  )
}

