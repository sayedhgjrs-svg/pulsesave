'use strict';

/**
 * Quality menu builder.
 *
 * Turns the raw `yt-dlp -J` payload into the small, stable list of quality
 * chips the UI renders. Each chip carries a *token* (`q1080`, `max`, `best`)
 * that is safe to send back and forth — the actual yt-dlp format expression is
 * rebuilt server-side at download time, so no raw user input ever reaches the
 * extractor command line.
 *
 * Special case — TikTok watermarks: TikTok serves both a watermarked and a
 * clean ("no watermark") rendition of the same video. When both exist we drop
 * the watermarked candidates before picking, which is what makes the default
 * download clean.
 */

const { PLATFORMS } = require('./platforms');

const BUCKETS = [2160, 1440, 1080, 720, 480, 360, 240, 144];

/**
 * TikTok marks the clean rendition `nowatermark` / `nowm` / `noop`, so those
 * markers are stripped *before* testing — otherwise "nowatermark" would match
 * /watermark/ and the clean rendition would be discarded by mistake.
 */
const CLEAN_RE = /no[_\s-]?watermark|\bnowm\b|\bnoop\b/gi;
const WM_RE = /watermark|_wm\b|\bwm\b/i;

function isWatermarked(format) {
  const text = `${format.format_id || ''} ${format.format_note || ''} ${format.protocol || ''}`.replace(
    CLEAN_RE,
    ' '
  );
  return WM_RE.test(text);
}

function qualityWord(height) {
  if (height >= 2160) return '4K';
  if (height >= 1440) return '2K';
  if (height >= 1080) return 'Full HD';
  if (height >= 720) return 'HD';
  return 'SD';
}

function noteFor(format) {
  const ext = (format.ext || 'mp4').toUpperCase();
  const fps = Number(format.fps) || 0;
  const bits = [];
  if (format.height) bits.push(qualityWord(format.height));
  if (fps >= 50) bits.push(`${fps}fps`);
  return [ext, ...bits].join(' · ');
}

/** Best single-file (video + audio) format at or below `maxHeight`. */
function bestMuxedAt(formats, maxHeight) {
  return formats
    .filter((f) => Number(f.height) > 0 && Number(f.height) <= maxHeight)
    .sort((a, b) => b.height - a.height || (Number(b.tbr) || 0) - (Number(a.tbr) || 0))[0];
}

function maxHeightOf(formats) {
  return formats.reduce((max, f) => Math.max(max, Number(f.height) || 0), 0);
}

/**
 * @returns {Array<{token:string,label:string,note:string,height:number|null,ext:string,expr:string}>}
 */
function buildQualityOptions(raw, platform, hasFfmpeg) {
  const all = Array.isArray(raw && raw.formats) ? raw.formats.filter((f) => f && f.format_id) : [];
  const withVideo = all.filter((f) => f.vcodec && f.vcodec !== 'none');
  const muxed = withVideo.filter((f) => f.acodec && f.acodec !== 'none');

  // TikTok: prefer the clean rendition when the platform exposes one.
  let pool = muxed;
  if (platform && platform.id === PLATFORMS.tiktok.id && muxed.some((f) => !isWatermarked(f))) {
    pool = muxed.filter((f) => !isWatermarked(f));
  }

  const options = [];
  const seenIds = new Set();
  const seenHeights = new Set();

  for (const bucket of BUCKETS) {
    const best = bestMuxedAt(pool, bucket);
    if (!best || seenIds.has(best.format_id) || seenHeights.has(best.height)) continue;
    seenIds.add(best.format_id);
    seenHeights.add(best.height);
    options.push({
      token: `q${best.height}`,
      label: `${best.height}p`,
      note: noteFor(best),
      height: Number(best.height),
      ext: best.ext || 'mp4',
      // Exact format id -> deterministic pick (this is how we skip watermarks).
      expr: String(best.format_id),
    });
  }

  // Highest-quality merged option: separate video + audio streams, merged with
  // ffmpeg. Only offered when it actually beats the best single-file option.
  if (hasFfmpeg) {
    const bestMuxedHeight = maxHeightOf(pool);
    const bestVideoOnlyHeight = maxHeightOf(withVideo.filter((f) => f.acodec === 'none'));
    if (bestVideoOnlyHeight > bestMuxedHeight) {
      options.unshift({
        token: 'max',
        label: `${bestVideoOnlyHeight}p+`,
        note: 'MP4 · merged best A/V',
        height: bestVideoOnlyHeight,
        ext: 'mp4',
        expr: 'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b[ext=mp4]/b',
      });
    }
  }

  // Always-available fallback so the UI is never empty.
  options.push({
    token: 'best',
    label: 'Auto',
    note: 'Best single file',
    height: null,
    ext: 'mp4',
    expr: 'best[ext=mp4]/best',
  });

  return options;
}

module.exports = { buildQualityOptions, BUCKETS, isWatermarked };
