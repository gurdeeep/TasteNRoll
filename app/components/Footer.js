import Image from "next/image";
import Link from "next/link";
import {
  SHOP_ADDRESS,
  SHOP_ENQUIRY,
  SHOP_NAME,
  SHOP_PHONE,
  SHOP_TAGLINE,
} from "../data/shop";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-content">
          <div className="footer-brand">
            <Image
              src="/brand/logo-mark.svg"
              alt=""
              width={34}
              height={34}
              className="footer-brand-mark"
              aria-hidden="true"
            />
            {SHOP_NAME}
          </div>
          <div className="footer-tagline">{SHOP_TAGLINE} 🙏</div>
        </div>

        <div className="footer-meta">
          <div className="footer-meta-block">
            <h4>Find Us</h4>
            <p>{SHOP_ADDRESS}</p>
          </div>
          <div className="footer-meta-block">
            <h4>Call Us</h4>
            <a href={`tel:${SHOP_PHONE.replace(/-/g, "")}`}>📞 {SHOP_PHONE}</a>
            <a href={`tel:${SHOP_ENQUIRY.replace(/-/g, "")}`}>💬 {SHOP_ENQUIRY}</a>
          </div>
          <div className="footer-meta-block">
            <h4>Explore</h4>
            <Link href="/menu">Full Menu</Link>
            <Link href="/cart">Current Order</Link>
          </div>
        </div>

        <div className="footer-bottom">
          © {new Date().getFullYear()} {SHOP_NAME} — Made with ❤️
        </div>
      </div>
    </footer>
  );
}
