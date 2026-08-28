import { NextResponse } from "next/server";
import { createServerClient } from "../../../../lib/supabase";
import { hashPassword, validatePassword } from "../../../../lib/password";
import { normalisePhone, validatePhone } from "../../../../lib/phone";
import { signSession } from "../../../../lib/jwt";
import { setSessionCookie } from "../../../../lib/auth";
import { checkThrottle, recordFailure, clientIp } from "../../../../lib/throttle";

// Signup is throttled too — otherwise it becomes a free way to enumerate which
// phone numbers already have an account.
const SIGNUP_LIMIT = 10;

export async function POST(req) {
  try {
    const ipKey = `signup-ip:${clientIp(req)}`;
    const throttle = await checkThrottle(ipKey, SIGNUP_LIMIT);
    if (!throttle.allowed) {
      return NextResponse.json(
        { error: "Too many sign-up attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(throttle.retryAfterSeconds) } }
      );
    }

    const { name, phone, password } = await req.json();

    const cleanName = String(name ?? "").trim().slice(0, 60);
    if (cleanName.length < 2) {
      return NextResponse.json({ error: "Enter your name" }, { status: 400 });
    }

    const phoneError = validatePhone(phone);
    if (phoneError) return NextResponse.json({ error: phoneError }, { status: 400 });

    const passwordError = validatePassword(password);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    const cleanPhone = normalisePhone(phone);
    const supabase = createServerClient();

    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (existing) {
      await recordFailure(ipKey, SIGNUP_LIMIT);
      return NextResponse.json(
        { error: "An account already exists for this number. Please sign in." },
        { status: 409 }
      );
    }

    const password_hash = await hashPassword(password);

    const { data: customer, error } = await supabase
      .from("customers")
      .insert({ name: cleanName, phone: cleanPhone, password_hash })
      .select("id, name, phone, token_version")
      .single();

    if (error) {
      // 23505 = unique violation: two signups raced for the same number.
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "An account already exists for this number. Please sign in." },
          { status: 409 }
        );
      }
      console.error("Customer signup error:", error);
      return NextResponse.json({ error: "Could not create your account" }, { status: 500 });
    }

    // Signing up signs you in — no reason to make someone type it all twice.
    const token = await signSession(
      { sub: customer.id, name: customer.name, phone: customer.phone, tv: customer.token_version },
      "customer"
    );
    await setSessionCookie(token, "customer");

    return NextResponse.json({
      success: true,
      customer: { id: customer.id, name: customer.name, phone: customer.phone },
    });
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
