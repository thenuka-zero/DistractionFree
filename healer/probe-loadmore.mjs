/**
 * Probe: find any "Load More" / pagination button in the LinkedIn feed.
 * Runs with the extension DISABLED so we can see what LinkedIn actually renders.
 */
import { chromium }    from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path             from 'path';

const __dir        = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dir, '..');
const session = JSON.parse(readFileSync(path.join(__dir, 'session.json'), 'utf8'));

// Launch WITHOUT the extension so LinkedIn renders its full native UI
const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: ['--window-size=1280,800'],
});

try {
  await ctx.addCookies(session);
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60_000 });

  // Wait for feed to settle, then scroll to bottom to trigger lazy loading
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(3000);

  const results = await page.evaluate(() => {
    // 1. Hunt for anything that looks like a "load more" / pagination button
    const candidates = [];
    document.querySelectorAll('button, [role="button"], a').forEach(el => {
      const text = el.innerText?.trim().toLowerCase() || '';
      if (text.includes('load') || text.includes('more') || text.includes('show') || text.includes('see more post')) {
        candidates.push({
          tag:           el.tagName,
          text:          el.innerText?.trim().slice(0, 80),
          dataViewName:  el.getAttribute('data-view-name') || el.closest('[data-view-name]')?.getAttribute('data-view-name') || null,
          dataTestId:    el.getAttribute('data-testid') || null,
          classes:       el.className.slice(0, 120),
          visible:       getComputedStyle(el).display !== 'none' && el.offsetHeight > 0,
        });
      }
    });

    // 2. Dump ALL data-view-name values present in the feed
    const mainFeed = document.querySelector("[data-testid='mainFeed']");
    const feedViewNames = new Set();
    if (mainFeed) {
      mainFeed.querySelectorAll('[data-view-name]').forEach(el => {
        feedViewNames.add(el.getAttribute('data-view-name'));
      });
    }

    // 3. Check specifically known pagination selectors
    const knownSelectors = [
      "[data-view-name='main-feed-pagination-loading-spinner']",
      "[data-view-name='feed-new-update-pill']",
      "[data-view-name='feed-pagination-cta']",
      "[data-view-name='feed-load-more']",
      "button.feed-shared-social-actions__load-more",
      ".feed-paginator",
      "[data-control-name='load_more_feed']",
    ];

    const knownResults = knownSelectors.map(sel => ({
      selector: sel,
      found:    !!document.querySelector(sel),
      visible:  (() => {
        const el = document.querySelector(sel);
        return el ? (getComputedStyle(el).display !== 'none' && el.offsetHeight > 0) : false;
      })(),
    }));

    return {
      candidates,
      feedViewNames: [...feedViewNames].sort(),
      knownResults,
    };
  });

  console.log('\n=== "Load More" candidates (button text match) ===');
  if (results.candidates.length === 0) {
    console.log('  (none found)');
  } else {
    results.candidates.forEach(c => console.log(JSON.stringify(c, null, 2)));
  }

  console.log('\n=== All data-view-name values inside mainFeed ===');
  results.feedViewNames.forEach(n => console.log(' ', JSON.stringify(n)));

  console.log('\n=== Known pagination selectors ===');
  results.knownResults.forEach(r => {
    const status = r.found ? (r.visible ? '  VISIBLE' : '  found (hidden)') : '  not found';
    console.log(`${status}  ${r.selector}`);
  });

} finally {
  await ctx.close();
}
