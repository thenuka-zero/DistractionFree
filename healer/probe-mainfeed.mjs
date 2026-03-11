/**
 * Quick probe: find the LinkedIn main feed container element.
 * Dumps candidate elements so we can identify the correct selector.
 */
import { chromium }    from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path             from 'path';

const __dir        = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dir, '..');
const SESSION_FILE   = path.join(__dir, 'session.json');

const session = JSON.parse(readFileSync(SESSION_FILE, 'utf8'));

const ctx = await chromium.launchPersistentContext('', {
  headless: true,
  args: [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
  ],
});

try {
  await ctx.addCookies(session);
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(3000);

  const info = await page.evaluate(() => {
    // 1. Check if data-testid='mainFeed' still exists
    const byTestId = document.querySelector("[data-testid='mainFeed']");

    // 2. Find feed-full-update elements and walk up to find their common ancestor
    const posts = [...document.querySelectorAll("[data-view-name='feed-full-update']")];
    const ancestor = posts.length > 0 ? (() => {
      let el = posts[0].parentElement;
      for (let i = 0; i < 10 && el; i++) {
        const allInside = posts.every(p => el.contains(p));
        if (allInside) {
          return {
            tag:       el.tagName,
            id:        el.id || null,
            testid:    el.getAttribute('data-testid') || null,
            viewName:  el.getAttribute('data-view-name') || null,
            className: el.className.slice(0, 80) || null,
            childCount: el.children.length,
          };
        }
        el = el.parentElement;
      }
      return null;
    })() : null;

    // 3. Look for elements with data-testid containing 'feed' or 'Feed'
    const feedTestIds = [...document.querySelectorAll('[data-testid]')]
      .filter(el => el.getAttribute('data-testid').toLowerCase().includes('feed'))
      .slice(0, 10)
      .map(el => ({
        testid:    el.getAttribute('data-testid'),
        tag:       el.tagName,
        childCount: el.children.length,
        offsetHeight: el.offsetHeight,
      }));

    // 4. Check the main content region
    const main = document.querySelector('main, [role="main"]');

    return {
      mainFeedTestIdFound: !!byTestId,
      commonAncestorOfPosts: ancestor,
      feedTestIds,
      mainTagFound: !!main,
      mainTestId:   main?.getAttribute('data-testid') || null,
    };
  });

  console.log(JSON.stringify(info, null, 2));
} finally {
  await ctx.close();
}
