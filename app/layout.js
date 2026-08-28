import "./globals.css";
import { CartProvider } from "./context/CartContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SessionProvider } from "./context/SessionContext";
import Toast from "./components/Toast";

export const metadata = {
  title: "Taste N' RoLLs | Cafe & Food Ordering",
  description:
    "Order delicious rolls, burgers, pizza, momos, pasta and more from Taste N' RoLLs. Freshly made with premium ingredients. Eat Healthy. Be Healthy.",
  keywords: "Taste N RoLLs, cafe, rolls, burgers, pizza, food ordering, Sampla",
};

// The navbar, footer and floating cart used to live here, which meant the
// counter's navigation also framed the login screens. They now belong to the
// two area layouts — app/customer/layout.js and app/owner/layout.js — so the
// entry gate and the login pages render clean.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <SessionProvider>
            <CartProvider>
              {children}
              <Toast />
            </CartProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
