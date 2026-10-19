"use client"

import { useCallback } from "react"
import { Moon, Sun } from "@phosphor-icons/react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

interface AnimatedThemeTogglerProps extends React.ComponentPropsWithoutRef<"button"> {
  duration?: number
}

export const AnimatedThemeToggler = ({
  className,
  ...props
}: AnimatedThemeTogglerProps) => {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const toggleTheme = useCallback(() => {
    setTheme(isDark ? "light" : "dark")
  }, [isDark, setTheme])

  return (
    <button type="button" onClick={toggleTheme} className={cn(className)} {...props}>
      {/* Render both icons to avoid SSR/CSR hydration mismatches. */}
      <Sun className="h-4 w-4 hidden dark:block" />
      <Moon className="h-4 w-4 block dark:hidden" />
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}

