import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dir, '..');
const session = JSON.parse(readFileSync(path.join(__dir, 'session.json'), 'utf8'));

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
});

try {
  await ctx.addCookies(session);
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector("[data-view-name='feed-full-update']", { timeout: 30000 }).catch(() => {});

  const result = await page.evaluate(() => {
    // Find the spinner and its ancestors
    const spinner = document.querySelector("[data-view-name='main-feed-pagination-loading-spinner']");
    const ancestors = [];
    if (spinner) {
      let curr = spinner.parentElement;
      const mainFeed = document.querySelector("[data-testid='mainFeed']");
      while (curr && curr !== mainFeed && ancestors.length < 6) {
        ancestors.push({
          tag: curr.tagName,
          viewName: curr.getAttribute('data-view-name'),
          display: window.getComputedStyle(curr).display,
          height: curr.offsetHeight,
          isDirectChildOfMainFeed: curr.parentElement === mainFeed,
        });
        curr = curr.parentElement;
      }
    }

    // Also check what's visible at the bottom of mainFeed (last 5 children)
    const mainFeed = document.querySelector("[data-testid='mainFeed']");
    const lastChildren = mainFeed ? [...mainFeed.children].slice(-5).map(c => ({
      tag: c.tagName,
      viewName: c.getAttribute('data-view-name'),
      display: window.getComputedStyle(c).display,
      height: c.offsetHeight,
    })) : [];

    return {
      spinnerFound: !!spinner,
      spinnerDisplay: spinner ? window.getComputedStyle(spinner).display : null,
      spinnerHeight: spinner ? spinner.offsetHeight : null,
      ancestors,
      lastChildren,
    };
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await ctx.close();
}
