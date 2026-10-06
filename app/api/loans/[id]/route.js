import { withAuth } from '@/lib/http/withAuth.js';
import { validateUuid } from '@/lib/http/validate.js';
import { handleApiError, successResponse } from '@/lib/http/errors.js';
import { getLoanWithPosition } from '@/lib/services/loanService.js';

export const GET = withAuth(async (req, { params }) => {
  try {
    const resolvedParams = await params;
    const loanId = resolvedParams?.id;
    validateUuid(loanId, 'loanId');

    const { searchParams } = new URL(req.url);
    const asOf = searchParams.get('asOf') || undefined;

    const { data, isCached } = await getLoanWithPosition(loanId, asOf);

    return successResponse(data, 200, {
      'X-Cache': isCached ? 'HIT' : 'MISS',
    });
  } catch (err) {
    return handleApiError(err);
  }
});
