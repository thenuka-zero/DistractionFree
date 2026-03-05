/**
 * DistractionFree — Shared utilities for all content scripts
 */
const DistractionFree = (() => {
  /**
   * Get a random quote from the curated list
   */
  function getRandomQuote() {
    const idx = Math.floor(Math.random() * DF_QUOTES.length);
    return DF_QUOTES[idx];
  }

  /**
   * Create and return a quote container element.
   * Won't duplicate if one already exists in the given parent.
   */
  function createQuoteElement(parent) {
    if (parent.querySelector(".df-quote-container")) return null;
    const quote = getRandomQuote();
    const container = document.createElement("div");
    container.className = "df-quote-container";
    container.innerHTML = `
      <div class="df-quote-inner">
        <div class="df-quote-mascot">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="32" cy="32" r="28" fill="#7C5CFC"/>
            <circle cx="22" cy="26" r="4" fill="white"/>
            <circle cx="42" cy="26" r="4" fill="white"/>
            <circle cx="23" cy="27" r="2" fill="#2D1B69"/>
            <circle cx="43" cy="27" r="2" fill="#2D1B69"/>
            <path d="M24 38 Q32 46 40 38" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            <circle cx="14" cy="32" r="4" fill="#E8A4E8" opacity="0.5"/>
            <circle cx="50" cy="32" r="4" fill="#E8A4E8" opacity="0.5"/>
          </svg>
        </div>
        <p class="df-quote-text">\u201C${quote.text}\u201D</p>
        <p class="df-quote-author">\u2014 ${quote.author}</p>
        <p class="df-quote-tagline">Stay focused! You've got this.</p>
      </div>
    `;
    return container;
  }

  /**
   * Inject a quote into a target element (replaces inner content visually)
   */
  function injectQuote(targetSelector) {
    const target = document.querySelector(targetSelector);
    if (!target) return;
    const el = createQuoteElement(target);
    if (el) target.prepend(el);
  }

  /**
   * Read settings from chrome.storage.sync
   */
  function getSettings(callback) {
    chrome.storage.sync.get("settings", (result) => {
      callback(result.settings || {});
    });
  }

  /**
   * Listen for storage changes and invoke callback with new settings
   */
  function onSettingsChanged(site, callback) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && changes.settings) {
        const newSettings = changes.settings.newValue || {};
        callback(newSettings[site] || {});
      }
    });
  }

  /**
   * Toggle a CSS class on <html> based on a boolean.
   * When enabled=true (blocking active), remove the disabled class.
   * When enabled=false, add the disabled class to un-hide content.
   */
  function toggleFeature(className, enabled) {
    if (enabled) {
      document.documentElement.classList.remove(className);
    } else {
      document.documentElement.classList.add(className);
    }
  }

  /**
   * Set up a MutationObserver that calls the callback whenever
   * new nodes are added to the DOM.
   */
  function observeDOM(callback) {
    let timer = null;
    const observer = new MutationObserver((mutations) => {
      let hasNewNodes = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          hasNewNodes = true;
          break;
        }
      }
      if (hasNewNodes) {
        clearTimeout(timer);
        timer = setTimeout(callback, 300);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return observer;
  }

  /**
   * SPA navigation detection.
   * Intercepts pushState/replaceState and dispatches 'df-url-change' event.
   */
  function detectSPANavigation(callback) {
    const wrap = (method) => {
      const orig = history[method];
      history[method] = function() {
        const result = orig.apply(this, arguments);
        callback();
        return result;
      };
    };
    wrap("pushState");
    wrap("replaceState");
    window.addEventListener("popstate", callback);
  }

  /**
   * Remove all injected quote containers from the page
   */
  function removeAllQuotes() {
    document.querySelectorAll(".df-quote-container").forEach(el => el.remove());
  }

  return {
    getRandomQuote,
    createQuoteElement,
    injectQuote,
    getSettings,
    onSettingsChanged,
    toggleFeature,
    observeDOM,
    detectSPANavigation,
    removeAllQuotes
  };
})();
