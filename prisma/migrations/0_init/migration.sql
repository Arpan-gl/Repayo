-- CreateTable loans
CREATE TABLE "loans" (
    "id" UUID NOT NULL,
    "principal_paise" INTEGER NOT NULL,
    "annual_rate_pct" DECIMAL(6,3) NOT NULL,
    "tenure_months" INTEGER NOT NULL,
    "disbursement_date" DATE NOT NULL,
    "emi_paise" INTEGER NOT NULL,
    "total_payable_paise" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable instalments
CREATE TABLE "instalments" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "principal_paise" INTEGER NOT NULL,
    "interest_paise" INTEGER NOT NULL,
    "total_due_paise" INTEGER NOT NULL,

    CONSTRAINT "instalments_pkey" PRIMARY KEY ("id")
);

-- CreateTable payments
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "paid_on" DATE NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable allocations
CREATE TABLE "allocations" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "instalment_id" UUID NOT NULL,
    "interest_paid_paise" INTEGER NOT NULL,
    "principal_paid_paise" INTEGER NOT NULL,

    CONSTRAINT "allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instalments_loan_id_seq_key" ON "instalments"("loan_id", "seq");

-- CreateIndex
CREATE INDEX "instalments_loan_id_due_date_idx" ON "instalments"("loan_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "payments_loan_id_idempotency_key_key" ON "payments"("loan_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "payments_loan_id_paid_on_idx" ON "payments"("loan_id", "paid_on");

-- CreateIndex
CREATE INDEX "allocations_instalment_id_idx" ON "allocations"("instalment_id");

-- AddForeignKey
ALTER TABLE "instalments" ADD CONSTRAINT "instalments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_instalment_id_fkey" FOREIGN KEY ("instalment_id") REFERENCES "instalments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database-level CHECK constraints
ALTER TABLE "loans"
  ADD CONSTRAINT "loans_principal_range" CHECK ("principal_paise" BETWEEN 5000000 AND 100000000),
  ADD CONSTRAINT "loans_tenure_range"    CHECK ("tenure_months" BETWEEN 3 AND 36),
  ADD CONSTRAINT "loans_rate_nonneg"     CHECK ("annual_rate_pct" >= 0);

ALTER TABLE "instalments"
  ADD CONSTRAINT "inst_total_matches" CHECK ("total_due_paise" = "principal_paise" + "interest_paise"),
  ADD CONSTRAINT "inst_nonneg"        CHECK ("principal_paise" >= 0 AND "interest_paise" >= 0);

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_positive" CHECK ("amount_paise" > 0);

ALTER TABLE "allocations"
  ADD CONSTRAINT "alloc_nonneg" CHECK ("interest_paid_paise" >= 0 AND "principal_paid_paise" >= 0);
