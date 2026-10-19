'use strict';

/**
 * ApiError - Standardized error responses for the API
 * -------------------------------------------
 * Creates error objects with status codes and message strings
 * that are consistently formatted for JSON responses.
 */
'use strict';

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Create a 400 Bad Request error
   * @param {string} message - Error description
   * @returns {ApiError}
   */
  static badRequest(message) {
    return new ApiError(400, message);
  }

  /**
   * Create a 403 Forbidden error
   * @param {string} message - Error description
   * @returns {ApiError}
   */
  static forbidden(message) {
    return new ApiError(403, message);
  }

  /**
   * Create a 429 Too Many Requests error
   * @param {string} message - Error description
   * @returns {ApiError}
   */
  static tooManyRequests(message) {
    return new ApiError(429, message);
  }

  /**
   * Create a 500 Internal Server Error
   * @param {string} message - Error description
   *   @returns {ApiError}
   */
  static internal(message) {
    return new ApiError(500, message);
  }
}

module.exports = { ApiError };