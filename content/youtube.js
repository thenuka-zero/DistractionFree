/**
 * DistractionFree — YouTube content script
 */
(function () {
  const SITE = "youtube";

  DistractionFree.injectCSS(`
/* DistractionFree — YouTube homepage feed hiding */

/* Hide the recommendations grid on the home page */
html.df-youtube-is-home ytd-rich-grid-renderer {
  display: none !important;
}

/* Disabled state: restore when toggle is off */
html.df-youtube-is-home.df-youtube-feed-disabled ytd-rich-grid-renderer {
  display: revert !important;
}

/* Quote: hide when feed toggle is off */
html.df-youtube-feed-disabled .df-quote-container {
  display: none !important;
}
  `);

  function isHomePage() {
    return window.location.pathname === '/';
  }

  function updateHomeClass() {
    document.documentElement.classList.toggle('df-youtube-is-home', isHomePage());
  }

  const DEFAULTS = { feedEnabled: true };

  function applySettings(cfg) {
    const c = Object.assign({}, DEFAULTS, cfg);
    DistractionFree.toggleFeature('df-youtube-feed-disabled', c.feedEnabled);
    if (c.feedEnabled) {
      tryInjectQuote();
    } else {
      DistractionFree.removeAllQuotes();
    }
  }

  function tryInjectQuote() {
    if (!isHomePage()) return;
    if (document.querySelector('.df-quote-container')) return;
    const container =
      document.querySelector('ytd-browse[page-subtype="home"] #primary-inner') ||
      document.querySelector('ytd-browse[page-subtype="home"] #primary') ||
      document.querySelector('#primary');
    if (!container) return;
    const el = DistractionFree.createQuoteElement(container);
    if (!el) return;
    container.prepend(el);
  }

  function init() {
    updateHomeClass();

    const cached = DistractionFree.getSettingsSync();
    if (cached) applySettings(cached[SITE] || {});

    DistractionFree.getSettings((settings) => {
      applySettings(settings[SITE] || {});
    });

    DistractionFree.onSettingsChanged(SITE, applySettings);

    DistractionFree.observeDOM(() => {
      if (isHomePage()) tryInjectQuote();
    });

    DistractionFree.detectSPANavigation(() => {
      updateHomeClass();
      DistractionFree.removeAllQuotes();
      DistractionFree.getSettings((settings) => {
        applySettings(settings[SITE] || {});
      });
    });
  }

  init();
})();
