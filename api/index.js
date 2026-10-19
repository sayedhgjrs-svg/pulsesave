'use strict';

const express = require('express');
const { getEngine, streamDownload } = require('../server/lib/ytdlp');
const { createRateLimit } = require('../server/lib/rate-limit');
const { ApiError } = require('../server/lib/errors');

const router = express.Router();

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
  const info = await getEngine() === 'live' ? await fetchLiveInfo(url) : { title: 'Demo video', platform: 'unknown' };
  res.json(info);
});

router.get('/download', async (req, res) => {
  const { url, format } = req.query;
  if (!url) throw ApiError.badRequest('url is required');
  res.set('Content-Disposition', `attachment; filename=\"video.mp4\"`);
  res.set('Content-Type', 'video/mp4');
  const stream = await streamDownload(url, format);
  stream.pipe(res);
});

module.exports = router;