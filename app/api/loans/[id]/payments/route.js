import { withAuth } from '@/lib/http/withAuth.js';
import { validateUuid, validateRecordPayment } from '@/lib/http/validate.js';
import { handleApiError, successResponse } from '@/lib/http/errors.js';
import { recordPayment } from '@/lib/services/paymentService.js';

export const POST = withAuth(async (req, { params }) => {
  try {
    const resolvedParams = await params;
    const loanId = resolvedParams?.id;
    validateUuid(loanId, 'loanId');

    const idempotencyKey =
      req.headers.get('idempotency-key') ||
      req.headers.get('Idempotency-Key');

    const body = await req.json();
    validateRecordPayment(body, idempotencyKey);

    const result = await recordPayment(loanId, body, idempotencyKey);

    const status = result.isReplay ? 200 : 201;
    const headers = result.isReplay ? { 'Idempotent-Replay': 'true' } : {};

    return successResponse(result, status, headers);
  } catch (err) {
    return handleApiError(err);
  }
});
