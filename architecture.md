# Loan Repayment Service: Architecture

A Next.js (JavaScript only) application that generates an MSME loan repayment schedule, records payments against it, and reports the live position of the loan.

**Stack:** Next.js (App Router, route handlers) · React · Prisma · PostgreSQL (Neon/Supabase) · Firebase Auth · Redis (Upstash) · GitHub Actions · Vercel

---

## 1. Goals and guiding principles

| Principle | What it means in this codebase |
|---|---|
| **Money is exact** | All amounts are stored as **integer paise** (`Int`). No floats are stored, and none cross the API boundary. ₹9,986.00 is `998600`. |
| **Logic is pure** | Schedule generation and payment allocation are **pure functions** with no DB, no Redis and no `Date.now()`. They are trivial to unit test. |
| **The DB is the last line of defence** | Foreign keys, `CHECK` constraints and unique indexes enforce the invariants even if app code is wrong. |
| **Cache is an optimisation, never a source of truth** | Redis is fail-open. If Redis is down, the app still returns correct data from Postgres. |
| **Every write is idempotent and serialised** | An `Idempotency-Key` plus a row lock on the loan means double-submits and races cannot corrupt the loan. |
| **One error shape everywhere** | All three endpoints return the same success envelope and the same error envelope. |

---

## 2. High-level architecture

```mermaid
flowchart LR
    subgraph Client["Browser (React, one page)"]
        UI["Loan Page<br/>schedule table, position, pay form"]
        FBC["Firebase Client SDK<br/>sign-in / sign-out / getIdToken"]
    end

    subgraph Vercel["Next.js on Vercel"]
        MW["Route Handler wrapper<br/>withAuth, validate, error mapper"]
        R1["POST /api/loans"]
        R2["GET /api/loans/:id"]
        R3["POST /api/loans/:id/payments"]
        SVC["Service layer<br/>loanService, paymentService"]
        CORE["Core domain (pure)<br/>schedule.js, allocate.js, position.js"]
        CACHE["cache.js<br/>Redis wrapper, fail-open"]
        PRISMA["Prisma Client"]
    end

    FBA["Firebase Auth<br/>(Google identity)"]
    REDIS[("Redis<br/>Upstash")]
    PG[("PostgreSQL<br/>Neon / Supabase")]

    UI --> FBC
    FBC <--> FBA
    UI -- "Bearer ID token" --> MW
    MW -- "verifyIdToken (firebase-admin)" --> FBA
    MW --> R1 & R2 & R3
    R1 & R2 & R3 --> SVC
    SVC --> CORE
    SVC --> CACHE
    SVC --> PRISMA
    CACHE <--> REDIS
    PRISMA <--> PG
```

### Layer responsibilities

| Layer | Folder | Responsibility | Must not |
|---|---|---|---|
| **Route handlers** | `app/api/**/route.js` | HTTP only: parse, call wrapper, return envelope | contain business rules |
| **HTTP helpers** | `lib/http/` | `withAuth`, `validate`, `respond`, `AppError` mapping | touch the DB |
| **Service layer** | `lib/services/` | Orchestrates: transaction, locking, cache, persistence | do money maths itself |
| **Core domain** | `lib/core/` | EMI, schedule, allocation, position | import Prisma, Redis or Firebase |
| **Infra** | `lib/db.js`, `lib/cache.js`, `lib/firebaseAdmin.js` | Singletons and adapters | contain domain logic |
| **UI** | `app/page.js`, `components/` | Rendering and interaction | compute money (display only) |

---

## 3. Repository structure

```
.
├── app/
│   ├── layout.js
│   ├── page.js                       # the single page (auth-gated)
│   ├── globals.css                   # design tokens (colors, type, spacing)
│   └── api/
│       └── loans/
│           ├── route.js              # POST create loan
│           └── [id]/
│               ├── route.js          # GET loan + position
│               └── payments/
│                   └── route.js      # POST record payment
├── components/
│   ├── AuthGate.js                   # redirects unauthenticated users to sign-in
│   ├── SignInCard.js
│   ├── LoanSelector.js
│   ├── PositionCards.js              # outstanding, next due, overdue
│   ├── ScheduleTable.js
│   ├── PaymentForm.js
│   └── Toast.js
├── lib/
│   ├── core/
│   │   ├── money.js                  # toPaise, formatINR, helpers
│   │   ├── emi.js                    # EMI calculation (decimal.js)
│   │   ├── schedule.js               # generateSchedule()
│   │   ├── allocate.js               # allocatePayment()
│   │   └── position.js               # computePosition()
│   ├── services/
│   │   ├── loanService.js
│   │   └── paymentService.js
│   ├── http/
│   │   ├── withAuth.js
│   │   ├── validate.js
│   │   └── errors.js
│   ├── db.js                         # Prisma singleton
│   ├── cache.js                      # Redis wrapper
│   ├── firebaseAdmin.js              # server-side token verification
│   └── firebaseClient.js             # client SDK init
├── prisma/
│   ├── schema.prisma
│   ├── migrations/                   # includes raw SQL CHECK constraints
│   └── seed.js
├── tests/
│   ├── unit/
│   │   ├── schedule.test.js
│   │   └── allocate.test.js
│   └── integration/
│       └── api.test.js
├── .github/workflows/ci.yml
├── .env.example
├── jsconfig.json                     # JS only, no tsconfig
├── package.json
└── README.md                         # one page, as required
```

