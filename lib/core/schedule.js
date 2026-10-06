import Decimal from 'decimal.js';
import { calculateEmiPaise } from './emi.js';
import { roundHalfUp } from './money.js';

/**
 * Adds months to a UTC date string (YYYY-MM-DD) or Date object,
 * clamping to the last valid day of the target month.
 *
 * @param {string|Date} dateInput
 * @param {number} monthsToAdd
 * @returns {string} YYYY-MM-DD in UTC
 */
export function addMonthsClamped(dateInput, monthsToAdd) {
  let year, month, day;

  if (typeof dateInput === 'string') {
    const parts = dateInput.split('T')[0].split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1; // 0-indexed
    day = parseInt(parts[2], 10);
  } else {
    const d = new Date(dateInput);
    year = d.getUTCFullYear();
    month = d.getUTCMonth();
    day = d.getUTCDate();
  }

  const totalMonths = month + monthsToAdd;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;

  // Days in target month using UTC
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, daysInTargetMonth);

  const yyyy = String(targetYear);
  const mm = String(targetMonth + 1).padStart(2, '0');
  const dd = String(targetDay).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Generates the full amortization schedule for an MSME loan.
 *
 * @param {Object} params
 * @param {number} params.principalPaise - Principal in integer paise
 * @param {number|string} params.annualRatePct - Annual interest rate percentage
 * @param {number} params.tenureMonths - Number of monthly instalments (3 to 36)
 * @param {string|Date} params.disbursementDate - Date of disbursement
 * @returns {Object} { emiPaise, totalPayablePaise, instalments }
 */
export function generateSchedule({
  principalPaise,
  annualRatePct,
  tenureMonths,
  disbursementDate,
}) {
  if (!principalPaise || principalPaise <= 0) {
    throw new Error('Principal must be a positive integer in paise');
  }
  if (!tenureMonths || tenureMonths < 1) {
    throw new Error('Tenure must be at least 1 month');
  }

  const emiPaise = calculateEmiPaise(principalPaise, annualRatePct, tenureMonths);
  const annualRate = new Decimal(annualRatePct);
  const monthlyRate = annualRate.dividedBy(1200);

  const instalments = [];
  let remainingOutstanding = new Decimal(principalPaise);
  let totalPayable = 0;

  for (let k = 1; k <= tenureMonths; k++) {
    const dueDate = addMonthsClamped(disbursementDate, k);

    let interestPaise;
    let principalInstalmentPaise;
    let totalDuePaise;

    if (k === tenureMonths) {
      // Last instalment: absorbs any rounding differences
      principalInstalmentPaise = remainingOutstanding.toNumber();
      interestPaise = roundHalfUp(remainingOutstanding.times(monthlyRate));
      totalDuePaise = principalInstalmentPaise + interestPaise;
      remainingOutstanding = new Decimal(0);
    } else {
      interestPaise = roundHalfUp(remainingOutstanding.times(monthlyRate));
      principalInstalmentPaise = emiPaise - interestPaise;

      // Guard if principal component exceeds remaining
      if (principalInstalmentPaise > remainingOutstanding.toNumber()) {
        principalInstalmentPaise = remainingOutstanding.toNumber();
      }

      totalDuePaise = principalInstalmentPaise + interestPaise;
      remainingOutstanding = remainingOutstanding.minus(principalInstalmentPaise);
    }

    totalPayable += totalDuePaise;

    instalments.push({
      seq: k,
      dueDate,
      principalPaise: principalInstalmentPaise,
      interestPaise,
      totalDuePaise,
    });
  }

  return {
    emiPaise,
    totalPayablePaise: totalPayable,
    instalments,
  };
}
