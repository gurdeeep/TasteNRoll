#!/usr/bin/env node
// Helper for first-time setup and for rotating the owner's password.
//
//   node scripts/gen-secret.mjs              -> a fresh JWT_SECRET
//   node scripts/gen-secret.mjs <password>   -> OWNER_PASSWORD_HASH for that password
//
// Paste the output into .env.local (local) and into the Vercel project's
// Environment Variables (production).

import { randomBytes } from "node:crypto";
import { hashPassword } from "../app/lib/password.js";

const [, , ...args] = process.argv;
const password = args.find((a) => !a.startsWith("-"));

if (!password) {
  console.log("\nJWT_SECRET=" + randomBytes(48).toString("base64url"));
  console.log("\nPaste that into .env.local. Keep it secret; changing it signs");
  console.log("everyone out.\n");
  console.log("To hash the owner password instead:");
  console.log("  node scripts/gen-secret.mjs 'your owner password'\n");
} else {
  const hash = await hashPassword(password);
  console.log("\nOWNER_PASSWORD_HASH=" + hash);
  console.log("\nPaste that into .env.local. The plaintext password is never");
  console.log("stored anywhere — only this hash.\n");
}
