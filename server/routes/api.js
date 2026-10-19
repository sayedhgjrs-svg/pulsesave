'use strict';

const express = require('express');

const { ApiError } = require('../lib/errors');
const { detectTarget, platformSummary } = require('../lib/platforms');
const { getVideo, getEngine, streamDownload } = require('../lib/ytdlp');
const { createRateLimit } = require('../lib/rate-limit');

const router = express.Router();

const BOOTED_AT = Date.now();

const infoLimit = createRateLimit({
  name: 'info',
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_INFO) || 30,
});
const downloadLimit = createRateLimit({
  name: 'download',
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_DOWNLOAD) || 12,
});

/** `async` route wrapper so rejected promises land in the error handler. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * GET /api/health
 * Lightweight status probe used by the UI badge ("Engine: yt-dlp 2025.x")
 * and by monitoring. Also tells the client which platforms are supported.
 */
router.get(
  '/health',
  wrap(async (req, res) => {
    const engine = getEngine();
    res.json({
      ok: true,
      mode: engine.ytDlp.present ? 'live' : 'demo',
      engine: {
        ytDlp: { present: engine.ytDlp.present, version: engine.ytDlp.version },
        ffmpeg: { present: engine.ffmpeg.present },
      },
      platforms: platformSummary(),
      uptimeMs: Date.now() - BOOTED_AT,
    });
  })
);

/**
 * GET /api/info?url=<link>
 * Analyzes a link and returns the preview card payload: title, author,
 * duration, safe thumbnail and a stable quality menu (tokens, not raw
 * yt-dlp format ids).
 */
router.get(
  '/info',
  infoLimit,
  wrap(async (req, res) => {
    const { url, platform } = detectTarget(req.query.url);
    const result = await getVideo(url, platform);

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      source: result.source, // 'live' | 'demo' — the UI surfaces this honestly
      reason: result.reason || null,
      video: result.video,
    });
  })
);

/**
 * GET /api/download?url=<link>&format=<q1080|max|best>
 * Streams the selected rendition to the browser as an attachment
 * (Content-Disposition: attachment), cleaning up temp files afterwards.
 */
router.get(
  '/download',
  downloadLimit,
  wrap(async (req, res) => {
    const { url, platform } = detectTarget(req.query.url);
    const formatToken = typeof req.query.format === 'string' && req.query.format ? req.query.format : 'best';

    if (!/^[a-zA-Z0-9_+\-.]{1,32}$/.test(formatToken)) {
      throw new ApiError(400, 'invalid_format', 'That quality token is not valid.');
    }

    await streamDownload({ url, platform, formatToken, res });
  })
);

/** JSON 404 for any other /api path (mounted before the static handler). */
router.use((req, res) => {
  res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Unknown API endpoint.' } });
});

module.exports = router;
