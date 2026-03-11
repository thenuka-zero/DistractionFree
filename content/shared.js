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
          <svg width="80" height="80" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="100" r="96" fill="#FDF6EC"/>
            <ellipse cx="100" cy="115" rx="72" ry="68" fill="#E8943C"/>
            <ellipse cx="80" cy="95" rx="30" ry="22" fill="#F0B870" opacity="0.5"/>
            <rect x="95" y="42" width="10" height="18" rx="5" fill="#5B8C3E"/>
            <ellipse cx="82" cy="52" rx="18" ry="8" fill="#6EAE3E" transform="rotate(-25 82 52)"/>
            <ellipse cx="118" cy="52" rx="18" ry="8" fill="#6EAE3E" transform="rotate(25 118 52)"/>
            <ellipse cx="80" cy="112" rx="8" ry="9" fill="#3D2417"/>
            <ellipse cx="120" cy="112" rx="8" ry="9" fill="#3D2417"/>
            <circle cx="83" cy="108" r="3.5" fill="white"/>
            <circle cx="123" cy="108" r="3.5" fill="white"/>
            <path d="M88 126 Q100 138 112 126" stroke="#3D2417" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            <ellipse cx="66" cy="124" rx="10" ry="7" fill="#F5A0A0" opacity="0.6"/>
            <ellipse cx="134" cy="124" rx="10" ry="7" fill="#F5A0A0" opacity="0.6"/>
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
   * Read settings synchronously from sessionStorage cache.
   * Returns the cached settings object, or null if not yet cached.
   * Used at document_start to apply settings before any DOM renders (zero-flash).
   */
  function getSettingsSync() {
    try {
      const raw = sessionStorage.getItem('df_settings_cache');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Read settings from chrome.storage.sync.
   * Also writes to sessionStorage cache so the next page load can apply
   * settings synchronously via getSettingsSync() before any DOM renders.
   */
  function getSettings(callback) {
    chrome.storage.sync.get("settings", (result) => {
      const settings = result.settings || {};
      try { sessionStorage.setItem('df_settings_cache', JSON.stringify(settings)); } catch (e) {}
      callback(settings);
    });
  }

  /**
   * Listen for storage changes and invoke callback with new settings.
   * Also refreshes the sessionStorage cache so the next page load applies
   * the latest settings synchronously via getSettingsSync().
   */
  function onSettingsChanged(site, callback) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && changes.settings) {
        const newSettings = changes.settings.newValue || {};
        try { sessionStorage.setItem('df_settings_cache', JSON.stringify(newSettings)); } catch (e) {}
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
    if (window.navigation) {
      // Navigation API (Chrome 102+) fires for all navigations in every world,
      // including SPA pushState/replaceState called by the page's own JS.
      // The history.pushState wrapping below only catches calls made from this
      // extension's isolated world, so it never fires for LinkedIn navigations.
      window.navigation.addEventListener('navigate', callback);
      return;
    }
    // Fallback for older browsers (Chrome < 102).
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

  /**
   * Inject a CSS string into the page via document.adoptedStyleSheets.
   *
   * Using adoptedStyleSheets instead of a manifest-declared CSS file means the
   * rules come from the JS content script, which Chrome re-reads from disk on
   * every page load.  Manifest CSS files are compiled and cached at extension
   * load time — so CSS-only edits would require an extension reload to take
   * effect.  With this approach, saving a file and refreshing the tab is
   * sufficient for any JS or CSS change.
   *
   * @param {string} css  - Full CSS text to apply
   * @returns {CSSStyleSheet} the adopted sheet (can be mutated later if needed)
   */
  function injectCSS(css) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    return sheet;
  }

  return {
    getRandomQuote,
    createQuoteElement,
    injectQuote,
    getSettingsSync,
    getSettings,
    onSettingsChanged,
    toggleFeature,
    observeDOM,
    detectSPANavigation,
    removeAllQuotes,
    injectCSS,
  };
})();
