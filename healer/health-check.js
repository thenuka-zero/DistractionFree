// healer/health-check.js
// Runs selector existence and effectiveness checks against a live Playwright page.

/**
 * Check a single CSS selector from the feature's selectors array.
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {object} feature  - registry entry
 * @returns {object} result
 */
async function checkSelector(page, selector, feature) {
  const checkedAt = new Date().toISOString();

  // Existence check: does the selector match at least one element?
  const count = await page.evaluate((sel) => {
    return document.querySelectorAll(sel).length;
  }, selector);

  if (count === 0) {
    return {
      feature:   feature.feature,
      selector,
      status:    'BROKEN',
      count:     0,
      isHidden:  null,
      checkedAt,
    };
  }

  // Effectiveness check: are the matched elements actually hidden?
  // Only meaningful when the feature's blocking is active
  // (i.e., the CSS disabled class is NOT on <html>).
  const isHidden = await page.evaluate((sel) => {
    const els = document.querySelectorAll(sel);
    if (els.length === 0) return null;
    return window.getComputedStyle(els[0]).display === 'none';
  }, selector);

  let status;
  if (isHidden === null) {
    status = 'BROKEN'; // defensive
  } else if (isHidden === true) {
    status = 'HEALTHY';
  } else {
    status = 'INEFFECTIVE'; // element exists and is rendered; CSS rule not applying
  }

  return {
    feature:   feature.feature,
    selector,
    status,
    count,
    isHidden,
    checkedAt,
  };
}

/**
 * Check a single JS selector from the feature's jsSelectors array.
 * JS selectors only get an existence check (they are not subject to CSS hiding).
 * @param {import('playwright').Page} page
 * @param {{ symbol: string, selector: string }} jsEntry
 * @param {object} feature  - registry entry
 * @returns {object} result
 */
async function checkJsSelector(page, jsEntry, feature) {
  const checkedAt = new Date().toISOString();
  const { selector } = jsEntry;

  const count = await page.evaluate((sel) => {
    return document.querySelectorAll(sel).length;
  }, selector);

  return {
    feature:   feature.feature,
    selector,
    status:    count > 0 ? 'HEALTHY' : 'BROKEN',
    count,
    isHidden:  null, // N/A for JS selectors
    checkedAt,
  };
}

/**
 * Run the full health check across all entries in the registry.
 * @param {import('playwright').Page} page  - already navigated to linkedin.com/feed/
 * @param {Array} registry                   - SELECTOR_REGISTRY
 * @returns {Promise<Array>} results array
 */
export async function runHealthCheck(page, registry) {
  const results = [];
  for (const feature of registry) {
    for (const selector of feature.selectors) {
      const result = await checkSelector(page, selector, feature);
      results.push(result);
    }
    for (const jsEntry of (feature.jsSelectors || [])) {
      const result = await checkJsSelector(page, jsEntry, feature);
      results.push(result);
    }
  }
  return results;
}
