"use client"

import { useActionState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginAction } from "./actions"

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null)

  return (
    <div className="fixed inset-0 z-[60] overflow-auto bg-background">
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-[0.15] dark:opacity-[0.25]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_30%,hsl(var(--foreground)/0.08),transparent_65%)] dark:bg-[radial-gradient(ellipse_60%_50%_at_50%_30%,hsl(var(--foreground)/0.12),transparent_65%)]" />

      <div className="relative mx-auto flex min-h-dvh max-w-screen-sm items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-border/60 bg-card/70 backdrop-blur">
          <CardHeader className="space-y-5">
            <Link href="/" className="mx-auto flex items-center gap-2">
              <span className="relative block h-8 w-8">
                <Image
                  src="/logo_white.png"
                  alt="AgentWarden logo"
                  width={40}
                  height={40}
                  className="absolute inset-0 hidden h-8 w-8 object-contain dark:block"
                  priority
                />
                <Image
                  src="/logo_dark.png"
                  alt="AgentWarden logo"
                  width={40}
                  height={40}
                  className="absolute inset-0 block h-8 w-8 object-contain dark:hidden"
                  priority
                />
              </span>
              <span className="font-heading text-lg font-bold tracking-tight">Agent<span className="text-primary">Warden</span></span>
            </Link>

            <div className="space-y-1 text-center">
              <CardTitle className="text-balance">Sign in</CardTitle>
              <CardDescription className="text-pretty">
                Welcome back. Sign in to continue.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
          <form className="space-y-4" action={formAction}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={isPending}
              />
            </div>
            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <Button
              type="submit"
              className="w-full bg-foreground text-background hover:bg-foreground/90"
              disabled={isPending}
            >
              {isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="underline">Sign up</Link>
          </p>
          </CardContent>
      </Card>
    </div>
    </div>
  )
}
