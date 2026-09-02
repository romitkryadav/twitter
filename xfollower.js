/**
 * Pure Vanilla JavaScript Client for X Live Follower Counter
 * Handles 5-second live countdown, edge polling, telemetry, sparkline, and quick cards.
 */

(function () {
  'use strict';

  // Constants
  const POLL_INTERVAL_MS = 5000;
  const PRIMARY_WORKER_URL = 'https://xfollower.romitkr5539.workers.dev/api/x-followers';
  const FALLBACK_API_URL = 'https://xfollower.romitkr5539.workers.dev/api/x-followers';

  // State
  let currentUsername = 'romitkryadav';
  let currentFollowerCount = 302;
  let baselineFollowerCount = null;
  let pollIterationCount = 0;
  let isPaused = false;
  let isFetching = false;
  let countdownTimerId = null;
  let nextPollTimestamp = Date.now() + POLL_INTERVAL_MS;
  let followerHistory = []; // { time, count }

  // DOM Elements
  const searchForm = document.getElementById('search-form');
  const usernameInput = document.getElementById('username-input');
  const searchBtn = document.getElementById('search-btn');
  const errorBanner = document.getElementById('error-banner');
  const errorText = document.getElementById('error-text');

  const profileAvatar = document.getElementById('profile-avatar');
  const trackingPill = document.getElementById('tracking-pill');
  const trackingHandle = document.getElementById('tracking-handle');
  const profileName = document.getElementById('profile-name');
  const profileTagline = document.getElementById('profile-tagline');
  const taglineHandle = document.getElementById('tagline-handle');
  const followerNumber = document.getElementById('follower-number');
  const followerLabel = document.getElementById('follower-label');

  // Countdown & Ticker
  const countdownCirclePath = document.getElementById('countdown-circle-path');
  const countdownMiniSec = document.getElementById('countdown-mini-sec');
  const tickerSeconds = document.getElementById('ticker-seconds');
  const togglePauseBtn = document.getElementById('toggle-pause-btn');
  const pauseBtnIcon = document.getElementById('pause-btn-icon');

  // Telemetry
  const metaUsername = document.getElementById('meta-username');
  const metaDelta = document.getElementById('meta-delta');
  const metaTicks = document.getElementById('meta-ticks');
  const metaVerified = document.getElementById('meta-verified');

  // Sparkline
  const sparklinePath = document.getElementById('sparkline-path');
  const sparklineArea = document.getElementById('sparkline-area');
  const sparklinePoint = document.getElementById('sparkline-point');
  const sparklineEmpty = document.getElementById('sparkline-empty');

  // Theme & FAQ
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = document.getElementById('theme-icon');
  const faqItems = document.querySelectorAll('.faq-item');

  /**
   * Format number with standard commas (e.g. 1,245,678)
   */
  function formatNumber(num) {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    return num.toLocaleString('en-US');
  }

  /**
   * Format current time as HH:MM:SS AM/PM
   */
  function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }

  /**
   * Display or hide error banner
   */
  function showError(message) {
    if (message) {
      errorText.textContent = message;
      errorBanner.classList.remove('hidden');
    } else {
      errorBanner.classList.add('hidden');
    }
  }

  /**
   * Update sparkline SVG with accumulated follower history
   */
  function updateSparkline() {
    if (!sparklinePath || followerHistory.length < 1) return;

    if (followerHistory.length === 1) {
      sparklineEmpty.classList.remove('hidden');
      const count = followerHistory[0].count;
      sparklinePath.setAttribute('d', `M 0 45 L 800 45`);
      sparklineArea.setAttribute('d', `M 0 45 L 800 45 L 800 90 L 0 90 Z`);
      sparklinePoint.setAttribute('cx', '800');
      sparklinePoint.setAttribute('cy', '45');
      return;
    }

    sparklineEmpty.classList.add('hidden');

    const counts = followerHistory.map(h => h.count);
    let min = Math.min(...counts);
    let max = Math.max(...counts);
    if (min === max) {
      min = min - 1;
      max = max + 1;
    }

    const paddingY = 15;
    const height = 90 - (paddingY * 2);
    const width = 800;
    const stepX = width / (followerHistory.length - 1);

    const points = followerHistory.map((h, i) => {
      const x = i * stepX;
      const normalized = (h.count - min) / (max - min);
      const y = (90 - paddingY) - (normalized * height);
      return { x, y };
    });

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      // Simple smooth cubic bezier
      const prev = points[i - 1];
      const curr = points[i];
      const cpX = (prev.x + curr.x) / 2;
      pathD += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    sparklinePath.setAttribute('d', pathD);

    const areaD = `${pathD} L ${width} 90 L 0 90 Z`;
    sparklineArea.setAttribute('d', areaD);

    const lastPoint = points[points.length - 1];
    sparklinePoint.setAttribute('cx', lastPoint.x.toString());
    sparklinePoint.setAttribute('cy', lastPoint.y.toString());
  }

  /**
   * Render profile data to UI
   */
  function renderProfile(profile, updatedAt) {
    if (!profile) return;

    const username = profile.username;
    const name = profile.name || username;
    const followers = profile.followers;
    const avatar = profile.profileImage || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png';

    // Update Avatar & Links
    profileAvatar.src = avatar;
    profileAvatar.alt = `${name}'s Profile`;
    trackingHandle.textContent = `@${username}`;
    trackingPill.href = `https://x.com/${encodeURIComponent(username)}`;

    // Update Headers
    profileName.textContent = name;
    taglineHandle.textContent = `@${username}`;
    followerLabel.textContent = `${username.toUpperCase()} FOLLOWERS`;

    // Baseline Delta Calculation
    if (baselineFollowerCount === null || currentUsername !== username) {
      baselineFollowerCount = followers;
      followerHistory = [];
    }

    // Number Bump Animation
    if (currentFollowerCount !== followers) {
      followerNumber.classList.add('updating');
      setTimeout(() => followerNumber.classList.remove('updating'), 400);
    }

    currentFollowerCount = followers;
    followerNumber.textContent = formatNumber(followers);

    // Add to history
    followerHistory.push({ time: Date.now(), count: followers });
    if (followerHistory.length > 30) followerHistory.shift();
    updateSparkline();

    // Telemetry Update
    metaUsername.textContent = `@${username}`;
    
    const delta = followers - baselineFollowerCount;
    if (delta > 0) {
      metaDelta.textContent = `+${formatNumber(delta)}`;
      metaDelta.style.color = '#10b981';
    } else if (delta < 0) {
      metaDelta.textContent = `-${formatNumber(Math.abs(delta))}`;
      metaDelta.style.color = '#ef4444';
    } else {
      metaDelta.textContent = '+0';
      metaDelta.style.color = '#10b981';
    }

    pollIterationCount++;
    metaTicks.textContent = `${pollIterationCount} ticks`;

    const verifiedDate = updatedAt ? new Date(updatedAt) : new Date();
    metaVerified.textContent = formatTime(verifiedDate);
  }

  /**
   * Fetch follower data from Cloudflare Worker
   */
  async function fetchFollowers(input, isPolling = false) {
    if (isFetching) return;
    isFetching = true;

    if (!isPolling) {
      showError(null);
      searchBtn.disabled = true;
    }

    try {
      const isUrl = input.startsWith('http://') || input.startsWith('https://');
      const paramKey = isUrl ? 'url' : 'username';
      const queryString = `${paramKey}=${encodeURIComponent(input)}`;
      const workerUrl = `${PRIMARY_WORKER_URL}?${queryString}`;
      const fallbackUrl = `${FALLBACK_API_URL}?${queryString}`;

      let response;
      try {
        response = await fetch(workerUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
      } catch (err) {
        response = await fetch(fallbackUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
      }

      const data = await response.json();

      if (!response.ok || !data.success || !data.profile) {
        throw new Error(data.error || 'Failed to retrieve follower data.');
      }

      currentUsername = data.profile.username;
      renderProfile(data.profile, data.updatedAt);
    } catch (err) {
      if (!isPolling) {
        showError(err.message || 'Follower count is not publicly available.');
      }
    } finally {
      isFetching = false;
      searchBtn.disabled = false;
      resetCountdown();
    }
  }

  /**
   * Reset 5s countdown timer
   */
  function resetCountdown() {
    nextPollTimestamp = Date.now() + POLL_INTERVAL_MS;
  }

  /**
   * Continuous Countdown Animation Loop (~50ms tick)
   */
  function startCountdownLoop() {
    if (countdownTimerId) clearInterval(countdownTimerId);

    countdownTimerId = setInterval(() => {
      if (isPaused || document.visibilityState === 'hidden') return;

      const remainingMs = Math.max(0, nextPollTimestamp - Date.now());
      const remainingSec = (remainingMs / 1000).toFixed(1);

      // Update Ticker Text
      tickerSeconds.textContent = `${remainingSec}s`;
      countdownMiniSec.textContent = `${Math.ceil(remainingMs / 1000)}s`;

      // Update SVG Circular Progress (100 is full, 0 is empty)
      const progressFraction = remainingMs / POLL_INTERVAL_MS;
      const dashValue = Math.round(progressFraction * 100);
      countdownCirclePath.setAttribute('stroke-dasharray', `${dashValue}, 100`);

      if (remainingMs <= 0 && !isFetching) {
        resetCountdown();
        fetchFollowers(currentUsername, true);
      }
    }, 50);
  }

  // Toggle Pause / Resume
  togglePauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    if (isPaused) {
      pauseBtnIcon.textContent = '▶';
      togglePauseBtn.title = 'Resume Live Stream';
      tickerSeconds.textContent = 'PAUSED';
    } else {
      pauseBtnIcon.textContent = '❚❚';
      togglePauseBtn.title = 'Pause Live Stream';
      resetCountdown();
    }
  });

  // Search Form Submit
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = usernameInput.value.trim();
    if (!val) return;
    baselineFollowerCount = null;
    pollIterationCount = 0;
    fetchFollowers(val, false);
  });

  // Quick Account Switcher (Promoted & Popular cards)
  document.querySelectorAll('.account-card').forEach((card) => {
    card.addEventListener('click', () => {
      const username = card.getAttribute('data-username');
      if (username) {
        usernameInput.value = username;
        baselineFollowerCount = null;
        pollIterationCount = 0;
        fetchFollowers(username, false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  // FAQ Accordion
  faqItems.forEach((item) => {
    const questionBtn = item.querySelector('.faq-question');
    questionBtn.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      faqItems.forEach((f) => {
        f.classList.remove('active');
        f.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });
      if (!isActive) {
        item.classList.add('active');
        questionBtn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Theme Toggle
  themeToggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    themeIcon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
  });

  // Tab Visibility Sync
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !isPaused) {
      resetCountdown();
    }
  });

  // Initial Boot
  startCountdownLoop();
  fetchFollowers(currentUsername, false);

})();
