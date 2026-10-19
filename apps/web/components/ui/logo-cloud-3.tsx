"use client"

import React from "react"
import { InfiniteSlider } from "@/components/ui/infinite-slider"
import { cn } from "@/lib/utils"

type Logo = {
  alt: string
  src?: string
  svg?: React.ReactNode
  width?: number
  height?: number
}

type LogoCloudProps = React.ComponentProps<"div"> & {
  logos: Logo[]
  duration?: number
  durationOnHover?: number
  reverse?: boolean
  gap?: number
}

export function LogoCloud({
  className,
  logos,
  duration = 70,
  durationOnHover = 28,
  reverse = false,
  gap = 56,
  ...props
}: LogoCloudProps) {
  return (
    <div
      {...props}
      className={cn(
        "overflow-hidden py-6 [mask-image:linear-gradient(to_right,transparent,black,transparent)]",
        className,
      )}
    >
      <InfiniteSlider gap={gap} reverse={reverse} duration={duration} durationOnHover={durationOnHover}>
        {logos.map((logo) => (
          <div
            key={`logo-${logo.alt}`}
            aria-label={logo.alt}
            className={cn(
              "pointer-events-none select-none transition-colors",
              "text-foreground/70 dark:text-foreground/80",
            )}
            title={logo.alt}
          >
            {logo.svg ? (
              <div className="flex flex-col items-center gap-2">
                <div className="h-7 md:h-8 lg:h-9 [&_svg]:h-full [&_svg]:w-auto [&_svg]:block [&_svg]:fill-current">
                  {logo.svg}
                </div>
                <div className="text-center text-[11px] font-medium tracking-tight text-muted-foreground">
                  {logo.alt}
                </div>
              </div>
            ) : logo.src ? (
              <div className="flex flex-col items-center gap-2">
                <img
                  alt={logo.alt}
                  loading="lazy"
                  src={logo.src}
                  width={logo.width || "auto"}
                  height={logo.height || "auto"}
                  className="h-7 md:h-8 lg:h-9"
                />
                <div className="text-center text-[11px] font-medium tracking-tight text-muted-foreground">
                  {logo.alt}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </InfiniteSlider>
    </div>
  )
}

