'use strict';

/**
 * PulseSave server
 * ----------------
 * A small, fast Express app that serves the static UI plus a JSON API backed
 * by yt-dlp (with a graceful demo fallback when yt-dlp is not installed).
 *
 *   GET /api/health     engine status + supported platforms
 *   GET /api/info       metadata + quality menu for a link
 *   GET /api/download   streams the file as an attachment
 *
 * Run with `npm start` (PORT env var, default 3000).
 */

const path = require('node:path');
const express = require('express');

const apiRouter = require('./routes/api');
const { ApiError } = require('./lib/errors');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

/** Baseline security headers for an app that renders untrusted metadata. */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
}

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true); // correct client IPs behind a reverse proxy / tunnel
  app.use(securityHeaders);
  app.use(express.json({ limit: '32kb' }));

  // API first, so /api 404s stay JSON and never fall through to the SPA.
  app.use('/api', apiRouter);

  // Static UI (no build step — plain HTML/CSS/JS, which keeps first paint fast).
  app.use(
    express.static(PUBLIC_DIR, {
      index: 'index.html',
      maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
      },
    })
  );

  // Unknown non-API routes get the app shell.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  // Central error handler: always JSON for /api, never leak internals.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ApiError) {
      res.status(err.status).json(err.toJSON());
      return;
    }
    console.error('[pulsesave] unhandled error:', err);
    res.status(500).json({
      ok: false,
      error: { code: 'internal_error', message: 'Something went wrong on our side. Please try again.' },
    });
  });

  return app;
}

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

if (require.main === module) {
  const app = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`\n  PulseSave running at http://localhost:${PORT}\n`);
  });
}

module.exports = { createApp };
