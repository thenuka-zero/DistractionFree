/**
 * Probe: get full structure of the LinkedIn News / Top Stories sidebar section.
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

  await page.goto('https://www.linkedin.com/feed/', {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForTimeout(5000);

  const result = await page.evaluate(() => {
    // Find the "Top stories" or "LinkedIn News" text and walk up to find the
    // outermost stable container (has componentkey, data-testid, or id attribute)
    let target = null;
    for (const el of document.querySelectorAll('p,div,span')) {
      const t = (el.textContent || '').trim();
      if (/^top stories$/i.test(t) || /^linkedin news$/i.test(t)) {
        target = el;
        break;
      }
    }
    if (!target) return { error: 'no target found' };

    // Walk up ancestor chain looking for stable identifiers
    const chain = [];
    let node = target;
    while (node && node !== document.body) {
      const attrs = {};
      for (const a of node.attributes) {
        if (['id', 'data-testid', 'componentkey', 'data-entity-urn'].includes(a.name)) {
          attrs[a.name] = a.value;
        }
      }
      chain.push({
        tag:     node.tagName,
        h:       node.offsetHeight,
        hasStable: Object.keys(attrs).length > 0,
        attrs,
        outerHTML: node.outerHTML.slice(0, 100),
      });
      node = node.parentElement;
    }

    // Find the topmost element with componentkey near the target
    let ckEl = target;
    while (ckEl && !ckEl.hasAttribute('componentkey')) ckEl = ckEl.parentElement;
    const ckParent = ckEl ? ckEl.parentElement : null;
    while (ckParent && !ckParent.hasAttribute('componentkey')) {}

    // Also: find ALL elements with componentkey on the page (their keys + heights)
    const allCK = [...document.querySelectorAll('[componentkey]')].map(el => ({
      key: el.getAttribute('componentkey'),
      h:   el.offsetHeight,
      text: (el.innerText || '').trim().slice(0, 60),
    }));

    return {
      chain: chain.slice(0, 15),
      allComponentKeys: allCK,
    };
  });

  if (result.error) { console.log('ERROR:', result.error); process.exit(1); }

  console.log('\n=== Ancestor chain from "Top stories" element ===');
  result.chain.forEach((node, i) => {
    const stable = node.hasStable ? ` *** STABLE: ${JSON.stringify(node.attrs)}` : '';
    console.log(`[${i}] ${node.tag} h=${node.h}${stable}`);
  });

  console.log('\n=== All [componentkey] elements on page ===');
  result.allComponentKeys.forEach(ck => {
    console.log(`  key=${ck.key}  h=${ck.h}`);
    if (ck.text) console.log(`    "${ck.text}"`);
  });

  await page.waitForTimeout(3000);
} finally {
  await ctx.close();
}
