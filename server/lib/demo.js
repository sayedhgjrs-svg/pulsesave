'use strict';

/**
 * Demo data.
 *
 * When yt-dlp is not installed (or the platform blocks the server), the API
 * answers with these clearly-flagged fixtures so the whole interface —
 * preview card, quality chips, empty states — stays demonstrable. The UI
 * shows a "preview data" badge whenever `source === 'demo'`.
 *
 * Thumbnails are inline SVG data URIs, so they render with zero network access.
 */

function svgThumb({ from, to, label, durationLabel }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <radialGradient id="v" cx="0.5" cy="0.45" r="0.75">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/>
    </radialGradient>
  </defs>
  <rect width="640" height="360" fill="url(#g)"/>
  <g opacity="0.14" stroke="#fff" stroke-width="1">
    <path d="M0 120H640M0 240H640M160 0V360M320 0V360M480 0V360"/>
  </g>
  <circle cx="320" cy="176" r="54" fill="#ffffff" opacity="0.16"/>
  <path d="M303 146 L353 176 L303 206 Z" fill="#ffffff" opacity="0.92"/>
  <rect width="640" height="360" fill="url(#v)"/>
  <text x="28" y="322" fill="#ffffff" opacity="0.92" font-family="Inter,Segoe UI,Helvetica,Arial,sans-serif" font-size="26" font-weight="600">${label}</text>
  <g>
    <rect x="548" y="288" width="64" height="34" rx="10" fill="#000" opacity="0.55"/>
    <text x="580" y="311" text-anchor="middle" fill="#fff" font-family="Inter,Segoe UI,Helvetica,Arial,sans-serif" font-size="17">${durationLabel}</text>
  </g>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\n\s*/g, ' '))}`;
}

const FIXTURES = {
  tiktok: {
    title: 'Golden hour on the rooftop — wait for the last shot',
    author: '@aurora.frames',
    handle: '@aurora.frames',
    durationSeconds: 17,
    views: 1_284_000,
    colors: ['#25f4ee', '#ff0050'],
    qualities: [
      { token: 'q1080', label: '1080p', note: 'MP4 · Full HD', height: 1080 },
      { token: 'q720', label: '720p', note: 'MP4 · HD', height: 720 },
      { token: 'q480', label: '480p', note: 'MP4 · SD', height: 480 },
    ],
  },
  instagram: {
    title: 'Morning espresso ritual ☕ in 20 seconds',
    author: '@daily.brews',
    handle: 'daily.brews',
    durationSeconds: 24,
    views: 482_000,
    colors: ['#feda75', '#d62976', '#4f5bd5'],
    qualities: [
      { token: 'q1080', label: '1080p', note: 'MP4 · Full HD', height: 1080 },
      { token: 'q720', label: '720p', note: 'MP4 · HD', height: 720 },
      { token: 'q480', label: '480p', note: 'MP4 · SD', height: 480 },
    ],
  },
  youtube: {
    title: 'Designing a premium dark-mode UI from scratch',
    author: 'PixelForge',
    handle: 'PixelForge',
    durationSeconds: 612,
    views: 1_400_000,
    colors: ['#ff3b5c', '#7c5cff'],
    qualities: [
      { token: 'q720', label: '720p', note: 'MP4 · HD', height: 720 },
      { token: 'q480', label: '480p', note: 'MP4 · SD', height: 480 },
      { token: 'q360', label: '360p', note: 'MP4 · SD', height: 360 },
    ],
  },
};

function formatDurationLabel(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function buildDemoVideo(platform, url) {
  const fixture = FIXTURES[platform.id] || FIXTURES.youtube;
  return {
    id: `demo-${platform.id}`,
    url,
    platform: platform.id,
    platformLabel: platform.label,
    title: fixture.title,
    author: fixture.author,
    handle: fixture.handle,
    durationSeconds: fixture.durationSeconds,
    thumbnail: svgThumb({
      from: fixture.colors[0],
      to: fixture.colors[fixture.colors.length - 1],
      label: platform.label,
      durationLabel: formatDurationLabel(fixture.durationSeconds),
    }),
    views: fixture.views,
    formats: fixture.qualities.map((q) => ({ ...q, ext: 'mp4' })),
  };
}

module.exports = { buildDemoVideo, FIXTURES };
