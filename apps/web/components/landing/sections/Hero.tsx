"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import * as motion from "motion/react-client"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "@phosphor-icons/react"
import { useState } from "react"
import { CanvasText } from "@/components/ui/canvas-text"
import { CapgentVisualization } from "@/components/landing/sections/CapgentVisualization"
import { LandingLogoCloud } from "@/components/landing/sections/LogoCloud"

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
}

const stagger = {
  visible: { transition: { staggerChildren: 0.07 } },
}

const TypeScriptLogo = () => (
  <svg
    viewBox="0 0 256 256"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    preserveAspectRatio="xMidYMid"
    fill="#000000"
    aria-hidden="true"
  >
    <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
    <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
    <g id="SVGRepo_iconCarrier">
      <g>
        <polygon
          fill="#007ACC"
          transform="translate(128.000000, 128.000000) scale(1, -1) translate(-128.000000, -128.000000) "
          points="0 128 0 0 128 0 256 0 256 128 256 256 128 256 0 256"
        ></polygon>
        <path
          d="M146.658132,223.436863 L146.739401,212.953054 L130.079084,212.953054 L113.418767,212.953054 L113.418767,165.613371 L113.418767,118.273689 L101.63464,118.273689 L89.8505126,118.273689 L89.8505126,165.613371 L89.8505126,212.953054 L73.1901951,212.953054 L56.5298776,212.953054 L56.5298776,223.233689 C56.5298776,228.922577 56.6517824,233.676863 56.8143221,233.798768 C56.9362269,233.961308 77.2130522,234.042577 101.797179,234.001943 L146.536227,233.880038 L146.658132,223.436863 Z"
          fill="#FFFFFF"
          transform="translate(101.634640, 176.142993) rotate(-180.000000) translate(-101.634640, -176.142993) "
        ></path>
        <path
          d="M206.566631,234.272145 C213.068219,232.646748 218.025679,229.761668 222.57679,225.048018 C224.933616,222.528653 228.428219,217.936907 228.712663,216.839764 C228.793933,216.514684 217.659965,209.037859 210.914568,204.852462 C210.670758,204.689922 209.69552,205.74643 208.598377,207.371827 C205.306949,212.166748 201.852981,214.239129 196.570441,214.604843 C188.809171,215.133097 183.811076,211.069605 183.851711,204.283573 C183.851711,202.292462 184.136155,201.114049 184.948854,199.488653 C186.65552,195.953414 189.825044,193.840399 199.7806,189.533097 C218.106949,181.649922 225.949489,176.448653 230.825679,169.053097 C236.270758,160.804208 237.489806,147.638494 233.792028,137.845478 C229.728536,127.199129 219.651076,119.966113 205.469489,117.568653 C201.080917,116.796589 190.678377,116.918494 185.964727,117.771827 C175.684092,119.600399 165.931711,124.679764 159.917743,131.343891 C157.560917,133.944526 152.969171,140.730557 153.253616,141.218176 C153.37552,141.380716 154.432028,142.030875 155.610441,142.721668 C156.748219,143.371827 161.05552,145.850557 165.119012,148.207383 L172.473933,152.474049 L174.01806,150.198494 C176.171711,146.907065 180.885362,142.396589 183.729806,140.893097 C191.897425,136.585795 203.112663,137.195319 208.639012,142.15278 C210.995838,144.30643 211.971076,146.541351 211.971076,149.83278 C211.971076,152.799129 211.605362,154.099446 210.061235,156.334367 C208.070123,159.178811 204.006631,161.576272 192.466314,166.574367 C179.259965,172.263256 173.571076,175.798494 168.369806,181.406113 C165.362822,184.656907 162.518377,189.858176 161.339965,194.206113 C160.364727,197.822621 160.120917,206.884208 160.892981,210.541351 C163.61552,223.300716 173.245996,232.199764 187.143139,234.841034 C191.653616,235.694367 202.137425,235.369287 206.566631,234.272145 Z"
          fill="#FFFFFF"
          transform="translate(194.578507, 176.190240) scale(1, -1) translate(-194.578507, -176.190240) "
        ></path>
      </g>
    </g>
  </svg>
)

export function Hero() {
  const [copied, setCopied] = useState(false)

  const cmd = "npm install capgent-sdk"

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(cmd)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // ignore
    }
  }

  return (
    <section className="relative overflow-hidden border-b border-border/40">
      <div className="container relative z-10 max-w-screen-xl py-14 md:py-20 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left — text */}
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-xl">
            <motion.div variants={fadeUp}>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/40 px-4 py-1.5 text-sm text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground/40 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-foreground/70" />
                </span>
                AI for Cybersecurity &amp; Digital Safety
              </div>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className={cn(
                "font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl",
                "text-foreground",
              )}
            >
              Stop AI agents from being{" "}
              <CanvasText
                text="hijacked"
                backgroundClassName="bg-violet-600 dark:bg-violet-700"
                colors={[
                  "rgba(236, 72, 153, 1)",
                  "rgba(236, 72, 153, 0.9)",
                  "rgba(236, 72, 153, 0.8)",
                  "rgba(236, 72, 153, 0.7)",
                  "rgba(236, 72, 153, 0.6)",
                  "rgba(236, 72, 153, 0.5)",
                  "rgba(236, 72, 153, 0.4)",
                  "rgba(236, 72, 153, 0.3)",
                  "rgba(236, 72, 153, 0.2)",
                  "rgba(236, 72, 153, 0.1)",
                ]}
                lineGap={4}
                animationDuration={20}
              />
            </motion.h1>

            <motion.p variants={fadeUp} className="mt-6 text-lg leading-relaxed text-muted-foreground">
              AI agents need a <span className="font-semibold text-l1">passport</span>, an{" "}
              <span className="font-semibold text-l2">immune system</span> and a{" "}
              <span className="font-semibold text-l3">security badge</span> that only opens the doors they need. AgentWarden provides all
              three.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="group h-11 gap-2 px-6">
                <Link href="/demo">
                  Watch the live attack
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-11 px-6"
              >
                <Link href="/shield">Try the Shield</Link>
              </Button>
            </motion.div>


            <motion.div
              variants={fadeUp}
              className="mt-6 rounded-xl border border-border/60 bg-card/70 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/50 bg-background">
                    <div className="h-7 w-7">
                      <TypeScriptLogo />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Install for TypeScript
                    </div>
                    <code className="mt-1 block truncate font-mono text-[12px] text-foreground">
                      {cmd}
                    </code>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onCopy}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-border/50 bg-background/60 px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </motion.div>
          </motion.div>

          {/* Right — visualization */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="hidden lg:block"
          >
            <CapgentVisualization />
          </motion.div>
        </div>

        <LandingLogoCloud />
      </div>
    </section>
  )
}

