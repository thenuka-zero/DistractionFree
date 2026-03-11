/**
 * Probe 2: Find the exact DOM position of the "Load more" button.
 * Runs WITHOUT extension to see raw LinkedIn structure.
 */
import { chromium }    from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path             from 'path';

const __dir        = path.dirname(fileURLToPath(import.meta.url));
const session = JSON.parse(readFileSync(path.join(__dir, 'session.json'), 'utf8'));

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: ['--window-size=1280,800'],
});

try {
  await ctx.addCookies(session);
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(4000);

  // Scroll to trigger load-more
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(3000);

  const result = await page.evaluate(() => {
    // Find every button/link with "load more" text (case-insensitive)
    const hits = [];
    document.querySelectorAll('button, [role="button"], a').forEach(el => {
      const text = (el.innerText || '').trim().toLowerCase();
      if (text === 'load more' || text === 'show more posts' || text === 'see more') {
        // Walk up the ancestor chain to understand where it lives
        const ancestors = [];
        let cur = el.parentElement;
        while (cur && cur !== document.documentElement) {
          const tag = cur.tagName;
          const vn  = cur.getAttribute('data-view-name');
          const tid = cur.getAttribute('data-testid');
          ancestors.push(
            `${tag}` +
            (vn  !== null ? `[data-view-name="${vn}"]`   : '') +
            (tid !== null ? `[data-testid="${tid}"]`      : '')
          );
          if (ancestors.length >= 6) break;
          cur = cur.parentElement;
        }

        hits.push({
          text:          el.innerText.trim(),
          tag:           el.tagName,
          ownDataViewName: el.getAttribute('data-view-name'),
          ownDataTestId:   el.getAttribute('data-testid'),
          ancestors,
          visible: getComputedStyle(el).display !== 'none' && el.offsetHeight > 0,
        });
      }
    });
    return hits;
  });

  if (result.length === 0) {
    console.log('No "Load more" / "Show more posts" buttons found after scrolling.');
  } else {
    result.forEach((h, i) => {
      console.log(`\n[${i + 1}] "${h.text}"`);
      console.log(`  tag:           ${h.tag}`);
      console.log(`  data-view-name: ${JSON.stringify(h.ownDataViewName)}`);
      console.log(`  data-testid:    ${JSON.stringify(h.ownDataTestId)}`);
      console.log(`  visible:        ${h.visible}`);
      console.log(`  ancestor chain (innermost first):`);
      h.ancestors.forEach(a => console.log(`    ${a}`));
    });
  }

} finally {
  await ctx.close();
}
