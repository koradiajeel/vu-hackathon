import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function VerifyEmailSentPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const sp = await searchParams
  const email = sp.email ? String(sp.email) : null

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Check your inbox</CardTitle>
          <CardDescription>
            {email ? `We sent a verification link to ${email}.` : "We sent a verification link to your email."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            If you don&apos;t see it within a few minutes, check your spam folder.
          </div>
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/login"
              className="text-sm font-medium underline underline-offset-4"
            >
              Go to login
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Create another account
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

