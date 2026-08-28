import { menuData, pizzaAddOns, generalAddOns } from "../data/menu.js";

// ---------------------------------------------------------------------------
// Authoritative pricing.
//
// The POS is operated by staff at the counter, so trusting the prices in its
// payload is fine. A customer ordering from their own phone is a different
// matter: nothing stops them editing the request and sending price: 1. So every
// online order is re-priced here, from the same menu.js the UI renders, and the
// client-sent price is discarded.
// ---------------------------------------------------------------------------

// Which field on a menu item a given variant refers to. "regular" is
// deliberately absent: it means item.price on a single-price category but
// item.regular on a three-size one, so it is resolved against the category.
const VARIANT_FIELD = {
  half: "half",
  full: "full",
  option1: "price1",
  option2: "price2",
  medium: "medium",
  large: "large",
};

// id -> { item, category }, built once per server instance.
let itemIndex = null;
function index() {
  if (itemIndex) return itemIndex;
  itemIndex = new Map();
  for (const category of menuData) {
    for (const item of category.items) {
      itemIndex.set(item.id, { item, category });
    }
  }
  return itemIndex;
}

const pizzaAddOnIndex = new Map(pizzaAddOns.map((a) => [a.id, a]));
const generalAddOnIndex = new Map(generalAddOns.map((a) => [a.id, a]));

// Returns the real price for a line, or null if the id/variant pair is not
// something this menu can actually sell.
export function priceFor(id, variant) {
  const direct = index().get(id);
  if (direct) {
    const { item, category } = direct;
    if (variant === "regular") {
      const price = category.type === "single" ? item.price : item.regular;
      return typeof price === "number" ? price : null;
    }
    const field = VARIANT_FIELD[variant];
    const price = field ? item[field] : null;
    return typeof price === "number" ? price : null;
  }

  // Add-on lines carry a composite id: "<menuItemId>-<addOnId>".
  const split = id.lastIndexOf("-");
  if (split === -1) return null;
  const addOnId = id.slice(split + 1);

  if (variant === "add-on") {
    const addOn = generalAddOnIndex.get(addOnId);
    return addOn ? addOn.price : null;
  }

  const pizzaAddOn = pizzaAddOnIndex.get(addOnId);
  if (pizzaAddOn && ["regular", "medium", "large"].includes(variant)) {
    return pizzaAddOn[variant];
  }

  return null;
}

// Re-prices a whole cart. Returns { items, subtotal, error }.
// `items` is rebuilt from scratch so nothing the client invented — an extra
// field, a doctored name — survives into the database.
export function repriceCart(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: "Your cart is empty" };
  }
  if (rawItems.length > 100) {
    return { error: "That is too many different items for one order" };
  }

  const items = [];
  let subtotal = 0;

  for (const raw of rawItems) {
    const id = String(raw?.id ?? "");
    const variant = String(raw?.variant ?? "");
    const qty = Number(raw?.qty);

    if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
      return { error: "Invalid quantity in your cart" };
    }

    const price = priceFor(id, variant);
    if (price === null) {
      return { error: "Your cart contains an item that is no longer available" };
    }

    // The display name comes from the menu, not the request. Add-on lines are
    // not in the index, so fall back to the submitted name for those only —
    // and even then it is only a label; the price above is ours.
    const known = index().get(id);
    const name = known ? known.item.name : String(raw?.name ?? "Add-on").slice(0, 80);

    items.push({ id, name, variant, price, qty, key: `${id}-${variant}` });
    subtotal += price * qty;
  }

  return { items, subtotal, error: null };
}
