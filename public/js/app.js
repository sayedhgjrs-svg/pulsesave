'use strict';

const urlInput = document.getElementById('url-input');
const analyzeBtn = document.getElementById('analyze-btn');
const resultsDiv = document.getElementById('results');
const statusDiv = document.createElement('div');
statusDiv.id = 'status';
statusDiv.style = 'margin: 16px 0; color: var(--muted); font-size: 0.875rem;';

// Live platform detection
const platformLabels = {
  tiktok: 'TikTok',
  instagram: 'Instagram Reels',
  youtube: 'YouTube'
};

// State
let activeQuality = 'best';
let activeUrl = null;
let isAnalyzing = false;

async function analyzeUrl() {
  const url = urlInput.value.trim();
  if (!url || isAnalyzing) return;
  isAnalyzing = true;
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Analyzing...';
  analyzeBtn.innerHTML += ' <span class="spinner"></span>';
  resultsDiv.innerHTML = '';
  statusDiv.textContent = '';

  try {
    const resp = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
    if (!resp.ok) throw new Error(resp.statusText || 'Analysis failed');
    const info = await resp.json();

    // Live mode: real extraction; demo mode: friendly preview
    if (info.demo) {
      showPreview(info);
    } else {
      showLiveInfo(info);
    }
  } catch (e) {
    showError(e.message || 'Analysis failed');
  } finally {
    isAnalyzing = false;
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze';
    analyzeBtn.innerHTML = 'Analyze';
  }
}

function showPreview(info) {
  resultsDiv.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <img src="/placeholder.svg?width=400&height=225&text=Preview" alt="Thumbnail" loading="lazy" />
    <div class="info">
      <h3>${escapeHtml(info.title || 'Unknown video')}</h3>
      <p>${escapeHtml(info.platform || 'Unknown platform')}</p>
      <span class="badge badge-${info.platform ? info.platform.replace(/\s+/g, '').toLowerCase() : 'unknown'}">${info.platform || 'Unknown'}</span>
      <div class="quality-info">Preview data (install yt-dlp for live)</div>
    </div>
  `;
  resultsDiv.appendChild(card);
  statusDiv.textContent = 'Preview mode - install yt-dlp for live extraction';
  resultsDiv.appendChild(statusDiv);
}

function showLiveInfo(info) {
  resultsDiv.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <img src="${info.thumbnail || '/placeholder.svg?width=400&height=225&text=Result'}" alt="Thumbnail" loading="lazy" />
    <div class="info">
      <h3>${escapeHtml(info.title)}</h3>
      <p>${info.author ? 'By ' + escapeHtml(info.author) : ''}</p>
      <div>
        ${Object.entries(info.formats || []).slice(0, 5).map(([f, details]) => `
          <span class="quality-chip" data-quality="${f}">${f}</span>
        `).join('')}
      </div>
    </div>
  `;
  resultsDiv.appendChild(card);
  attachQualityChips(info.formats || []);
  statusDiv.textContent = 'Ready - select a quality and download';
  resultsDiv.appendChild(statusDiv);
}

function attachQualityChips(formats) {
  const chips = resultsDiv.querySelectorAll('.quality-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const quality = chip.dataset.quality;
      activeQuality = quality;
      chips.forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
  });
}

function showError(msg) {
  resultsDiv.innerHTML = '';
  statusDiv.textContent = 'Error: ' + msg;
  resultsDiv.appendChild(statusDiv);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Event listeners
analyzeBtn.addEventListener('click', analyzeUrl);
urlInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') analyzeUrl();
});

// Initial focus
urlInput.focus();
