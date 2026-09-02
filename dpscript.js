/**
 * X (Twitter) Profile Picture Downloader - Vanilla JavaScript Client
 */

(function () {
  'use strict';

  // DOM Elements
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');
  const form = document.getElementById('downloaderForm');
  const usernameInput = document.getElementById('usernameInput');
  const submitBtn = document.getElementById('submitBtn');
  const pasteBtn = document.getElementById('pasteBtn');
  const loadingBox = document.getElementById('loadingBox');
  const alertBox = document.getElementById('alertBox');
  const alertMessage = document.getElementById('alertMessage');
  const resultCard = document.getElementById('resultCard');

  // Result Elements
  const avatarImg = document.getElementById('avatarImg');
  const displayNameEl = document.getElementById('displayName');
  const usernameEl = document.getElementById('username');
  const dimensionEl = document.getElementById('dimensionVal');
  const formatEl = document.getElementById('formatVal');
  const statusEl = document.getElementById('statusVal');
  const downloadBtn = document.getElementById('downloadBtn');
  const openImageBtn = document.getElementById('openImageBtn');

  // Quick Chips
  const exampleChips = document.querySelectorAll('.example-chip');

  // Tab Elements
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const copyButtons = document.querySelectorAll('.copy-code-btn');

  // Cloudflare Worker API URL
  const WORKER_BASE = 'https://xdp.romitkr3018.workers.dev';

  // Current fetched state
  let currentProfileData = null;
  let isFetching = false;

  /* ==========================================================================
     Theme Management (Dark / Light)
     ========================================================================== */
  function initTheme() {
    const savedTheme = localStorage.getItem('x-dp-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('x-dp-theme', theme);
    if (themeIcon) {
      themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      setTheme(next);
    });
  }

  /* ==========================================================================
     Input Validation & Sanitization Helpers
     ========================================================================== */
  function validateInput(rawInput) {
    if (!rawInput || !rawInput.trim()) {
      return { valid: false, error: 'Please enter a valid X username.' };
    }

    const trimmed = rawInput.trim();

    // Check if input is a URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes('/')) {
      let url;
      try {
        url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      } catch {
        return { valid: false, error: 'Invalid X profile URL.' };
      }

      const allowedHosts = ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'];
      if (!allowedHosts.includes(url.hostname.toLowerCase())) {
        return { valid: false, error: 'Invalid X profile URL.' };
      }

      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length === 0) {
        return { valid: false, error: 'Invalid X profile URL.' };
      }

      const candidate = segments[0].replace(/^@/, '');
      const forbidden = ['home', 'explore', 'notifications', 'messages', 'i', 'search', 'settings', 'tos', 'privacy'];
      if (forbidden.includes(candidate.toLowerCase()) || !/^[A-Za-z0-9_]{1,15}$/.test(candidate)) {
        return { valid: false, error: 'Invalid X profile URL.' };
      }

      return { valid: true, query: candidate };
    }

    // Direct username (@username or username)
    const cleaned = trimmed.replace(/^@/, '');
    if (!/^[A-Za-z0-9_]{1,15}$/.test(cleaned)) {
      return { valid: false, error: 'Please enter a valid X username.' };
    }

    return { valid: true, query: cleaned };
  }

  /* ==========================================================================
     UI State Handlers
     ========================================================================== */
  function showError(msg) {
    if (alertBox && alertMessage) {
      alertMessage.textContent = msg;
      alertBox.classList.add('active');
    }
  }

  function hideError() {
    if (alertBox) {
      alertBox.classList.remove('active');
    }
  }

  function setLoading(loading) {
    isFetching = loading;
    if (submitBtn) {
      submitBtn.disabled = loading;
    }
    if (loadingBox) {
      loadingBox.style.display = loading ? 'flex' : 'none';
    }
    if (loading) {
      hideError();
      if (resultCard) resultCard.classList.remove('active');
    }
  }

  /* ==========================================================================
     Fetch Profile Picture from Worker API
     ========================================================================== */
  async function fetchProfile(rawInput) {
    if (isFetching) return;

    const validation = validateInput(rawInput);
    if (!validation.valid) {
      showError(validation.error);
      return;
    }

    setLoading(true);

    try {
      const endpoint = `${WORKER_BASE}/api/x-dp?username=${encodeURIComponent(validation.query)}`;
      const res = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' }
      });

      const data = await res.json().catch(() => ({
        success: false,
        error: 'Profile picture is not publicly available.'
      }));

      if (!res.ok || !data.success) {
        showError(data.error || 'Profile picture is not publicly available.');
        setLoading(false);
        return;
      }

      currentProfileData = data;
      renderResult(data);
    } catch (err) {
      showError('The request timed out. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  /* ==========================================================================
     Render Result Card
     ========================================================================== */
  function renderResult(data) {
    if (!resultCard) return;

    hideError();

    // Populate user info
    displayNameEl.textContent = data.profile.name || data.profile.username;
    usernameEl.textContent = `@${data.profile.username}`;

    // Status
    statusEl.textContent = 'Public DP';

    // Format
    const mimeType = (data.image && data.image.type) || 'image/jpeg';
    formatEl.textContent = mimeType.replace('image/', '').toUpperCase();

    // Dimensions
    if (data.image && data.image.width && data.image.height) {
      dimensionEl.textContent = `${data.image.width} × ${data.image.height}`;
    } else {
      dimensionEl.textContent = 'Auto / HD';
    }

    // Set avatar image source
    avatarImg.src = data.image.url;
    avatarImg.alt = `${data.profile.name}'s X profile picture`;

    // Once image natural dimensions load, update accurately
    avatarImg.onload = function () {
      if (avatarImg.naturalWidth && avatarImg.naturalHeight) {
        dimensionEl.textContent = `${avatarImg.naturalWidth} × ${avatarImg.naturalHeight}`;
      }
    };

    // If browser blocks direct image CDN due to strict privacy / adblocker, fallback to worker download endpoint
    avatarImg.onerror = function () {
      const fallbackUrl = `${WORKER_BASE}/api/x-dp-download?url=${encodeURIComponent(data.image.url)}&username=${encodeURIComponent(data.profile.username)}`;
      if (avatarImg.src !== fallbackUrl) {
        avatarImg.src = fallbackUrl;
      }
    };

    // Download button handler (Routes through Worker streaming endpoint)
    const downloadEndpoint = `${WORKER_BASE}/api/x-dp-download?url=${encodeURIComponent(data.image.url)}&username=${encodeURIComponent(data.profile.username)}`;
    downloadBtn.href = downloadEndpoint;
    downloadBtn.setAttribute('download', `x-dp-${data.profile.username}.jpg`);

    // Open image directly in new tab
    openImageBtn.href = data.image.url;
    openImageBtn.target = '_blank';
    openImageBtn.rel = 'noopener noreferrer';

    // Reveal result card
    resultCard.classList.add('active');

    // Smooth scroll to result
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ==========================================================================
     Form & Event Listeners
     ========================================================================== */
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      fetchProfile(usernameInput.value);
    });
  }

  if (pasteBtn && usernameInput) {
    pasteBtn.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          usernameInput.value = text.trim();
          usernameInput.focus();
        }
      } catch {
        usernameInput.focus();
      }
    });
  }

  exampleChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const username = chip.getAttribute('data-user');
      if (username && usernameInput) {
        usernameInput.value = username;
        fetchProfile(username);
      }
    });
  });

  /* ==========================================================================
     Guide Tabs & Code Copying
     ========================================================================== */
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      tabBtns.forEach((b) => b.classList.remove('active'));
      tabPanes.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const pane = document.getElementById(targetTab);
      if (pane) pane.classList.add('active');
    });
  });

  copyButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const targetId = btn.getAttribute('data-target');
      const codeEl = document.getElementById(targetId);
      if (codeEl) {
        try {
          await navigator.clipboard.writeText(codeEl.innerText);
          const originalText = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => {
            btn.textContent = originalText;
          }, 2000);
        } catch {
          // Fallback
        }
      }
    });
  });

  // Initialize
  initTheme();
})();
