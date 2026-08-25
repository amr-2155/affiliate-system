# AFFILIATE SAAS — PHASE 0 — ARCHITECTURE & TECHNICAL BLUEPRINT

> Status: DRAFT FOR APPROVAL — no production code written or modified.
> Date: Aug 25, 2026 · Prepared by: ox-alpha (Hermes)
> REVISION 1 (Aug 25, 2026): Business model corrected — the platform is ONLY a SaaS
> provider. The MERCHANT owns the affiliate program and all commercial/financial
> relations with their affiliates. The platform does NOT pay affiliates, hold
> affiliate funds, or take any share of commissions. See §29 for the full
> responsibility boundary and change log.
> REVISION 2 (Aug 25, 2026): FINAL business model — the primary customer/tenant is the
> USER / ACCOUNT OWNER (not "merchant"). Each User owns an isolated workspace and may
> operate BOTH their own STORE and their own AFFILIATE NETWORK (with subordinate
> Merchants & Affiliates). Tenant discriminator = user_id/account_id. See §30 for the
> full Revision 2 change log.

---

## 1. Executive Summary

We are designing a **multi-tenant Affiliate Marketing SaaS** for the Egyptian market.
The platform owner (Super Admin) is ONLY the SaaS provider. **The primary customer and
tenant is the USER / ACCOUNT OWNER** — not a "merchant". Each User owns an isolated
workspace in which they may operate TWO independent capabilities:

1. Their own **STORE** (products → customers → orders)
2. Their own **AFFILIATE NETWORK** (subordinate Merchants + Affiliates/Marketers)

The User owns all commercial relationships inside their workspace (with affiliates,
merchants, customers). The platform NEVER pays affiliates, never holds affiliate or
merchant sales money, and never mediates financial disputes — it provides infrastructure,
attribution, commission CALCULATION records, and analytics.

**Platform revenue:** 1 EGP per DELIVERED order, charged to the USER (configurable from
Super Admin; billing event = DELIVERED; never hard-coded) — covering BOTH store-originated
and affiliate-network-originated orders. The wallet is the **User Platform Wallet**
(recharged manually via Vodafone Cash / InstaPay, approved by Super Admin), used
exclusively for SaaS billing. Every movement goes through an append-only ledger.

Key architectural pillars:

1. **PostgreSQL with shared-schema multi-tenancy** — every business row carries
   `user_id` (account owner), enforced at three layers (query layer, PostgreSQL RLS as
   defense-in-depth, API middleware). Cheapest to operate at 1K–10K users; partitioning
   path exists for scale.
2. **Append-only double-entry-style financial ledger** — wallet movements are immutable
   rows; balances are derived/cached, never edited destructively.
3. **Explicit state machines** for Order and Commission, persisted transitions table.
4. **Attribution snapshotting** — the order freezes affiliate/program/rate/commission data
   at creation time; later changes cannot rewrite history.
5. **Monolith-first modular Next.js app** (Route Handlers as the API) with a worker process
   for jobs — simple to run now, clean seams to split later.

The existing `affiliate-system` project in this workspace is a **single-tenant prototype**
(SQLite, next-auth v4). The recommendation is a **fresh repository** (`affiliate-saas`)
that reuses lessons/tests patterns from the prototype but starts clean on PostgreSQL.
Nothing in the existing repo was touched.

### 1.1 FINAL Business Model (Revision 2)

```
SUPER ADMIN  (platform owner — infrastructure & SaaS billing only)
    ↓
USER / ACCOUNT OWNER   ← primary tenant; owns the workspace & wallet
    ├── STORE(s)            → Products → Customers → Orders
    └── AFFILIATE NETWORK   → Merchants + Affiliates/Marketers → Orders
```

- A User may use Store only, Affiliate Network only, both, or neither initially.
- Multiple stores per User allowed; one shared User Platform Wallet across everything.
- Merchants/Affiliates inside a network are SUBORDINATE entities of that User — NOT
  separate tenants. Identity model keeps an upgrade path: a Merchant or Affiliate can
  later become a full independent User without schema rewrites (see §6.1).
- The platform fee applies per DELIVERED order regardless of source
  (STORE or AFFILIATE_NETWORK); always attributable to exactly one User account.

---

## 2. Recommended Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15+ (App Router)** one repo | Team already fluent; SSR dashboards + Route Handlers API in one deployable; App Router Server Actions reduce client boilerplate. |
| Language | **TypeScript strict** | Financial logic demands compile-time contracts; zod-validated boundaries. |
| DB | **PostgreSQL 16** | ACID, rich indexes, `NUMERIC` money, row-level locking (`SELECT … FOR UPDATE`), RLS for tenant defense-in-depth, partitioning, logical replication. SQLite cannot serve concurrent multi-tenant writes safely. |
| ORM | **Prisma** | Familiar to team, migrations, typed queries. Raw SQL escape hatch for ledger hot paths. |
| Auth | **Auth.js v5 (next-auth) credentials + JWT sessions** OR custom session table | We need first-party credential auth (merchants/affiliates), short-lived access tokens + rotating refresh, server-side session revocation. |
| Validation | **Zod** | Single schema source reused by API handlers and forms. |
| Money | **Prisma `Decimal` / Postgres `NUMERIC(14,2)`**, currency EGP stored explicitly | Never floats. |
| Background jobs | **BullMQ + Redis** (worker = separate Node process) | Commission finalization, wallet sweeps, email/WhatsApp, analytics rollups need retries + durability. |
| Cache | **Redis** | Sessions, rate limiting, click dedupe windows, dashboard aggregates. |
| Storage | **S3-compatible (Cloudflare R2 / Wasabi)** | Product images, KYC receipts of Vodafone Cash transfers. |
| Email | Resend / SMTP | Verification, recharge status notifications. |
| Logging | **pino** structured JSON → file/Loki | Cheap, queryable. |
| Monitoring | Sentry + UptimeRobot (+ Grafana later) | Error tracking, availability. |
| Testing | **Vitest** + Testcontainers-PG (or dedicated PG test DB); Playwright for E2E | Mirrors the prototype's strong financial-invariant test culture. |
| Deployment (start) | Single VPS (Hetzner/Contabo) via Docker Compose: app, worker, postgres, redis, caddy | EGP-denominated costs matter; VPS ≈ $10–20/mo vs managed ≈ $60+. Migration path to containers/K8s documented in §22. |

