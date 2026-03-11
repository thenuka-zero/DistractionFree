/**
 * Probe notification page DOM — WITHOUT extension.
 * Captures current URL, HTML classes, and mainFeed children attributes.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dir  = path.dirname(fileURLToPath(import.meta.url));
const session = JSON.parse(readFileSync(path.join(__dir, 'session.json'), 'utf8'));

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: ['--window-size=1280,900'],
});

try {
  await ctx.addCookies(session);
  const page = ctx.pages()[0] || await ctx.newPage();

  // Step 1: get a fresh notification URL from the bell icon page
  await page.goto('https://www.linkedin.com/notifications/', {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForTimeout(3000);

  // Dump ALL links that look like linkedin.com/feed or posts
  const allLinks = await page.evaluate(() =>
    [...document.querySelectorAll('a')]
      .map(a => a.href)
      .filter(h => h.includes('linkedin.com') && (
        h.includes('/feed') || h.includes('/posts/') || h.includes('updateUrn') || h.includes('activity')
      ))
      .slice(0, 10)
  );

  console.log('\n=== All feed/post/activity links on notifications page ===');
  allLinks.forEach((u, i) => console.log(`[${i}] ${u.slice(0, 140)}`));

  const notifLinks = allLinks.filter(h => h.includes('highlightedUpdateUrn') || h.includes('updateUrn'));

  if (!notifLinks.length) {
    console.log('\nNo highlightedUpdateUrn links found.');
    console.log('Trying any /feed link with params...');
    const feedLinks = allLinks.filter(h => h.includes('/feed'));
    if (!feedLinks.length) {
      console.log('No usable links found at all. Taking screenshot...');
      await page.screenshot({ path: '/tmp/notif-page.png', fullPage: false });
      console.log('Screenshot saved to /tmp/notif-page.png');
      await page.waitForTimeout(5000);
      process.exit(1);
    }
    notifLinks.push(...feedLinks);
  }

  // Step 2: navigate to first notification URL WITHOUT extension
  const url = notifLinks[0];
  console.log('\nNavigating to:', url.slice(0, 120));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  const result = await page.evaluate(() => {
    const html     = document.documentElement;
    const mainFeed = document.querySelector("[data-testid='mainFeed']");

    const children = mainFeed ? [...mainFeed.children].map((el, i) => {
      const dataAttrs = [...el.attributes]
        .filter(a => a.name.startsWith('data-'))
        .map(a => `${a.name}=${a.value.slice(0, 60)}`);
      const st = window.getComputedStyle(el);
      return {
        i,
        tag:       el.tagName,
        h:         el.offsetHeight,
        display:   st.display,
        classes:   el.className.slice(0, 60),
        dataAttrs,
        text:      (el.innerText || '').trim().slice(0, 80),
      };
    }) : [];

    return {
      url:           window.location.href.slice(0, 120),
      htmlClasses:   html.className,
      mainFeedFound: !!mainFeed,
      childCount:    mainFeed ? mainFeed.children.length : 0,
      children,
    };
  });

  console.log('\n=== Page URL ===');
  console.log(result.url);
  console.log('\n=== HTML classes (should have NO df- classes without extension) ===');
  console.log(result.htmlClasses || '(none)');
  console.log(`\n=== mainFeed: found=${result.mainFeedFound}, children=${result.childCount} ===`);
  for (const c of result.children) {
    console.log(`\n[${c.i}] h=${c.h} display=${c.display} "${c.text.slice(0, 60)}"`);
    if (c.dataAttrs.length) console.log(`  data: ${c.dataAttrs.join(' | ')}`);
  }

  await page.waitForTimeout(3000);
} finally {
  await ctx.close();
}
