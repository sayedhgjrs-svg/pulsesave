'use strict';

/**
 * Vercel entry point.
 *
 * vercel.json rewrites /api/* to this function; everything under public/ is
 * served straight from Vercel's CDN, so the Express app only has to answer
 * the JSON API in this environment.
 *
 * IMPORTANT: Vercel's serverless runtime cannot run yt-dlp (no Python/binary,
 * ephemeral filesystem, execution limits), so on Vercel the API answers with
 * clearly-labelled demo data. Deploy the same repo to a container host
 * (see Dockerfile — Render, Railway, Fly.io, any VPS) for real downloads.
 */

const { createApp } = require('../server/index');

module.exports = createApp();
