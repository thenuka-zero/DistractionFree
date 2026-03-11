/**
 * Quick probe: does switching to headless: false make extension JS run?
 * Also tests whether chrome.storage.sync.get works.
 */
import { chromium }    from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path             from 'path';

const __dir        = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dir, '..');
const session = JSON.parse(readFileSync(path.join(__dir, 'session.json'), 'utf8'));

const ctx = await chromium.launchPersistentContext('', {
  headless: false,   // <-- the change
  args: [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
    '--window-size=1280,800',
  ],
});

try {
  await ctx.addCookies(session);
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(4000);

  const r = await page.evaluate(() => ({
    jsRan:           document.documentElement.className.includes('df-') || !!document.querySelector('.df-quote-container'),
    htmlClasses:     document.documentElement.className.slice(0, 200),
    quoteFound:      !!document.querySelector('.df-quote-container'),
    mainFeedOverflow: (() => {
      const mf = document.querySelector("[data-testid='mainFeed']");
      return mf ? { inline: mf.style.overflow || '(empty)', computed: getComputedStyle(mf).overflow } : null;
    })(),
    spinnerVisible: (() => {
      const el = document.querySelector("[data-view-name='main-feed-pagination-loading-spinner']");
      return el ? { display: getComputedStyle(el).display, height: el.offsetHeight } : null;
    })(),
  }));

  console.log(JSON.stringify(r, null, 2));
} finally {
  await ctx.close();
}
