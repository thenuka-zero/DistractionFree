/**
 * Probe: find the LinkedIn "stats/analytics" section in the left sidebar.
 * Looks for profile views, impressions, search appearances, "Your Dashboard" etc.
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
  await page.waitForTimeout(6000);

  const result = await page.evaluate(() => {
    function chain(el, depth = 12) {
      const out = [];
      let node = el;
      for (let i = 0; i < depth && node && node !== document.body; i++) {
        const attrs = {};
        for (const a of node.attributes) {
          if (['id','data-testid','componentkey','data-display-contents','data-view-name'].includes(a.name))
            attrs[a.name] = a.value;
        }
        const rect = node.getBoundingClientRect();
        out.push({
          tag: node.tagName,
          h: node.offsetHeight,
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          sibs: node.parentElement ? node.parentElement.children.length : 0,
          attrs,
          cls: node.className.slice(0, 80),
          html: node.outerHTML.slice(0, 200),
        });
        node = node.parentElement;
      }
      return out;
    }

    // Left sidebar: all elements at left < 300
    const leftSidebarEls = [];

    // Look for numbers (stat counts)
    const statsPatterns = [
      /profile views/i,
      /search appearances/i,
      /post impressions/i,
      /impressions/i,
      /your dashboard/i,
      /analytics/i,
      /insights/i,
      /\d+\s+connection/i,
      /\d+\s+follower/i,
    ];

    for (const el of document.querySelectorAll('p, span, h2, h3, a, div')) {
      const t = (el.textContent || '').trim();
      const rect = el.getBoundingClientRect();
      if (rect.left > 300 || rect.top < 60 || rect.height === 0) continue;
      if (!statsPatterns.some(p => p.test(t))) continue;
      // Avoid huge containers
      if (el.children.length > 5) continue;

      const card = el.closest('[componentkey], [data-view-name], .artdeco-card, aside, section');
      leftSidebarEls.push({
        tag: el.tagName,
        text: t.slice(0, 80),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        h: el.offsetHeight,
        cardKey: card ? (card.getAttribute('componentkey') || card.getAttribute('data-view-name') || '') : '',
        cardH: card ? card.offsetHeight : 0,
        cardHtml: card ? card.outerHTML.slice(0, 400) : '',
        chain: chain(el, 12),
      });
    }

    // Also dump all data-view-name elements in left sidebar for reference
    const viewNames = [];
    for (const el of document.querySelectorAll('[data-view-name]')) {
      const rect = el.getBoundingClientRect();
      if (rect.left > 300 || rect.top < 60) continue;
      viewNames.push({
        viewName: el.getAttribute('data-view-name'),
        h: el.offsetHeight,
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        html: el.outerHTML.slice(0, 200),
      });
    }

    return { leftSidebarEls, viewNames };
  });

  console.log('\n═══════ LEFT SIDEBAR STATS ELEMENTS ═══════');
  if (result.leftSidebarEls.length === 0) console.log('(none found)');
  result.leftSidebarEls.forEach((e, i) => {
    console.log(`\n[${i}] <${e.tag}> "${e.text}" top=${e.top} left=${e.left}`);
    console.log(`    cardKey: "${e.cardKey}"  cardH=${e.cardH}`);
    console.log(`    cardHtml: ${e.cardHtml.slice(0, 300)}`);
    console.log('    chain:');
    e.chain.forEach((n, j) => {
      const a = Object.keys(n.attrs).length ? ' ATTRS:' + JSON.stringify(n.attrs) : '';
      console.log(`      [${j}] ${n.tag} h=${n.h} top=${n.top} left=${n.left} sibs=${n.sibs}${a}`);
      if (j < 3) console.log(`           cls: ${n.cls}`);
    });
  });

  console.log('\n═══════ data-view-name elements in left sidebar ═══════');
  result.viewNames.forEach((v, i) => {
    console.log(`[${i}] data-view-name="${v.viewName}" h=${v.h} top=${v.top} left=${v.left}`);
    console.log(`     html: ${v.html.slice(0, 150)}`);
  });

  await page.waitForTimeout(3000);
} finally {
  await ctx.close();
}
