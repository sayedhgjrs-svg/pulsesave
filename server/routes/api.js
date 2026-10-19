'use strict';

const express = require('express');
const { ApiError } = require('../lib/errors');
const { detectTarget, platformSummary } = require('../lib/platforms');
const { getVideo, getEngine, streamDownload } = require('../lib/ytdlp');
const { createRateLimit } = require('../lib/rate-limit');

const router = express.Router();

const infoLimit = createRateLimit({
  name: 'info',
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_INFO) || 30,
});

router.get('/health', async (req, res) => {
  const engine = await getEngine();
  res.json({ status: engine === 'demo' ? 'demo' : 'live', engine });
});

router.get('/info', async (req, res) => {
  const { url } = req.query;
  if (!url) throw ApiError.badRequest('url is required');
  const allowed = ['tiktok.com', 'instagram.com', 'youtube.com'];
  try {
    const host = new URL(url).host;
    if (!allowed.some(a => host.includes(a))) throw ApiError.forbidden('unsupported host');
  } catch { throw ApiError.badRequest('invalid url'); }
  const info = await getEngine() === 'live' ? await getVideo(url) : { title: 'Demo video', platform: 'unknown' };
  res.json(info);
});

router.get('/download', async (req, res) => {
  const { url, format } = req.query;
  if (!url) throw ApiError.badRequest('url is required');
  res.set('Content-Disposition', `attachment; filename=\"video.mp4\"`);
  res.set('Content-Type', 'video/mp4');
  const stream = await streamDownload(url, format);
  if (!stream) return res.status(500).json({ error: 'Download failed' });
  stream.pipe(res);
});

module.exports = router;