> **JavaScript only:** no `.ts`, `.tsx` or `tsconfig.json`. Use `jsconfig.json` for path aliases. Pin Prisma to a 6.x release so no TypeScript config file is needed. Prisma 7 generates a `prisma.config.ts` by default, so if you use 7, write the config as `prisma.config.js` instead.

---

## 4. Data model

### 4.1 Money type decision

**Integer paise (`Int`)**, mapped to Postgres `INTEGER`.

- Maximum amount is ₹10,00,000 principal plus interest, which is roughly 1.5×10⁸ paise. This is far below the `Int` limit of 2.1×10⁹.
- Integers are exact, fast, and need no Decimal serialisation.
- Rates are stored as `NUMERIC(6,3)` (for example `18.000`) and are only used inside `decimal.js` during schedule generation.
- Conversion to rupees happens **only at the UI edge** (`formatINR`).

### 4.2 ER diagram

```mermaid
erDiagram
    LOAN ||--|{ INSTALMENT : "has schedule"
    LOAN ||--o{ PAYMENT : "receives"
    PAYMENT ||--|{ ALLOCATION : "split into"
    INSTALMENT ||--o{ ALLOCATION : "settled by"

    LOAN {
        uuid id PK
        int principal_paise "CHECK > 0"
        numeric annual_rate_pct "NUMERIC(6,3), CHECK >= 0"
        int tenure_months "CHECK 3..36"
        date disbursement_date
        int emi_paise
        int total_payable_paise
        timestamptz created_at
    }

    INSTALMENT {
        uuid id PK
        uuid loan_id FK
        int seq "1..n, UNIQUE with loan_id"
        date due_date
        int principal_paise
        int interest_paise
        int total_due_paise "= principal + interest"
    }

    PAYMENT {
        uuid id PK
        uuid loan_id FK "ON DELETE RESTRICT, NOT NULL"
        int amount_paise "CHECK > 0"
        date paid_on
        text idempotency_key "UNIQUE with loan_id"
        text request_hash
        timestamptz created_at
    }

    ALLOCATION {
        uuid id PK
        uuid payment_id FK
        uuid instalment_id FK
        int interest_paid_paise "CHECK >= 0"
        int principal_paid_paise "CHECK >= 0"
    }
```

### 4.3 Prisma schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Loan {
  id                String   @id @default(uuid()) @db.Uuid
  principalPaise    Int      @map("principal_paise")
  annualRatePct     Decimal  @map("annual_rate_pct") @db.Decimal(6, 3)
  tenureMonths      Int      @map("tenure_months")
  disbursementDate  DateTime @map("disbursement_date") @db.Date
  emiPaise          Int      @map("emi_paise")
  totalPayablePaise Int      @map("total_payable_paise")
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz
  instalments       Instalment[]
  payments          Payment[]

  @@map("loans")
}

model Instalment {
  id            String   @id @default(uuid()) @db.Uuid
  loanId        String   @map("loan_id") @db.Uuid
  seq           Int
  dueDate       DateTime @map("due_date") @db.Date
  principalPaise Int     @map("principal_paise")
  interestPaise  Int     @map("interest_paise")
  totalDuePaise  Int     @map("total_due_paise")
  loan          Loan     @relation(fields: [loanId], references: [id], onDelete: Restrict)
  allocations   Allocation[]

  @@unique([loanId, seq])
  @@index([loanId, dueDate])
  @@map("instalments")
}

model Payment {
  id             String   @id @default(uuid()) @db.Uuid
  loanId         String   @map("loan_id") @db.Uuid
  amountPaise    Int      @map("amount_paise")
  paidOn         DateTime @map("paid_on") @db.Date
  idempotencyKey String   @map("idempotency_key")
  requestHash    String   @map("request_hash")
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz
  loan           Loan     @relation(fields: [loanId], references: [id], onDelete: Restrict)
  allocations    Allocation[]

  @@unique([loanId, idempotencyKey])
  @@index([loanId, paidOn])
  @@map("payments")
}

model Allocation {
  id                 String   @id @default(uuid()) @db.Uuid
  paymentId          String   @map("payment_id") @db.Uuid
  instalmentId       String   @map("instalment_id") @db.Uuid
  interestPaidPaise  Int      @map("interest_paid_paise")
  principalPaidPaise Int      @map("principal_paid_paise")
  payment            Payment    @relation(fields: [paymentId], references: [id], onDelete: Restrict)
  instalment         Instalment @relation(fields: [instalmentId], references: [id], onDelete: Restrict)

  @@index([instalmentId])
  @@map("allocations")
}
```

### 4.4 Constraints that Prisma cannot express

Add these in a hand-written migration (`prisma migrate dev --create-only`, then edit the SQL). They are the DB-level guarantees the brief asks for.

```sql
ALTER TABLE loans
  ADD CONSTRAINT loans_principal_range CHECK (principal_paise BETWEEN 5000000 AND 100000000),
  ADD CONSTRAINT loans_tenure_range    CHECK (tenure_months BETWEEN 3 AND 36),
  ADD CONSTRAINT loans_rate_nonneg     CHECK (annual_rate_pct >= 0);

