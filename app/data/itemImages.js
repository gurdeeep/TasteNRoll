// Maps every menu item to its illustration in /public/items.
//
// The map is derived from menuData at module load, so adding a new item to
// menu.js automatically gets artwork — no second list to keep in sync.
// Resolution order per item: name keyword → category default → generic fallback.

import { menuData } from "./menu";

const BASE = "/items";

export const FALLBACK_IMAGE = `${BASE}/roll-veg.svg`;

// Category → default artwork
const CATEGORY_IMAGE = {
  "veg-rolls": "roll-veg",
  "chaap-rolls": "roll-chaap",
  "egg-rolls": "roll-egg",
  "chicken-rolls": "roll-chicken",
  burgers: "burger",
  sandwiches: "sandwich",
  fries: "fries",
  pasta: "pasta",
  maggi: "maggi",
  "chinese-special": "chinese",
  nuggets: "nuggets",
  momos: "momos-steam",
  "cheese-mushroom-momos": "momos-steam",
  "pan-fried-momos": "momos-fried",
  "basic-pizza": "pizza",
  "amazing-pizza": "pizza",
  "combo-pizza": "pizza",
  mojitos: "mojito",
  beverages: "shake",
  "soft-drinks": "softdrink",
};

// Name keywords that beat the category default, most specific first.
// Only consulted for categories listed in KEYWORD_CATEGORIES below.
const NAME_KEYWORDS = [
  [/pan\s*fried/i, "momos-fried"],
  [/kurkure|fried/i, "momos-fried"],
  [/steam/i, "momos-steam"],
  [/cold\s*coffee|frappe|coffee/i, "coldcoffee"],
  [/shake|oreo|kit-?kat|vanilla|strawberry|butter\s*scotch/i, "shake"],
  [/paneer/i, "roll-paneer"],
];

// Categories where a name keyword may override the category default.
const KEYWORD_CATEGORIES = new Set([
  "momos",
  "cheese-mushroom-momos",
  "pan-fried-momos",
  "beverages",
  "veg-rolls",
]);

function resolve(categoryId, name) {
  if (KEYWORD_CATEGORIES.has(categoryId)) {
    for (const [pattern, art] of NAME_KEYWORDS) {
      if (pattern.test(name)) return art;
    }
  }
  return CATEGORY_IMAGE[categoryId] || null;
}

// itemId → "/items/<art>.svg"
const imageById = {};
for (const category of menuData) {
  for (const item of category.items) {
    const art = resolve(category.id, item.name);
    if (art) imageById[item.id] = `${BASE}/${art}.svg`;
  }
}

// Prefix of an item id (e.g. "vr7" → "vr") → category artwork, so ids that
// aren't in the map directly (add-on rows like "vr7-ao1") still resolve.
const imageByPrefix = {};
for (const [id, src] of Object.entries(imageById)) {
  const prefix = id.replace(/\d+$/, "");
  if (prefix && !(prefix in imageByPrefix)) imageByPrefix[prefix] = src;
}

/**
 * Artwork for a menu item or cart line.
 * @param {string} id   Menu item id, optionally suffixed (e.g. "vr7-ao1").
 * @param {string} [name] Item name, used as a last resort for ad-hoc lines.
 * @returns {string} Path to an SVG under /public/items.
 */
export function getItemImage(id, name = "") {
  if (id && imageById[id]) return imageById[id];

  // Add-on / composite ids: "vr7-ao1" → try "vr7", then the "vr" prefix.
  if (id) {
    const root = String(id).split("-")[0];
    if (imageById[root]) return imageById[root];
    const prefix = root.replace(/\d+$/, "");
    if (imageByPrefix[prefix]) return imageByPrefix[prefix];
  }

  // Nothing matched on id — fall back to reading the name.
  for (const [pattern, art] of NAME_KEYWORDS) {
    if (pattern.test(name)) return `${BASE}/${art}.svg`;
  }
  return FALLBACK_IMAGE;
}

/** Artwork representing a whole category, for section headers and tiles. */
export function getCategoryImage(categoryId) {
  const art = CATEGORY_IMAGE[categoryId];
  return art ? `${BASE}/${art}.svg` : FALLBACK_IMAGE;
}
