/**
 * Mobile nav toggle + FAQ accordion for X downloader pages
 */

(function () {
  // ── Mobile nav ─────────────────────────────────────────────────────────
  const hamburger = document.getElementById('hamburgerBtn');
  const mobileNav = document.getElementById('mobileNav');

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', function () {
      const isOpen = mobileNav.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', isOpen);
      // Prevent body scroll while nav is open
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close on nav link click (single-page feel)
    mobileNav.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileNav.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    // Close when clicking outside
    document.addEventListener('click', function (e) {
      if (
        mobileNav.classList.contains('open') &&
        !mobileNav.contains(e.target) &&
        !hamburger.contains(e.target)
      ) {
        mobileNav.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  }

  // ── FAQ accordion ──────────────────────────────────────────────────────
  document.querySelectorAll('.faq-trigger').forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      var item    = trigger.closest('.faq-item, .xdl-faq-item');
      var content = item && item.querySelector('.faq-content');
      if (!item || !content) return;

      var isActive = item.classList.contains('active');

      // Close all open items first
      document.querySelectorAll('.faq-item, .xdl-faq-item').forEach(function (el) {
        el.classList.remove('active');
        var c = el.querySelector('.faq-content');
        if (c) c.style.maxHeight = null;
      });

      // Open clicked item if it was closed
      if (!isActive) {
        item.classList.add('active');
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    });
  });
})();
