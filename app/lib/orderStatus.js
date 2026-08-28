// Shared vocabulary for online orders, so the API, the customer pages and the
// owner board can never drift on spelling.

// payment_status — where the money is
export const PAYMENT = {
  PENDING: "pending", // order created, customer has not paid yet
  SUBMITTED: "submitted", // customer says they paid and gave a UTR
  PAID: "paid", // owner verified it against their UPI app
  REJECTED: "rejected", // owner could not find the payment
};

// order_status — where the food is (POS rows keep the legacy 'confirmed')
export const FULFILLMENT = {
  AWAITING_PAYMENT: "awaiting_payment",
  NEW: "new",
  PREPARING: "preparing",
  READY: "ready",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

// status — the legacy accounting column the dashboard and reports read.
// An online order stays PENDING_ONLINE (and so out of revenue) until the owner
// confirms the payment.
export const ACCOUNTING = {
  COMPLETED: "completed",
  UNPAID: "unpaid",
  PENDING_ONLINE: "pending_online",
};

export const ORDER_TYPES = ["pickup", "dine-in"];

export const FULFILLMENT_LABEL = {
  [FULFILLMENT.AWAITING_PAYMENT]: "Awaiting payment",
  [FULFILLMENT.NEW]: "New order",
  [FULFILLMENT.PREPARING]: "Preparing",
  [FULFILLMENT.READY]: "Ready for pickup",
  [FULFILLMENT.COMPLETED]: "Completed",
  [FULFILLMENT.CANCELLED]: "Cancelled",
};

export const PAYMENT_LABEL = {
  [PAYMENT.PENDING]: "Not paid yet",
  [PAYMENT.SUBMITTED]: "Payment submitted — needs your check",
  [PAYMENT.PAID]: "Paid",
  [PAYMENT.REJECTED]: "Payment not found",
};