ALTER TABLE instalments
  ADD CONSTRAINT inst_total_matches CHECK (total_due_paise = principal_paise + interest_paise),
  ADD CONSTRAINT inst_nonneg        CHECK (principal_paise >= 0 AND interest_paise >= 0);

ALTER TABLE payments
  ADD CONSTRAINT payments_amount_positive CHECK (amount_paise > 0);

ALTER TABLE allocations
  ADD CONSTRAINT alloc_nonneg CHECK (interest_paid_paise >= 0 AND principal_paid_paise >= 0);
```

`payments.loan_id` is `NOT NULL` with a foreign key to `loans(id)`, which satisfies "a payment cannot exist without a loan, enforced in the schema".

### 4.5 Schema creation (not manual)

- `package.json` script: `"db:setup": "prisma migrate deploy && node prisma/seed.js"`
- Vercel build command: `prisma generate && prisma migrate deploy && next build`
- CI runs `prisma migrate deploy` against the Postgres service container before the integration tests.

Prisma needs two connection strings on Neon or Supabase pooled setups:

- `DATABASE_URL` is the pooled connection used at runtime.
- `DIRECT_URL` is the direct connection used for migrations (`directUrl` in the datasource block).

---

## 5. The core domain (the part that is graded hardest)

All of this lives in `lib/core/` and is **pure**.

### 5.1 EMI and schedule generation

```
r   = annualRatePct / 12 / 100                 (Decimal)
EMI = P * r * (1+r)^n / ((1+r)^n - 1)          (Decimal, then round half-up to paise)
if r == 0:  EMI = P / n                         (handle 0% rate, avoids divide by zero)
```

Per instalment `k = 1..n`:

```
interest_k  = round_half_up(outstanding_{k-1} * r)         (integer paise)
principal_k = EMI - interest_k
outstanding_k = outstanding_{k-1} - principal_k

LAST instalment (k = n):
    principal_n = outstanding_{n-1}                         (absorbs all rounding remainder)
    interest_n  = round_half_up(outstanding_{n-1} * r)
    total_n     = principal_n + interest_n                  (may differ from EMI by a few paise)
```

**Invariants (each is asserted in a unit test):**

1. `sum(principal_k) === principalPaise`, exactly.
2. `outstanding_n === 0`.
3. `total_k === principal_k + interest_k` for every k.
4. Every instalment except the last equals `EMI`.
5. Verification case: ₹2,00,000, 18%, 24 months gives an EMI within ±₹2 of ₹9,986.

**Due dates:** instalment `k` is due on `disbursementDate + k months`, clamped to the last day of the month (31 Jan + 1 month = 28/29 Feb). Do this with explicit UTC date arithmetic. Never use local-timezone `Date` maths, because that causes off-by-one-day bugs between UTC and IST.

```mermaid
flowchart TD
    A["Input: principalPaise, annualRatePct, tenure, disbursementDate"] --> B["Validate ranges"]
    B --> C["r = rate / 1200 (Decimal)"]
    C --> D["EMI = formula, round half-up to paise"]
    D --> E["outstanding = principal"]
    E --> F{"k < n ?"}
    F -- yes --> G["interest = round(outstanding x r)<br/>principal = EMI - interest"]
    G --> H["outstanding -= principal<br/>dueDate = addMonths(disb, k)"]
    H --> F
    F -- "k = n (last)" --> I["principal = outstanding<br/>interest = round(outstanding x r)<br/>absorbs rounding remainder"]
    I --> J["Return instalments[] + emi + totalPayable"]
```

### 5.2 Payment allocation

**Documented allocation order (put this in the README):**

1. Instalments are settled **oldest first** (by `seq`).
2. Within an instalment, **interest is settled before principal**.
3. If a payment exceeds what is due on the oldest open instalment, the **excess rolls forward** to the next instalment(s) in order. It does **not** recalculate the schedule.
4. A payment larger than the **total outstanding** on the loan is **rejected** with `422 OVERPAYMENT_EXCEEDS_OUTSTANDING`. Prepayment closure is out of scope.

**Why roll-forward instead of reducing principal:** reducing principal would force a schedule recalculation (new interest figures and possibly a new EMI or tenure). That is effectively prepayment handling, which the brief puts out of scope. Roll-forward keeps the schedule immutable. This is a clean, explainable invariant.

**Function signature:**

```js
allocatePayment({
  instalments,   // [{ id, seq, dueDate, interestPaise, principalPaise, paidInterestPaise, paidPrincipalPaise }]
  amountPaise,   // integer > 0
}) => {
  allocations,   // [{ instalmentId, interestPaidPaise, principalPaidPaise }]
  unallocatedPaise // always 0 on success; function throws if amount > outstanding
}
```

```mermaid
flowchart TD
    A["amount = payment.amountPaise"] --> B["Load instalments ordered by seq<br/>with already-paid interest/principal"]
    B --> C{"amount > total outstanding?"}
    C -- yes --> X["Throw OVERPAYMENT_EXCEEDS_OUTSTANDING (422)"]
    C -- no --> D["Take next open instalment"]
    D --> E["interestDue = interest - paidInterest"]
    E --> F["payI = min(amount, interestDue)<br/>amount -= payI"]
    F --> G["principalDue = principal - paidPrincipal"]
    G --> H["payP = min(amount, principalDue)<br/>amount -= payP"]
    H --> I["Record allocation row"]
    I --> J{"amount > 0 ?"}
    J -- yes --> D
    J -- no --> K["Return allocations"]
