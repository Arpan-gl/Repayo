import { withAuth } from '@/lib/http/withAuth.js';
import { validateCreateLoan } from '@/lib/http/validate.js';
import { handleApiError, successResponse } from '@/lib/http/errors.js';
import { createLoan } from '@/lib/services/loanService.js';

export const POST = withAuth(async (req) => {
  try {
    const body = await req.json();
    validateCreateLoan(body);

    const createdLoan = await createLoan(body);
    return successResponse(createdLoan, 201);
  } catch (err) {
    return handleApiError(err);
  }
});
