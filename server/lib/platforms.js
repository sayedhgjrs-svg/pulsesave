'use strict';

const { ApiError } = require('./errors');

/**
 * Supported platforms.
 *
 * Only hosts listed here are ever sent to the extractor. This doubles as our
 * SSRF guard: the server will not fetch arbitrary/internal URLs on behalf of a
 * visitor (no http://localhost, no 169.254.169.254, no private LAN hosts).
 */
const PLATFORMS = {
  tiktok: {
    id: 'tiktok',
    label: 'TikTok',
    accent: '#25f4ee',
    hosts: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'm.tiktok.com', 'tiktokv.com'],
  },
  instagram: {
    id: 'instagram',
    label: 'Instagram Reels',
    accent: '#e1306c',
    hosts: ['instagram.com', 'instagr.am', 'ddinstagram.com'],
  },
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    accent: '#ff3b5c',
    hosts: ['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'music.youtube.com'],
  },
};

const PLATFORM_LIST = Object.values(PLATFORMS);

/** Host matcher: exact match or a sub-domain of an allowed host. */
function matchesHost(hostname, allowedHost) {
  return hostname === allowedHost || hostname.endsWith('.' + allowedHost);
}

/**
 * Parse + validate a user-submitted link.
 *
 * @param {string} raw  the raw string pasted by the visitor
 * @returns {{ url: string, platform: (typeof PLATFORMS)[keyof typeof PLATFORMS] }}
 * @throws {ApiError} 400 when the value is not a usable, supported link
 */
function detectTarget(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new ApiError(400, 'missing_url', 'Paste a video link first, then hit Download.');
  }

  const value = raw.trim();
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new ApiError(400, 'invalid_url', 'That does not look like a valid link. It should start with https://');
  }

  // Only web schemes, and never embedded credentials (user:pass@host tricks).
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ApiError(400, 'invalid_url', 'Only http and https video links are supported.');
  }
  if (parsed.username || parsed.password) {
    throw new ApiError(400, 'invalid_url', 'That link contains credentials and was rejected.');
  }

  const hostname = parsed.hostname.toLowerCase();
  const platform = PLATFORM_LIST.find((p) => p.hosts.some((host) => matchesHost(hostname, host)));

  if (!platform) {
    throw new ApiError(
      400,
      'unsupported_url',
      'That link is not from TikTok, Instagram or YouTube yet. Try one of the supported platforms.'
    );
  }

  // Normalise: drop tracking-only params that some share links append, keep everything else.
  parsed.hash = '';
  return { url: parsed.toString(), platform };
}

/** Small helper used by the health endpoint + UI chips. */
function platformSummary() {
  return PLATFORM_LIST.map((p) => ({ id: p.id, label: p.label, accent: p.accent, hosts: p.hosts.length }));
}

module.exports = { PLATFORMS, PLATFORM_LIST, detectTarget, platformSummary };
