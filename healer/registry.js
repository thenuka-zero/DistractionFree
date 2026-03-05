// healer/registry.js
// Single source of truth for all selectors monitored by the self-healing system.
// CSS selectors come from content/linkedin.css.
// JS selectors come from content/linkedin.js.

export const SELECTOR_REGISTRY = [
  {
    feature:          'feed',
    description:      'Home feed post cards',
    urlPattern:       /linkedin\.com\/(feed\/?)?$/,
    cssDisabledClass: 'df-linkedin-disabled',
    selectors: [
      '.feed-shared-update-v2',
      'div[data-id^="urn:li:activity:"]',
      '.feed-sort-toggle',
      '.feed-follows-module',
    ],
    // The JS selector used to find the feed container for quote injection.
    // Tracked separately because it lives in linkedin.js, not linkedin.css.
    jsSelectors: [
      { symbol: 'feedContainer', selector: '.scaffold-finite-scroll__content' },
    ],
  },
  // Future entries for A1–F1 toggles will be added here as they ship.
  // Each entry follows the same shape so health-check.js and selector-ai.js
  // can iterate the registry without feature-specific branching.
];
