/**
 * Probe: verify notification page shows only the highlighted post.
 * Discovers a fresh notification URL from the /notifications/ page.
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

async function checkState(page, label) {
  const s = await page.evaluate(() => {
    const html     = document.documentElement;
    const mainFeed = document.querySelector("[data-testid='mainFeed']");
    const allPosts = mainFeed ? [...mainFeed.querySelectorAll("[data-view-name='feed-full-update']")] : [];
    const visible  = allPosts.filter(el => getComputedStyle(el).display !== 'none');
    return {
      isFeedClass:  html.classList.contains('df-linkedin-is-feed'),
      isNotifClass: html.classList.contains('df-linkedin-is-notif'),
      totalPosts:   allPosts.length,
      visiblePosts: visible.length,
      overflow:     mainFeed ? getComputedStyle(mainFeed).overflow : 'n/a',
      quoteVisible: !!document.querySelector('.df-quote-container'),
      url:          window.location.href.slice(0, 90),
    };
  });
  console.log(`\n[${label}]`);
  console.log(`  URL:            ${s.url}`);
  console.log(`  is-feed class:  ${s.isFeedClass}`);
  console.log(`  is-notif class: ${s.isNotifClass}`);
  console.log(`  posts:          ${s.totalPosts} total, ${s.visiblePosts} visible`);
  console.log(`  overflow:       ${s.overflow}`);
  console.log(`  quote visible:  ${s.quoteVisible}`);
  return s;
}

try {
  await ctx.addCookies(session);
  const page = ctx.pages()[0] || await ctx.newPage();

  // ── Test 1: Feed homepage ───────────────────────────────────────────────
  console.log('=== Test 1: Feed homepage ===');
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  const feed = await checkState(page, '/feed/');
  const t1 = feed.isFeedClass && !feed.isNotifClass && feed.visiblePosts === 0 && feed.quoteVisible;
  console.log('  PASS?', t1 ? 'YES ✓' : 'NO ✗');

  // ── Discover a fresh notification URL ──────────────────────────────────
  console.log('\n=== Fetching fresh notification URL from /notifications/ ===');
  await page.goto('https://www.linkedin.com/notifications/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const notifLinks = await page.evaluate(() =>
    [...document.querySelectorAll('a')]
      .filter(a => a.href.includes('highlightedUpdateUrn'))
      .slice(0, 3)
      .map(a => a.href)
  );
  console.log('Found notification URLs:', notifLinks.length);

  if (notifLinks.length === 0) {
    console.log('No notification URLs found — skipping Test 2');
  } else {
    const NOTIF_URL = notifLinks[0];
    console.log('Using:', NOTIF_URL.slice(0, 90));

    // ── Test 2: Notification page ─────────────────────────────────────────
    console.log('\n=== Test 2: Notification URL ===');
    await page.goto(NOTIF_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    const notif = await checkState(page, 'notification URL');
    const t2 = !notif.isFeedClass && notif.isNotifClass && notif.visiblePosts === 1 && !notif.quoteVisible;
    console.log('  PASS?', t2 ? 'YES ✓' : `NO ✗  (want: is-notif=true, 1 visible post, no quote)`);

    // ── Test 3: Back to feed ──────────────────────────────────────────────
    console.log('\n=== Test 3: Back to /feed/ ===');
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
    const back = await checkState(page, 'back to /feed/');
    const t3 = back.isFeedClass && !back.isNotifClass && back.visiblePosts === 0 && back.quoteVisible;
    console.log('  PASS?', t3 ? 'YES ✓' : 'NO ✗');

    console.log('\n' + '='.repeat(50));
    console.log('OVERALL:', (t1 && t2 && t3) ? 'ALL PASS ✓' : 'ISSUES ✗');
  }

  await page.waitForTimeout(2000);
} finally {
  await ctx.close();
}
