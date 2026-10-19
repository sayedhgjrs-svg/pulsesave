'use strict';

/**
 * yt-dlp wrapper with graceful demo fallback
 * -------------------------------
 * Wraps the yt-dlp child process, providing metadata extraction and streaming.
 * Falls back to demo data when yt-dlp is not installed.
 */
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

/**
 * Launch yt-dlp with the given arguments.
 * Returns a child_process spawned at the yt-dlp binary path.
 */
function launchYtDlp(args) {
  const ytDlpPath = path.join(__dirname, '..', '..', '..', 'node_modules', '.bin', 'yt-dlp');
  return spawn(ytDlpPath, args, {
    cwd: os.tmpdir(),
    env: { ...process.env, PATH: process.env.PATH },
    windowsHide: true,
    timeout: 30_000,
  });
}

/**
 * Extract metadata from a video URL using yt-dlp.
 * Returns a promise that resolves to the metadata object, or rejects if yt-dlp is unavailable.
 */
async function extractMetadata(url, extraArgs = []) {
  try {
    const proc = launchYtDlp(['--dump-json', ...extraArgs, url]);
    let data = '';
    proc.stdout.on('data', chunk => data += chunk);
    proc.stderr.on('data', chunk => {});
    return new Promise((resolve, reject) => {
      proc.on('close', code => {
        if (code !== 0) return reject(new Error('yt-dlp exited with code ' + code));
        try {
          resolve(JSON.parse(data));
        } catch { reject(new Error('invalid JSON from yt-dlp'));
        }
      });
      proc.on('error', reject);
    });
  } catch { return Promise.resolve({ title: 'Demo video', platform: 'unknown', demo: true }); }
}

/**
 * Stream a video file using yt-dlp.
 * Returns a node.js ReadStream.
 */
async function streamDownload(url, format) {
  try {
    const proc = launchYtDlp(['-f', format || 'best', '--output', '-', url]);
    return proc.stdout;
  } catch { return null; }
}

module.exports = { extractMetadata, streamDownload };