Rejected alternatives: Supabase-only (RLS great but we want full control of auth + jobs),
microservices (premature at this stage), MongoDB (no multi-document ACID for ledger).

---

## 3. System Architecture

```
                    ┌──────────────┐
 Customers ──click──▶ Storefront    │  /product/123?ref=AFF102
 Affiliates         │ (public web)  │──▶ Click ingest API (fast, queued)
                    └──────┬───────┘
                           ▼
        ┌──────────────────────────────────────────┐
        │  Next.js App (monolith, modular)         │
        │  ├─ /api/v1/* Route Handlers             │
        │  ├─ middleware.ts: tenant guard, RBAC    │
        │  ├─ modules/: auth tenancy catalog       │
        │  │   orders commissions wallet billing   │
        │  │   attribution fraud audit analytics   │
        │  └─ Admin & Merchant & Affiliate UIs     │
        └───────┬───────────────────┬──────────────┘
                ▼                   ▼
        ┌──────────────┐    ┌──────────────┐
        │ PostgreSQL16 │    │ Redis        │
        │ (RLS on)     │    │ cache+queues │
        └──────────────┘    └──────┬───────┘
                                   ▼
                          ┌────────────────┐
                          │ Worker (BullMQ)│ commissions, rollups,
                          │ separate proc  │ emails, click processing
                          └────────────────┘
                                   │
                     ┌─────────────┼─────────────┐
                     ▼             ▼             ▼
                 pino logs     Sentry        S3 storage
```

Module boundaries are package-internal (one deployable), each module exposing only its
service interface — so commission/wallet/billing can later be extracted into services
without rewriting callers.

---

## 4. Database Architecture

Conventions:

- PKs: **UUIDv7** (`gen_random_uuid()` fallback; time-ordered for index locality).
- Audit columns everywhere: `created_at`, `updated_at`, `created_by`, `updated_by` (nullable FKs).
- Soft delete only where history matters: `deleted_at` on products, affiliates, users, stores.
  Orders, ledgers, commissions are NEVER deleted.
- All money: `NUMERIC(14,2)` + `currency CHAR(3) DEFAULT 'EGP'`.
- Every tenant-owned table has `user_id UUID NOT NULL` (account owner) indexed as
  **leftmost column** of every secondary index (tenant-first composite indexes).
  Store/network-scoped tables additionally carry `store_id` / `network_id` for
  finer scoping, but `user_id` is the isolation boundary.
- Transaction boundaries (see §10–12): order creation + attribution + pending commission
  = ONE transaction. Ledger append + balance update = ONE transaction with row lock.

### Platform config (no hard-coded fees)

```
platform_settings (singleton)
  id, platform_fee_per_delivered_order NUMERIC(14,2),
  fee_billing_event TEXT ('ORDER_DELIVERED'),
  low_balance_threshold NUMERIC, min_wallet_balance NUMERIC,
  insufficient_balance_behavior TEXT ('WARN'|'BLOCK_NEW_ORDERS'|'ACCUMULATE_DEBT'),
  updated_by, updated_at
```

All fee reads go through `PlatformConfigService` (cached in Redis, invalidated on write).

---

## 5. ERD Description (Revision 2)

Entities and relationships (cardinalities) — USER is the ownership root:

```
users 1─* user_sessions ; users *─1 role enum (SUPER_ADMIN | USER)
users 1─* stores 1─* products 1─* product_variants 1─* inventory_movements
stores 1─* customers 1─* carts 1─* cart_items
stores 1─* orders 1─* order_items
users 1─* affiliate_networks                    ← new root entity per User
affiliate_networks 1─* network_merchants        ← subordinate entities of the User
affiliate_networks 1─* affiliates 1─* affiliate_links 1─* clicks
orders *─1 clicks (optional attribution source)
orders 1─1 order_attribution ; orders 1─* order_status_events
orders 1─* commissions ; affiliates 1─* commissions   ← commission belongs to the
                                                        owning USER's network
users 1─1 wallet_accounts 1─* wallet_ledger_entries (append-only)
users 1─* recharge_requests 1─* recharge_reviews(admin decision)
users/actors 1─* audit_logs
platform_settings (singleton) ; feature_flags
```

Ordering note: every business row carries `user_id`; `store_id`/`network_id` are scoping
attributes beneath it. Full DDL will be formalized as Prisma schema + raw-SQL migration
with RLS policies in Phase 1.

---

## 6. Multi-Tenant Strategy (Revision 2)

**Primary isolation boundary: USER / ACCOUNT OWNER (`user_id`).**

**Chosen: shared database, shared schema, discriminator column + PostgreSQL Row-Level Security.**

Three enforcement layers:

