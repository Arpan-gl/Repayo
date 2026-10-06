import crypto from 'crypto';
import { prisma } from '../db.js';
import { allocatePayment } from '../core/allocate.js';
import { getTodayIST } from '../core/position.js';
import { getLoanWithPosition } from './loanService.js';
import { invalidateLoanCache } from '../cache.js';
import { AppError } from '../http/errors.js';

/**
 * Computes canonical SHA-256 hash of payment payload.
 * @param {Object} payload
 * @returns {string} hex digest
 */
export function computeRequestHash(payload) {
  const canonicalString = JSON.stringify({
    amountPaise: payload.amountPaise,
    paidOn: payload.paidOn,
  });
  return crypto.createHash('sha256').update(canonicalString).digest('hex');
}

/**
 * Records a payment against a loan with row locking, idempotency check,
 * and pure allocation inside a single database transaction.
 *
 * @param {string} loanId
 * @param {Object} input - { amountPaise, paidOn }
 * @param {string} idempotencyKey
 * @returns {Promise<Object>}
 */
export async function recordPayment(loanId, input, idempotencyKey) {
  const { amountPaise, paidOn } = input;
  const requestHash = computeRequestHash(input);
  const todayIST = getTodayIST();

  if (paidOn > todayIST) {
    throw new AppError(
      'PAYMENT_IN_FUTURE',
      422,
      `Payment date (${paidOn}) cannot be in the future (today is ${todayIST})`
    );
  }

  // Execute payment write inside an isolated transaction
  const txResult = await prisma.$transaction(async (tx) => {
    // 1. Row lock on loan to serialise concurrent payments per loan
    const lockRows = await tx.$queryRaw`
      SELECT id, disbursement_date FROM loans WHERE id = ${loanId}::uuid FOR UPDATE
    `;

    if (!lockRows || lockRows.length === 0) {
      throw new AppError('LOAN_NOT_FOUND', 404, `Loan with ID ${loanId} not found`);
    }

    const lockedLoan = lockRows[0];
    const disbursementDateStr = new Date(lockedLoan.disbursement_date).toISOString().split('T')[0];

    // 2. Validate payment date is on or after disbursement date
    if (paidOn < disbursementDateStr) {
      throw new AppError(
        'PAYMENT_BEFORE_DISBURSEMENT',
        422,
        `Payment date (${paidOn}) cannot be earlier than disbursement date (${disbursementDateStr})`
      );
    }

    // 3. Idempotency check
    const existingPayment = await tx.payment.findUnique({
      where: {
        loanId_idempotencyKey: {
          loanId,
          idempotencyKey,
        },
      },
      include: {
        allocations: true,
      },
    });

    if (existingPayment) {
      if (existingPayment.requestHash === requestHash) {
        // Idempotent replay: return existing payment
        return {
          isReplay: true,
          payment: existingPayment,
          allocations: existingPayment.allocations,
        };
      } else {
        throw new AppError(
          'IDEMPOTENCY_KEY_REUSED',
          409,
          'Idempotency key has already been used with different request parameters'
        );
      }
    }

    // 4. Fetch instalments ordered by seq with all past allocations
    const instalments = await tx.instalment.findMany({
      where: { loanId },
      orderBy: { seq: 'asc' },
      include: {
        allocations: true,
      },
    });

    const instalmentsForAllocation = instalments.map((inst) => {
      const paidI = inst.allocations.reduce((sum, a) => sum + a.interestPaidPaise, 0);
      const paidP = inst.allocations.reduce((sum, a) => sum + a.principalPaidPaise, 0);

      return {
        id: inst.id,
        seq: inst.seq,
        dueDate: inst.dueDate.toISOString().split('T')[0],
        interestPaise: inst.interestPaise,
        principalPaise: inst.principalPaise,
        totalDuePaise: inst.totalDuePaise,
        paidInterestPaise: paidI,
        paidPrincipalPaise: paidP,
      };
    });

    // 5. Run pure allocation logic
    const { allocations } = allocatePayment({
      instalments: instalmentsForAllocation,
      amountPaise,
    });

    // 6. Insert Payment record
    const createdPayment = await tx.payment.create({
      data: {
        loanId,
        amountPaise,
        paidOn: new Date(paidOn + 'T00:00:00.000Z'),
        idempotencyKey,
        requestHash,
      },
    });

    // 7. Insert Allocation records
    const allocationData = allocations.map((alloc) => ({
      paymentId: createdPayment.id,
      instalmentId: alloc.instalmentId,
      interestPaidPaise: alloc.interestPaidPaise,
      principalPaidPaise: alloc.principalPaidPaise,
    }));

    await tx.allocation.createMany({
      data: allocationData,
    });

    return {
      isReplay: false,
      payment: createdPayment,
      allocations: allocationData,
    };
  });

  // 8. Invalidate Redis cache for this loan
  await invalidateLoanCache(loanId);

  // 9. Fetch fresh loan view
  const freshLoanView = await getLoanWithPosition(loanId, paidOn);

  return {
    isReplay: txResult.isReplay,
    payment: {
      id: txResult.payment.id,
      loanId: txResult.payment.loanId,
      amountPaise: txResult.payment.amountPaise,
      paidOn: txResult.payment.paidOn.toISOString().split('T')[0],
      idempotencyKey: txResult.payment.idempotencyKey,
    },
    allocations: txResult.allocations,
    loanView: freshLoanView.data,
  };
}
