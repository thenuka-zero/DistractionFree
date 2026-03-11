/**
 * Probe: Verify stats section anchor hrefs + catch right-sidebar promoted card.
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
    function chain(el, depth = 8) {
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
          attrs,
        });
        node = node.parentElement;
      }
      return out;
    }

    // 1. ALL anchors in left sidebar (left < 300)
    const leftAnchors = [];
    document.querySelectorAll('a[href]').forEach(a => {
      const rect = a.getBoundingClientRect();
      if (rect.left > 300 || rect.top < 60 || rect.height === 0) return;
      const href = a.getAttribute('href') || '';
      const text = (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      leftAnchors.push({
        href: href.slice(0, 100),
        text,
        top: Math.round(rect.top),
        left: Math.round(rect.left),
      });
    });

    // 2. Specifically check if our target selectors match anything
    const statsAnchors = [
      ...document.querySelectorAll('a[href*="/analytics/creator/content"]'),
      ...document.querySelectorAll('a[href*="profile-views"]'),
      ...document.querySelectorAll('a[href*="search-appearances"]'),
    ].map(a => ({
      href: a.getAttribute('href'),
      text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      chain: chain(a, 8),
    }));

    // 3. Check right sidebar for promoted/follow (broader search)
    const mainFeed = document.querySelector("[data-testid='mainFeed']");
    const rightSidebarAll = [];
    // ALL text nodes in right sidebar
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let textNode;
    while ((textNode = walker.nextNode())) {
      const t = (textNode.textContent || '').trim();
      if (!/follow|promoted|sponsor|advertis/i.test(t)) continue;
      const el = textNode.parentElement;
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.left < 600 || rect.height === 0) continue;
      if (mainFeed && mainFeed.contains(el)) continue;
      rightSidebarAll.push({
        text: t.slice(0, 80),
        tag: el.tagName,
        top: Math.round(rect.top),
        left: Math.round(rect.left),
      });
    }

    return { leftAnchors, statsAnchors, rightSidebarAll };
  });

  console.log('\n═══════ LEFT SIDEBAR ANCHORS (top < 600) ═══════');
  result.leftAnchors.filter(a => a.top < 600).forEach((a, i) => {
    console.log(`[${i}] top=${a.top} left=${a.left} href="${a.href}" text="${a.text}"`);
  });

  console.log('\n═══════ STATS ANCHOR SELECTOR MATCHES ═══════');
  if (result.statsAnchors.length === 0) {
    console.log('(NONE FOUND — selector does not match any element)');
  }
  result.statsAnchors.forEach((a, i) => {
    console.log(`\n[${i}] href="${a.href}" text="${a.text}"`);
    console.log('    chain:');
    a.chain.forEach((n, j) => {
      const at = Object.keys(n.attrs).length ? ' ' + JSON.stringify(n.attrs) : '';
      console.log(`      [${j}] ${n.tag} h=${n.h} top=${n.top} left=${n.left}${at}`);
    });
  });

  console.log('\n═══════ RIGHT SIDEBAR TEXT: follow/promoted/sponsor/advertis ═══════');
  if (result.rightSidebarAll.length === 0) console.log('(none found)');
  result.rightSidebarAll.forEach((e, i) => {
    console.log(`[${i}] <${e.tag}> "${e.text}" top=${e.top} left=${e.left}`);
  });

  await page.waitForTimeout(3000);
} finally {
  await ctx.close();
}
