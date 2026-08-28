// Indian mobile numbers, stored one canonical way so "+91 98765 43210",
// "09876543210" and "9876543210" are all the same customer.
export function normalisePhone(input) {
  let digits = String(input ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

export function validatePhone(input) {
  const digits = normalisePhone(input);
  if (!digits) return "Enter your mobile number";
  if (!/^[6-9]\d{9}$/.test(digits)) return "Enter a valid 10-digit mobile number";
  return null;
}
