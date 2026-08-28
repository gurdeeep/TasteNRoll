# Taste N&nbsp;RoLLs

A Next.js app that is two things at once:

- **The counter** (`/owner/*`) — the point-of-sale the staff use: punch in orders, split payments, unpaid tabs, sales dashboard, automated daily and monthly reports.
- **The customer site** (`/customer/*`) — customers sign in on their own phone, order for pickup or dine-in, and pay online by UPI.

Both live behind an entry gate at `/` with two doors: **Customer** and **Owner**.

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Run the database migration

Open your Supabase project → **SQL Editor** → **New query**, paste the whole of
[`supabase/migrations/001_auth_and_online_orders.sql`](supabase/migrations/001_auth_and_online_orders.sql),
and run it. It is idempotent, so running it twice is safe.

It creates the `customers` and `auth_throttle` tables, adds the online-ordering
columns to `orders`, enables Row Level Security, and puts `orders` on the
realtime publication.

### 3. Enable Realtime on the `orders` table

Supabase → **Database** → **Replication** → make sure `orders` is included in the
`supabase_realtime` publication. (The migration does this too; the toggle is the
place to confirm it.)

### 4. Fill in `.env.local`

See [`.env.example`](.env.example) for the full list. The ones the new features
need:

| Variable | What it does |
| --- | --- |
| `JWT_SECRET` | Signs every session token. `npm run gen-secret` prints a fresh one. |
| `OWNER_USERNAME` | Username on the owner login screen. |
| `OWNER_PASSWORD_HASH` | scrypt hash of the owner password. `npm run gen-secret -- "your password"` |
| `NEXT_PUBLIC_UPI_VPA` | **Your UPI ID.** Customers cannot pay without it. |
| `NEXT_PUBLIC_UPI_PAYEE_NAME` | The name shown in the customer's payment app. |
| `SUPABASE_JWT_SECRET` | Supabase → Project Settings → API → JWT Secret. Enables the instant new-order popup; without it the owner board falls back to polling. |

### 5. Check everything landed

```bash
npm run check-setup
```

It reports every missing variable, table and column in one pass.

### 6. Run

```bash
npm run dev
```

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run check-setup` | Verifies env vars, tables and columns |
| `npm run gen-secret` | Prints a new `JWT_SECRET` |
| `npm run gen-secret -- "pw"` | Prints an `OWNER_PASSWORD_HASH` for that password |
| `npm test` | Checks the server-side pricing, UPI and phone helpers |

---

## How the customer order flow works

```
customer signs in  ->  browses /customer/menu  ->  cart  ->  checkout
                                                              |
                        server re-prices the cart from menu.js|
                                                              v
                                        order created, payment_status = pending
                                                              |
                                          [ owner popup: "New online order" ]
                                                              |
                                                              v
                        /customer/pay/<id>: UPI QR + UPI ID + "open my UPI app"
                                                              |
                                    customer pays, enters the UTR from their app
                                                              v
                                                 payment_status = submitted
                                                              |
                                     [ owner popup: "Payment submitted" + UTR ]
                                                              |
                              owner checks their UPI app and taps Confirm / Reject
                                                              v
                              payment_status = paid, status = completed (revenue)
```

### The important caveat

There is no payment gateway. A plain UPI QR or UPI-ID link has **no callback** —
nothing tells the app that money arrived. So the customer supplies the UTR and
**the owner confirms it against their own UPI app**. Until they do, the order:

- shows in the **Needs you** column of `/owner/live`
- sits at `status = 'pending_online'`, so it is **excluded** from the dashboard,
  the daily report and the monthly report

Only the owner tapping *Confirm payment* turns it into revenue. If you later
want automatic confirmation, that means adding a real gateway (Razorpay is
already in `package.json` for exactly this reason).

---

## Security

| Concern | How it is handled |
| --- | --- |
| Passwords | Node `crypto.scrypt`, per-user random salt, constant-time compare. Never stored or logged in the clear. |
| Sessions | HS256 JWTs in `httpOnly`, `secure`, `sameSite=lax` cookies. Page JS cannot read them, so an XSS cannot steal one. |
| Role separation | Owner and customer tokens have different audiences and different cookies. A customer token presented to an owner route fails the audience check. |
| Route protection | `proxy.js` redirects browsers, **and** every API route independently calls `requireOwner()` / `requireCustomer()`. The proxy is convenience; the route check is the boundary. |
| Brute force | Per-IP and per-account throttling in the `auth_throttle` table (in-memory counters would reset on every serverless cold start). 5 wrong owner passwords locks that IP for 15 minutes. |
| Account enumeration | "Incorrect mobile number or password" for both failure modes, and a decoy hash is verified when the account does not exist so the timing matches. |
| Price tampering | Online orders are re-priced server-side from `app/data/menu.js`. The price in the request is discarded entirely. |
| Cross-customer reads | Every customer query is scoped by `customer_id` from the token, never by a URL parameter. Guessing another order id returns 404. |
| Session revocation | `customers.token_version` is baked into the token. Bump it in the database and every token issued before the bump stops working. |
| Realtime | RLS denies the anon key everything. The owner's browser upgrades its websocket with a short-lived token signed with `SUPABASE_JWT_SECRET`. |

---

## Route map

| Route | Who | What |
| --- | --- | --- |
| `/` | anyone | Entry gate: Customer or Owner |
| `/login/customer`, `/register` | anyone | Customer auth |
| `/login/owner` | anyone | Owner auth |
| `/customer` | customer | Home |
| `/customer/menu`, `/cart`, `/checkout` | customer | Ordering |
| `/customer/pay/[orderId]` | customer | UPI QR, UPI ID, UTR entry |
| `/customer/orders` | customer | Live status of their orders |
| `/owner/live` | owner | Live online-order board |
| `/owner/menu`, `/cart`, `/checkout` | owner | The counter POS |
| `/owner/unpaid`, `/history`, `/dashboard` | owner | Tabs, history, sales |
| `/bill/[id]` | owner, or the customer who placed it | Printable receipt |

---

made by gurdeep
