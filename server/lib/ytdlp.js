'use strict';

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn, spawnSync } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const { createReadStream } = require('node:fs');

const { ApiError } = require('./errors');
const { buildQualityOptions } = require('./formats');
const demo = require('./demo');

/* ------------------------------------------------------------------ *
 * Engine discovery (yt-dlp + optional ffmpeg)
 * ------------------------------------------------------------------ */

const YTDL_BIN = process.env.YTDL_PATH || 'yt-dlp';
const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';

const INFO_TIMEOUT_MS = Number(process.env.INFO_TIMEOUT_MS) || 45_000;
const DOWNLOAD_TIMEOUT_MS = Number(process.env.DOWNLOAD_TIMEOUT_MS) || 300_000;
const MAX_INFO_BYTES = 24 * 1024 * 1024; // safety cap for `yt-dlp -J` output

let engineCache = null;

function probeVersion(bin, args) {
  try {
    const res = spawnSync(bin, args, { encoding: 'utf8', timeout: 6_000 });
    if (res.error || res.status !== 0) return null;
    return (res.stdout || '').trim().split('\n')[0] || null;
  } catch {
    return null;
  }
}

/**
 * Detect the extraction engine once and cache the result.
 * `yt-dlp` does the heavy lifting; `ffmpeg` unlocks higher qualities that
 * ship video and audio as separate streams (they get merged server-side).
 */
function getEngine() {
  if (engineCache) return engineCache;
  const ytDlpVersion = probeVersion(YTDL_BIN, ['--version']);
  const ffmpegVersion = probeVersion(FFMPEG_BIN, ['-version']);
  engineCache = {
    ytDlp: { present: Boolean(ytDlpVersion), version: ytDlpVersion, bin: YTDL_BIN },
    ffmpeg: { present: Boolean(ffmpegVersion), version: ffmpegVersion ? ffmpegVersion.split('\n')[0] : null },
  };
  return engineCache;
}

/** Test hook: forget the cached engine probe (used when env vars change). */
function resetEngineCache() {
  engineCache = null;
}

function isDemoRequested() {
  return process.env.DEMO_MODE === '1' || process.env.DEMO_MODE === 'true';
}

/* ------------------------------------------------------------------ *
 * Child-process plumbing
 * ------------------------------------------------------------------ */

/** Run yt-dlp and capture stdout/stderr with hard limits. */
function runYtDlp(args, { timeoutMs = INFO_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(YTDL_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      reject(err);
      return;
    }

    let stdout = '';
    let stderr = '';
    let outBytes = 0;
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      outBytes += chunk.length;
      if (outBytes > MAX_INFO_BYTES) {
        killed = true;
        child.kill('SIGKILL');
        return;
      }
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 128 * 1024) stderr += chunk;
    });

    child.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr, killed });
    });
  });
}

/* ------------------------------------------------------------------ *
 * Error translation: yt-dlp messages -> user-facing ApiErrors
 * ------------------------------------------------------------------ */

function humanizeYtDlpError(stderr = '') {
  const text = String(stderr);
  const lower = text.toLowerCase();

  if (lower.includes('unsupported url')) {
    return new ApiError(404, 'unsupported_video', 'We could not read that link. Check that it is a public post.');
  }
  if (lower.includes('private') || lower.includes('sign in to confirm') || lower.includes('login required')) {
    return new ApiError(401, 'private_video', 'This video is private or requires an account, so it cannot be downloaded.');
  }
  if (lower.includes('age') && lower.includes('confirm')) {
    return new ApiError(401, 'age_restricted', 'This video is age-restricted and cannot be downloaded anonymously.');
  }
  if (lower.includes('not available in your country') || lower.includes('region')) {
    return new ApiError(451, 'not_available', 'This video is not available in the server region.');
  }
  if (lower.includes('video unavailable') || lower.includes('removed') || lower.includes('deleted')) {
    return new ApiError(404, 'not_available', 'That video looks unavailable — it may have been removed or made private.');
  }
  return new ApiError(502, 'extract_failed', 'We could not fetch that video right now. Please try again in a moment.');
}

/* ------------------------------------------------------------------ *
 * Metadata
 * ------------------------------------------------------------------ */

const HTTPS_ONLY = /^https:\/\//i;

/** Only ever hand the browser image URLs we can vouch for. */
function safeThumbnail(raw) {
  const candidates = [];
  if (raw && typeof raw.thumbnail === 'string') candidates.push(raw.thumbnail);
  if (raw && Array.isArray(raw.thumbnails)) {
    for (let i = raw.thumbnails.length - 1; i >= 0; i -= 1) {
      if (raw.thumbnails[i] && typeof raw.thumbnails[i].url === 'string') candidates.push(raw.thumbnails[i].url);
    }
  }
  return candidates.find((url) => HTTPS_ONLY.test(url)) || null;
}

function pickText(...values) {
  return values.find((v) => typeof v === 'string' && v.trim()) || null;
}

