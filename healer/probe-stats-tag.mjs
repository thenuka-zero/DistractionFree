/**
 * Probe: verify tagStatsDashboard() logic works correctly.
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
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  const result = await page.evaluate(() => {
    // Simulate tagStatsDashboard()
    const anchor = document.querySelector(
      'a[href*="/analytics/creator/content"], a[href*="profile-views"]'
    );
    if (!anchor) return { error: 'anchor not found' };

    const wrapper = anchor.closest('[data-display-contents]');
    if (!wrapper) return { error: 'no [data-display-contents] ancestor', anchorHref: anchor.href };

    const chain2 = wrapper.parentElement;
    const chain3 = chain2?.parentElement;
    const section = chain3?.parentElement;

    if (!section) return { error: 'chain too short', wrapper: wrapper.outerHTML.slice(0, 100) };

    // Tag it
    section.dataset.dfHideStatsDashboard = 'true';

    const rect = section.getBoundingClientRect();
    return {
      ok: true,
      anchorHref: anchor.href,
      anchorTop: Math.round(anchor.getBoundingClientRect().top),
      sectionH: section.offsetHeight,
      sectionTop: Math.round(rect.top),
      sectionLeft: Math.round(rect.left),
      sectionTagged: section.getAttribute('data-df-hide-stats-dashboard'),
      sectionHtml: section.outerHTML.slice(0, 100),
      // What text is in the section?
      sectionText: (section.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
      // Verify CSS would hide it (check if data-df-hide-stats-dashboard="true" was set)
      queryCheck: !!document.querySelector('[data-df-hide-stats-dashboard="true"]'),
    };
  });

  console.log('\n═══════ STATS TAGGING VERIFICATION ═══════');
  console.log(JSON.stringify(result, null, 2));

  await page.waitForTimeout(2000);
} finally {
  await ctx.close();
}
