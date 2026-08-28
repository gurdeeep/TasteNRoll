import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import FloatingCart from "../components/FloatingCart";
import NewOrderWatcher from "../components/NewOrderWatcher";
import { LiveOrdersProvider } from "../context/LiveOrdersContext";

const OWNER_LINKS = [
  { href: "/owner/live", label: "Live Orders", icon: "🔔", badge: "live" },
  { href: "/owner/menu", label: "Counter", icon: "📋" },
  { href: "/owner/unpaid", label: "Unpaid", icon: "⏳", badge: "unpaid" },
  { href: "/owner/history", label: "History", icon: "📜" },
  { href: "/owner/dashboard", label: "Dashboard", icon: "📊" },
];

// NewOrderWatcher lives here rather than on the live-orders page so the popup
// reaches the owner wherever they are in the counter — mid-order, on the
// dashboard, anywhere.
export default function OwnerLayout({ children }) {
  return (
    <LiveOrdersProvider>
      <Navbar links={OWNER_LINKS} role="owner" homeHref="/owner/live" />
      <main>{children}</main>
      <Footer />
      <FloatingCart />
      <NewOrderWatcher />
    </LiveOrdersProvider>
  );
}
