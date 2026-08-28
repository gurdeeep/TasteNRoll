// ---------------------------------------------------------------------------
// UPI deep links.
//
// There is no payment gateway in this flow: we hand the customer a standard
// UPI intent URL. Scanning it as a QR, or tapping it on a phone, opens GPay /
// PhonePe / Paytm with the payee and amount already filled in.
//
// The consequence, stated plainly because it drives the whole design: UPI
// intent links have NO callback. Nothing tells this app that money arrived.
// The customer submits the UTR their app shows them, and the owner confirms it
// against their own UPI app before the order counts as paid.
// ---------------------------------------------------------------------------

export const UPI_VPA = process.env.NEXT_PUBLIC_UPI_VPA || "";
export const UPI_PAYEE_NAME =
  process.env.NEXT_PUBLIC_UPI_PAYEE_NAME || "Taste N RoLLs";

// A short reference we generate per order and embed as `tr`. Most UPI apps
// surface it on the payment, which makes reconciling against the bank feed
// much easier than matching on amount alone.
export function makeTxnRef(orderId) {
  return String(orderId).replace(/[^A-Za-z0-9]/g, "").slice(0, 35).toUpperCase();
}

// Builds the upi://pay?... URL. `amount` is rupees; UPI wants two decimals.
export function buildUpiLink({ amount, txnRef, note, vpa, payeeName }) {
  const pa = vpa || UPI_VPA;
  if (!pa) return null;

  const params = new URLSearchParams({
    pa,
    pn: payeeName || UPI_PAYEE_NAME,
    am: Number(amount).toFixed(2),
    cu: "INR",
  });
  if (txnRef) params.set("tr", txnRef);
  if (note) params.set("tn", note.slice(0, 50));

  return `upi://pay?${params.toString()}`;
}

// A UTR / RRN is 12 digits on most rails, but some apps show a longer
// alphanumeric reference. Accept both shapes and reject obvious junk.
export function validateUtr(value) {
  const v = String(value ?? "").trim();
  if (!v) return "Enter the UPI reference number from your payment app";
  if (!/^[A-Za-z0-9]{6,30}$/.test(v)) {
    return "That does not look like a UPI reference number";
  }
  return null;
}