```

### 5.3 How each required case behaves

| Case | Behaviour | Result |
|---|---|---|
| **Underpayment** (₹5,000 vs ₹9,986) | Interest is settled first, then principal for the remainder. The instalment stays open with `amountPaid = 5000`. | Remainder (₹4,986) stays due. It becomes **overdue** once `dueDate < asOf`. |
| **Overpayment** (2× EMI) | Instalment 1 is settled fully and the rest flows to instalment 2. | Two instalments paid. Schedule is unchanged. |
| **Late payment** (11 days late) | The payment is recorded with its real `paid_on` date. Position is computed **as of a date**. Between due date and payment date the instalment counted as overdue. | After the payment, overdue drops. **No penalty interest** (out of scope). |
| **Duplicate submission** | `Idempotency-Key` check (see §7). | The second request returns the **original** response. No second allocation row is written. |
| **Invalid input** | Validated before any DB work. | `400 VALIDATION_ERROR` with field details. Unknown loan gives `404 LOAN_NOT_FOUND`. |
| **Payment before disbursement date** | Rejected. | `422 PAYMENT_BEFORE_DISBURSEMENT` |
| **Future-dated payment** | Rejected (payment date later than today in IST). | `422 PAYMENT_IN_FUTURE` |
| **Loan already fully paid** | Rejected. | `422 LOAN_ALREADY_SETTLED` |
| **Payment exactly equals overdue amount** | Clears all overdue instalments, leaves future ones untouched. | Overdue becomes 0. |

### 5.4 Position computation

`computePosition({ instalments (with paid amounts), asOf })`:

```
paid_k            = paidInterest_k + paidPrincipal_k
remaining_k       = total_k - paid_k
outstandingPrincipal = sum(principal_k - paidPrincipal_k)
overdueAmount        = sum(remaining_k) for instalments where dueDate < asOf
nextDue              = first instalment where remaining_k > 0 and dueDate >= asOf
                       -> { dueDate, amount: remaining_k }
status               = SETTLED | OVERDUE | CURRENT
daysOverdue          = asOf - dueDate of the oldest overdue instalment
```

`asOf` defaults to **today in IST** and can be overridden with `?asOf=YYYY-MM-DD`. This makes tests and the demo deterministic.

---

## 6. API design

### 6.1 Envelopes (identical on all endpoints)

**Success**

```json
{ "ok": true, "data": { } }
```

**Error**

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "amountPaise", "issue": "must be a positive integer" }]
  }
}
```

### 6.2 Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/loans` | Bearer | Create loan and generate schedule |
| `GET` | `/api/loans/:id?asOf=YYYY-MM-DD` | Bearer | Schedule and current position |
| `POST` | `/api/loans/:id/payments` | Bearer + `Idempotency-Key` | Record and allocate a payment |

**Money on the wire:** amounts are exchanged as **integer paise** with a `Paise` suffix in field names, and the UI formats them. This avoids any float or string-decimal ambiguity. Document this in the README.

**POST `/api/loans` request**

```json
{
  "principalPaise": 20000000,
  "annualRatePct": 18,
  "tenureMonths": 24,
  "disbursementDate": "2026-09-01"
}
```

**GET `/api/loans/:id` response**

```json
{
  "ok": true,
  "data": {
    "loan": { "id": "…", "principalPaise": 20000000, "annualRatePct": "18.000",
              "tenureMonths": 24, "disbursementDate": "2026-09-01", "emiPaise": 998600 },
    "schedule": [
      { "seq": 1, "dueDate": "2026-10-01", "principalPaise": 698600, "interestPaise": 300000,
        "totalDuePaise": 998600, "amountPaidPaise": 500000, "status": "PARTIAL" }
    ],
    "position": {
      "asOf": "2026-10-12",
      "outstandingPrincipalPaise": 19501400,
      "overdueAmountPaise": 498600,
      "daysOverdue": 11,
      "nextDue": { "dueDate": "2026-11-01", "amountPaise": 998600 },
      "status": "OVERDUE"
    }
  }
}
```

**POST `/api/loans/:id/payments`**

Headers: `Authorization: Bearer <idToken>`, `Idempotency-Key: <uuid>`

```json
{ "amountPaise": 500000, "paidOn": "2026-10-12" }
```

Response: `201` with the payment, its allocations, and the **fresh loan view** (same shape as GET), so the UI can update without a second round trip. A replay returns `200` with the original body and the header `Idempotent-Replay: true`.

### 6.3 Error catalogue

| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Negative, zero or non-numeric amount; tenure not in 3 to 36; malformed date or UUID; missing idempotency key |
| 401 | `UNAUTHENTICATED` | Missing, invalid or expired token |
| 404 | `LOAN_NOT_FOUND` | Unknown loan id |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Same key, different request body |
| 422 | `PAYMENT_BEFORE_DISBURSEMENT` / `PAYMENT_IN_FUTURE` / `OVERPAYMENT_EXCEEDS_OUTSTANDING` / `LOAN_ALREADY_SETTLED` | Business rule violations |
| 500 | `INTERNAL_ERROR` | Unexpected. Log server-side, return a generic message |

A single `AppError(code, status, message, details)` class is thrown anywhere and mapped to the envelope in one place (`lib/http/errors.js`), which keeps responses consistent.

---

## 7. The payment write path (idempotency, locking, cache)

```mermaid
sequenceDiagram
    autonumber
    participant UI as React UI
    participant API as POST /payments
    participant FB as Firebase Admin
    participant SVC as paymentService
    participant PG as PostgreSQL
    participant RD as Redis

    UI->>API: amount, paidOn, Idempotency-Key (Bearer token)
    API->>FB: verifyIdToken(token)
    FB-->>API: decoded token or error
    alt token invalid
        API-->>UI: 401 UNAUTHENTICATED
    end
    API->>API: validate body and headers
    API->>SVC: recordPayment(loanId, input, key)
    SVC->>PG: BEGIN
    SVC->>PG: SELECT loan FOR UPDATE (serialises payments per loan)
    alt loan missing
        SVC-->>API: LOAN_NOT_FOUND (404)
    end
    SVC->>PG: find payment by (loanId, idempotencyKey)
    alt key exists
        alt request_hash matches
            SVC-->>API: original response (replay)
        else hash differs
            SVC-->>API: IDEMPOTENCY_KEY_REUSED (409)
        end
    end
    SVC->>PG: load instalments + sum of allocations
    SVC->>SVC: allocatePayment() (pure)
    SVC->>PG: INSERT payment + allocations
    SVC->>PG: COMMIT
    SVC->>RD: INCR loan:{id}:ver (invalidate)
    SVC->>PG: read fresh view (or compute from the data in hand)
    SVC->>RD: SET new cache entry
    SVC-->>API: payment + fresh loan view
    API-->>UI: 201 Created
    UI->>UI: update state in place (no refresh)
```

**Why these choices**

- **`SELECT … FOR UPDATE` on the loan row** serialises concurrent payments for the same loan, so two requests cannot both allocate against the same unpaid balance.
- **`UNIQUE (loan_id, idempotency_key)`** is the true duplicate guard. Even if two identical requests race past the lookup, one INSERT fails with a unique violation. Catch it and return the stored response.
- **`request_hash`** (SHA-256 of the canonical body) distinguishes a genuine retry from key misuse.
- The UI generates the key with `crypto.randomUUID()` **once per submit attempt**, and keeps it on retry after a network failure. A double-click sends the same key twice.
- Payment and allocation rows are written in **one transaction**. A failure leaves nothing partial.

---

## 8. Authentication (Firebase)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant UI as React (Firebase client SDK)
    participant FA as Firebase Auth
    participant API as Route handler
    participant ADM as firebase-admin

    U->>UI: Open page
    UI->>UI: onAuthStateChanged: no user
    UI-->>U: Show Sign-in card (AuthGate)
    U->>UI: Sign in (Google or email/password)
    UI->>FA: signIn
    FA-->>UI: user + ID token (1h lifetime)
    UI->>API: fetch with Authorization: Bearer idToken
    API->>ADM: verifyIdToken(idToken)
    ADM-->>API: decoded claims (uid, email)
    API-->>UI: data
    U->>UI: Click Sign out
    UI->>FA: signOut()
    UI-->>U: Back to Sign-in card
```

**Server side (`lib/http/withAuth.js`)**

- Reads `Authorization: Bearer <token>`.
- Calls `admin.auth().verifyIdToken(token)`. Any failure returns `401 UNAUTHENTICATED`.
- Wraps **all three** handlers, so no route can be added without auth by accident.
- Roles and per-user ownership are excluded by the brief, so only a valid signed-in user is required.

**Client side**

- The Firebase Web SDK handles sign-in with `onAuthStateChanged`.
- `AuthGate` renders the sign-in card when there is no user, and the loan page when there is one.
- `getIdToken()` is called per request (the SDK refreshes automatically), and is never stored by hand.
- A visible **Sign out** button calls `signOut()`.

**Secrets**

- `FIREBASE_ADMIN_*` variables are server-only. The private key is stored with escaped newlines and restored with `.replace(/\\n/g, '\n')`.
- `NEXT_PUBLIC_FIREBASE_*` variables are public by design (web config).
- Nothing is committed. `.env.example` lists every name.

---

## 9. Redis caching

**Purpose:** avoid recomputing and re-querying the same loan view repeatedly (the page polls or re-renders, and reviewers refresh).

**What is cached:** the assembled response of `GET /api/loans/:id` (loan, schedule, position), keyed per loan, per version and per `asOf` date.

```
key   = loan:{loanId}:v{version}:asOf:{YYYY-MM-DD}
ver   = loan:{loanId}:ver          (integer counter, INCR on every write)
TTL   = 60 seconds (safety net)
```

```mermaid
flowchart TD
    A["GET /api/loans/:id"] --> B["Auth OK, validate id"]
    B --> C["GET loan:{id}:ver from Redis<br/>(default 0)"]
    C --> D{"Cache HIT for<br/>loan:{id}:v{ver}:asOf:{date}?"}
    D -- yes --> E["Return cached JSON<br/>header: X-Cache: HIT"]
    D -- "no or Redis error" --> F["Query Postgres via Prisma"]
    F --> G["computePosition() (pure)"]
    G --> H["SET key with TTL 60s (best effort)"]
    H --> I["Return JSON<br/>header: X-Cache: MISS"]