1. **Application layer**: every Prisma query goes through tenant-scoped repositories that
   inject `where: { userId }` automatically (a `TenantScope` helper — direct
   `prisma.order.findMany` in feature code is lint-banned).
2. **Database layer (defense-in-depth)**: RLS policies
   `USING (user_id = current_setting('app.user_id')::uuid)`; super-admin uses
   `app.role='SUPER_ADMIN'` bypass policy. Connection acquires `SET LOCAL` inside each request tx.
3. **API layer**: middleware resolves tenant from session; every `/api/v1/users/:id/*`
   route asserts `session.userId === params.id || role===SUPER_ADMIN`.

Anti-IDOR rule: **no object IDs are trusted without ownership check** — fetch by
`(id, userId)` composite always.

### 6.1 Subordinate-entity upgrade path (Merchants/Affiliates → Users)

Network Merchants and Affiliates are subordinate rows scoped to the owning User's
network. To keep a future "become an independent platform User" path WITHOUT rewrites:

- Every `affiliate` / `network_merchant` row carries a nullable `promoted_user_id`
  FK to `users`. Promotion = create User row + set the pointer; historical orders,
  clicks, commissions stay intact because they reference the affiliate/network row,
  not the identity.
- Affiliate/merchant portal logins use the same `users` table with role
  `AFFILIATE_PORTAL` / `MERCHANT_PORTAL` linked to their subordinate entity — so no
  second identity system ever exists.

Why not schema-per-tenant: 10K schemas → migration/pooling nightmare. Why not DB-per-tenant:
operational cost ×N. Escape hatch: because all queries already filter tenant-first,
partitioning by `HASH(merchant_id)` later is non-breaking.

---

## 7. RBAC (Revision 2)

Roles: `SUPER_ADMIN, USER, AFFILIATE_PORTAL, MERCHANT_PORTAL, CUSTOMER`.

- `USER` = account owner. Full control of their workspace: stores, products, orders,
  affiliate network (recruiting/approving merchants & affiliates), commission rules,
  marking commissions PAID externally, wallet & recharge requests.
- `AFFILIATE_PORTAL` / `MERCHANT_PORTAL` = subordinate identities inside ONE User's
  network; read-only visibility of their own performance/commissions. No wallet, no
  withdrawals, no money movement.
- `SUPER_ADMIN` = platform infrastructure only: users, platform fee config, recharge
  approvals, ledger oversight. NEVER touches User commercial data or decisions.

Role semantics under the corrected business model:
- Portal roles see THEIR OWN performance (clicks, orders, pending/earned/paid/unpaid
  commission amounts) — all monetary fields are read-only reports of the User-owned
  accounting records.
- Permission matrix in code (typed constants): e.g. `wallet.approve_recharge` → SUPER_ADMIN only;
  `products.write` → USER (+ future staff sub-roles); `commissions.read.own` → portal roles.
- Enforcement: route-level guard (`requirePermission('wallet.approve_recharge')`) +
  service-layer re-check for sensitive operations (never trust the router alone).
- Every role change writes an audit log entry and kills affected sessions.

---

## 8. Order State Machine

States: `PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED`, terminal side states
`CANCELLED, REJECTED, RETURNED`.

Legal transitions:

```
PENDING    → CONFIRMED | CANCELLED | REJECTED
CONFIRMED  → PROCESSING | CANCELLED | REJECTED
PROCESSING → SHIPPED | CANCELLED | REJECTED
SHIPPED    → DELIVERED | RETURNED | REJECTED
DELIVERED  → RETURNED          ← the critical money edge
CANCELLED / REJECTED / RETURNED : terminal (RETURNED reachable only from SHIPPED/DELIVERED)
```

Enforced in `OrderStateMachine.canTransition()`; every transition inserts a row into
`order_status_events (order_id, from, to, actor_id, reason, at)` — the state history is
immutable evidence.

**Commission & fee timing (recommended defaults — flagged for your approval):**

| Event | Commission | Platform fee |
|---|---|---|
| Order PENDING (attributed) | created as `PENDING` | nothing |
| Order DELIVERED | PENDING → `EARNED` (payable) | fee becomes `BILLABLE` → ledger debit |
| Delivered order RETURNED | commission `EARNED → REVERSED` (clawback entry) | fee reversal credit entry |
| Order CANCELLED/REJECTED pre-delivery | commission → `CANCELLED` | nothing was charged |
| Insufficient wallet balance | commission still earned (affiliate is innocent) | per `insufficient_balance_behavior`: default `ACCUMULATE_DEBT` (negative balance allowed up to a floor) + admin alert; alternative `BLOCK_NEW_ORDERS` blocks merchant checkout until top-up |

Alternatives explained (not silently chosen):
- *Charge fee at shipment instead of delivery*: earlier cash flow, but you'd refund on returns — worse ledger churn. Delivery-charging recommended since your spec ties both to DELIVERED.
- *Clawback earned-but-paid commissions*: if payouts already happened, clawback becomes a negative balance on the affiliate wallet (Phase 5 concern) rather than editing history.

---

## 9. Commission State Machine

```
PENDING → EARNED            (order delivered)
PENDING → CANCELLED         (order cancelled/rejected before delivery)
EARNED  → REVERSED          (delivered order returned; compensating entry in the
                             merchant-facing commission ledger)
EARNED  → PAID_BY_USER      (User confirms they paid the affiliate externally)
```

REVISION 2 — corrected semantics:
- Commissions are **User-owned accounting records** (the User's commercial relationship
  with their affiliates/merchants), NOT platform liabilities.
