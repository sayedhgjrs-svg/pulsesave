'use strict';

/**
 * Tiny in-memory sliding-window rate limiter.
 *
 * Keeps the API polite without adding a Redis dependency. State is per
 * process; swap this for a shared store (Redis/Upstash) if you run multiple
 * instances behind a load balancer.
 */
function createRateLimit({ name, windowMs, max }) {
  const buckets = new Map();

  const sweeper = setInterval(
    () => {
      const now = Date.now();
      for (const [key, entry] of buckets) {
        if (entry.resetAt <= now) buckets.delete(key);
      }
    },
    Math.max(windowMs, 1_000)
  );
  if (typeof sweeper.unref === 'function') sweeper.unref();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = `${req.ip || req.socket?.remoteAddress || 'unknown'}|${name}`;

    let entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }
    entry.count += 1;

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      res.status(429).json({
        ok: false,
        error: { code: 'rate_limited', message: 'Too many requests — give it a few seconds and try again.' },
      });
      return;
    }

    next();
  };
}

module.exports = { createRateLimit };
