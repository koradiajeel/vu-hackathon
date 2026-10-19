import { NextRequest, NextResponse } from "next/server";
import { verifyEmailVerificationToken } from "@/lib/email-verification";
import { createSession, verifySession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  // If the user already has a session, they don't necessarily need to verify again
  // (unless they are switching accounts), but for better UX, we'll send them to dashboard.
  const session = await verifySession();

  if (!token) {
    return NextResponse.redirect(new URL(session ? "/dashboard" : "/login?verify=missing", request.url));
  }

  try {
    const result = await verifyEmailVerificationToken(token);
    
    // If the token is invalid or expired
    if (!result.ok || !result.userId) {
      console.error("❌ [Verify] Token verification failed or user not found for token.");
      // If already verified (result might be ok:false), check if we should just go to dashboard
      return NextResponse.redirect(new URL(session ? "/dashboard" : "/login?verify=invalid", request.url));
    }

    // Verified: immediately create session and send user to the dashboard.
    await createSession(result.userId);
    console.log(`✅ [Verify] User ${result.userId} verified via Route Handler. Redirecting to dashboard.`);
    
    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error("❌ [Verify] Unexpected error during verification:", error);
    return NextResponse.redirect(new URL("/login?verify=error", request.url));
  }
}
