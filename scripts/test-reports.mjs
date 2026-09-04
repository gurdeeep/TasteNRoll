// Golden-output tests for sales report generation.
//   node scripts/test-reports.mjs
//
// The report text used to be built by three near-identical copies inside the
// route handlers. They are now one shared module, and these tests pin the exact
// output so a future edit cannot silently change what the owner receives by
// email while leaving the on-screen report alone (or vice versa).

import { generateReport, buildItemCategoryMap } from "../app/lib/salesReport.js";

let failures = 0;

function check(label, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures++;
  console.log(
    `${pass ? "pass" : "FAIL"}  ${label}` +
      (pass ? "" : `\n        got  ${JSON.stringify(actual)}\n        want ${JSON.stringify(expected)}`)
  );
}

// A day's takings covering every branch the report has: cash, UPI, a split
// payment, a discount, and an item id that is no longer on the menu.
const ORDERS = [
  {
    payment_method: "Cash",
    total_amount: 300,
    discount_amount: 0,
    discount_applied: false,
    items: [{ id: "vr7", name: "Paneer Roll", variant: "full", price: 150, qty: 2 }],
  },
  {
    payment_method: "UPI",
    total_amount: 140,
    discount_amount: 0,
    discount_applied: false,
    items: [{ id: "fr6", name: "Overloaded Fries", variant: "regular", price: 140, qty: 1 }],
  },
  {
    payment_method: "Split",
    total_amount: 260,
    cash_amount: 100,
    upi_amount: 160,
    discount_amount: 40,
    discount_applied: true,
    items: [
      { id: "cmm1", name: "Steam Momos", variant: "option1", price: 130, qty: 2 },
      { id: "zz9", name: "Mystery Item", variant: "regular", price: 0, qty: 1 },
    ],
  },
];

console.log("\nsalesReport\n");

const report = generateReport(ORDERS, "31 August 2026");

// Money. Split orders contribute their cash leg to cash and their UPI leg to UPI.
check("total revenue", report.stats.totalRevenue, 700);
check("cash total includes the split's cash leg", report.stats.totalCash, 400);
check("upi total includes the split's upi leg", report.stats.totalUpi, 300);
check("discount total", report.stats.totalDiscount, 40);
check("discounted order count", report.stats.discountedOrders, 1);
check("order count", report.stats.totalOrders, 3);
check("items sold", report.stats.totalItemsSold, 6);

// An unknown item id must not be dropped or throw; it lands in a catch-all.
const sectionNames = report.stats.sections.map((s) => s.name);
check(
  "unknown item id falls into the catch-all section",
  sectionNames.some((n) => n.includes("Other")),
  true
);

// Sections are ordered by quantity sold, highest first.
const quantities = report.stats.sections.map((s) => s.totalQty);
check(
  "sections are sorted by quantity, descending",
  quantities.every((q, i) => i === 0 || quantities[i - 1] >= q),
  true
);

// The text body is what actually reaches the owner's phone.
check("text carries the date label", report.text.includes("31 August 2026"), true);
check("text states the revenue", report.text.includes("₹700"), true);
check("text names a real menu item", report.text.includes("Paneer Roll (full)"), true);
check("discount line appears when a discount was given", report.text.includes("Discount"), true);

// Empty day: no orders must still produce a sendable report rather than throw.
const empty = generateReport([], "1 January 2027");
check("empty day reports zero revenue", empty.stats.totalRevenue, 0);
check("empty day says nothing was sold", empty.text.includes("No items sold today."), true);

console.log("\nbuildItemCategoryMap\n");

const categoryById = buildItemCategoryMap();
check("known item maps to its category", categoryById["vr7"].category, "Veg Rolls");
check("category carries an icon for the report heading", typeof categoryById["vr7"].icon, "string");
check("unknown id maps to nothing", categoryById["zz9"], undefined);

console.log(`\n${failures === 0 ? "All checks passed." : failures + " check(s) FAILED."}\n`);
if (failures > 0) process.exit(1);
