'use strict';

/**
 * ApiError — the single error type the HTTP layer knows how to render.
 *
 * Every failure the API can produce carries:
 *  - status: the HTTP status code
 *  - code:    a stable, machine-readable string the frontend can branch on
 *  - message: a human-readable, user-safe sentence (never leak stack traces
 *             or raw yt-dlp output to the client)
 */
class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  toJSON() {
    return { ok: false, error: { code: this.code, message: this.message } };
  }
}

module.exports = { ApiError };
