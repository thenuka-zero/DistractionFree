// healer/registry.js
// Single source of truth for all selectors monitored by the self-healing system.
// CSS selectors come from content/linkedin.css.
// JS selectors come from content/linkedin.js.
//
// skipAutoFix: true  — healer will detect BROKEN status and notify, but will NOT
//   attempt to auto-rewrite the CSS file. The block-aware updater in extension-updater.js
//   only manages the main feed delimiter block. Other features will be auto-fixable in v2.1.

export const SELECTOR_REGISTRY = [
  // -------------------------------------------------------------------------
  // v1.0: Feed hiding — auto-fixable by extension-updater.js
  // -------------------------------------------------------------------------
  {
    feature:          'feed',
    description:      'Home feed post cards',
    urlPattern:       /linkedin\.com\/(feed\/?)?$/,
    cssDisabledClass: 'df-linkedin-disabled',
    selectors: [
      "[data-view-name='feed-full-update']",
      "[data-view-name='feed-nav-feed-sort-toggle']",
    ],
    // The JS selector used to find the feed container for quote injection.
    jsSelectors: [
      { symbol: 'feedContainer', selector: "[data-testid='mainFeed']" },
    ],
  },

  // -------------------------------------------------------------------------
  // v2.0: CSS-only features — monitored; sends desktop notification on break
  // -------------------------------------------------------------------------
  {
    feature:          'premium-upsell',
    description:      'Premium upsell nav link and banners',
    urlPattern:       /linkedin\.com\//,
    cssDisabledClass: 'df-linkedin-hide-premium-upsell-disabled',
    skipAutoFix:      true,
    selectors: [
      "[data-view-name='home-nav-left-rail-growth-widgets-my-premium']",
      "[data-view-name='home-nav-left-rail-page-premium-upsell-cta']",
    ],
  },
];
