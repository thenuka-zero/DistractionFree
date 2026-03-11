/**
 * Probe notification page via SPA navigation (simulates clicking from bell icon):
 * 1. Load /feed/ with extension
 * 2. Wait for feed to be blocked (normal state)
 * 3. SPA-navigate to notification URL
 * 4. Check state after navigation
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

async function dumpState(page, label) {
  const r = await page.evaluate(() => {
    const html     = document.documentElement;
    const mainFeed = document.querySelector("[data-testid='mainFeed']");
    const children = mainFeed ? [...mainFeed.children].map((el, i) => {
      const st = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        i,
        display:       st.display,
        h:             el.offsetHeight,
        rectTop:       Math.round(rect.top),
        rectH:         Math.round(rect.height),
        hasDisp:       el.hasAttribute('data-display-contents'),
        hasTrack:      el.hasAttribute('data-view-tracking-scope'),
        isHighlighted: el.classList.contains('df-highlighted-post'),
        hasQuote:      el.classList.contains('df-quote-container'),
        text:          (el.innerText || '').trim().slice(0, 40),
      };
    }) : [];
    return {
      url:        window.location.href.slice(0, 100),
      isFeed:     html.classList.contains('df-linkedin-is-feed'),
      isNotif:    html.classList.contains('df-linkedin-is-notif'),
      childCount: mainFeed ? mainFeed.children.length : 0,
      children,
    };
  });

  console.log(`\n=== ${label} ===`);
  console.log(`URL:     ${r.url}`);
  console.log(`is-feed: ${r.isFeed}  is-notif: ${r.isNotif}`);
  console.log(`mainFeed children: ${r.childCount}`);
  for (const c of r.children) {
    const flags = [
      c.isHighlighted ? '★HIGHLIGHTED' : '',
      c.hasQuote      ? '★QUOTE' : '',
      c.hasDisp && c.hasTrack ? '[disp+track]' : c.hasDisp ? '[disp]' : '',
    ].filter(Boolean).join(' ');
    console.log(`  [${c.i}] display=${c.display} h=${c.h} rect.top=${c.rectTop} rect.h=${c.rectH} ${flags}`);
    if (c.text) console.log(`       "${c.text}"`);
  }
}

try {
  await ctx.addCookies(session);
  const page = ctx.pages()[0] || await ctx.newPage();

  // 1. Get a notification URL from /notifications/
  await page.goto('https://www.linkedin.com/notifications/', {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForTimeout(3000);
  const notifUrl = await page.evaluate(() =>
    ([...document.querySelectorAll('a')].find(a => a.href.includes('highlightedUpdateUrn')) || {}).href
  );
  if (!notifUrl) { console.log('No notification URL'); process.exit(1); }
  console.log('Notification URL:', notifUrl.slice(0, 100));

  // 2. Load /feed/ first (normal state)
  await page.goto('https://www.linkedin.com/feed/', {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForTimeout(4000);
  await dumpState(page, 'AFTER /feed/ load');

  // 3. SPA-navigate to notification URL (simulates clicking from bell)
  console.log('\n--- SPA navigating to notification URL ---');
  await page.evaluate((url) => history.pushState({}, '', url), notifUrl);
  await page.waitForTimeout(500);
  await dumpState(page, 'IMMEDIATELY after pushState (before LinkedIn reacts)');

  // Wait for LinkedIn to update the DOM
  await page.waitForTimeout(5000);
  await dumpState(page, '5s after pushState (LinkedIn DOM updated)');

  await page.waitForTimeout(3000);
} finally {
  await ctx.close();
}
