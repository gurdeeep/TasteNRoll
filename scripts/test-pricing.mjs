#!/usr/bin/env node
// Sanity checks for the server-side re-pricing, which is what stops an online
// customer from choosing their own prices. Run with: node scripts/test-pricing.mjs

import { priceFor, repriceCart } from "../app/lib/pricing.js";
import { buildUpiLink, makeTxnRef, validateUtr } from "../app/lib/upi.js";
import { normalisePhone, validatePhone } from "../app/lib/phone.js";

let failures = 0;
function check(label, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures++;
  console.log(`${pass ? "pass" : "FAIL"}  ${label}${pass ? "" : `\n        got ${JSON.stringify(actual)}\n        want ${JSON.stringify(expected)}`}`);
}

console.log("\npriceFor\n");
check("half/full item, half", priceFor("vr7", "half"), 110);
check("half/full item, full", priceFor("vr7", "full"), 150);
check("single-price category (burger)", priceFor("bg1", "regular"), 60);
// "regular" means item.price on a single-price category but item.regular on a
// three-size one. Both shapes must resolve, or pizzas price as null.
check("triple-size, regular", priceFor("bp1", "regular"), 100);
check("triple-size, medium", priceFor("bp1", "medium"), 220);
check("triple-size, large", priceFor("bp1", "large"), 340);
check("dual-label, option1", priceFor("ng1", "option1"), 150);
check("dual-label, option2", priceFor("ng1", "option2"), 260);

// The 2026 menu reshaped several categories. These pin the new shapes so a
// future menu edit cannot quietly reintroduce a removed item or column.
check("momos row is a flavour, columns are Steam/Kurkure", priceFor("mm2", "option1"), 110);
check("momos kurkure column", priceFor("mm2", "option2"), 140);
check("cheese corn momos was added", priceFor("mm5", "option1"), 130);
check("chinese special is single-price now", priceFor("cs1", "regular"), 150);
check("chinese special no longer sells halves", priceFor("cs1", "half"), null);
check("honey chilli potato was withdrawn", priceFor("cs2", "regular"), null);
check("spring rolls are their own category", priceFor("sr2", "regular"), 180);
check("combo pizza folded into basic pizza", priceFor("cp1", "large"), 430);
check("fried momos was withdrawn", priceFor("mm1", "option3"), null);
check("malai pan fried was withdrawn", priceFor("pfm3", "regular"), null);
check("bare add-on id is not a menu item", priceFor("ao1", "regular"), null);
check("unknown item", priceFor("nope", "full"), null);
check("wrong variant for item", priceFor("vr7", "large"), null);
check("general add-on", priceFor("vr7-ao4", "add-on"), 20);
check("pizza add-on, medium", priceFor("bp1-pao1", "medium"), 40);
check("pizza add-on, wrong variant", priceFor("bp1-pao1", "half"), null);

console.log("\nrepriceCart\n");
check("empty cart rejected", repriceCart([]).error, "Your cart is empty");
check(
  "a doctored price is ignored",
  repriceCart([{ id: "vr7", name: "Paneer Roll", variant: "half", qty: 2, price: 1 }]),
  {
    items: [{ id: "vr7", name: "Paneer Roll", variant: "half", price: 110, qty: 2, key: "vr7-half" }],
    subtotal: 220,
    error: null,
  }
);
check(
  "a doctored name is ignored",
  repriceCart([{ id: "vr7", name: "FREE STUFF", variant: "half", qty: 1 }]).items[0].name,
  "Paneer Roll"
);
check("negative quantity rejected", repriceCart([{ id: "vr7", variant: "half", qty: -3 }]).error, "Invalid quantity in your cart");
check("fractional quantity rejected", repriceCart([{ id: "vr7", variant: "half", qty: 1.5 }]).error, "Invalid quantity in your cart");
check("absurd quantity rejected", repriceCart([{ id: "vr7", variant: "half", qty: 9999 }]).error, "Invalid quantity in your cart");
check(
  "invented item rejected",
  repriceCart([{ id: "free-lunch", variant: "full", qty: 1 }]).error,
  "Your cart contains an item that is no longer available"
);
check(
  "mixed cart totals correctly",
  repriceCart([
    { id: "vr7", variant: "half", qty: 2 },   // 110 x 2 = 220
    { id: "vr7-ao4", name: "Cheese", variant: "add-on", qty: 1 }, // 20
  ]).subtotal,
  240
);

console.log("\nUPI\n");
const link = buildUpiLink({ amount: 240, txnRef: "RB123", note: "Order RB-X", vpa: "cafe@upi", payeeName: "Taste N RoLLs" });
check("link scheme", link.startsWith("upi://pay?"), true);
check("amount has two decimals", link.includes("am=240.00"), true);
check("currency is INR", link.includes("cu=INR"), true);
check("reference carried", link.includes("tr=RB123"), true);
check("no VPA means no link", buildUpiLink({ amount: 10, vpa: "" }), null);
check("txn ref strips punctuation", makeTxnRef("RB-L8X9YZ"), "RBL8X9YZ");
check("blank UTR rejected", typeof validateUtr(""), "string");
check("short UTR rejected", typeof validateUtr("123"), "string");
check("real UTR accepted", validateUtr("412345678901"), null);
check("UTR with spaces trimmed and accepted", validateUtr("  412345678901  "), null);
check("UTR with symbols rejected", typeof validateUtr("4123-4567"), "string");

console.log("\nPhone\n");
check("plus-91 normalised", normalisePhone("+91 98765 43210"), "9876543210");
check("leading zero normalised", normalisePhone("09876543210"), "9876543210");
check("plain number unchanged", normalisePhone("9876543210"), "9876543210");
check("landline-style rejected", typeof validatePhone("1234567890"), "string");
check("too short rejected", typeof validatePhone("98765"), "string");
check("valid accepted", validatePhone("9876543210"), null);

console.log(`\n${failures === 0 ? "All checks passed." : failures + " check(s) FAILED."}\n`);
process.exit(failures ? 1 : 0);
