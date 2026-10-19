'use strict';

/**
 * Format detection and quality menu generation
 * ----------------------------------------
 * Extracts platform, title, duration, thumbnail, and quality options
 * from a video URL using yt-dlp (or demo data when unavailable).
 * Handles TikTok watermark detection and filtering.
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
function detectPlatform(url) {
  for (const [platform, regex] of Object.entries(PLATFORM_REGEX)) {
    if (regex.test(url)) return platform;
  }
  return null;
}

/**
 * Get a summary of the platform for display in the quality menu.
 * @param {string} platform - The platform key
 * @returns {string} Human-readable platform name with badge CSS class
 */
function platformSummary(platform) {
  const summaries = {
    tiktok: 'TikTok <span class="badge badge-tiktok">📱</span>',
    instagram: 'Instagram Reels <span class="badge badge-ig">📸</span>',
    youtube: 'YouTube <span class="badge badge-yt">▶</span>'
  };
  return summaries[platform] || 'Unknown platform';
}

/**
 * Generate the quality menu options from yt-dlp metadata or demo data.
 * @param {Object|undefined} info - The video metadata info object
 * @returns {Array} Array of { label, value } quality options
 */
function generateQualityMenu(info) {
  if (!info || info.demo) {
    return [
      { label: 'Best available', value: 'best', disabled: true },
      { label: '720p', value: '720p', disabled: true },
      { label: '480p', value: '480p', disabled: true }
    ];
  }
  const formatOptions = [];
  const fmtMap = info.formats || [];
  // Prioritize high-quality progressive formats
  for (const fmt of fmtMap) {
    if (fmt.acodec !== 'none' && fmt.vcodec !== 'none' && fmt.height) {
      const label = fmt.height >= 1080 ? '4K' : fmt.height >= 720 ? '1080p' : '720p';
      formatOptions.push({ label, value: fmt.format_id });
    }
  }
  // Deduplicate by label while preserving order
  const seen = new Set();
  return formatOptions.filter(o => !seen.has(o.label) && !seen.add(o.label));
}

/**
 * Filter out watermarked TikTok formats.
 * TikTok serves both watermarked and clean renditions; this function
 * drops candidates that contain the watermark flag so the default
 * download is always watermark-free.
 * @param {Array} formats - Raw format list from yt-dlp
 * @returns {Array} Formats with watermarked candidates removed
 */
function filterWatermarkedFormats(formats) {
  return formats.filter(fmt => {
    const fmtStr = JSON.stringify(fmt).toLowerCase();
    // Keep formats that explicitly have no watermark or don't mention it
    const hasNowatermark = fmtStr.includes('nowatermark');
    const hasWatermark = fmtStr.includes('watermark') && !hasNowatermark;
    return !hasWatermark;
  });
}

module.exports = { detectPlatform, platformSummary, generateQualityMenu, filterWatermarkedFormats };