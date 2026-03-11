/**
 * Probe the feed homepage DOM WITHOUT extension — understand new rendering structure.
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
    const mainFeed = document.querySelector("[data-testid='mainFeed']");
    if (!mainFeed) return { error: 'no mainFeed' };

    // All unique data-view-name values on the page
    const allDvn = new Set();
    document.querySelectorAll('[data-view-name]').forEach(el => allDvn.add(el.getAttribute('data-view-name')));

    // Direct children of mainFeed — full attribute dump
    const children = [...mainFeed.children].slice(0, 10).map((el, i) => {
      const attrs = {};
      for (const a of el.attributes) attrs[a.name] = a.value.slice(0, 80);
      // Check first visible descendant for clues
      const firstVisible = [...el.querySelectorAll('*')].find(d => d.offsetHeight > 0 && getComputedStyle(d).display !== 'none');
      return {
        i,
        tag: el.tagName,
        h: el.offsetHeight,
        display: getComputedStyle(el).display,
        attrs,
        // text snippet to identify what it is visually
        text: el.innerText?.trim().slice(0, 60) || '',
        firstVisibleTag: firstVisible?.tagName,
        firstVisibleDvn: firstVisible?.getAttribute('data-view-name'),
        firstVisibleAttrs: firstVisible ? [...firstVisible.attributes].map(a => `${a.name}=${a.value.slice(0,40)}`).join(' | ') : '',
      };
    });

    // How many children total
    const totalChildren = mainFeed.children.length;

    // Visible children (h > 0)
    const visibleChildren = [...mainFeed.children].filter(el => el.offsetHeight > 0);

    return {
      allDvn: [...allDvn].sort(),
      totalChildren,
      visibleCount: visibleChildren.length,
      children,
    };
  });

  console.log('=== All data-view-name values on feed page ===');
  if (result.allDvn?.length) {
    console.log(result.allDvn.join('\n'));
  } else {
    console.log('(none)');
  }

  console.log(`\n=== mainFeed: ${result.totalChildren} children, ${result.visibleCount} visible ===`);
  for (const c of result.children || []) {
    console.log(`\n[${c.i}] h=${c.h} display=${c.display} "${c.text.slice(0,50)}"`);
    const interestingAttrs = Object.entries(c.attrs || {}).filter(([k]) => k !== 'class').map(([k,v]) => `${k}=${v.slice(0,50)}`);
    if (interestingAttrs.length) console.log(`  attrs: ${interestingAttrs.join(', ')}`);
    if (c.firstVisibleDvn !== undefined) console.log(`  first visible descendant: ${c.firstVisibleTag} dvn="${c.firstVisibleDvn}" ${c.firstVisibleAttrs.slice(0,80)}`);
  }

  await page.waitForTimeout(2000);
} finally {
  await ctx.close();
}
