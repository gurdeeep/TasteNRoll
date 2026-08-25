"use client";
import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useCart } from "../context/CartContext";
import {
  SHOP_NAME,
  SHOP_ADDRESS,
  SHOP_PHONE,
  SHOP_ENQUIRY,
  SHOP_TAGLINE,
} from "../data/shop";

function ReceiptContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { setCart, setDiscount } = useCart();
  const orderId = params.get("id") || "N/A";
  const method = params.get("method") || "Cash";
  const [order, setOrder] = useState(null);
  const [viewMode, setViewMode] = useState("bill"); // screen view: 'kitchen' or 'bill'
  const [printTarget, setPrintTarget] = useState("kitchen"); // what to print: 'kitchen' or 'bill'
  const autoPrintDone = useRef(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("lastOrder");
      if (stored) setOrder(JSON.parse(stored));
    } catch {}
  }, []);

  // Auto-print kitchen slip once when order loads
  useEffect(() => {
    if (order && !autoPrintDone.current) {
      autoPrintDone.current = true;
      setPrintTarget("kitchen");
      setTimeout(() => {
        window.print();
      }, 600);
    }
  }, [order]);

  const ownerPhone = process.env.NEXT_PUBLIC_OWNER_PHONE || "";

  // Build WhatsApp message text
  const buildSlipText = () => {
    if (!order) return "";
    let text = `🥡 *${SHOP_NAME}*\n`;
    text += `━━━━━━━━━━━━━━━\n`;
    text += `📋 *Order Slip*\n`;
    text += `🆔 ${orderId}\n`;
    text += `📅 ${order.time}\n`;
    text += `👤 ${order.customer.name}\n`;
    text += `📞 ${order.customer.phone}\n`;
    text += `━━━━━━━━━━━━━━━\n`;
    order.items.forEach((item) => {
      text += `▸ ${item.name} (${item.variant}) ×${item.qty} — ₹${item.price * item.qty}\n`;
    });
    text += `━━━━━━━━━━━━━━━\n`;
    if (order.discountPercent && order.discountAmount) {
      text += `📋 Subtotal: ₹${order.subtotal}\n`;
      text += `🏷️ Discount (${order.discountPercent}%): −₹${order.discountAmount}\n`;
    }
    text += `💰 *Total: ₹${order.total}*\n`;
    text += `💳 Payment: ${method}\n`;
    text += `━━━━━━━━━━━━━━━\n`;
    text += `Thank you! Visit again 🙏`;
    return text;
  };

  const sendWhatsApp = (phone) => {
    const text = encodeURIComponent(buildSlipText());
    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "91" + cleanPhone.slice(1);
    if (!cleanPhone.startsWith("91") && cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, "_blank");
  };

  // Print kitchen slip
  const printKitchen = () => {
    setPrintTarget("kitchen");
    setTimeout(() => window.print(), 50);
  };

  // Print customer bill
  const printBill = () => {
    setPrintTarget("bill");
    setTimeout(() => window.print(), 50);
  };

  // Edit order: load items back to cart, navigate to cart
  const handleEditOrder = () => {
    if (!order) return;
    const cartItems = order.items.map((item) => ({
      ...item,
      key: `${item.id}-${item.variant}`,
    }));
    setCart(cartItems);
    if (order.discountPercent) {
      setDiscount(order.discountPercent);
    }
    sessionStorage.setItem("editingOrderId", orderId);
    router.push("/cart");
  };

  // Kitchen Slip Component (reusable)
  const KitchenSlip = () => (
    <div className="receipt receipt-kitchen-content">
      <div className="receipt-header">
        <h2>🍳 KITCHEN ORDER</h2>
        <p>{SHOP_NAME}</p>
      </div>
      <div className="receipt-divider" />
      <div className="receipt-info">
        <div className="receipt-row">
          <span>Order</span>
          <span className="order-id" style={{ fontWeight: 700 }}>
            {order?.dailyOrderNumber && `#${order.dailyOrderNumber} · `}{orderId}
          </span>
        </div>
        <div className="receipt-row">
          <span>Customer</span>
          <span>{order?.customer?.name || "—"}</span>
        </div>
        <div className="receipt-row">
          <span>Time</span>
          <span>{order?.time || new Date().toLocaleTimeString("en-IN")}</span>
        </div>
      </div>
      <div className="receipt-divider" />
      <div className="receipt-items">
        <div className="receipt-items-header" style={{ gridTemplateColumns: "1fr 40px" }}>
          <span>Item</span>
          <span>Qty</span>
        </div>
        {order?.items?.map((item, i) => (
          <div className="receipt-item-row" key={i} style={{ gridTemplateColumns: "1fr 40px" }}>
            <span className="receipt-item-name">
              {item.name}
              <small> ({item.variant})</small>
            </span>
            <span style={{ textAlign: "center" }}>×{item.qty}</span>
          </div>
        ))}
      </div>
      <div className="receipt-divider" />
      <div className="receipt-footer">
        <p style={{ fontWeight: 600 }}>Total Items: {order?.items?.reduce((s, i) => s + i.qty, 0) || 0}</p>
      </div>
    </div>
  );

  // Full Bill Component (reusable)
  const FullBill = () => (
    <div className="receipt receipt-bill-content">
      <div className="receipt-header">
        <h2>🥡 {SHOP_NAME}</h2>
        <p>{SHOP_TAGLINE}</p>
        <p className="receipt-address">{SHOP_ADDRESS}</p>
        <p className="receipt-address">📞 {SHOP_PHONE} | Enquiry: {SHOP_ENQUIRY}</p>
      </div>

      <div className="receipt-divider" />

      <div className="receipt-info">
        <div className="receipt-row">
          <span>Order No</span>
          <span className="order-id" style={{ fontWeight: 700 }}>
            {order?.dailyOrderNumber && `#${order.dailyOrderNumber} · `}{orderId}
          </span>
        </div>
        <div className="receipt-row">
          <span>Date & Time</span>
          <span>{order?.time || new Date().toLocaleString("en-IN")}</span>
        </div>
        <div className="receipt-row">
          <span>Customer</span>
          <span style={{ fontWeight: 600 }}>{order?.customer?.name || "—"}</span>
        </div>
        <div className="receipt-row">
          <span>Phone</span>
          <span>{order?.customer?.phone || "—"}</span>
        </div>
        <div className="receipt-row">
          <span>Payment</span>
          <span style={{ fontWeight: 600 }}>
            {method === "Split"
              ? "💳 Split"
              : method === "Unpaid"
                ? "⏳ Unpaid"
                : method === "UPI" ? "📱 UPI" : "💵 Cash"}
          </span>
        </div>
        {method === "Split" && order?.cashAmount > 0 && (
          <>
            <div className="receipt-row">
              <span>  └ Cash</span>
              <span>₹{order.cashAmount}</span>
            </div>
            <div className="receipt-row">
              <span>  └ UPI</span>
              <span>₹{order.upiAmount}</span>
            </div>
          </>
        )}
      </div>

      <div className="receipt-divider" />

      <div className="receipt-items">
        <div className="receipt-items-header">
          <span>Item</span>
          <span>Qty</span>
          <span>Price</span>
        </div>
        {order?.items?.map((item, i) => (
          <div className="receipt-item-row" key={i}>
            <span className="receipt-item-name">
              {item.name}
              <small> ({item.variant})</small>
            </span>
            <span>×{item.qty}</span>
            <span>₹{item.price * item.qty}</span>
          </div>
        ))}
      </div>

      <div className="receipt-divider" />

      {order?.discountPercent > 0 && order?.discountAmount > 0 && (
        <>
          <div className="receipt-row">
            <span>Subtotal</span>
            <span>₹{order.subtotal}</span>
          </div>
          <div className="receipt-row" style={{ color: "var(--green)" }}>
            <span>🏷️ Discount ({order.discountPercent}%)</span>
            <span>−₹{order.discountAmount}</span>
          </div>
        </>
      )}

      <div className="receipt-total">
        <span>TOTAL</span>
        <span>₹{order?.total || "—"}</span>
      </div>

      <div className="receipt-footer">
        <p>Thank you! Visit again 🙏</p>
      </div>
    </div>
  );

  return (
    <div className="success-page">
      <div className="success-icon no-print">✅</div>
      <h1 className="no-print">Order Placed!</h1>

      {/* Print Container — both always rendered, CSS controls print visibility */}
      <div className="print-container" data-print-target={printTarget}>
        {/* Kitchen slip: hidden on screen, visible in print when target=kitchen */}
        <div className={`print-slip print-slip-kitchen ${viewMode === "kitchen" ? "" : "screen-hidden"}`}>
          <KitchenSlip />
        </div>
        {/* Customer bill: hidden on screen when viewing kitchen, visible in print when target=bill */}
        <div className={`print-slip print-slip-bill ${viewMode === "bill" ? "" : "screen-hidden"}`}>
          <FullBill />
        </div>
      </div>

      {/* Actions, grouped by what they are for rather than stacked in four
          undifferentiated rows. Hidden in print. */}
      <div className="action-panel no-print">
        <div className="action-group">
          <span className="action-group-label">Print</span>
          <div className="action-row">
            {viewMode === "kitchen" ? (
              <>
                <button className="btn-kitchen" onClick={printKitchen}>
                  🍳 Print Kitchen
                </button>
                <button className="btn-primary" onClick={() => setViewMode("bill")}>
                  🧾 Show Bill
                </button>
              </>
            ) : (
              <>
                <button className="btn-primary" onClick={printBill}>
                  🖨️ Print Bill
                </button>
                <button className="btn-kitchen" onClick={() => setViewMode("kitchen")}>
                  🍳 Kitchen Slip
                </button>
              </>
            )}
          </div>
        </div>

        <div className="action-group">
          <span className="action-group-label">Send the bill</span>
          <div className="action-row">
            <button
              className="btn-secondary"
              onClick={() => {
                const billUrl = `${window.location.origin}/bill/${orderId}`;
                navigator.clipboard
                  .writeText(billUrl)
                  .then(() => {
                    alert("Bill link copied! Share it with the customer.");
                  })
                  .catch(() => {
                    prompt("Copy this link:", billUrl);
                  });
              }}
            >
              🔗 Copy Link
            </button>

            {order?.customer?.phone && (
              <button
                className="btn-sms"
                onClick={() => {
                  const billUrl = `${window.location.origin}/bill/${orderId}`;
                  let smsText = `Hi ${order.customer.name}, your order at ${SHOP_NAME} is confirmed! 🥡\n`;
                  smsText += `Order ID: ${orderId}\n`;
                  smsText += `Total: ₹${order.total}\n`;
                  smsText += `View your bill: ${billUrl}\n`;
                  smsText += `Thank you! Visit again 🙏`;

                  let cleanPhone = order.customer.phone.replace(/\D/g, "");
                  if (cleanPhone.startsWith("0")) cleanPhone = cleanPhone.slice(1);
                  if (!cleanPhone.startsWith("91") && cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;

                  window.open(`sms:+${cleanPhone}?body=${encodeURIComponent(smsText)}`, "_self");
                }}
              >
                💬 SMS
              </button>
            )}

            {order?.customer?.phone && (
              <button className="btn-whatsapp" onClick={() => sendWhatsApp(order.customer.phone)}>
                📲 WhatsApp
              </button>
            )}

            {ownerPhone && (
              <button className="btn-whatsapp owner" onClick={() => sendWhatsApp(ownerPhone)}>
                📲 To Owner
              </button>
            )}
          </div>
        </div>

        <div className="action-group">
          <span className="action-group-label">Next</span>
          <div className="action-row">
            <button className="btn-edit-order" onClick={handleEditOrder}>
              ✏️ Edit Order
            </button>
            <Link href="/menu" className="btn-primary">
              🍽️ New Order
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="success-page"><p>Loading...</p></div>}>
      <ReceiptContent />
    </Suspense>
  );
}
