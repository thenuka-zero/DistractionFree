/**
 * Probe 3: Check the "Load more" button in both conditions:
 *   A) Without extension, no scrolling (is it in the initial DOM?)
 *   B) With extension running (does it appear, and is it visible?)
 *
 * Also dumps the exact attributes of the direct mainFeed child that wraps it.
 */
import { chromium }    from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path             from 'path';

const __dir          = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dir, '..');
const session        = JSON.parse(readFileSync(path.join(__dir, 'session.json'), 'utf8'));

async function probe(label, ctxOpts) {
  const ctx = await chromium.launchPersistentContext('', ctxOpts);
  try {
    await ctx.addCookies(session);
    const page = ctx.pages()[0] || await ctx.newPage();
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(5000); // settle — no scrolling

    return await page.evaluate(() => {
      const mainFeed = document.querySelector("[data-testid='mainFeed']");

      // Find the "Load more" button
      let loadMoreBtn = null;
      document.querySelectorAll('button').forEach(el => {
        if ((el.innerText || '').trim().toLowerCase() === 'load more') loadMoreBtn = el;
      });

      // Dump all direct children of mainFeed with their key attributes
      const directChildren = mainFeed ? [...mainFeed.children].map(el => ({
        tag:          el.tagName,
        dataViewName: el.getAttribute('data-view-name'),
        dataTestId:   el.getAttribute('data-testid'),
        id:           el.id || null,
        classSnippet: el.className.slice(0, 60),
        visible:      getComputedStyle(el).display !== 'none' && el.offsetHeight > 0,
        height:       el.offsetHeight,
      })) : [];

      const loadMoreInfo = loadMoreBtn ? {
        found:          true,
        visible:        getComputedStyle(loadMoreBtn).display !== 'none' && loadMoreBtn.offsetHeight > 0,
        display:        getComputedStyle(loadMoreBtn).display,
        height:         loadMoreBtn.offsetHeight,
        // Walk up to find the direct mainFeed child that contains it
        mainFeedDirectParent: (() => {
          let cur = loadMoreBtn.parentElement;
          while (cur && cur.parentElement !== mainFeed) cur = cur.parentElement;
          if (!cur) return null;
          return {
            tag:          cur.tagName,
            dataViewName: cur.getAttribute('data-view-name'),
            dataTestId:   cur.getAttribute('data-testid'),
            id:           cur.id || null,
            classSnippet: cur.className.slice(0, 80),
            visible:      getComputedStyle(cur).display !== 'none' && cur.offsetHeight > 0,
          };
        })(),
      } : { found: false };

      return { loadMoreInfo, directChildren };
    });
  } finally {
    await ctx.close();
  }
}

console.log('Running probe A: WITHOUT extension, no scrolling…');
const a = await probe('A', {
  headless: false,
  args: ['--window-size=1280,800'],
});

console.log('\n=== A: Without extension (no scroll) ===');
console.log('Load more button:', JSON.stringify(a.loadMoreInfo, null, 2));
console.log('\nmainFeed direct children:');
a.directChildren.forEach(c => console.log(' ', JSON.stringify(c)));

console.log('\n\nRunning probe B: WITH extension…');
const b = await probe('B', {
  headless: false,
  args: [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
    '--window-size=1280,800',
  ],
});

console.log('\n=== B: With extension (no scroll) ===');
console.log('Load more button:', JSON.stringify(b.loadMoreInfo, null, 2));
console.log('\nmainFeed direct children:');
b.directChildren.forEach(c => console.log(' ', JSON.stringify(c)));