- `PAID` is renamed **`PAID_BY_USER`**: the User marks that they handled the payment
  externally (cash, Vodafone Cash, bank…). The platform records the confirmation; it
  never moves money. Requires the USER role (`commissions.mark_paid`) + audit-log entry
  with optional external reference (transfer number/note).
- A returned order AFTER `PAID_BY_USER`: a compensating `REVERSED` adjusting entry linked
  to the original is recorded (history preserved); the User sees a negative adjustment in
  their reports. Recovery is purely User–affiliate business — the platform holds no funds.
  (The former `PAID → CLAWBACK_PENDING` platform-debt state remains REMOVED.)
- No payout holds, no affiliate debt management, no withdrawal workflow exist in MVP.

Commissions are **append-corrected, never edited**: rate/amount changes create adjusting
entries referencing the original. `commissions.amount_locked` computed once from the frozen
attribution snapshot (§13). Unique constraint `(order_id, affiliate_id, type='PRIMARY')`
prevents duplicate attribution.

## 10. Wallet Architecture

One `wallet_accounts` row per **USER** (account owner):

```
wallet_accounts(id, user_id UNIQUE, balance NUMERIC CHECK (balance >= min_allowed),
                low_balance_threshold, version BIGINT, timestamps)
```

REVISION 2: this is the ONLY financial account in the MVP — the **User Platform
Wallet**, used exclusively to settle SaaS platform fees (1 EGP/delivered order,
charged to the User). It is SHARED across all the User's stores and their
affiliate-network activity. There is deliberately NO affiliate wallet and NO customer
wallet. Ledger txn_types: `RECHARGE | PLATFORM_FEE | FEE_REVERSAL | ADJUSTMENT`
(payout types removed).

- Balance updates happen ONLY inside `WalletService.apply(entry)` which:
  1. opens a transaction, `SELECT … FOR UPDATE` on wallet row,
  2. validates resulting balance against policy,
  3. inserts the immutable ledger row,
  4. updates cached balance + `version` (optimistic-concurrency guard for read paths).
- No code path anywhere mutates balance without writing a ledger row (enforced by test).

## 11. Immutable Ledger

```
wallet_ledger_entries(
  id, user_id, amount NUMERIC > 0, direction 'CREDIT'|'DEBIT',
  txn_type 'RECHARGE'|'PLATFORM_FEE'|'FEE_REVERSAL'|'ADJUSTMENT',
  status 'COMPLETED' (ledger rows post only completed facts; pending lives in recharge_requests),
  reference (e.g. order_id / recharge_request_id / manual note id),
  created_by, created_at, metadata JSONB,
  prev_entry_id, prev_balance_hash  ← hash chain: sha256(prev_hash + entry fields)
)
```

Rules: UPDATE/DELETE revoked at DB level (trigger raising exception; app role lacks privilege).
Corrections = compensating entries. Hash chain makes silent tampering detectable; nightly job verifies chain.

## 12. Platform Billing (Revision 2)

Every DELIVERED order — whether from the User's STORE or their AFFILIATE_NETWORK —
creates EXACTLY ONE billable platform-fee event, charged to that User's wallet.
Duplicate billing is impossible: unique constraint `platform_fee_events(order_id UNIQUE)`
+ idempotency key on the delivery transition.

Flow on `DELIVERED` event (inside one DB transaction with the state change):
compute fee from `PlatformConfigService` (default 1.00 EGP; configurable amount +
billing event by Super Admin) → if balance sufficient: DEBIT ledger + balance;
else follow configured behavior (default: allow negative within floor, alert admin,
mark account `billing_state='DEBT'`). Super Admin can bulk-view debts, send reminders,
adjust via ADJUSTMENT entries (dual control above a threshold — configurable).

## 13. Affiliate Attribution (Revision 2)

Chain: User's Network → Affiliate/Link (`/product/123?ref=AFF102`) → click → cookie/localStorage
→ customer order → attributed commission. Store-originated orders carry
`source_type='STORE'` (no affiliate); network orders carry `source_type='AFFILIATE_NETWORK'`.

**Secure tracking design (not solely URL-dependent):**

1. Click hits `/api/v1/t/[code]` (server): validate link belongs to active program of THAT
   store's merchant (cross-tenant ref codes rejected), generate signed click token
   `HMAC(clickId, storeId, merchantId, affiliateId, expiry=30d)` stored httpOnly cookie
   scoped to the storefront domain + last-click-wins policy (configurable).
2. Order creation accepts the click token (or raw ref for API clients) → server re-resolves
   affiliate from DB, ignores client-supplied affiliate IDs/rates entirely.
3. `order_attribution` snapshot frozen at order creation — the immutable OWNERSHIP +
   commission record:
   `(order_id UNIQUE, user_id, source_type 'STORE'|'AFFILIATE_NETWORK', store_id NULLABLE,
   network_id NULLABLE, network_merchant_id NULLABLE, affiliate_id NULLABLE,
   click_id, program/commission_type, commission_value, computed_rate_snapshot,
   product_ids[], ip_hash, user_agent_hash, created_at)`
   — later edits to rules never touch past orders; every order is attributable to
   exactly ONE User account for billing.

Protections: cross-tenant (click token bound to User+store/network), fake affiliate IDs
(server resolution), manipulated commissions (rates from DB snapshot, client input
ignored), duplicate attribution
(unique constraint), unauthorized order creation (orders only created server-side with
session/cart signature), replay (click token single-use binding + expiry + nonce in Redis),
self-referral fraud (deny when customer identity matches affiliate identity — phone/email/
device-hash match rules, configurable), velocity rules in fraud engine (§15).

