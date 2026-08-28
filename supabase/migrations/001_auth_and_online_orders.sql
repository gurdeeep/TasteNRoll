-- ============================================================================
-- Taste N' RoLLs — customer ordering + JWT auth
-- Run once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- Every statement is idempotent, so re-running it is safe.
--
-- Written against the LIVE public.orders schema, which already carries
-- source / order_type / transaction_id / order_status. Those are reused rather
-- than duplicated; only the genuinely-missing columns are added below.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Customers
--     Passwords are never stored in the clear. `password_hash` holds a scrypt
--     digest in the format  scrypt:N:r:p:<salt-b64url>:<hash-b64url>  produced
--     by app/lib/password.js. Colons rather than the conventional "$" because
--     the owner hash lives in .env.local, and Next runs env values through
--     dotenv-expand, which would eat "$16384" as a variable reference.
--     `token_version` is bumped to invalidate every JWT already issued to this
--     customer (password change, "log out everywhere").
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  phone           text not null unique,
  name            text not null,
  password_hash   text not null,
  token_version   integer not null default 0,
  failed_attempts integer not null default 0,
  locked_until    timestamptz,
  last_login_at   timestamptz
);

create index if not exists customers_phone_idx on public.customers (phone);

-- ---------------------------------------------------------------------------
-- 2. Auth throttle
--     Serverless functions do not share memory, so brute-force counters live in
--     the database. One row per key ("ip:1.2.3.4", "phone:9876543210", ...).
-- ---------------------------------------------------------------------------
create table if not exists public.auth_throttle (
  key          text primary key,
  attempts     integer not null default 0,
  window_start timestamptz not null default now(),
  locked_until timestamptz
);

-- ---------------------------------------------------------------------------
-- 3. Online-order columns
--
--     Already present, reused as-is:
--       source          'pos' | 'online'
--       order_type      'pickup' | 'dine-in'
--       transaction_id  the UPI reference/UTR the CUSTOMER pastes after paying
--       order_status    kitchen lifecycle; POS rows keep 'confirmed', online
--                       rows walk 'awaiting_payment' -> 'new' -> 'preparing'
--                       -> 'ready' -> 'completed' | 'cancelled'
--
--     The legacy `status` column keeps its accounting meaning ('completed' /
--     'unpaid'). An online order sits at 'pending_online' until the owner
--     confirms the payment, so it never counts as revenue while unverified.
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists customer_id    uuid references public.customers(id) on delete set null;
alter table public.orders add column if not exists table_number   text;
alter table public.orders add column if not exists payment_status text;        -- 'pending' | 'submitted' | 'paid' | 'rejected'
alter table public.orders add column if not exists upi_txn_ref    text;        -- reference WE generate and embed in the UPI link
alter table public.orders add column if not exists paid_at        timestamptz;
alter table public.orders add column if not exists customer_note  text;
alter table public.orders add column if not exists seen_by_owner  boolean not null default false;

create index if not exists orders_source_idx      on public.orders (source);
create index if not exists orders_customer_id_idx on public.orders (customer_id);
create index if not exists orders_created_at_idx  on public.orders (created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
--     The Next.js API routes talk to Supabase with the SERVICE ROLE key, which
--     bypasses RLS entirely — the POS and every API route keep full access.
--     RLS exists here purely to gate the Realtime websocket the owner's browser
--     opens with the ANON key. Without a policy, anon sees nothing.
--
--     The owner's browser calls supabase.realtime.setAuth(<token>) with a JWT
--     minted by /api/auth/realtime-token and signed with SUPABASE_JWT_SECRET.
--     That token carries role='authenticated' and rollbox_role='owner', which
--     is what the policy below checks. A plain anon key gets zero rows.
-- ---------------------------------------------------------------------------
alter table public.orders        enable row level security;
alter table public.customers     enable row level security;
alter table public.auth_throttle enable row level security;

drop policy if exists "owner realtime can read orders" on public.orders;
create policy "owner realtime can read orders"
  on public.orders for select
  to authenticated
  using ( (auth.jwt() ->> 'rollbox_role') = 'owner' );

-- customers / auth_throttle deliberately get NO policies, which makes them
-- unreachable by anon and authenticated alike. Only the service role can read
-- them — and password hashes should never leave the server anyway.

-- ---------------------------------------------------------------------------
-- 5. Realtime publication
--     Adds `orders` to the realtime publication so INSERT/UPDATE events are
--     broadcast. Wrapped because adding the same table twice raises an error.
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- Send the full previous row on UPDATE so the client can tell a payment
-- confirmation apart from any other edit.
alter table public.orders replica identity full;
