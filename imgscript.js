/**
 * Pure Vanilla JavaScript: X (Twitter) Image Downloader Client
 * 
 * Features:
 * - URL normalization and strict X/Twitter domain validation
 * - Communication with Cloudflare Worker API (/api/x-images and /api/x-image-download)
 * - Single image and sequential bulk downloading (No ZIP)
 * - Fullscreen image lightbox preview
 * - Dark / Light theme toggle
 * - Sample tweet quick testing
 * - Documentation and deployment guide viewer
 */

(function () {
  'use strict';

  // DOM Elements
  const urlInput = document.getElementById('tweet-url-input');
  const downloadForm = document.getElementById('downloader-form');
  const submitBtn = document.getElementById('submit-btn');
  const clearBtn = document.getElementById('clear-input-btn');
  const statusContainer = document.getElementById('status-container');
  const statusAlert = document.getElementById('status-alert');
  const loadingState = document.getElementById('loading-state');
  const resultsSection = document.getElementById('results-section');
  const imagesGrid = document.getElementById('images-grid');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const docsModal = document.getElementById('docs-modal');
  const openDocsBtn = document.getElementById('open-docs-btn');
  const closeDocsBtn = document.getElementById('close-docs-btn');
  const lightboxOverlay = document.getElementById('lightbox-overlay');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCloseBtn = document.getElementById('lightbox-close-btn');
  const samplePills = document.querySelectorAll('.sample-pill-btn');
  const faqItems = document.querySelectorAll('.faq-item');

  // Configuration: Live Cloudflare Worker Base URL
  const WORKER_BASE_URL = 'https://ximage.romitkr3018.workers.dev';

  // State
  let currentExtractedData = null;
  let isDownloadingAll = false;

  // Initial Theme & Worker Status Setup
  initTheme();
  checkWorkerHealth();

  /**
   * Check Worker Health on startup
   */
  async function checkWorkerHealth() {
    const badge = document.getElementById('worker-status-badge');
    if (!badge) return;

    try {
      const res = await fetch(`${WORKER_BASE_URL}/health`, { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        badge.innerHTML = `
          <span class="status-dot-pulse" style="background-color:var(--color-success);"></span>
          <span>Worker: Live & Connected</span>
        `;
        badge.setAttribute('title', `Cloudflare Worker is running at ${WORKER_BASE_URL}`);
      }
    } catch {
      badge.innerHTML = `
        <span class="status-dot-pulse" style="background-color:#f59e0b;box-shadow:none;"></span>
        <span>Worker: ${WORKER_BASE_URL.replace(/^https?:\/\//, '')}</span>
      `;
    }
  }

  // Event Listeners
  if (downloadForm) {
    downloadForm.addEventListener('submit', handleFormSubmit);
  }

  if (urlInput) {
    urlInput.addEventListener('input', handleInputChange);
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      urlInput.value = '';
      clearBtn.style.display = 'none';
      urlInput.focus();
      hideStatus();
    });
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  if (openDocsBtn && docsModal) {
    openDocsBtn.addEventListener('click', () => {
      docsModal.style.display = 'flex';
    });
  }

  if (closeDocsBtn && docsModal) {
    closeDocsBtn.addEventListener('click', () => {
      docsModal.style.display = 'none';
    });
  }

  // Close modals on outside click
  window.addEventListener('click', (e) => {
    if (docsModal && e.target === docsModal) {
      docsModal.style.display = 'none';
    }
    if (lightboxOverlay && e.target === lightboxOverlay) {
      closeLightbox();
    }
  });

  if (lightboxCloseBtn) {
    lightboxCloseBtn.addEventListener('click', closeLightbox);
  }

  // Keyboard escape handler for modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (lightboxOverlay && lightboxOverlay.style.display === 'flex') {
        closeLightbox();
      } else if (docsModal && docsModal.style.display === 'flex') {
        docsModal.style.display = 'none';
      }
    }
  });

  // Sample Tweet Pills
  samplePills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const sampleUrl = pill.getAttribute('data-url');
      if (sampleUrl && urlInput) {
        urlInput.value = sampleUrl;
        handleInputChange();
        handleFormSubmit(new Event('submit'));
      }
    });
  });

  // FAQ Accordion
  faqItems.forEach((item) => {
    const questionBtn = item.querySelector('.faq-question-btn');
    if (questionBtn) {
      questionBtn.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        // Close all others
        faqItems.forEach((f) => f.classList.remove('open'));
        if (!isOpen) {
          item.classList.add('open');
        }
      });
    }
  });

  /**
   * Handle Input Change
   */
  function handleInputChange() {
    const val = urlInput.value.trim();
    if (clearBtn) {
      clearBtn.style.display = val.length > 0 ? 'flex' : 'none';
    }
    if (val.length === 0) {
      hideStatus();
    }
  }

  /**
   * Handle Form Submission
   */
  async function handleFormSubmit(e) {
    if (e) e.preventDefault();

    const rawUrl = urlInput.value.trim();
    hideStatus();
    hideResults();

    if (!rawUrl) {
      showStatus('Please enter a public X or Twitter post URL.', 'error');
      return;
    }

    // Client-side URL Validation & Normalization
    const validated = validateAndNormalizeUrl(rawUrl);
    if (!validated.isValid) {
      showStatus(validated.error || 'Invalid X post URL.', 'error');
      return;
    }

    // Set Loading State
    setLoading(true);

    try {
      // Send request to Live Cloudflare Worker API endpoint with fallback
      const queryParam = `url=${encodeURIComponent(validated.normalizedUrl)}`;
      const workerUrl = `${WORKER_BASE_URL}/api/x-images?${queryParam}`;
      
      let response;
      let data;
      
      try {
        response = await fetch(workerUrl);
        data = await response.json();
      } catch (workerErr) {
        console.warn('Worker direct fetch failed, trying local fallback proxy:', workerErr);
        const fallbackUrl = `/api/x-images?${queryParam}`;
        response = await fetch(fallbackUrl);
        data = await response.json();
      }

      setLoading(false);

      if (!response.ok || !data.success) {
        showStatus(data.error || 'No images found.', 'error');
        return;
      }

      if (!data.images || data.images.length === 0) {
        showStatus('No publicly available images were found in this post.', 'info');
        return;
      }

      // Render Results
      currentExtractedData = data;
      renderResults(data);

    } catch (err) {
      setLoading(false);
      console.error('Fetch error:', err);
      showStatus('The request timed out or the network is unreachable. Please try again.', 'error');
    }
  }

  /**
   * URL Validation & Normalization
   */
  function validateAndNormalizeUrl(input) {
    // Basic scheme sanitize
    if (input.startsWith('javascript:') || input.startsWith('data:') || input.startsWith('file:')) {
      return { isValid: false, error: 'Invalid URL format.' };
    }

    let urlObj;
    try {
      urlObj = new URL(input.startsWith('http') ? input : `https://${input}`);
    } catch {
      return { isValid: false, error: 'Invalid X post URL.' };
    }

    const host = urlObj.hostname.toLowerCase();
    const approvedHosts = ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com', 'mobile.x.com'];

    if (!approvedHosts.includes(host)) {
      return { isValid: false, error: 'Only URLs from x.com or twitter.com are supported.' };
    }

    // Match status ID pattern
    const match = urlObj.pathname.match(/^\/([a-zA-Z0-9_]{1,50})\/status(?:es)?\/(\d+)/i);
    if (!match) {
      return { isValid: false, error: 'Invalid X post URL. Please provide a link to a specific tweet (e.g. /status/123456789).' };
    }

    const username = match[1];
    const tweetId = match[2];

    return {
      isValid: true,
      username: username,
      tweetId: tweetId,
      normalizedUrl: `https://x.com/${username}/status/${tweetId}`
    };
  }

  /**
   * Render Extracted Tweet & Images
   */
  function renderResults(data) {
    if (!resultsSection || !imagesGrid) return;

    const { tweet, images } = data;

    // Update Tweet Header Card
    const authorAvatar = document.getElementById('res-author-avatar');
    const authorDisplayName = document.getElementById('res-author-name');
    const authorUsername = document.getElementById('res-author-username');
    const imageCountBadge = document.getElementById('res-image-count');
    const tweetText = document.getElementById('res-tweet-text');

    if (authorAvatar) {
      if (tweet.avatarUrl) {
        authorAvatar.src = tweet.avatarUrl;
        authorAvatar.style.display = 'block';
      } else {
        authorAvatar.style.display = 'none';
      }
    }

    if (authorDisplayName) {
      authorDisplayName.textContent = tweet.displayName || `@${tweet.username}`;
    }

    if (authorUsername) {
      authorUsername.textContent = `@${tweet.username}`;
    }

    if (imageCountBadge) {
      const count = images.length;
      imageCountBadge.textContent = `${count} ${count === 1 ? 'Image' : 'Images'} Found`;
    }

    if (tweetText) {
      if (tweet.text && tweet.text.trim().length > 0) {
        tweetText.textContent = tweet.text;
        tweetText.style.display = 'block';
      } else {
        tweetText.style.display = 'none';
      }
    }

    // Set grid layout class according to count
    imagesGrid.className = 'images-grid';
    if (images.length === 1) imagesGrid.classList.add('grid-1');
    else if (images.length === 2) imagesGrid.classList.add('grid-2');
    else if (images.length === 3) imagesGrid.classList.add('grid-3');
    else imagesGrid.classList.add('grid-4');

    // Build Image Cards
    imagesGrid.innerHTML = '';

    images.forEach((img, idx) => {
      const card = document.createElement('div');
      card.className = 'image-item-card';

      const downloadUrl = `${WORKER_BASE_URL}/api/x-image-download?url=${encodeURIComponent(img.url)}&filename=${encodeURIComponent(img.downloadFilename || `twitter-image-${idx + 1}.jpg`)}`;

      card.innerHTML = `
        <div class="image-preview-container" data-full-url="${escapeHtml(img.url)}">
          <img 
            src="${escapeHtml(img.previewUrl || img.url)}" 
            alt="X Image ${idx + 1}" 
            class="image-preview-img" 
            loading="lazy"
          />
          <span class="image-index-tag">Image ${idx + 1} of ${images.length}</span>
          <div class="image-zoom-indicator">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            Click to preview
          </div>
        </div>
        <div class="image-meta-footer">
          <div class="meta-details">
            <span class="meta-pill highlight">${escapeHtml(img.resolution || 'Original Quality')}</span>
            <span class="meta-pill">${escapeHtml(img.format || 'JPEG')}</span>
            <span class="meta-pill">${escapeHtml(img.type || 'image/jpeg')}</span>
          </div>
          <div class="image-action-buttons">
            <button class="btn-card-action btn-card-download" data-download-url="${escapeHtml(downloadUrl)}" data-filename="${escapeHtml(img.downloadFilename || `twitter-image-${idx + 1}.jpg`)}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </button>
            <a href="${escapeHtml(img.url)}" target="_blank" rel="noopener noreferrer" class="btn-card-action btn-card-view">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Open Full
            </a>
          </div>
        </div>
      `;

      // Preview click handler for Lightbox
      const previewContainer = card.querySelector('.image-preview-container');
      previewContainer.addEventListener('click', () => {
        openLightbox(img.url);
      });

      // Individual Download Button
      const downloadBtn = card.querySelector('.btn-card-download');
      downloadBtn.addEventListener('click', () => {
        downloadSingleImage(downloadUrl, img.downloadFilename);
      });

      imagesGrid.appendChild(card);
    });

    // Update Bulk Download Bar
    const bulkMetaText = document.getElementById('bulk-meta-text');
    const downloadAllBtn = document.getElementById('download-all-btn');

    if (bulkMetaText) {
      bulkMetaText.textContent = `Download all ${images.length} high-resolution images sequentially`;
    }

    if (downloadAllBtn) {
      // Remove old listeners
      const newBtn = downloadAllBtn.cloneNode(true);
      downloadAllBtn.parentNode.replaceChild(newBtn, downloadAllBtn);

      newBtn.addEventListener('click', () => {
        handleDownloadAll(images);
      });
    }

    resultsSection.style.display = 'block';

    // Smooth scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Download a single image using the streaming Worker download endpoint
   */
  function downloadSingleImage(endpointUrl, filename) {
    const link = document.createElement('a');
    link.href = endpointUrl;
    link.download = filename || 'twitter-image.jpg';
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Sequential Bulk Image Downloader
   * Downloads files sequentially with a controlled interval to prevent browser blockage.
   * No ZIP archive is used.
   */
  async function handleDownloadAll(images) {
    if (isDownloadingAll || !images || images.length === 0) return;

    const downloadAllBtn = document.getElementById('download-all-btn');
    isDownloadingAll = true;

    if (downloadAllBtn) {
      downloadAllBtn.disabled = true;
    }

    showStatus(`Starting sequential download for ${images.length} images...`, 'info');

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const filename = img.downloadFilename || `twitter-image-${i + 1}.jpg`;
      const downloadUrl = `${WORKER_BASE_URL}/api/x-image-download?url=${encodeURIComponent(img.url)}&filename=${encodeURIComponent(filename)}`;

      if (downloadAllBtn) {
        downloadAllBtn.innerHTML = `
          <div class="spinner" style="width:14px;height:14px;border-width:2px;"></div>
          Downloading ${i + 1} of ${images.length}...
        `;
      }

      downloadSingleImage(downloadUrl, filename);

      // 400ms delay between sequential downloads
      if (i < images.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    if (downloadAllBtn) {
      downloadAllBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        All Images Downloaded
      `;
      setTimeout(() => {
        downloadAllBtn.disabled = false;
        downloadAllBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download All
        `;
        isDownloadingAll = false;
      }, 3000);
    } else {
      isDownloadingAll = false;
    }

    showStatus(`Successfully initiated download for all ${images.length} images!`, 'info');
  }

  /**
   * UI State Controls
   */
  function setLoading(isLoading) {
    if (loadingState) {
      loadingState.style.display = isLoading ? 'block' : 'none';
    }
    if (submitBtn) {
      submitBtn.disabled = isLoading;
      if (isLoading) {
        submitBtn.innerHTML = `
          <div class="spinner" style="width:14px;height:14px;border-width:2px;"></div>
          Finding images...
        `;
      } else {
        submitBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download Images
        `;
      }
    }
  }

  function showStatus(message, type = 'info') {
    if (!statusContainer || !statusAlert) return;

    statusAlert.className = `status-alert ${type}`;
    statusAlert.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;">
        ${type === 'error' 
          ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' 
          : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'}
      </svg>
      <span>${escapeHtml(message)}</span>
    `;
    statusContainer.style.display = 'block';
  }

  function hideStatus() {
    if (statusContainer) {
      statusContainer.style.display = 'none';
    }
  }

  function hideResults() {
    if (resultsSection) {
      resultsSection.style.display = 'none';
    }
  }

  /**
   * Lightbox Controls
   */
  function openLightbox(url) {
    if (!lightboxOverlay || !lightboxImg) return;
    lightboxImg.src = url;
    lightboxOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightboxOverlay || !lightboxImg) return;
    lightboxOverlay.style.display = 'none';
    lightboxImg.src = '';
    document.body.style.overflow = '';
  }

  /**
   * Theme Management
   */
  function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
  }

  function updateThemeIcon(theme) {
    if (!themeToggleBtn) return;
    if (theme === 'light') {
      themeToggleBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        Dark
      `;
    } else {
      themeToggleBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        Light
      `;
    }
  }

  /**
   * Helper: Escape HTML string
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
