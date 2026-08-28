import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

// scrypt from Node's own crypto rather than bcrypt/argon2: no native module to
// compile, nothing extra to install, and it is a memory-hard KDF that OWASP
// lists as an acceptable choice. These are the OWASP-recommended parameters.
const N = 16384; // CPU/memory cost
const R = 8; // block size
const P = 1; // parallelisation
const KEYLEN = 64;
const SALT_BYTES = 16;

// Stored as  scrypt:N:r:p:<salt-base64url>:<hash-base64url>  so the cost
// parameters travel with the hash and can be raised later without invalidating
// existing passwords.
//
// Colons and base64url rather than the conventional "$" and plain base64: the
// owner hash lives in .env.local, and Next.js runs env values through
// dotenv-expand, which would treat "$16384" as a variable reference and eat it.
export async function hashPassword(plain) {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(normalise(plain), salt, KEYLEN, { N, r: R, p: P });
  return `scrypt:${N}:${R}:${P}:${salt.toString("base64url")}:${derived.toString("base64url")}`;
}

export async function verifyPassword(plain, stored) {
  if (typeof stored !== "string") return false;
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, "base64url");
  const expected = Buffer.from(hashB64, "base64url");

  let derived;
  try {
    derived = await scrypt(normalise(plain), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
  } catch {
    return false;
  }

  // Constant-time compare so the response time never leaks how much of the
  // hash matched.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

// Unicode-normalise so the same typed password always derives the same key,
// and cap the length so nobody can burn CPU by posting a 10 MB "password".
function normalise(plain) {
  return String(plain ?? "").normalize("NFKC").slice(0, 256);
}

// Rules are deliberately modest — this is a cafe, not a bank — but they rule
// out the passwords that actually get guessed.
export function validatePassword(plain) {
  const pw = String(plain ?? "");
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (pw.length > 128) return "Password must be under 128 characters";
  if (!/[a-zA-Z]/.test(pw)) return "Password must contain a letter";
  if (!/[0-9]/.test(pw)) return "Password must contain a number";
  if (/^(.)\1+$/.test(pw)) return "Password is too simple";
  return null;
}
