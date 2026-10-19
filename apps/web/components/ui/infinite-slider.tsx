"use client"

import { cn } from "@/lib/utils"
import { animate, useMotionValue } from "motion/react"
import * as motion from "motion/react-client"
import { useEffect, useState } from "react"
import useMeasure from "react-use-measure"

type InfiniteSliderProps = {
  children: React.ReactNode
  gap?: number
  duration?: number
  durationOnHover?: number
  direction?: "horizontal" | "vertical"
  reverse?: boolean
  className?: string
}

export function InfiniteSlider({
  children,
  gap = 16,
  duration = 25,
  durationOnHover,
  direction = "horizontal",
  reverse = false,
  className,
}: InfiniteSliderProps) {
  const [currentDuration, setCurrentDuration] = useState(duration)
  const [containerRef, containerBounds] = useMeasure()
  const [contentRef, contentBounds] = useMeasure()
  const translation = useMotionValue(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [key, setKey] = useState(0)

  useEffect(() => {
    let controls: ReturnType<typeof animate> | undefined
    const viewportSize = direction === "horizontal" ? containerBounds.width : containerBounds.height
    const singleSize = direction === "horizontal" ? contentBounds.width : contentBounds.height

    // We animate by exactly one "set" width/height, and render enough copies to
    // ensure there is never empty space in the viewport.
    const step = singleSize + gap
    const from = reverse ? -step : 0
    const to = reverse ? 0 : -step

    if (!viewportSize || !singleSize) return

    if (isTransitioning) {
      controls = animate(translation, [translation.get(), to], {
        ease: "linear",
        duration: currentDuration * Math.abs((translation.get() - to) / step),
        onComplete: () => {
          setIsTransitioning(false)
          setKey((prev) => prev + 1)
        },
      })
    } else {
      controls = animate(translation, [from, to], {
        ease: "linear",
        duration: currentDuration,
        repeat: Infinity,
        repeatType: "loop",
        repeatDelay: 0,
        onRepeat: () => {
          translation.set(from)
        },
      })
    }

    return controls?.stop
  }, [
    key,
    translation,
    currentDuration,
    containerBounds.width,
    containerBounds.height,
    contentBounds.width,
    contentBounds.height,
    gap,
    isTransitioning,
    direction,
    reverse,
  ])

  const hoverProps = durationOnHover
    ? {
        onHoverStart: () => {
          setIsTransitioning(true)
          setCurrentDuration(durationOnHover)
        },
        onHoverEnd: () => {
          setIsTransitioning(true)
          setCurrentDuration(duration)
        },
      }
    : {}

  return (
    <div ref={containerRef} className={cn("overflow-hidden", className)}>
      <motion.div
        className="flex w-max"
        style={{
          ...(direction === "horizontal" ? { x: translation } : { y: translation }),
          gap: `${gap}px`,
          flexDirection: direction === "horizontal" ? "row" : "column",
        }}
        {...hoverProps}
      >
        {/* Measure a single "set" */}
        <div ref={contentRef} className="flex w-max" style={{ gap: `${gap}px` }}>
          {children}
        </div>

        {/* Render enough copies to always cover the viewport */}
        {Array.from({ length: Math.max(2, Math.ceil(((direction === "horizontal" ? containerBounds.width : containerBounds.height) || 0) / ((direction === "horizontal" ? contentBounds.width : contentBounds.height) || 1)) + 2) }).map(
          (_, idx) => (
            <div key={idx} className="flex w-max" style={{ gap: `${gap}px` }}>
              {children}
            </div>
          ),
        )}
      </motion.div>
    </div>
  )
}

