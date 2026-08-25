import Image from "next/image";
import { getItemImage, getCategoryImage } from "../data/itemImages";

/**
 * The round food illustration used on menu cards, cart lines, accordion
 * headers and the landing page.
 *
 * Pass an item (`id` + `name`) for per-item artwork, or a `categoryId` alone
 * for the category's default. When both are given the item wins, so a Paneer
 * Roll gets paneer artwork rather than the generic veg-roll drawing.
 *
 * The artwork is decorative — the dish name is always adjacent in the DOM —
 * so alt is empty by default and the image is hidden from screen readers.
 */
export default function DishArt({
  id,
  name = "",
  categoryId,
  size = 66,
  className = "",
  alt = "",
}) {
  const src = id ? getItemImage(id, name) : getCategoryImage(categoryId);

  return (
    <Image
      src={src}
      width={size}
      height={size}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      className={`dish-art ${className}`.trim()}
    />
  );
}
