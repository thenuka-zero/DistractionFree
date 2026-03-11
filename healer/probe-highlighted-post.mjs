/**
 * Probe: inspect DOM structure of the highlighted post on a notification URL.
 * Goal: find a reliable selector to identify the highlighted post vs feed posts.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dir          = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dir, '..');
const session        = JSON.parse(readFileSync(path.join(__dir, 'session.json'), 'utf8'));

// The notification URL with a highlighted post
const NOTIFICATION_URL =
  'https://www.linkedin.com/feed/?highlightedUpdateUrn=urn%3Ali%3Aactivity%3A7436799186362220544' +
  '&highlightedUpdateType=SHARED_BY_YOUR_NETWORK&origin=SHARED_BY_YOUR_NETWORK&showCommentBox=true';

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [
    '--window-size=1280,900',
    // No extension — see raw LinkedIn DOM
  ],
});

try {
  await ctx.addCookies(session);
  const page = ctx.pages()[0] || await ctx.newPage();

  console.log('Navigating to notification URL (no extension)...');
  await page.goto(NOTIFICATION_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  const result = await page.evaluate(() => {
    const mainFeed = document.querySelector("[data-testid='mainFeed']");
    if (!mainFeed) return { error: 'mainFeed not found' };

    // Look at the first few direct children
    const children = [...mainFeed.children].slice(0, 8).map((el, i) => {
      const allAttrs = {};
      for (const a of el.attributes) allAttrs[a.name] = a.value;

      // Check for URN-related attributes anywhere in this subtree
      const urnEls = [...el.querySelectorAll('[data-urn], [data-id], [data-update-v2], [data-activity-urn]')].slice(0, 3);

      // Also check the element itself and its direct children for data attrs
      const urnAttrs = {};
      for (const a of el.attributes) {
        if (a.name.includes('urn') || a.name.includes('activity') || a.name.includes('update') || a.name.includes('id')) {
          urnAttrs[a.name] = a.value.slice(0, 80);
        }
      }

      // Look for the activity URN inside this post
      const activityLinks = [...el.querySelectorAll('a[href*="activity"]')].slice(0, 2).map(a => a.href.slice(0, 100));

      return {
        index: i,
        dvn: el.getAttribute('data-view-name'),
        tag: el.tagName,
        topAttrs: allAttrs,
        urnAttrs,
        activityLinks,
        urnEls: urnEls.map(u => ({
          tag: u.tagName,
          urn: u.getAttribute('data-urn') || u.getAttribute('data-id') || u.getAttribute('data-update-v2'),
          cls: u.className.slice(0, 40),
        })),
        height: el.offsetHeight,
        outerHTML: el.outerHTML.slice(0, 300),
      };
    });

    // Also search globally for anything with the target URN
    const targetUrn = 'urn:li:activity:7436799186362220544';
    const urnMatches = [...document.querySelectorAll('*')].filter(el => {
      for (const a of el.attributes) {
        if (a.value.includes('7436799186362220544')) return true;
      }
      return false;
    }).slice(0, 10).map(el => ({
      tag: el.tagName,
      dvn: el.getAttribute('data-view-name'),
      matchingAttrs: [...el.attributes]
        .filter(a => a.value.includes('7436799186362220544'))
        .map(a => ({ name: a.name, value: a.value.slice(0, 100) })),
    }));

    return { children, urnMatches };
  });

  console.log('\n=== mainFeed direct children ===');
  for (const c of result.children || []) {
    console.log(`\n[${c.index}] dvn="${c.dvn}" h=${c.height} tag=${c.tag}`);
    if (Object.keys(c.topAttrs).length > 0) {
      console.log('  attrs:', JSON.stringify(c.topAttrs));
    }
    if (c.urnEls.length > 0) console.log('  urnEls:', JSON.stringify(c.urnEls));
    if (c.activityLinks.length > 0) console.log('  activityLinks:', c.activityLinks);
    console.log('  html:', c.outerHTML.slice(0, 200));
  }

  console.log('\n=== Elements matching target URN ===');
  for (const m of result.urnMatches || []) {
    console.log(`${m.tag} dvn="${m.dvn}"`, JSON.stringify(m.matchingAttrs));
  }

  await page.waitForTimeout(2000);
} finally {
  await ctx.close();
}
