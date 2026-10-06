import { getFirebaseAdmin } from '../firebaseAdmin.js';
import { AppError, handleApiError } from './errors.js';

/**
 * Middleware wrapper for Next.js route handlers that enforces Firebase Auth.
 * Extracts `Authorization: Bearer <token>` and verifies it using firebase-admin.
 * Rejects unauthenticated requests with 401 UNAUTHENTICATED.
 *
 * @param {Function} handler - Route handler function (req, context) => Promise<NextResponse>
 * @returns {Function} wrapped handler
 */
export function withAuth(handler) {
  return async (req, context) => {
    try {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError(
          'UNAUTHENTICATED',
          401,
          'Missing or malformed Authorization header. Bearer token required.'
        );
      }

      const token = authHeader.split('Bearer ')[1]?.trim();

      if (!token) {
        throw new AppError('UNAUTHENTICATED', 401, 'Bearer token is empty');
      }

      let decodedUser;

      // Test environment shortcut for deterministic CI/integration testing
      if (process.env.NODE_ENV === 'test' && token === 'test-token') {
        decodedUser = {
          uid: 'test-user-id',
          email: 'tester@vitto.money',
        };
      } else {
        try {
          const adminApp = getFirebaseAdmin();
          decodedUser = await adminApp.auth().verifyIdToken(token);
        } catch (authError) {
          console.warn('[withAuth] Token verification failed:', authError.message);
          throw new AppError(
            'UNAUTHENTICATED',
            401,
            'Invalid or expired authentication token'
          );
        }
      }

      // Attach user to context for handler use
      return await handler(req, { ...context, user: decodedUser });
    } catch (err) {
      return handleApiError(err);
    }
  };
}