```

**Invalidation:** versioned keys. A successful payment runs `INCR loan:{id}:ver`, so every old key becomes unreachable instantly and expires by TTL. This avoids `SCAN` and `DEL pattern`, which are slow and not atomic.

**Rules that keep it safe**

1. **Write path never reads from cache.** Allocation always uses fresh DB rows inside the transaction.
2. **Fail-open.** Every Redis call is wrapped in try/catch. On error, log and fall through to Postgres.
3. `asOf` is part of the key, because position depends on the date.
4. Do not cache error responses.
5. Optional second use: a simple **rate limit** on the payments endpoint (`INCR` with `EXPIRE`) per uid.

**Hosting:** Upstash Redis (HTTP/REST client `@upstash/redis`) works in serverless environments where TCP connection pooling is a problem. Locally and in CI you can run Redis in Docker, or disable caching with `REDIS_ENABLED=false`.

---

## 10. UI/UX design

### 10.1 Design workflow with Stitch MCP

1. Connect the Google **Stitch** MCP server to your coding agent (Claude Code or Antigravity).
2. Give Stitch a single brief covering the screen, tone and palette (prompt below). Generate a **desktop** and a **mobile** variant.
3. Review the variants and pick one. Ask for focused iterations ("make the overdue state calmer but unmistakable").
4. Pull the generated design and its HTML/CSS into the repo as a **reference only**.
5. Re-implement it as React components using the design tokens in §10.3. Do not paste raw generated markup unreviewed, because you must be able to explain all submitted code.

**Starter prompt for Stitch**

> Design a single-page fintech dashboard for an MSME loan repayment tracker, used by lending operations staff in India. Sections, top to bottom: header with product name and a sign-out button; a loan selector; three position cards (Outstanding principal, Next due, Overdue); a repayment schedule table with a status chip per instalment (Paid, Partial, Due, Overdue); and a "Record payment" panel with amount, date and a live preview of how the payment will be allocated. Tone: calm, trustworthy, precise. Indian rupee formatting with lakh separators (₹2,00,000). Palette: deep midnight indigo, warm paper background, jade for paid, saffron for due soon, coral for overdue, lavender as the single accent. Generous spacing, tabular numerals, soft 14px radii, no heavy borders. Include empty, loading, error and success states. Provide desktop and mobile layouts.

### 10.2 Page layout

```mermaid
flowchart TB
    subgraph Page["Single page"]
        H["Header: logo, user email, Sign out"]
        S["Loan selector + status chip"]
        subgraph Cards["Position cards"]
            C1["Outstanding principal"]
            C2["Next due: date and amount"]
            C3["Overdue: amount and days"]
        end
        subgraph Main["Main area"]
            T["Schedule table<br/>seq, due date, principal, interest, total, paid, status"]
            P["Payment panel<br/>amount, date, allocation preview, Pay"]
        end
        TO["Toasts: success, error"]
    end
    H --> S --> Cards --> Main
    P -. "on success: update state in place" .-> Cards
    P -. "on success" .-> T
```

On mobile, the payment panel becomes a **bottom sheet** opened from a sticky "Record payment" button, and the schedule table becomes a **card list** (one card per instalment) instead of a horizontally scrolling table.

### 10.3 Colour system: "Midnight Indigo + Jade + Saffron"

A palette that avoids the generic blue-and-green bank look. The deep indigo gives authority, the warm paper background reduces eye strain on a data-heavy screen, and each status colour has one job.

| Role | Token | Hex | Used for |
|---|---|---|---|
| Ink (primary) | `--ink-900` | `#0F1535` | Header, headings, primary buttons |
| Ink soft | `--ink-700` | `#2A3260` | Body text on light, hover states |
| Paper (background) | `--paper` | `#F7F4EE` | Page background |
| Surface | `--surface` | `#FFFFFF` | Cards, table |
| Line | `--line` | `#E6E1D6` | Hairline dividers |
| Accent (lavender) | `--accent` | `#8B7CF6` | Focus rings, links, selected row, the single accent |
| Jade | `--paid` | `#12B886` | Paid, success |
| Saffron | `--due` | `#F5A524` | Due soon, partial |
| Coral | `--overdue` | `#F0506E` | Overdue, errors |
| Muted text | `--muted` | `#6B7194` | Labels, secondary text |

Tints for chips (12% opacity backgrounds): `--paid-bg #E3F7F0`, `--due-bg #FDF1DB`, `--overdue-bg #FDE5EA`.

