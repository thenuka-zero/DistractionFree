/**
 * DistractionFree — LinkedIn content script
 */
(function () {
  const SITE = "linkedin";

  function applySettings(cfg) {
    DistractionFree.toggleFeature("df-linkedin-disabled", cfg.feedEnabled !== false);
    if (cfg.feedEnabled !== false) {
      tryInjectQuote();
    } else {
      DistractionFree.removeAllQuotes();
    }
  }

  function tryInjectQuote() {
    if (document.querySelector(".df-quote-container")) return;
    const feedContainer = document.querySelector(".scaffold-finite-scroll__content");
    if (!feedContainer) return;
    const el = DistractionFree.createQuoteElement(feedContainer);
    if (el) feedContainer.prepend(el);
  }

  function init() {
    DistractionFree.getSettings((settings) => {
      applySettings(settings[SITE] || { feedEnabled: true });
    });

    DistractionFree.onSettingsChanged(SITE, applySettings);

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", tryInjectQuote);
    } else {
      tryInjectQuote();
    }

    DistractionFree.observeDOM(() => {
      DistractionFree.getSettings((settings) => {
        const cfg = settings[SITE] || { feedEnabled: true };
        if (cfg.feedEnabled !== false) tryInjectQuote();
      });
    });

    DistractionFree.detectSPANavigation(() => {
      DistractionFree.removeAllQuotes();
      DistractionFree.getSettings((settings) => {
        applySettings(settings[SITE] || { feedEnabled: true });
      });
    });
  }

  init();
})();
