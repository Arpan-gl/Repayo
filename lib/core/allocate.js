/**
 * Allocates a payment across loan instalments according to MSME rules:
 * 1. Oldest instalment first (by seq)
 * 2. Within an instalment, interest is settled before principal
 * 3. Excess payment rolls forward to subsequent open instalments
 * 4. Payment exceeding total loan outstanding throws an error (422 OVERPAYMENT_EXCEEDS_OUTSTANDING)
 * 5. Payment on an already settled loan throws LOAN_ALREADY_SETTLED (422)
 *
 * @param {Object} params
 * @param {Array<Object>} params.instalments - Ordered list of instalments with already-paid amounts
 * @param {number} params.amountPaise - Payment amount in integer paise (> 0)
 * @returns {{ allocations: Array<Object>, unallocatedPaise: number }}
 */
export function allocatePayment({ instalments, amountPaise }) {
  if (!amountPaise || amountPaise <= 0 || !Number.isInteger(amountPaise)) {
    const err = new Error('Payment amount must be a positive integer in paise');
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 400;
    throw err;
  }

  // Sort instalments by seq just in case
  const sortedInstalments = [...instalments].sort((a, b) => a.seq - b.seq);

  // Compute total outstanding across all instalments
  let totalOutstandingPaise = 0;
  for (const inst of sortedInstalments) {
    const paidI = inst.paidInterestPaise || 0;
    const paidP = inst.paidPrincipalPaise || 0;
    const iDue = Math.max(0, inst.interestPaise - paidI);
    const pDue = Math.max(0, inst.principalPaise - paidP);
    totalOutstandingPaise += (iDue + pDue);
  }

  if (totalOutstandingPaise === 0) {
    const err = new Error('Loan is already fully settled');
    err.code = 'LOAN_ALREADY_SETTLED';
    err.statusCode = 422;
    throw err;
  }

  if (amountPaise > totalOutstandingPaise) {
    const err = new Error(
      `Payment amount (${amountPaise} paise) exceeds total outstanding balance (${totalOutstandingPaise} paise)`
    );
    err.code = 'OVERPAYMENT_EXCEEDS_OUTSTANDING';
    err.statusCode = 422;
    err.details = { amountPaise, totalOutstandingPaise };
    throw err;
  }

  let remainingToAllocate = amountPaise;
  const allocations = [];

  for (const inst of sortedInstalments) {
    if (remainingToAllocate <= 0) break;

    const paidI = inst.paidInterestPaise || 0;
    const paidP = inst.paidPrincipalPaise || 0;

    const interestDue = Math.max(0, inst.interestPaise - paidI);
    const principalDue = Math.max(0, inst.principalPaise - paidP);

    if (interestDue === 0 && principalDue === 0) {
      continue;
    }

    // Settle interest first
    const payI = Math.min(remainingToAllocate, interestDue);
    remainingToAllocate -= payI;

    // Settle principal next
    const payP = Math.min(remainingToAllocate, principalDue);
    remainingToAllocate -= payP;

    if (payI > 0 || payP > 0) {
      allocations.push({
        instalmentId: inst.id,
        interestPaidPaise: payI,
        principalPaidPaise: payP,
      });
    }
  }

  return {
    allocations,
    unallocatedPaise: remainingToAllocate,
  };
}
