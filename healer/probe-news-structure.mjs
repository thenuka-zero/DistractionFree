/**
 * Probe WITHOUT extension — see the full LinkedIn News section structure.
 * This lets us find the correct container to hide everything at once.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dir  = path.dirname(fileURLToPath(import.meta.url));
const session = JSON.parse(readFileSync(path.join(__dir, 'session.json'), 'utf8'));

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: ['--window-size=1280,900'],  // NO extension
});

try {
  await ctx.addCookies(session);
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://www.linkedin.com/feed/', {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForTimeout(5000);

  // Screenshot without extension
  await page.screenshot({ path: path.join(__dir, 'news-no-ext-screenshot.png'), fullPage: false });
  console.log('Screenshot saved.');

  const result = await page.evaluate(() => {
    // Find the "LinkedIn News" / "Top stories" p element
    let headingEl = null;
    for (const el of document.querySelectorAll('p, span, h2, h3')) {
      const t = (el.textContent || '').trim();
      if (/^(linkedin news|top stories)$/i.test(t)) {
        headingEl = el;
        break;
      }
    }
    if (!headingEl) return { error: 'no heading found' };

    // Walk up and show full ancestor chain with heights and structure
    const chain = [];
    let node = headingEl;
    while (node && node !== document.body && chain.length < 20) {
      const rect = node.getBoundingClientRect();
      const st = window.getComputedStyle(node);
      const attrs = {};
      for (const a of node.attributes) {
        if (['id', 'data-testid', 'componentkey', 'data-entity-urn', 'data-display-contents', 'class'].includes(a.name)) {
          attrs[a.name] = a.name === 'class' ? a.value.slice(0, 80) : a.value;
        }
      }
      chain.push({
        idx:      chain.length,
        tag:      node.tagName,
        h:        node.offsetHeight,
        rectH:    Math.round(rect.height),
        rectTop:  Math.round(rect.top),
        rectLeft: Math.round(rect.left),
        display:  st.display,
        sibCount: node.parentElement ? node.parentElement.children.length : 0,
        attrs,
      });
      node = node.parentElement;
    }

    return { chain };
  });

  if (result.error) {
    console.log('ERROR:', result.error);
    process.exit(1);
  }

  console.log('\n=== Ancestor chain from "LinkedIn News"/"Top stories" heading ===');
  console.log('(idx=0 is the heading element itself, idx=1 is its parent, etc.)');
  result.chain.forEach(n => {
    const stable = n.attrs.componentkey ? ` [componentkey="${n.attrs.componentkey}"]` :
                   n.attrs['data-testid'] ? ` [data-testid="${n.attrs['data-testid']}"]` :
                   n.attrs.id ? ` [id="${n.attrs.id}"]` : '';
    const siblings = n.sibCount > 1 ? ` (${n.sibCount} siblings at this level)` : '';
    console.log(`[${n.idx}] ${n.tag} display=${n.display} h=${n.h} top=${n.rectTop} left=${n.rectLeft}${stable}${siblings}`);
    if (n.attrs.class) console.log(`     class="${n.attrs.class}"`);
  });

  await page.waitForTimeout(3000);
} finally {
  await ctx.close();
}