## 14. Security Threat Model (STRIDE-condensed)

| Threat | Mitigation |
|---|---|
| Spoofing | bcrypt(12+) passwords, optional TOTP for admins, session fixation prevention, device binding for SUPER_ADMIN |
| IDOR / cross-tenant reads | §6 triple enforcement on `user_id` + composite-key fetches + authorization tests per endpoint (pattern inherited from prototype tests) |
| SQL injection | Prisma parameterization; raw SQL only via tagged templates |
| XSS | React escaping, strict CSP, no `dangerouslySetInnerHTML` for user data |
| CSRF | SameSite=Lax cookies + origin checks on mutations; Bearer tokens for pure-API clients |
| Rate limiting / abuse | Redis sliding-window per IP+route+identity; stricter on auth, click-ingest, recharge submit |
| Mass assignment | Zod strict schemas (`passthrough` banned); explicit DTO mapping |
| Session/token security | Short JWT access (15m) + rotating refresh (7d, reuse-detection revokes family); server-side session table for revoke |
| Secrets management | `.env` never committed (already gitignored), staging/prod secrets via host env / future vault; secret scanning in CI |
| Financial manipulation | §11 hash-chain ledger, dual-control adjustments, no client-computed money values, DB triggers block UPDATE/DELETE |
| Insider/admin abuse | Everything sensitive in audit_logs with actor + before/after diff |
| Fake "PAID_BY_USER" confirmations / internal fraud | `commissions.mark_paid` is permission-gated to the USER role, audit-logged with actor + external reference; SUPER_ADMIN cannot mark commissions paid (not their domain); portal roles see read-only status |
| Affiliate/merchant privacy leakage across workspaces | portal dashboards scoped to `(user_id, affiliate_id / network_merchant_id)` composite; an affiliate in User A's network can never enumerate User B's network, even with forged IDs |

## 15. Fraud Prevention

