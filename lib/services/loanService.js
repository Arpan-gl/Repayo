import { prisma } from '../db.js';
import { generateSchedule } from '../core/schedule.js';
import { computePosition, getTodayIST } from '../core/position.js';
import { getCachedLoanView, setCachedLoanView } from '../cache.js';
import { AppError } from '../http/errors.js';

/**
 * Creates a new loan and persists its amortization schedule in PostgreSQL.
 *
 * @param {Object} input
 * @param {number} input.principalPaise
 * @param {number} input.annualRatePct
 * @param {number} input.tenureMonths
 * @param {string} input.disbursementDate
 * @returns {Promise<Object>}
 */
export async function createLoan({ principalPaise, annualRatePct, tenureMonths, disbursementDate }) {
  const scheduleData = generateSchedule({
    principalPaise,
    annualRatePct,
    tenureMonths,
    disbursementDate,
  });

  const created = await prisma.loan.create({
    data: {
      principalPaise,
      annualRatePct,
      tenureMonths,
      disbursementDate: new Date(disbursementDate + 'T00:00:00.000Z'),
      emiPaise: scheduleData.emiPaise,
      totalPayablePaise: scheduleData.totalPayablePaise,
      instalments: {
        create: scheduleData.instalments.map((inst) => ({
          seq: inst.seq,
          dueDate: new Date(inst.dueDate + 'T00:00:00.000Z'),
          principalPaise: inst.principalPaise,
          interestPaise: inst.interestPaise,
          totalDuePaise: inst.totalDuePaise,
        })),
      },
    },
  });

  // Fetch full view
  return getLoanWithPosition(created.id);
}

/**
 * Retrieves a loan with its schedule and live position as of a given date.
 * Fail-open Redis caching layer included.
 *
 * @param {string} loanId
 * @param {string} [asOf]
 * @returns {Promise<{ data: Object, isCached: boolean }>}
 */
export async function getLoanWithPosition(loanId, asOf) {
  const effectiveAsOf = asOf || getTodayIST();

  // Try Redis cache
  const cached = await getCachedLoanView(loanId, effectiveAsOf);
  if (cached) {
    return { data: cached, isCached: true };
  }

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      instalments: {
        orderBy: { seq: 'asc' },
        include: {
          allocations: true,
        },
      },
    },
  });

  if (!loan) {
    throw new AppError('LOAN_NOT_FOUND', 404, `Loan with ID ${loanId} not found`);
  }

  // Aggregate paid amounts per instalment
  const instalmentsWithPayments = loan.instalments.map((inst) => {
    const paidI = inst.allocations.reduce((sum, a) => sum + a.interestPaidPaise, 0);
    const paidP = inst.allocations.reduce((sum, a) => sum + a.principalPaidPaise, 0);

    return {
      id: inst.id,
      seq: inst.seq,
      dueDate: inst.dueDate.toISOString().split('T')[0],
      principalPaise: inst.principalPaise,
      interestPaise: inst.interestPaise,
      totalDuePaise: inst.totalDuePaise,
      paidInterestPaise: paidI,
      paidPrincipalPaise: paidP,
    };
  });

  const { schedule, position } = computePosition({
    instalments: instalmentsWithPayments,
    asOf: effectiveAsOf,
  });

  const result = {
    loan: {
      id: loan.id,
      principalPaise: loan.principalPaise,
      annualRatePct: loan.annualRatePct.toString(),
      tenureMonths: loan.tenureMonths,
      disbursementDate: loan.disbursementDate.toISOString().split('T')[0],
      emiPaise: loan.emiPaise,
      totalPayablePaise: loan.totalPayablePaise,
      createdAt: loan.createdAt.toISOString(),
    },
    schedule,
    position,
  };

  // Populate cache (best-effort)
  await setCachedLoanView(loanId, effectiveAsOf, result);

  return { data: result, isCached: false };
}
