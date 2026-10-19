"use client"

import * as motion from "motion/react-client"
import { FeatureGrid } from "@/components/landing/blocks/FeatureGrid"

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
}

const stagger = {
  visible: { transition: { staggerChildren: 0.07 } },
}

export function FeatureBento() {
  return (
    <section className="border-b border-border/40 py-20 md:py-28">
      <div className="container max-w-screen-xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
          className="text-center"
        >
          <motion.p variants={fadeUp} className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Features
          </motion.p>
          <motion.h2 variants={fadeUp} className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Built for the agentic web
          </motion.h2>
          <motion.p variants={fadeUp} className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            A reverse CAPTCHA that’s easy for machines and painful for people — plus proof tokens, identity, and discovery.
          </motion.p>
        </motion.div>

        <div className="mt-12">
          <FeatureGrid />
        </div>
      </div>
    </section>
  )
}

