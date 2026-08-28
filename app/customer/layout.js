import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import FloatingCart from "../components/FloatingCart";

const CUSTOMER_LINKS = [
  { href: "/customer", label: "Home", icon: "🏠" },
  { href: "/customer/menu", label: "Menu", icon: "📋" },
  { href: "/customer/orders", label: "My Orders", icon: "🧾" },
];

// Everything under /customer is already gated by proxy.js, which redirects a
// signed-out visitor to /login/customer before this layout ever renders.
export default function CustomerLayout({ children }) {
  return (
    <>
      <Navbar links={CUSTOMER_LINKS} role="customer" homeHref="/customer" />
      <main>{children}</main>
      <Footer />
      <FloatingCart />
    </>
  );
}
