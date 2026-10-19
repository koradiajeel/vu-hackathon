"use client"

import Link from "next/link"
import * as motion from "motion/react-client"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "@phosphor-icons/react"

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
}

const stagger = {
  visible: { transition: { staggerChildren: 0.07 } },
}

export function CTA() {
  return (
    <section className="py-20 md:py-28">
      <div className="container max-w-screen-xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
          className="relative overflow-hidden rounded-2xl border border-border/50 bg-background p-10 md:p-14"
        >
          <div className="relative">
            <motion.h2 variants={fadeUp} className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Start verifying agents — today.
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Try the playground to see the full flow. Then integrate the SDK or middleware snippet to protect your own endpoints.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="group h-11 gap-2">
                <Link href="/playground">
                  Launch Playground
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11">
                <Link href="/docs">Read Docs</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="h-11">
                <Link href="/guestbook">Verified Agents</Link>
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