function formatCount(n) {
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Fetch metadata + the quality menu for a link.
 * Returns `{ source: 'live' | 'demo', video, reason? }` — never throws for
 * extractor problems, so the UI can always render a card.
 */
async function getVideo(url, platform) {
  if (isDemoRequested()) {
    return { source: 'demo', reason: 'demo_mode', video: demo.buildDemoVideo(platform, url) };
  }

  const engine = getEngine();
  if (!engine.ytDlp.present) {
    return { source: 'demo', reason: 'yt_dlp_missing', video: demo.buildDemoVideo(platform, url) };
  }

  try {
    const raw = await fetchRawInfo(url);
    return { source: 'live', video: normalizeInfo(raw, url, platform, engine.ffmpeg.present) };
  } catch (err) {
    // Hard user-facing problems stay errors (private, removed, unreadable link).
    if (err instanceof ApiError && err.code !== 'extract_failed' && err.code !== 'timeout') throw err;

    console.warn('[pulsesave] falling back to demo data:', err.message);
    return { source: 'demo', reason: 'unavailable', video: demo.buildDemoVideo(platform, url), detail: err.message };
  }
}

async function fetchRawInfo(url) {
  const res = await runYtDlp([
    '-J',
    '--no-warnings',
    '--no-playlist',
    '--no-call-home',
    '--socket-timeout',
    '15',
    url,
  ]);

  if (res.killed) {
    throw new ApiError(504, 'timeout', 'That video took too long to analyze. Please try again.');
  }
  if (res.code !== 0) throw humanizeYtDlpError(res.stderr);

  try {
    return JSON.parse(res.stdout);
  } catch {
    throw new ApiError(502, 'extract_failed', 'Received an unexpected response while analyzing that link.');
  }
}

function normalizeInfo(raw, url, platform, hasFfmpeg) {
  const title = pickText(raw.title, raw.fulltitle) || 'Untitled video';
  const author = pickText(raw.uploader, raw.channel, raw.artist, raw.creator) || 'Unknown creator';
  const handle = pickText(raw.uploader_id, raw.channel_id, raw.creator);
  const options = buildQualityOptions(raw, platform, hasFfmpeg);

  return {
    id: pickText(raw.id) || null,
    url,
    platform: platform.id,
    platformLabel: platform.label,
    title,
    author,
    handle,
    durationSeconds: Number.isFinite(raw.duration) ? Math.round(raw.duration) : null,
    thumbnail: safeThumbnail(raw),
    views: formatCount(Number(raw.view_count)),
    formats: options.map((o) => ({
      token: o.token,
      label: o.label,
      note: o.note,
      height: o.height,
      ext: o.ext,
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Download
 * ------------------------------------------------------------------ */

const MIME_BY_EXT = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
};

/** RFC 6266 Content-Disposition with a UTF-8 fallback for non-ASCII titles. */
function contentDisposition(filename) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'video.mp4';
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * Download a video and stream it straight to the visitor as an attachment.
 * Files land in a private temp folder that is always cleaned up, so disk use
 * is bounded even if the client disconnects mid-transfer.
 */
async function streamDownload({ url, platform, formatToken, res }) {
  if (isDemoRequested() || !getEngine().ytDlp.present) {
    throw new ApiError(
      501,
      'demo_mode',
      'Demo mode: install yt-dlp on the server (and optionally ffmpeg) to enable real downloads.'
    );
  }

  const raw = await fetchRawInfo(url);
  const options = buildQualityOptions(raw, platform, getEngine().ffmpeg.present);
  const selected = options.find((o) => o.token === formatToken) || options.find((o) => o.token === 'best');
  if (!selected) throw new ApiError(400, 'invalid_format', 'That quality is not available for this video.');

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pulsesave-'));
  try {
    const outputTemplate = path.join(tmpDir, '%(title).120B.%(ext)s');
    const result = await runYtDlp(
      [
        '--no-warnings',
        '--no-playlist',
        '--no-part',
        '--newline',
        '-f',
        selected.expr,
        '-o',
        outputTemplate,
        url,
      ],
      { timeoutMs: DOWNLOAD_TIMEOUT_MS }
    );

    if (result.killed) {
      throw new ApiError(504, 'timeout', 'The download timed out. Please try a smaller quality or try again later.');
    }
    if (result.code !== 0) throw humanizeYtDlpError(result.stderr);

    const files = (await fs.readdir(tmpDir)).filter((f) => !f.endsWith('.part') && !f.endsWith('.ytdl'));
    if (!files.length) {
      throw new ApiError(502, 'extract_failed', 'The download finished but produced no file. Please try again.');
    }

    const fileName = files[0];
    const fullPath = path.join(tmpDir, fileName);
    const stat = await fs.stat(fullPath);
    const ext = path.extname(fileName).replace('.', '').toLowerCase();

    res.status(200);
    res.setHeader('Content-Type', MIME_BY_EXT[ext] || 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', contentDisposition(fileName));
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    await pipeline(createReadStream(fullPath), res);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = {
  getEngine,
  resetEngineCache,
  getVideo,
  streamDownload,
  humanizeYtDlpError,
  contentDisposition,
};
