'use strict';

/**
 * Demo fallback data and utilities
 * -------------------------------
 * Provides mock video metadata when yt-dlp is not installed.
 * This ensures the UI remains functional in demo mode.
 */
'use strict';

/**
 * Demo video entries keyed by platform.
 * Used when yt-dlp is unavailable; the UI falls back to these.
 */
const demoData = {
  tiktok: {
    title: 'Sample TikTok video',
    author: 'tiktok_user',
    duration: '1:23',
    thumbnail: 'https://picsum.photos/seed/tiktok/400/225',
    formats: [
      { label: 'Best available', value: 'best', disabled: true }
    ]
  },
  instagram: {
    title: 'Sample Instagram Reel',
    author: 'instagram_user',
    duration: '2:15',
    thumbnail: 'https://picsum.photos/seed/instagram/400/225',
    formats: [
      { label: 'Best available', value: 'best', disabled: true }
    ]
  },
  youtube: {
    title: 'Sample YouTube video',
    author: 'youtube_channel',
    duration: '3:45',
    thumbnail: 'https://picsum.photos/seed/youtube/400/225',
    formats: [
      { label: 'Best available', value: 'best', disabled: true }
    ]
  }
};

/**
 * Get demo metadata for a given platform.
 * @param {string} platform - The platform key ('tiktok', 'instagram', 'youtube')
 * @returns {Object} Demo metadata object
 */
function getDemo(platform) {
  return demoData[platform] || demoData.youtube;
}

/**
 * Check if yt-dlp is available (stub - real check happens at runtime)
 * @returns {boolean} Always returns false in demo-only builds
 */
function isYtDlpAvailable() {
  return false;
}

module.exports = { getDemo, isYtDlpAvailable };