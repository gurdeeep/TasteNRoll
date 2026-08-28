#!/usr/bin/env node
// Verifies that the environment and the database are ready for the customer
// ordering side. Run it after applying the SQL migration:
//
//   npm run check-setup
//
// Reports what is missing rather than failing on the first problem, so one run
// tells you everything left to do.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envPath = process.argv[2] || ".env.local";

const env = {};
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
} catch {
  console.error(`Could not read ${envPath}`);
  process.exit(1);
}

let problems = 0;
const ok = (label, note = "") => console.log(`  OK      ${label}${note ? "  " + note : ""}`);
const bad = (label, note) => {
  problems++;
  console.log(`  MISSING ${label}${note ? "  -> " + note : ""}`);
};

console.log("\nEnvironment\n");

const required = [
  ["NEXT_PUBLIC_SUPABASE_URL", "Supabase project URL"],
  ["SUPABASE_SERVICE_ROLE_KEY", "server-side database access"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "browser realtime connection"],
  ["JWT_SECRET", "signs every session token"],
  ["OWNER_PASSWORD_HASH", "npm run gen-secret -- \"your password\""],
];
for (const [key, why] of required) {
  if (env[key]) ok(key);
  else bad(key, why);
}

const optional = [
  ["NEXT_PUBLIC_UPI_VPA", "customers cannot pay online without your UPI ID"],
  ["SUPABASE_JWT_SECRET", "without it the owner board polls instead of live updates"],
];
for (const [key, why] of optional) {
  if (env[key]) ok(key);
  else console.log(`  WARN    ${key}  -> ${why}`);
}

if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
  bad("JWT_SECRET length", "must be at least 32 characters");
}
if (env.OWNER_PASSWORD_HASH && !env.OWNER_PASSWORD_HASH.startsWith("scrypt:")) {
  bad("OWNER_PASSWORD_HASH format", "regenerate with npm run gen-secret");
}

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("\nSkipping database checks: Supabase credentials are incomplete.\n");
  process.exit(problems ? 1 : 0);
}

console.log("\nDatabase\n");

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// A missing table and a missing column both come back as an error from
// PostgREST, so select a named column: `head: true` on a missing table can
// return no error at all, which is what made an earlier version of this script
// report tables that were not there.
async function probe(table, column) {
  const { error } = await sb.from(table).select(column).limit(1);
  return error ? error.message : null;
}

for (const [table, column] of [
  ["customers", "phone"],
  ["auth_throttle", "key"],
]) {
  const err = await probe(table, column);
  if (err) bad(`table ${table}`, err);
  else ok(`table ${table}`);
}

const newColumns = [
  "customer_id",
  "table_number",
  "payment_status",
  "upi_txn_ref",
  "paid_at",
  "customer_note",
  "seen_by_owner",
];
for (const col of newColumns) {
  const err = await probe("orders", col);
  if (err) bad(`orders.${col}`);
  else ok(`orders.${col}`);
}

// These already existed on the live schema and are reused rather than added.
for (const col of ["source", "order_type", "transaction_id", "order_status"]) {
  const err = await probe("orders", col);
  if (err) bad(`orders.${col}`, "expected to already exist");
  else ok(`orders.${col}`, "(pre-existing)");
}

console.log("");
if (problems) {
  console.log(
    `${problems} thing(s) still to do. For the database ones, paste\n` +
      "supabase/migrations/001_auth_and_online_orders.sql into the Supabase\n" +
      "SQL editor and run it.\n"
  );
  process.exit(1);
}
console.log("Everything is in place.\n");
