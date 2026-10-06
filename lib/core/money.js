import Decimal from 'decimal.js';

/**
 * Converts rupees to integer paise.
 * @param {number|string} rupees
 * @returns {number} integer paise
 */
export function toPaise(rupees) {
  const d = new Decimal(rupees);
  return d.times(100).round().toNumber();
}

/**
 * Converts integer paise to rupees.
 * For display or calculations where Decimal is used.
 * @param {number} paise
 * @returns {number}
 */
export function toRupees(paise) {
  return new Decimal(paise).dividedBy(100).toNumber();
}

/**
 * Formats integer paise as INR string (e.g. ₹2,00,000.00).
 * Handles Indian numbering system (lakhs, crores).
 * @param {number} paise
 * @returns {string}
 */
export function formatINR(paise) {
  if (paise === null || paise === undefined || isNaN(paise)) return '₹0.00';
  const rupees = Number(paise) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Rounds a Decimal half-up to the nearest integer.
 * @param {Decimal} decimalVal
 * @returns {number}
 */
export function roundHalfUp(decimalVal) {
  return new Decimal(decimalVal)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}