Dark mode: swap `--paper` to `#0B0F26`, `--surface` to `#141A3D`, `--line` to `#232A55`, and text to `#ECEBFF`. The status colours stay the same.

**Accessibility:** never rely on colour alone. Every status chip carries an icon and a text label ("Overdue · 11 days"). Check text contrast at WCAG AA (4.5:1) on every background.

### 10.4 Typography, spacing and components

- **Fonts:** *Inter* for UI, with `font-variant-numeric: tabular-nums` on every money cell so digits align in columns. Optionally *Fraunces* for the large position figures to give a distinctive, premium feel.
- **Scale:** 12 / 14 / 16 / 20 / 28 / 40. **Spacing:** 4-point grid. **Radius:** 14px cards, 10px inputs, 999px chips.
- **Currency display:** `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` applied to `paise / 100`. This gives lakh grouping (₹2,00,000.00). Display only, never used for calculation.

| Component | Behaviour |
|---|---|
| **PositionCards** | Three equal cards. The overdue card turns coral-tinted only when `overdue > 0`, otherwise a calm jade "All clear". |
| **ScheduleTable** | Sticky header, zebra-free (hairlines only), row status chip, partial rows show a thin progress bar (paid ÷ due). The next-due row has a lavender left rule. Overdue rows get a coral left rule. |
| **PaymentForm** | Amount input with ₹ prefix, a date input (defaults to today, max today), quick-fill chips ("Pay overdue", "Pay next EMI"), and a **live allocation preview** ("₹5,000: ₹3,000 interest, ₹2,000 principal on instalment #1"). The preview uses the same pure `allocatePayment` function client-side, for display only. The server is the authority. |
| **Feedback** | Button shows a spinner and is disabled while submitting (also protects against double-clicks). Success toast and the cards animate to the new values. Errors show the server `message` inline. |
| **States** | Skeleton loaders, empty state ("No loan selected"), error state with Retry, signed-out state. |

### 10.5 How the page updates without a refresh

```mermaid
sequenceDiagram
    participant U as User
    participant F as PaymentForm
    participant S as Page state
    participant A as API

    U->>F: Submit amount + date
    F->>F: Generate Idempotency-Key, disable button
    F->>A: POST /api/loans/:id/payments
    A-->>F: 201 { payment, allocations, loan view }
    F->>S: setLoanView(response.loanView)
    S-->>U: Cards, table rows and statuses re-render in place
    F->>F: Reset form, show success toast
```

Because the POST response already contains the fresh view, no second GET is needed. If you prefer a decoupled approach, use SWR or React Query and call `mutate(key, data, { revalidate: false })` with the response.

---

## 11. Testing strategy (about 12 tests)

Runner: **Vitest** (plain JS, fast) or Jest. Single command: `npm test`.

### Unit tests (pure functions, no DB)

| # | Test | Asserts |
|---|---|---|
| 1 | EMI reference case | ₹2,00,000 at 18% over 24 months gives EMI within ±200 paise of 998600 |
| 2 | Principal sums exactly | `sum(principal) === principalPaise` for several (P, rate, n) combinations |
| 3 | Final instalment absorbs rounding | Outstanding after the last instalment is exactly 0; the last total may differ from EMI by a few paise |
| 4 | Zero-rate loan and month-end dates | No divide-by-zero; 31 Jan + 1 month gives 28/29 Feb |
| 5 | Underpayment | ₹5,000 vs ₹9,986 settles interest first, leaves a remainder, and the instalment stays open |
| 6 | Overpayment roll-forward | 2× EMI settles instalments 1 and 2 and leaves the schedule untouched |
| 7 | Payment exceeding total outstanding | Throws `OVERPAYMENT_EXCEEDS_OUTSTANDING` |
| 8 | Position with a late payment | Overdue drops to 0 after the payment; the overdue amount is correct before it |
| 9 | Allocation conserves money | `sum(allocations) === amountPaise` (property-style check over random inputs) |

### Integration tests (real route handlers and a real Postgres, no mocks)

| # | Test | Asserts |
|---|---|---|
| 10 | Success path | Create loan, record payment, GET shows updated paid amount and position |
| 11 | Failure path | Negative amount gives 400; unknown loan gives 404; both use the standard error envelope |
| 12 | Unauthenticated | No token gives 401 on all three endpoints |
| 13 (bonus) | Duplicate submission | The same `Idempotency-Key` twice results in exactly one payment row |

**Testing auth for integration tests:** the brief forbids mocks for the database, but you need a way to authenticate. Two defensible options:

- Use the **Firebase Auth Emulator** in CI. It issues real-format tokens and `verifyIdToken` works against it when `FIREBASE_AUTH_EMULATOR_HOST` is set. This is the most faithful option.
- Or inject a test-only verifier behind `NODE_ENV === 'test'`. Document this clearly in the README and make sure the code path cannot be enabled in production.

Invoke route handlers directly by importing `POST`/`GET` from the route files and passing a standard `Request` object. No HTTP server is needed.