Fraud engine (rules evaluated async on order events; flags, doesn't auto-punish by default):

- Fake/duplicate orders: same customer+product velocity thresholds, IP/device hashing, phone OTP verification option per merchant.
- Affiliate self-referral: identity-match (email/phone/device/payment details) between affiliate profile and customer.
- Click fraud: per-affiliate click velocity, conversion-rate outliers (<x% or >y%), bot signatures.
- Recharge fraud: receipt image + amount + sender number must match request; approval requires SUPER_ADMIN permission + audit trail; duplicate reference numbers unique-constrained.
- Unauthorized admin actions: every admin mutation requires permission + writes audit log; privileged actions (recharge approve, adjustment, role change) require reason text.

## 16. API Architecture (Revision 2)

Versioned under `/api/v1`. Namespaces (not implemented yet):

`auth, admin, me/stores|products|orders|customers|network/affiliates|merchants|programs|commissions|wallet|billing, portal/* (affiliate & merchant self-service), t/[code] (click), webhook-ready`

All `/me/*` routes resolve the tenant from the session (`session.userId`) — user IDs in
URLs are never trusted. Conventions: Zod validation at boundary; envelope
`{data|error:{code,message,details}}`; cursor pagination (`?cursor=&limit≤100`);
Idempotency-Key header required on POST /orders and wallet mutations; errors mapped
RFC-7807-ish; OpenAPI generated from zod later.

## 17. Store Architecture (Revision 2)

USER → Store(s) → Products → Variants → Inventory (movements log, reserved-on-cart with
TTL) → Customer → Cart → Order. A User may own MULTIPLE stores; all belong to the same
account and share the User platform wallet. Public storefront routes are store-scoped by
slug/domain: `/s/{slug}/product/{id}?ref=AFF102`; custom domains map in Phase 11. Checkout
is server-driven (cart signature), COD-first for Egypt (Phase 9 adds gateways).

### 17.1 Affiliate Network Architecture (new)

USER → Affiliate Network(s) → subordinate entities:
- **Affiliates/Marketers**: registered/approved by the User; get portal logins, links, clicks.
- **Network Merchants**: registered by the User inside their network; subordinate, not tenants.
The network has its own programs/commission rules per product or merchant. Attribution
(§13) works identically whether traffic lands on the User's own storefront products or a
network merchant's offerings — orders always resolve back to exactly one owning User.

## 18. Deployment Architecture

Start: 1 VPS, Docker Compose — `app` (Next standalone), `worker`, `postgres`, `redis`,
`caddy` (auto-TLS reverse proxy). Environments:

- **dev**: local PG in Docker, seed fixtures, `.env.local`.
- **staging**: same compose on cheap VPS, isolated DB, test payment flows.
- **prod**: hardened VPS, secrets only via environment, automated nightly pg_dump + WAL archive to R2 (see §21), blue-green via second container + caddy switch.

CI (GitHub Actions): typecheck → lint → unit/integration (PG service container) → build → migrate check.

## 19. Testing Strategy

Pyramid: unit (domain logic, state machines, money math) → integration (API + real PG via
testcontainers, tenant-isolation suite: "User A can NEVER read B's X" enumerated for every
entity) → financial invariants suite (ledger sum == balance; no fee on undelivered; exactly
one fee event per delivered order; clawback correctness — sacred tests) → concurrency tests
(parallel wallet ops, parallel deliveries) → E2E Playwright happy paths. Coverage gates on
`modules/{wallet,commissions,billing}` ≥ 90%.

## 20. Observability

pino JSON logs with requestId/merchantId correlation → Loki (later); Sentry for exceptions;
health endpoints `/api/health/live|ready`; metrics (Prometheus later): orders/min, delivery
rate, fee postings, queue depth, wallet-negative count. Alerts: queue stuck, DB disk >80%,
negative wallets, ledger-chain verification failure.

## 21. Backup & DR

Nightly `pg_dump` + continuous WAL archiving to R2 (PITR), 30-day retention; weekly restore
drill into scratch DB (automated, asserts row counts + ledger invariant). RPO ≤ 5min, RTO ≤ 2h
documented runbook.

## 22. Scalability Strategy

To 1K merchants / millions of orders on the monolith+PG design:
- Tenant-first composite indexes keep queries O(tenant); hot tables (orders, ledger,
  clicks) get monthly RANGE partitions on created_at when > ~50M rows (non-breaking).
- Read replicas for analytics; heavy dashboards served from materialized rollup tables
  refreshed by worker, not live aggregates.
- Click ingestion is fire-and-forget → Redis queue → worker batch insert (absorbs spikes).
- Stateless app → scale horizontally behind caddy/ALB; Redis + BullMQ scale independently;
  worker shards queues by userId.
- Later splits (clean seams already exist): extract worker fleet, then commission/billing
  service if ever needed. DB-per-big-tenant export path documented.

## 23. Infrastructure Requirements

Initial prod: 4 vCPU / 8 GB VPS (app+worker), 2 vCPU/4GB managed-or-self PG with NVMe, Redis 1GB, R2 bucket, domain + Cloudflare. Dev: developer laptops + Docker.

## 24. Estimated Initial Running Costs

| Item | Monthly |
|---|---|
| Prod VPS (8GB) | ~$15 |
| Staging VPS (4GB) | ~$8 |
| Backups/storage R2 (~200GB) | ~$1–3 |
| Domain + Cloudflare | ~$1–2 |
| Sentry free tier / UptimeRobot free | $0 |
| Email (Resend free tier) | $0 |
| **Total** | **≈ $25–30/mo** |

## 25. Risks

1. Manual recharge verification doesn't scale past ~50 merchants → plan gateway integration (Phase 9).
2. Post-PAID_BY_USER clawbacks are unenforceable by the platform (money is outside) → surfaced as User-side negative adjustments + report; recovery is the User's affair. Mitigation option: configurable return window after which clawback entries stop being generated.
3. Concurrent-agent/process edits (known workspace hazard) → new isolated repo mandated.
4. Single-VPS blast radius → documented upgrade path; backups tested.
5. Fraud rules false positives harming legit affiliates → flag-first, human review.
6. Fee-debt accumulation if merchants go insolvent → floor + BLOCK behavior option.
7. Users disputing commission calculations rely entirely on platform math → immutable snapshots (§13) + append-corrected ledger are the evidence trail. The platform does NOT mediate User↔affiliate/merchant financial disputes.

## 26. Architectural Tradeoffs

- Monolith vs microservices: chose modular monolith (speed, ACID across modules) accepting later extraction cost.
- Shared-schema vs schema-per-tenant: isolation depth traded for operability; RLS compensates.
- Manual reconciliation vs auto gateways: cost now vs friction later; abstraction keeps WalletService agnostic.
- Last-click vs first-click attribution: last-click chosen (industry standard), configurable.
- Ledger posting only completed facts vs pending entries: simpler invariants; pending state lives in domain tables (recharge_requests).
- Tracking commissions without custodying them: holding affiliate money would create liability/regulatory exposure for the platform; recording User-confirmed PAID_BY_USER statuses gives operational visibility while money flows stay outside — accepted tradeoff is weaker guarantees around post-paid returns.

## 27. Phase-by-Phase Implementation Plan

| Phase | Deliverable | Highlights |
|---|---|---|
| 0 | This blueprint | approval gate |
| 1 | Repo scaffold, PG, Auth.js v5, users/roles/sessions (USER + SUPER_ADMIN), tenant middleware on user_id + RLS, audit_logs | isolation tests from day one |
| 2 | User onboarding, stores (multi-store), products, variants, inventory | soft deletes, media to R2 |
| 3 | Affiliate networks, subordinate merchants/affiliates, links, click ingest, attribution tokens, fraud flags | signed click tokens, last-click |
| 4 | Orders + state machine + commission engine (PAID_BY_USER) + ownership/attribution snapshots | idempotent order creation, concurrency suite |
| 5 | User platform wallet, hash-chain ledger, recharge workflow, SaaS billing engine (fee per delivered order, both sources) | financial invariant tests sacred; NO affiliate wallet/payouts |
| 6 | Super Admin console + analytics rollups | revenue, debts, tops |
| 7 | Public storefronts + checkout (COD) | ref tracking live end-to-end |
| 8 | Shipping integrations (Bosta/Aramex adapters) | webhook state sync into order machine |
| 9 | Payment gateways (Paymob/Fawry) auto-recharge | replaces manual flow |
| 10 | WhatsApp notifications + automation + AI assist | via worker queues |
| 11 | White label, custom domains, theming | domain verify + TLS automation |

## 28. Open Questions

1. Confirm fee timing = on DELIVERED (recommended) or on SHIPPED?
2. ~~Payout hold window~~ OBSOLETE — replaced by: configurable return window after which post-PAID_BY_USER clawback entries stop being generated?
3. Insufficient-balance default: ACCUMULATE_DEBT (recommended) or BLOCK_NEW_ORDERS?
4. Can one User own multiple affiliate NETWORKS, or exactly one network per account? (assumed one, multiple stores)
5. Affiliate commission model: percentage, flat-per-order, or both? Set per network/product/merchant? (assumed flexible rules per program)
6. Returns policy window after delivery that allows clawback? (recommend 14 days)
7. Language/UI: Arabic RTL first with EN toggle? (assumed Arabic-first)
8. Do CUSTOMER accounts need logins, or guest COD checkout with phone identity?
9. Should Users be able to export commission statements (CSV/PDF) for their external affiliate payroll? (assumed yes, trivial)
10. Do Users want optional notifications TO affiliates/merchants (e.g. "commission marked paid")? Platform stays message-carrier, never money-mover.
11. When a network Merchant or Affiliate is "promoted" to an independent platform User (§6.1), what happens to their historical records in the original User's workspace — shared read-only history or duplicated? (needs decision; pointer design supports either)

---

## 29. Revision 1 Change Log — Business Model Correction

### 29.1 Changed Sections

| Section | Change |
|---|---|
| Header | Revision banner added |
| §1 Executive Summary | Platform repositioned as pure SaaS provider; merchant owns the affiliate commercial relationship; platform fee charged to merchant only |
| §7 RBAC | AFFILIATE portal-only semantics; MERCHANT owns program decisions; SUPER_ADMIN excluded from commercial decisions |
| §9 Commission State Machine | `PAID → CLAWBACK_PENDING` removed; `PAID` redefined as merchant's external-payment confirmation; post-PAID returns produce compensating report entries only |
| §10 Wallet Architecture | Scoped to single Merchant Platform Wallet; ledger txn_type list reduced (payout types removed) |
| §14 Security Threat Model | Added: fake PAID confirmations, cross-program affiliate data leakage |
| §25 Risks | Replaced payout-clawback risk with unenforceable-post-PAID-clawback risk; added commission-dispute evidence risk |
| §26 Tradeoffs | Added "tracking without custodying" tradeoff |
| §27 Roadmap | Phase 5 clarified; all affiliate-financial work deleted from every phase |
| §28 Open Questions | Q2 obsoleted/replaced; Q9–Q10 added |

### 29.2 Removed Components

- ❌ Affiliate wallet / affiliate balances
- ❌ Affiliate withdrawal system & withdrawal state machine
- ❌ Affiliate payout gateway / payment processing
- ❌ Payout hold windows & platform-managed affiliate debt (`CLAWBACK_PENDING`)
- ❌ Any platform percentage/share of affiliate commissions
- ❌ PAYOUT / PAYOUT_REVERSAL ledger transaction types
- ❌ Platform responsibility for merchant–affiliate contracts, recruitment, fulfillment, customer service

### 29.3 Business Responsibility Boundaries

```
Platform Owner (SaaS provider): infrastructure, tenancy, security, tenant isolation,
    stores/products/inventory tools, affiliate-program infrastructure, links,
    click tracking, attribution, commission CALCULATION, order management,
    merchant platform wallet, SaaS billing, analytics
Merchant: recruiting/approving affiliates, commission RULES, communication,
    paying affiliates EXTERNALLY, fulfillment, customer service, marking PAID
Affiliate: promotion only; read-only performance/commission visibility
Customers/Orders: belong to the merchant
Platform revenue = 1 EGP per DELIVERED order from the MERCHANT. Nothing else.
```

### 29.4 Data Model Implications

- `wallet_accounts` stays merchant-scoped only; no owner polymorphism needed.
- `wallet_ledger_entries.txn_type`: `RECHARGE | PLATFORM_FEE | FEE_REVERSAL | ADJUSTMENT`.
- `commissions` gains: `paid_at`, `paid_by`, `external_payment_ref` (nullable) — set only via
  merchant action; plus `reversal_of_commission_id` self-FK for append-corrected reversals.
- New `commission_status_events` history table mirrors `order_status_events`
  (from, to, actor, reason, at) — merchant PAID confirmations become auditable facts.
- NO `withdrawals`, NO `affiliate_wallets`, NO `payout_batches` tables in MVP scope.
- Affiliate-facing aggregates computed from `commissions` only (read paths).

### 29.5 Security Implications

- Smaller attack surface: no money-out path for affiliates ⇒ payout-fraud class eliminated.
- New authorization rule: `commissions.mark_paid` ∈ {MERCHANT_OWNER, MERCHANT_STAFF};
  SUPER_ADMIN explicitly denied (separation of SaaS ops from merchant commerce).
- Affiliate endpoints filter strictly on `(merchantId, affiliateId)` — added to the Phase-1
  tenant-isolation test matrix.
- PAID confirmations are immutable audit events (actor, timestamp, external ref), giving
  merchants dispute-proof internal records.

### 29.6 Updated Implementation Roadmap Impact

- Phase 4: commission engine writes merchant-owned accounting records only;
  adds `mark_paid` endpoint + audit events.
- Phase 5: scope unchanged minus anything affiliate-financial (smaller than before).
- Phase 6 admin console: no affiliate-payout screens; recharge approvals remain.
- Phases 8–11 unchanged. Future payout gateways (if ever wanted) become an opt-in
  Phase 12+ extension requiring explicit approval — NOT current scope.
- Return handling confirmed: delivered→returned reverses BOTH the affiliate commission
  (compensating commission entry) and the 1 EGP platform fee (FEE_REVERSAL ledger credit).

### 29.7 Remaining Business Decisions (carried from §28)

1. Return/clawback window policy (recommend 14 days; decide whether post-PAID reversals are always recorded or window-limited).
2. Insufficient-balance default behavior (ACCUMULATE_DEBT vs BLOCK_NEW_ORDERS).
3. Multi-store-per-merchant with shared wallet — confirm.
4. Commission model shapes (percentage/flat/both per program/product).
5. Arabic-first UI confirmation.
6. Customer auth model (guest COD vs accounts).

---

## 30. Revision 2 Change Log — FINAL Business Model (USER as primary tenant)

### A. FINAL BUSINESS MODEL

Platform Owner = Super Admin = SaaS provider ONLY. Primary customer/tenant =
**USER / ACCOUNT OWNER**. Each User owns an isolated workspace and may operate
two independent capabilities: their own STORE and/or their own AFFILIATE NETWORK
(with subordinate Merchants & Affiliates). The platform never holds or moves anyone's
business money and never mediates disputes. Revenue = 1 EGP per DELIVERED order,
charged to the owning USER (configurable, default billing event DELIVERED).

### B. ENTITY HIERARCHY

```
SUPER ADMIN
    ↓
USER / ACCOUNT OWNER          ← primary tenant; owns wallet + workspace
    ├── STORE 1..N → Products → Customers → Orders
    └── AFFILIATE NETWORK
         ├── Merchants   (subordinate, not tenants)
         ├── Affiliates/Marketers (subordinate, portal logins)
         └── Orders (attributed)
```

### C. OWNERSHIP MODEL

| Entity | Owned by |
|---|---|
| Stores, products, customers, store orders | USER |
| Affiliate network, its merchants/affiliates/links/clicks | USER |
| Commission records | USER (accounting visibility; PAID_BY_USER = external-payment confirmation) |
| Platform wallet & recharge requests | USER (one shared wallet across stores + network) |
| Platform fee events | attributable to exactly ONE user per order |
| Merchants/Affiliates | subordinate to the User; promotable to full Users later via `promoted_user_id` (§6.1) |

### D. PLATFORM REVENUE MODEL

- Fee per DELIVERED order — source STORE **or** AFFILIATE_NETWORK both count
  (User A example: 100 store + 500 network delivered orders = 600 EGP).
- Configurable by Super Admin: amount (default 1.00), billing event (DELIVERED),
  low-balance threshold, min balance, insufficient-funds behavior.
- Exactly one fee event per delivered order (`platform_fee_events.order_id UNIQUE`
  + idempotency); returned orders get FEE_REVERSAL compensating ledger entry.
- Never charged to affiliates/merchants unless they are independent Users.

### E. UPDATED DATABASE MODEL

- Tenant discriminator renamed `merchant_id` → `user_id` in ALL business tables
  (stores, products, customers, carts, orders, networks, merchants, affiliates,
  links, clicks, commissions, wallets, ledger, recharges).
- NEW: `affiliate_networks(id, user_id, name, settings…)` root entity.
- RENAMED/SCOPED: `affiliate_programs` → programs under a network;
  `network_merchants(user_id, network_id, …)` replaces tenant-"merchants".
- `wallet_accounts.user_id UNIQUE` (was merchant_id); ledger carries `user_id`.
- `order_attribution` extended with ownership snapshot: `user_id, source_type
  ('STORE'|'AFFILIATE_NETWORK'), store_id?, network_id?, network_merchant_id?, affiliate_id?`.
- `commissions`: status enum gains `PAID_BY_USER` (+ paid_by/paid_at/external_payment_ref,
  reversal_of_commission_id self-FK) — no payout tables.
- RLS policies switch to `current_setting('app.user_id')`.

### F. SECURITY BOUNDARIES

1. **Primary boundary**: User A can NEVER access User B data — enforced at query layer
   (`TenantScope` on userId), DB RLS, API middleware.
2. Portal roles (AFFILIATE_PORTAL / MERCHANT_PORTAL) see only their own rows inside
   their User's network, scoped `(user_id, entity_id)`.
3. SUPER_ADMIN sees infrastructure/billing only — never User commercial decisions;
   cannot mark commissions paid.
4. Anti-IDOR composite fetch `(id, userId)` everywhere; click tokens bound to
   User+store/network; duplicate fee billing blocked by unique constraint.

### G. REMOVED COMPONENTS (cumulative through Rev 2)

- ❌ Merchant-as-primary-tenant model (replaced by User-as-primary-tenant)
- ❌ Affiliate wallets / withdrawals / payouts / payout holds / affiliate debt
- ❌ PAYOUT ledger txn types
- ❌ Any platform share of commissions or sales revenue
- ❌ Platform responsibility for User↔Merchant↔Affiliate financial relationships/disputes
- ❌ Direct fee charging of affiliates/merchants (unless independent Users)

### H. REMAINING BUSINESS QUESTIONS

See §28 (Q1–Q11). Most critical new ones:
- Q4: one network per account or multiple?
- Q11: history handling when a subordinate merchant/affiliate is promoted to an
  independent User.
- Q2/Q6: clawback window policy.

### I. IMPLEMENTATION PHASES

Unchanged 11-phase roadmap (§27) with Revision 2 wording: Phase 1 seeds USER +
SUPER_ADMIN roles and user_id-based tenancy; Phase 2 multi-store onboarding;
Phase 3 affiliate networks with subordinate entities; Phase 4 commission engine
with PAID_BY_USER + ownership snapshots; Phase 5 User platform wallet & SaaS billing
across both order sources. No phase includes affiliate financial custody.

---
**END OF PHASE 0 REPORT — awaiting approval before any implementation.**
