import { NextResponse } from "next/server";
import { createServerClient } from "../../../../lib/supabase";
import { verifyPassword, hashPassword } from "../../../../lib/password";
import { normalisePhone } from "../../../../lib/phone";
import { signSession } from "../../../../lib/jwt";
import { setSessionCookie } from "../../../../lib/auth";
import { checkThrottle, recordFailure, clearThrottle, clientIp } from "../../../../lib/throttle";

const PER_ACCOUNT_LIMIT = 5; // wrong passwords for one phone number
const PER_IP_LIMIT = 20; // wrong passwords from one address, any number

// A hash of a throwaway string. When the phone number does not exist we still
// run a full scrypt verification against this, so "no such account" and "wrong
// password" take the same time and cannot be told apart with a stopwatch.
let decoyHashPromise = null;
const decoyHash = () => (decoyHashPromise ??= hashPassword("decoy-not-a-real-password"));

export async function POST(req) {
  try {
    const { phone, password } = await req.json();
    const cleanPhone = normalisePhone(phone);

    const ipKey = `login-ip:${clientIp(req)}`;
    const accountKey = `login-phone:${cleanPhone}`;

    for (const [key, limit] of [[ipKey, PER_IP_LIMIT], [accountKey, PER_ACCOUNT_LIMIT]]) {
      const throttle = await checkThrottle(key, limit);
      if (!throttle.allowed) {
        const mins = Math.ceil(throttle.retryAfterSeconds / 60);
        return NextResponse.json(
          { error: `Too many failed attempts. Try again in ${mins} minute(s).` },
          { status: 429, headers: { "Retry-After": String(throttle.retryAfterSeconds) } }
        );
      }
    }

    const supabase = createServerClient();
    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, phone, password_hash, token_version")
      .eq("phone", cleanPhone)
      .maybeSingle();

    let ok = false;
    if (customer) {
      ok = await verifyPassword(password, customer.password_hash);
    } else {
      await verifyPassword(password, await decoyHash()); // burn the same time
    }

    if (!ok) {
      await Promise.all([
        recordFailure(ipKey, PER_IP_LIMIT),
        cleanPhone ? recordFailure(accountKey, PER_ACCOUNT_LIMIT) : Promise.resolve(),
      ]);
      // One message for both failure modes: never confirm whether a number is
      // registered to someone who does not already know the password.
      return NextResponse.json(
        { error: "Incorrect mobile number or password" },
        { status: 401 }
      );
    }

    await clearThrottle(accountKey);
    await supabase
      .from("customers")
      .update({ last_login_at: new Date().toISOString(), failed_attempts: 0 })
      .eq("id", customer.id);

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
    console.error("Customer login error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
