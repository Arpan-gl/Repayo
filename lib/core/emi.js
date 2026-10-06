import Decimal from 'decimal.js';
import { roundHalfUp } from './money.js';

/**
 * Calculates monthly EMI in integer paise.
 * Formula: EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
 * where P is principalPaise, r is monthly rate (annualRatePct / 12 / 100), n is tenureMonths.
 *
 * @param {number} principalPaise - Loan principal in integer paise
 * @param {number|string} annualRatePct - Annual interest rate in percent (e.g. 18.0)
 * @param {number} tenureMonths - Tenure in months (3 to 36)
 * @returns {number} EMI in integer paise
 */
export function calculateEmiPaise(principalPaise, annualRatePct, tenureMonths) {
  const P = new Decimal(principalPaise);
  const n = new Decimal(tenureMonths);
  const annualRate = new Decimal(annualRatePct);

  // If rate is 0%, simple division
  if (annualRate.isZero()) {
    return roundHalfUp(P.dividedBy(n));
  }

  // Monthly rate r = annualRate / 12 / 100 = annualRate / 1200
  const r = annualRate.dividedBy(1200);

  // factor = (1 + r)^n
  const onePlusR = new Decimal(1).plus(r);
  const factor = onePlusR.pow(n);

  // numerator = P * r * factor
  const numerator = P.times(r).times(factor);

  // denominator = factor - 1
  const denominator = factor.minus(1);

  const emiDecimal = numerator.dividedBy(denominator);
  return roundHalfUp(emiDecimal);
}
