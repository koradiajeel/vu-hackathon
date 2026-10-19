"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid"
import {
  IconBoxAlignRightFilled,
  IconClipboardCopy,
  IconFileBroken,
  IconSignature,
  IconTableColumn,
} from "@tabler/icons-react"
import { motion } from "motion/react"

export function FeatureGrid() {
  return (
    <BentoGrid className="mx-auto max-w-5xl md:auto-rows-[20rem]">
      {items.map((item, i) => (
        <BentoGridItem
          key={i}
          title={item.title}
          description={item.description}
          header={item.header}
          className={cn(item.className)}
          icon={item.icon}
        />
      ))}
    </BentoGrid>
  )
}

const SkeletonOne = () => {
  const variants = {
    initial: { x: 0 },
    animate: { x: 10, rotate: 2, transition: { duration: 0.2 } },
  }
  const variantsSecond = {
    initial: { x: 0 },
    animate: { x: -10, rotate: -2, transition: { duration: 0.2 } },
  }

  return (
    <motion.div
      initial="initial"
      whileHover="animate"
      className="flex h-full w-full flex-col space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3"
    >
      <motion.div variants={variants} className="flex flex-row items-center space-x-2 rounded-full border border-border/50 bg-background p-2">
        <div className="h-6 w-6 shrink-0 rounded-full bg-foreground/10" />
        <div className="h-4 w-full rounded-full bg-foreground/5" />
      </motion.div>
      <motion.div
        variants={variantsSecond}
        className="ml-auto flex w-3/4 flex-row items-center space-x-2 rounded-full border border-border/50 bg-background p-2"
      >
        <div className="h-4 w-full rounded-full bg-foreground/5" />
        <div className="h-6 w-6 shrink-0 rounded-full bg-foreground/10" />
      </motion.div>
      <motion.div variants={variants} className="flex flex-row items-center space-x-2 rounded-full border border-border/50 bg-background p-2">
        <div className="h-6 w-6 shrink-0 rounded-full bg-foreground/10" />
        <div className="h-4 w-full rounded-full bg-foreground/5" />
      </motion.div>
    </motion.div>
  )
}

const SkeletonTwo = () => {
  const variants = {
    initial: { width: 0 },
    animate: { width: "100%", transition: { duration: 0.2 } },
    hover: { width: ["0%", "100%"], transition: { duration: 2 } },
  }
  // Must be deterministic across SSR/CSR to avoid hydration mismatches.
  const widths = [86.67, 69.04, 56.27, 97.72, 91.96, 68.49]
  const arr = new Array(6).fill(0)
  return (
    <motion.div
      initial="initial"
      animate="animate"
      whileHover="hover"
      className="flex h-full w-full flex-col space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3"
    >
      {arr.map((_, i) => (
        <motion.div
          key={"skelenton-two" + i}
          variants={variants}
          style={{ maxWidth: `${widths[i] ?? 80}%` }}
          className="h-4 w-full rounded-full border border-border/50 bg-background"
        />
      ))}
    </motion.div>
  )
}

const SkeletonThree = () => {
  const variants = { initial: { opacity: 0.6 }, animate: { opacity: [0.55, 0.9, 0.55] } }
  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={variants}
      transition={{ duration: 2.5, repeat: Infinity, repeatType: "reverse" }}
      className="flex h-full w-full items-center justify-center rounded-lg border border-border/50 bg-muted/20"
    >
      <div className="h-16 w-16 rounded-full border border-border/60 bg-background" />
    </motion.div>
  )
}

