import { AppError } from './errors.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates a UUID string.
 * @param {string} id
 * @param {string} fieldName
 */
export function validateUuid(id, fieldName = 'id') {
  if (!id || typeof id !== 'string' || !UUID_REGEX.test(id)) {
    throw new AppError('VALIDATION_ERROR', 400, `Invalid ${fieldName} format: must be a valid UUID`, [
      { field: fieldName, issue: 'must be a valid UUID' },
    ]);
  }
}

/**
 * Validates a YYYY-MM-DD date string.
 * @param {string} dateStr
 * @param {string} fieldName
 * @returns {Date}
 */
export function validateDate(dateStr, fieldName = 'date') {
  if (!dateStr || typeof dateStr !== 'string' || !DATE_REGEX.test(dateStr)) {
    throw new AppError('VALIDATION_ERROR', 400, `Invalid ${fieldName}: must be YYYY-MM-DD`, [
      { field: fieldName, issue: 'must be formatted as YYYY-MM-DD' },
    ]);
  }

  const d = new Date(dateStr + 'T00:00:00.000Z');
  if (isNaN(d.getTime())) {
    throw new AppError('VALIDATION_ERROR', 400, `Invalid calendar date for ${fieldName}`, [
      { field: fieldName, issue: 'must be a real date' },
    ]);
  }

  return d;
}

/**
 * Validates input body for creating a loan.
 * @param {any} body
 */
export function validateCreateLoan(body) {
  const details = [];

  if (!body || typeof body !== 'object') {
    throw new AppError('VALIDATION_ERROR', 400, 'Request body must be a JSON object');
  }

  const { principalPaise, annualRatePct, tenureMonths, disbursementDate } = body;

  // Principal: between ₹50,000 (5,000,000 paise) and ₹10,00,000 (100,000,000 paise)
  if (
    typeof principalPaise !== 'number' ||
    !Number.isInteger(principalPaise) ||
    principalPaise < 5000000 ||
    principalPaise > 100000000
  ) {
    details.push({
      field: 'principalPaise',
      issue: 'must be an integer between 5,000,000 (₹50,000) and 100,000,000 (₹10,00,000) paise',
    });
  }

  // Annual Rate: non-negative number
  if (typeof annualRatePct !== 'number' || isNaN(annualRatePct) || annualRatePct < 0) {
    details.push({
      field: 'annualRatePct',
      issue: 'must be a non-negative number',
    });
  }

  // Tenure: between 3 and 36 months
  if (
    typeof tenureMonths !== 'number' ||
    !Number.isInteger(tenureMonths) ||
    tenureMonths < 3 ||
    tenureMonths > 36
  ) {
    details.push({
      field: 'tenureMonths',
      issue: 'must be an integer between 3 and 36',
    });
  }

  // Disbursement date
  if (!disbursementDate || typeof disbursementDate !== 'string' || !DATE_REGEX.test(disbursementDate)) {
    details.push({
      field: 'disbursementDate',
      issue: 'must be a valid date formatted as YYYY-MM-DD',
    });
  }

  if (details.length > 0) {
    throw new AppError('VALIDATION_ERROR', 400, 'Request validation failed', details);
  }
}

/**
 * Validates input body and headers for recording a payment.
 * @param {any} body
 * @param {string} idempotencyKey
 */
export function validateRecordPayment(body, idempotencyKey) {
  const details = [];

  if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
    details.push({
      field: 'Idempotency-Key',
      issue: 'Idempotency-Key header is required',
    });
  }

  if (!body || typeof body !== 'object') {
    throw new AppError('VALIDATION_ERROR', 400, 'Request body must be a JSON object');
  }

  const { amountPaise, paidOn } = body;

  if (typeof amountPaise !== 'number' || !Number.isInteger(amountPaise) || amountPaise <= 0) {
    details.push({
      field: 'amountPaise',
      issue: 'must be a positive integer in paise',
    });
  }

  if (!paidOn || typeof paidOn !== 'string' || !DATE_REGEX.test(paidOn)) {
    details.push({
      field: 'paidOn',
      issue: 'must be a valid date formatted as YYYY-MM-DD',
    });
  }

  if (details.length > 0) {
    throw new AppError('VALIDATION_ERROR', 400, 'Payment validation failed', details);
  }
}
