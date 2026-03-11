/**
 * Probe the notification page DOM WITHOUT the extension to see raw structure.
 * Specifically: what element identifies the highlighted post?
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

  // Get fresh URL from notifications page
  await page.goto('https://www.linkedin.com/notifications/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  const notifUrl = await page.evaluate(() =>
    ([...document.querySelectorAll('a')].find(a => a.href.includes('highlightedUpdateUrn')) || {}).href || null
  );
  if (!notifUrl) { console.log('No notification URL found'); process.exit(1); }
  console.log('Using URL:', notifUrl.slice(0, 100));

  // Navigate to the notification post page
  await page.goto(notifUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000); // wait longer for posts to render

  const result = await page.evaluate(() => {
    const mainFeed = document.querySelector("[data-testid='mainFeed']");
    if (!mainFeed) return { error: 'no mainFeed' };

    // All data-view-name values present in the entire page
    const allDvn = new Set();
    document.querySelectorAll('[data-view-name]').forEach(el => allDvn.add(el.getAttribute('data-view-name')));

    // Direct children of mainFeed
    const children = [...mainFeed.children].map((el, i) => ({
      i,
      tag: el.tagName,
      dvn: el.getAttribute('data-view-name'),
      h: el.offsetHeight,
      classes: el.className.slice(0, 60),
      // Data attributes
      dataAttrs: [...el.attributes]
        .filter(a => a.name.startsWith('data-'))
        .map(a => `${a.name}=${a.value.slice(0,40)}`),
    }));

    // All feed-full-update across whole page
    const posts = [...document.querySelectorAll("[data-view-name='feed-full-update']")].map(el => ({
      h: el.offsetHeight,
      display: getComputedStyle(el).display,
      parentDvn: el.parentElement ? el.parentElement.getAttribute('data-view-name') : null,
    }));

    return {
      allDvn: [...allDvn].sort(),
      childCount: children.length,
      children: children.slice(0, 6),
      feedFullUpdateCount: posts.length,
      feedFullUpdatePosts: posts,
    };
  });

  console.log('\n=== All data-view-name values on page ===');
  console.log(result.allDvn?.join('\n') || 'none');

  console.log('\n=== mainFeed direct children (first 6) ===');
  for (const c of result.children || []) {
    console.log(`[${c.i}] dvn="${c.dvn}" h=${c.h} ${c.classes.slice(0,40)}`);
    if (c.dataAttrs.length) console.log(`     data: ${c.dataAttrs.join(', ')}`);
  }

  console.log(`\n=== feed-full-update elements: ${result.feedFullUpdateCount} ===`);
  for (const p of result.feedFullUpdatePosts || []) {
    console.log(`  h=${p.h} display=${p.display} parentDvn="${p.parentDvn}"`);
  }

  await page.waitForTimeout(2000);
} finally {
  await ctx.close();
}
