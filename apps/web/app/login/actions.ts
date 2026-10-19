"use server"

import { signIn, signUp, deleteSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export type AuthState = { error: string | null }

export async function loginAction(
  _prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const result = await signIn(email, password);

  if (result.success) {
    redirect("/dashboard");
  }

  return { error: result.error || "Invalid credentials" };
}

export async function signupAction(
  _prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!name || !email || !password) {
    return { error: "All fields are required" };
  }

  const result = await signUp(name, email, password);

  if (result.success) {
    redirect("/dashboard");
  }

  return { error: result.error || "Failed to create account" };
}

export async function signoutAction() {
  await deleteSession();
  redirect("/login");
}
