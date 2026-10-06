import { POST as createLoanRoute } from '../../app/api/loans/route.js';
import { GET as getLoanRoute } from '../../app/api/loans/[id]/route.js';
import { POST as recordPaymentRoute } from '../../app/api/loans/[id]/payments/route.js';

describe('API Route Handlers (Integration)', () => {
  // Test 11: Unauthenticated request is rejected with 401 on all endpoints
  test('Security: Request without Bearer token returns 401 UNAUTHENTICATED', async () => {
    const unauthenticatedReq = new Request('http://localhost:3000/api/loans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        principalPaise: 20000000,
        annualRatePct: 18,
        tenureMonths: 24,
        disbursementDate: '2026-09-01',
      }),
    });

    const res = await createLoanRoute(unauthenticatedReq);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('UNAUTHENTICATED');
  });

  // Test 12: Validation failure on invalid inputs returns 400
  test('Validation: Negative or out-of-bounds input returns 400 VALIDATION_ERROR', async () => {
    const invalidReq = new Request('http://localhost:3000/api/loans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({
        principalPaise: -5000, // Invalid: negative
        annualRatePct: 18,
        tenureMonths: 1, // Invalid: < 3
        disbursementDate: 'invalid-date',
      }),
    });

    const res = await createLoanRoute(invalidReq);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.details.length).toBeGreaterThan(0);
  });

  // Test 13: Invalid payment amount returns 400
  test('Validation: Payment with missing amount or key returns 400', async () => {
    const invalidPaymentReq = new Request('http://localhost:3000/api/loans/11111111-1111-4111-8111-111111111111/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
        // Missing Idempotency-Key
      },
      body: JSON.stringify({
        amountPaise: 0,
        paidOn: '2026-10-01',
      }),
    });

    const res = await recordPaymentRoute(invalidPaymentReq, {
      params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });
});
