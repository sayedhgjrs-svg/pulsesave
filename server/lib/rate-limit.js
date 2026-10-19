'use strict';

/**
 * Rate limiting utility for API endpoints
 * -------------------------------
 * Provides per-IP rate limiting with configurable windows.
 */
'use strict';

const rateLimits = new Map();

/**
 * Create a rate limiter middleware for Express.
 * @param {Object} options - Rate limiter options
 * @param {number} options.windowMs - Rate limit window in milliseconds (default: 60000)
 * @param {number} options.max - Max requests per window (default: 30)
 * @param {string} options.name - Identifier key prefix (default: 'global')
 * @returns {Function} Express middleware function
 */
function createRateLimit(options = {}) {
  const { windowMs = 60_000, max = 30, name = 'global' } = options;
  return function rateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const key = `${name}:${ip}`;
    const now = Date.now();
    const window = rateLimits.get(key) || [];
    const recent = window.filter(t => now - t < windowMs);
    if (recent.length >= max) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfterMs: windowMs - (now - recent[0])
      });
    }
    rateLimits.set(key, [...recent, now]);
    next();
  };
}

module.exports = createRateLimit;