# Repayo — MSME Loan Repayment Service

An MSME loan repayment service and live portfolio tracker built with **Next.js (JavaScript only)**, **PostgreSQL (Prisma)**, **Firebase Auth**, and **Redis (Upstash)**.

Deployed link: `https://repayo.vercel.app` *(or your Vercel deployment URL)*  
Test Reviewer Account: `reviewer@vitto.money` / `Vitto@2026!`

---

## 1. Seeded Loans

The database is seeded with 4 distinct loans matching the specification:

| Loan ID | Type | Principal | Rate & Tenure | Status / Condition |
|---|---|---|---|---|
| `11111111-1111-4111-8111-111111111111` | Healthy Active | ₹2,00,000 | 18% p.a., 24 mos | 2 instalments paid on time, 0 overdue |
| `22222222-2222-4222-8222-222222222222` | **Overdue (Required)** | ₹1,50,000 | 16% p.a., 12 mos | Disbursed 45 days ago; 1st instalment unpaid and **overdue** (11+ days) |
| `33333333-3333-4333-8333-333333333333` | Partially Paid | ₹1,00,000 | 15% p.a., 12 mos | Partial collection of ₹5,000 applied (interest cleared, principal remaining) |
| `44444444-4444-4444-8444-444444444444` | Fully Settled | ₹50,000 | 12% p.a., 3 mos | All instalments settled; outstanding is ₹0.00 |

*Deterministic time queries: Any endpoint supports `?asOf=YYYY-MM-DD` (defaults to today in IST).*

---

## 2. Key Architecture Decisions

### 2.1 Money Type: Exact Integer Paise (`Int`)
* Stored as `Int` paise in PostgreSQL (e.g. ₹9,986.00 is `998600`).
* No floating-point numbers cross the API or persist in the database.
* Rupee formatting (`₹`) with Indian numbering system (lakhs) is strictly a UI edge concern (`Intl.NumberFormat('en-IN')`).

### 2.2 EMI Calculation & Rounding Absorption
* Monthly rate $r = \text{annualRatePct} / 1200$.
* Equal Monthly Instalment:
  $$\text{EMI} = P \times r \times \frac{(1+r)^n}{(1+r)^n - 1}$$
* Calculated using `decimal.js` with half-up rounding.
* **Invariant:** Final instalment absorbs all rounding remainder:
  $$\sum \text{principal}_k \equiv \text{principalPaise}, \quad \text{outstanding}_n = 0$$
* Reference verification: ₹2,00,000 at 18% for 24 months yields ₹9,986/month (within ±₹2).

### 2.3 Payment Allocation Order
1. **Oldest instalment first** (by `seq`).
2. Within an instalment, **interest is settled before principal**.
3. **Excess payment rolls forward** to subsequent open instalments; schedule remains immutable.
4. Payments exceeding total outstanding balance are **rejected with `422 OVERPAYMENT_EXCEEDS_OUTSTANDING`**.
5. Payments on settled loans are **rejected with `422 LOAN_ALREADY_SETTLED`**.

### 2.4 Concurrency & Idempotency
* Writes are guarded by `SELECT ... FOR UPDATE` row locks on the loan to serialize payments per loan.
* Every payment write requires an `Idempotency-Key` header with canonical SHA-256 `request_hash`. Replays return the original response with `Idempotent-Replay: true`. Different payloads on the same key return `409 IDEMPOTENCY_KEY_REUSED`.

### 2.5 Fail-Open Redis Caching
* Loan positions are cached by version: `loan:{loanId}:v{ver}:asOf:{date}`.
* Write operations run `INCR loan:{loanId}:ver`.
* Cache is fail-open: any Redis downtime falls back to PostgreSQL seamlessly.

---

## 3. API Reference

All responses follow uniform envelopes:
* Success: `{ "ok": true, "data": { ... } }`
* Error: `{ "ok": false, "error": { "code": "...", "message": "...", "details": [...] } }`

| Method | Path | Headers | Description |
|---|---|---|---|
| `POST` | `/api/loans` | `Authorization: Bearer <token>` | Create loan & amortization schedule |
| `GET` | `/api/loans/:id?asOf=YYYY-MM-DD` | `Authorization: Bearer <token>` | Get schedule & live position |
| `POST` | `/api/loans/:id/payments` | `Authorization: Bearer <token>`, `Idempotency-Key: <uuid>` | Record & allocate payment |

---

## 4. Local Setup & Testing

### Prerequisites
* Node.js v20+ / v22+
* PostgreSQL database

### Installation
```bash
# 1. Clone repository
git clone <repo-url>
cd Repayo

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Set DATABASE_URL and Firebase variables in .env.local

# 4. Generate Prisma & run migrations
npx prisma generate
npm run db:setup

# 5. Run test suite (Jest in JS)
npm test

# 6. Start development server
npm run dev
```

---

## 5. Hosting & Deployment

* **Host:** Vercel (Next.js App Router route handlers)
* **Database:** Hosted PostgreSQL (Neon / Supabase)
* **Auth:** Firebase Authentication (server-side ID token verification via `firebase-admin`)
* **Cache:** Upstash Redis (fail-open)