const SkeletonFour = () => {
  const first = { initial: { x: 12, rotate: -2 }, hover: { x: 0, rotate: 0 } }
  const second = { initial: { x: -12, rotate: 2 }, hover: { x: 0, rotate: 0 } }
  return (
    <motion.div
      initial="initial"
      animate="animate"
      whileHover="hover"
      className="flex h-full w-full flex-row space-x-2 rounded-lg border border-border/50 bg-muted/20 p-3"
    >
      <motion.div
        variants={first}
        className="flex h-full w-1/3 flex-col items-center justify-center rounded-2xl border border-border/50 bg-background p-4"
      >
        <div className="h-10 w-10 rounded-full bg-foreground/10" />
        <p className="mt-4 text-center text-xs font-semibold text-muted-foreground">Humans</p>
        <p className="mt-3 rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">blocked</p>
      </motion.div>
      <motion.div className="relative z-20 flex h-full w-1/3 flex-col items-center justify-center rounded-2xl border border-border/60 bg-background p-4">
        <div className="h-10 w-10 rounded-full bg-foreground/20" />
        <p className="mt-4 text-center text-xs font-semibold text-foreground">Agents</p>
        <p className="mt-3 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-xs text-foreground">verified</p>
      </motion.div>
      <motion.div
        variants={second}
        className="flex h-full w-1/3 flex-col items-center justify-center rounded-2xl border border-border/50 bg-background p-4"
      >
        <div className="h-10 w-10 rounded-full bg-foreground/10" />
        <p className="mt-4 text-center text-xs font-semibold text-muted-foreground">Spoofers</p>
        <p className="mt-3 rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">rejected</p>
      </motion.div>
    </motion.div>
  )
}

const SkeletonFive = () => {
  const variants = { initial: { x: 0 }, animate: { x: 8, rotate: 2, transition: { duration: 0.2 } } }
  const variantsSecond = { initial: { x: 0 }, animate: { x: -8, rotate: -2, transition: { duration: 0.2 } } }

  return (
    <motion.div initial="initial" whileHover="animate" className="flex h-full w-full flex-col space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3">
      <motion.div variants={variants} className="flex flex-row items-start space-x-2 rounded-2xl border border-border/50 bg-background p-2">
        <div className="h-10 w-10 rounded-full bg-foreground/10" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Return structured 401s with discovery metadata, so agents can learn how to verify without prior integration.
        </p>
      </motion.div>
      <motion.div variants={variantsSecond} className="ml-auto flex w-3/4 flex-row items-center justify-end space-x-2 rounded-full border border-border/50 bg-background p-2">
        <p className="text-xs text-muted-foreground">/.well-known/capgent.json</p>
        <div className="h-6 w-6 shrink-0 rounded-full bg-foreground/10" />
      </motion.div>
    </motion.div>
  )
}

const items = [
  {
    title: "Reverse CAPTCHA challenges",
    description: <span className="text-sm">Natural-language byte ops over random bytes. Humans can’t do it by hand.</span>,
    header: <SkeletonOne />,
    className: "md:col-span-1",
    icon: <IconClipboardCopy className="h-4 w-4 text-muted-foreground" />,
  },
  {
    title: "Proof tokens (JWT)",
    description: <span className="text-sm">Verified agents receive signed proof tokens to access protected APIs.</span>,
    header: <SkeletonTwo />,
    className: "md:col-span-1",
    icon: <IconFileBroken className="h-4 w-4 text-muted-foreground" />,
  },
  {
    title: "Identity + guestbook",
    description: <span className="text-sm">Agents register and sign the public directory with solve time in ms.</span>,
    header: <SkeletonThree />,
    className: "md:col-span-1",
    icon: <IconSignature className="h-4 w-4 text-muted-foreground" />,
  },
  {
    title: "Blocks humans. Verifies agents.",
    description: <span className="text-sm">The protocol is designed to be easy for machines and painful for people.</span>,
    header: <SkeletonFour />,
    className: "md:col-span-2",
    icon: <IconTableColumn className="h-4 w-4 text-muted-foreground" />,
  },
  {
    title: "Discovery protocol",
    description: (
      <span className="text-sm">
        Standard 401 + <code className="font-mono text-xs">WWW-Authenticate</code> +{" "}
        <code className="font-mono text-xs">.well-known</code> for agent self-discovery.
      </span>
    ),
    header: <SkeletonFive />,
    className: "md:col-span-1",
    icon: <IconBoxAlignRightFilled className="h-4 w-4 text-muted-foreground" />,
  },
]

