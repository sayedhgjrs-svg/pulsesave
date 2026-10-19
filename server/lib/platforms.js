'use strict';

/**
 * Platform detection and summary for the video downloader API
 * -------------------------------------------
 * Detects the platform from a URL and provides summary info
 * for the quality menu and UI badges.
 */
'use strict';

const PLATFORM_REGEX = {
  tiktok: /(?:tiktok\.com\/|vm\.tiktok\.co\/)[^\s]+/i,
  instagram: /(?:instagram\.com\/reels?\/|ii\.instagram\.com\/reel)[^\s]+/i,
  youtube: /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be)[^\s]+/i
};

/**
 * Detect which platform a URL belongs to.
 * @param {string} url - The video URL to analyze
 * @returns {string|null} Platform key ('tiktok', 'instagram', 'youtube', or null)
 */
function detectTarget(url) {
  for (const [platform, regex] of Object.entries(PLATFORM_REGEX)) {
    if (regex.test(url)) return platform;
  }
  return null;
}

/**
 * Get a human-readable platform summary with badge HTML.
 * @param {string} platform - The platform key
 * @returns {string} Summary string with badge HTML
 */
function platformSummary(platform) {
  const summaries = {
    tiktok: 'TikTok <span class="badge badge-tiktok">📱</span>',
    instagram: 'Instagram Reels <span class="badge badge-ig">📸</span>',
    youtube: 'YouTube <span class="badge badge-yt">▶</span>'
  };
  return summaries[platform] || 'Unknown platform';
}

module.exports = { detectTarget, platformSummary };