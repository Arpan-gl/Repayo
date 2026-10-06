import { NextResponse } from 'next/server';

/**
 * Standard Application Error
 */
export class AppError extends Error {
  constructor(code, statusCode, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Maps any error into the uniform API error envelope:
 * { "ok": false, "error": { "code": "...", "message": "...", "details": ... } }
 *
 * @param {Error|AppError} error
 * @returns {NextResponse}
 */
export function handleApiError(error) {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.statusCode }
    );
  }

  // Handle known error structures (e.g. from allocatePayment)
  if (error && error.code && error.statusCode) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.statusCode }
    );
  }

  console.error('[API Internal Error]:', error);

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal server error occurred',
      },
    },
    { status: 500 }
  );
}

/**
 * Creates a standard success response envelope:
 * { "ok": true, "data": ... }
 *
 * @param {any} data
 * @param {number} [status=200]
 * @param {HeadersInit} [headers={}]
 * @returns {NextResponse}
 */
export function successResponse(data, status = 200, headers = {}) {
  return NextResponse.json(
    {
      ok: true,
      data,
    },
    { status, headers }
  );
}
