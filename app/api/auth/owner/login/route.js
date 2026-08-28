import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { verifyPassword, hashPassword } from "../../../../lib/password";
import { signSession } from "../../../../lib/jwt";
import { setSessionCookie } from "../../../../lib/auth";
import { checkThrottle, recordFailure, clearThrottle, clientIp } from "../../../../lib/throttle";

// The owner account is the keys to the till, so it is throttled harder than a
// customer account and there is no self-service reset. Rotate the password by
// regenerating OWNER_PASSWORD_HASH with: npm run gen-secret -- "new password"
const OWNER_LIMIT = 5;

let decoyHashPromise = null;
const decoyHash = () => (decoyHashPromise ??= hashPassword("decoy-not-a-real-password"));

function constantTimeEquals(a, b) {
  const bufA = Buffer.from(String(a ?? ""));
  const bufB = Buffer.from(String(b ?? ""));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(req) {
  try {
    const { username, password } = await req.json();
    const key = `login-owner:${clientIp(req)}`;

    const throttle = await checkThrottle(key, OWNER_LIMIT);
    if (!throttle.allowed) {
      const mins = Math.ceil(throttle.retryAfterSeconds / 60);
      return NextResponse.json(
        { error: `Too many failed attempts. Locked for ${mins} minute(s).` },
        { status: 429, headers: { "Retry-After": String(throttle.retryAfterSeconds) } }
      );
    }

    const expectedUser = process.env.OWNER_USERNAME || "owner";
    const storedHash = process.env.OWNER_PASSWORD_HASH;

    if (!storedHash) {
      console.error("OWNER_PASSWORD_HASH is not set - owner login is disabled.");
      return NextResponse.json(
        { error: "Owner login is not configured on this server." },
        { status: 503 }
      );
    }

    const userOk = constantTimeEquals(
      String(username ?? "").trim().toLowerCase(),
      expectedUser.toLowerCase()
    );

    // Verify a password either way, so a wrong username does not come back
    // noticeably faster than a wrong password.
    const passOk = await verifyPassword(password, userOk ? storedHash : await decoyHash());

    if (!userOk || !passOk) {
      await recordFailure(key, OWNER_LIMIT);
      return NextResponse.json({ error: "Incorrect username or password" }, { status: 401 });
    }

    await clearThrottle(key);

    const token = await signSession({ sub: expectedUser, name: "Owner" }, "owner");
    await setSessionCookie(token, "owner");

    return NextResponse.json({ success: true, owner: { username: expectedUser } });
  } catch (err) {
    console.error("Owner login error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
