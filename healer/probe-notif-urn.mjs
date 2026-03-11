/**
 * Find how the highlightedUpdateUrn maps to a DOM element on the notification page.
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

  // Get a fresh notification URL
  await page.goto('https://www.linkedin.com/notifications/', {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForTimeout(3000);

  const url = await page.evaluate(() =>
    ([...document.querySelectorAll('a')].find(a => a.href.includes('highlightedUpdateUrn')) || {}).href
  );
  if (!url) { console.log('No URL found'); process.exit(1); }

  // Extract the URN from the URL
  const urnMatch = url.match(/highlightedUpdateUrn=([^&]+)/);
  const urnEncoded = urnMatch ? urnMatch[1] : '';
  const urn = decodeURIComponent(urnEncoded);
  console.log('\nTarget URN:', urn);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  const result = await page.evaluate((targetUrn) => {
    const mainFeed = document.querySelector("[data-testid='mainFeed']");
    if (!mainFeed) return { error: 'no mainFeed' };

    // Dump ALL attributes of each direct child
    const children = [...mainFeed.children].map((el, i) => {
      const allAttrs = [...el.attributes].map(a => `${a.name}="${a.value.slice(0, 120)}"`);
      // Search the entire subtree for any element containing the target URN
      const urnEl = el.querySelector(`[data-entity-urn*="${targetUrn}"], [data-id*="${targetUrn}"], [id*="${targetUrn}"]`);
      // Also brute-force: check outerHTML for URN
      const hasUrnInHTML = el.outerHTML.includes(targetUrn.replace(/:/g, '%3A')) ||
                           el.outerHTML.includes(targetUrn);
      return { i, allAttrs, hasUrnInHTML, urnElTag: urnEl ? urnEl.tagName : null, urnElAttrs: urnEl ? [...urnEl.attributes].map(a=>`${a.name}=${a.value.slice(0,60)}`).join(' | ') : null };
    });

    return { children };
  }, urn);

  for (const c of result.children || []) {
    const marker = c.hasUrnInHTML ? ' ◀ CONTAINS TARGET URN' : '';
    console.log(`\n[${c.i}]${marker}`);
    c.allAttrs.forEach(a => console.log(`  ${a}`));
    if (c.urnElTag) console.log(`  → URN element: ${c.urnElTag} | ${c.urnElAttrs}`);
  }

  await page.waitForTimeout(3000);
} finally {
  await ctx.close();
}