### CI (`.github/workflows/ci.yml`)

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: loans_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U test"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
      redis:
        image: redis:7
        ports: ["6379:6379"]
    env:
      DATABASE_URL: postgresql://test:test@localhost:5432/loans_test
      DIRECT_URL: postgresql://test:test@localhost:5432/loans_test
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm test
```

---

## 12. Deployment

```mermaid
flowchart LR
    DEV["git push"] --> GH["GitHub"]
    GH --> CI["GitHub Actions<br/>migrate + test"]
    GH --> VC["Vercel build<br/>prisma generate, migrate deploy, next build"]
    VC --> APP["Public URL"]
    APP --> NEON[("Neon Postgres<br/>(your link)")]
    APP --> UP[("Upstash Redis")]
    APP --> FBA["Firebase Auth"]
```

| Concern | Choice |
|---|---|
| Host | Vercel (free tier) |
| Database | Neon (pooled `DATABASE_URL`, direct `DIRECT_URL` for migrations) |
| Cache | Upstash Redis |
| Auth | Firebase project. Add the Vercel domain to **Authorized domains** in the Firebase console, or Google sign-in fails on the deployed URL |
| Schema | `prisma migrate deploy` in the build command |
| Seeding | `node prisma/seed.js`, run once against the production DB |

**Seed data (list in README):**

1. A healthy loan with a few instalments fully paid.
2. A loan with **one overdue instalment** (disbursed about two months before today and unpaid). Required.
3. A loan with a **partially paid** instalment.
4. A fully settled loan.

Make the seed **idempotent** (fixed UUIDs and `upsert`) so it can be re-run safely. Seed dates should be relative to the seeding day so the overdue loan stays overdue at review time. If the review happens well after seeding, document the `?asOf=` parameter.

### Environment variables (`.env.example`)

```bash
# Database (Neon / Supabase)
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
DIRECT_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
REDIS_ENABLED=true

# Firebase client (public)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (server only)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

## 13. Commit plan (history is reviewed)

Commit in small, meaningful steps, for example:

1. `chore: scaffold Next.js app (JS only), eslint, jsconfig`
2. `feat(core): money helpers and EMI calculation`
3. `feat(core): schedule generation with remainder in final instalment`
4. `test(core): schedule unit tests incl. 2,00,000 @ 18% / 24m`
5. `feat(core): payment allocation (oldest first, interest then principal)`
6. `test(core): allocation tests for under/over/exact payments`
7. `feat(core): loan position and overdue computation`
8. `feat(db): prisma schema, migrations, CHECK constraints`
9. `feat(api): http helpers, error envelope, validation`
10. `feat(auth): firebase-admin verification wrapper`
11. `feat(api): create loan and get loan endpoints`
12. `feat(api): record payment with idempotency and row lock`
13. `feat(cache): redis versioned cache for loan view`
14. `test(api): integration tests against real postgres`
15. `ci: github actions with postgres service`
16. `feat(ui): auth gate, sign-in, sign-out`
17. `feat(ui): position cards, schedule table`
18. `feat(ui): payment form with allocation preview`
19. `chore: seed script with overdue loan`
20. `docs: README`

---

## 14. Interview preparation: edge cases not in the brief

The interviewer will ask how allocation behaves in a case the brief does not specify. Have a clear answer for each.

| Question | Answer in this design |
|---|---|
| Payment dated before the first due date? | Accepted if on or after disbursement. It is applied to instalment 1, which is not yet due, so it is a prepayment of that instalment with no overdue effect. |
| Payment dated before disbursement? | Rejected with 422. |
| Payment larger than total outstanding? | Rejected with 422. No silent capping, so there is no hidden money. |
| Payments submitted out of date order? | Allocation is by instalment order, not date order. Each payment stores its own `paid_on`. The position for a given `asOf` is correct because overdue is computed from current paid totals, with future-dated payments disallowed. |
| Exactly the overdue amount? | Clears all overdue instalments, leaves the future ones untouched. |
| Two concurrent payments? | The row lock serialises them. The second sees the first's allocations. |
| Same key, different amount? | 409 `IDEMPOTENCY_KEY_REUSED`. |
| Redis down? | Fail-open to Postgres. Correctness is unaffected. |
| Why integer paise? | Exact arithmetic, no Decimal or float conversion, easy to assert in tests. |
| Why not reduce principal on overpayment? | It requires recalculating the schedule (prepayment logic), which is out of scope. Roll-forward keeps the schedule immutable and the behaviour explainable. |

---

## 15. Submission checklist

- [ ] Deployed URL loads in a **private window**
- [ ] Test Firebase account works on the deployed URL (and the domain is authorised in Firebase)
- [ ] Seeded loans listed in README, including one with an overdue instalment
- [ ] Record a payment on the live site and confirm the page updates with no refresh
- [ ] Latest GitHub Actions run is green
- [ ] No secrets in git (check history, not only the working tree)
- [ ] JavaScript only: no `.ts`, `.tsx` or `tsconfig.json`
- [ ] README is one page: link, seeded loans, setup, DB and host, test command, endpoint reference, money type, allocation and rounding decisions
- [ ] Email to `sourav.shukla@vitto.money` with subject **Full Stack SDE — Assignment — [Your Name]**, containing the live link, repo link and test account
- [ ] Sent before **Wed 7 Oct, 8:00 AM IST**
