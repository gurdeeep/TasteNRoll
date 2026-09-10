import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { requireOwner } from "../../../lib/auth";

function passwordsMatch(received, expected) {
  const receivedBuffer = Buffer.from(String(received ?? ""));
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function POST(req) {
  try {
    const { error } = await requireOwner();
    if (error) return error;

    const { password } = await req.json();
    const expected = process.env.DASHBOARD_PASSWORD;

    if (!expected) {
      console.error("DASHBOARD_PASSWORD is not set - dashboard unlock is disabled.");
      return NextResponse.json(
        { success: false, error: "Dashboard password is not configured." },
        { status: 503 }
      );
    }

    if (passwordsMatch(password, expected)) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: "Wrong password" }, { status: 401 });
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }
}
