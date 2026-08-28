import { NextResponse } from "next/server";
import { clearSessionCookie } from "../../../lib/auth";

// POST, not GET: a logout a stray image tag could trigger is a nuisance.
export async function POST(req) {
  const { role } = await req.json().catch(() => ({}));
  if (role === "owner" || role === "customer") {
    await clearSessionCookie(role);
  } else {
    await clearSessionCookie("owner");
    await clearSessionCookie("customer");
  }
  return NextResponse.json({ success: true });
}
