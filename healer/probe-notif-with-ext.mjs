/**
 * Probe notification page WITH extension — see what CSS classes and computed
 * styles are actually applied to the highlighted post.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dir          = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dir, '..');
const session        = JSON.parse(readFileSync(path.join(__dir, 'session.json'), 'utf8'));

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
    '--window-size=1280,900',
  ],
});

try {
  await ctx.addCookies(session);
  const page = ctx.pages()[0] || await ctx.newPage();

  // Get a fresh notification URL
  await page.goto('https://www.linkedin.com/notifications/', {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForTimeout(3000);

  const url = await page.evaluate(() =>
    ([...document.querySelectorAll('a')].find(a => a.href.includes('highlightedUpdateUrn')) || {}).href
  );
  if (!url) { console.log('No notification URL'); process.exit(1); }
  console.log('\nURL:', url.slice(0, 120));

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  const result = await page.evaluate(() => {
    const html     = document.documentElement;
    const mainFeed = document.querySelector("[data-testid='mainFeed']");

    const children = mainFeed ? [...mainFeed.children].map((el, i) => {
      const st = window.getComputedStyle(el);
      return {
        i,
        h:          el.offsetHeight,
        display:    st.display,
        classes:    [...el.classList].join(' '),
        hasDisp:    el.hasAttribute('data-display-contents'),
        hasTrack:   el.hasAttribute('data-view-tracking-scope'),
        isHighlighted: el.classList.contains('df-highlighted-post'),
        text:       (el.innerText || '').trim().slice(0, 60),
      };
    }) : [];

    return {
      url:           window.location.href.slice(0, 120),
      htmlClasses:   html.className,
      isFeedClass:   html.classList.contains('df-linkedin-is-feed'),
      isNotifClass:  html.classList.contains('df-linkedin-is-notif'),
      isDisabled:    html.classList.contains('df-linkedin-disabled'),
      mainFeedFound: !!mainFeed,
      childCount:    mainFeed ? mainFeed.children.length : 0,
      children,
    };
  });

  console.log('\n=== HTML state ===');
  console.log('is-feed class:  ', result.isFeedClass);
  console.log('is-notif class: ', result.isNotifClass);
  console.log('is-disabled:    ', result.isDisabled);

  console.log(`\n=== mainFeed: ${result.childCount} children ===`);
  for (const c of result.children) {
    const flags = [
      c.hasDisp   ? 'data-display-contents' : '',
      c.hasTrack  ? 'data-view-tracking-scope' : '',
      c.isHighlighted ? '★df-highlighted-post' : '',
    ].filter(Boolean).join(', ');
    console.log(`[${c.i}] h=${c.h} display=${c.display} ${flags}`);
    if (c.text) console.log(`     "${c.text}"`);
  }

  await page.waitForTimeout(3000);
} finally {
  await ctx.close();
}
