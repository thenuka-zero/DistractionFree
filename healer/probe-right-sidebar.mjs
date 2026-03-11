/**
 * Probe: find the DOM structure of the right-sidebar promoted Follow card
 * (T-Mobile For Business / "Promoted" badge + Follow button in right rail).
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
          html: node.outerHTML.slice(0, 120),
        });
        node = node.parentElement;
      }
      return out;
    }

    const mainFeed = document.querySelector("[data-testid='mainFeed']");

    // Find ALL "Promoted" text elements on the page (including right sidebar)
    const promotedEls = [];
    document.querySelectorAll('p, span, div').forEach(el => {
      const t = (el.textContent || '').trim();
      if (!/^promoted$/i.test(t)) return;
      const rect = el.getBoundingClientRect();
      if (rect.top < 60) return;

      // Is this inside mainFeed?
      const inMainFeed = mainFeed && mainFeed.contains(el);

      // Walk up to mainFeed direct child (if inside mainFeed)
      let feedChild = null;
      if (inMainFeed) {
        let node = el;
        while (node && node.parentElement !== mainFeed) node = node.parentElement;
        feedChild = (node && node !== mainFeed) ? node : null;
      }

      // Find Follow button nearby
      const card = el.closest('[componentkey], .artdeco-card, aside, section') || el.parentElement;
      const followBtn = card ? card.querySelector('button[aria-label^="Follow"], a[aria-label^="Follow"]') : null;

      promotedEls.push({
        tag: el.tagName,
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        inMainFeed,
        feedChildAttrs: feedChild ? Object.fromEntries([...feedChild.attributes].filter(a => ['data-display-contents','componentkey','data-testid'].includes(a.name)).map(a => [a.name, a.value])) : null,
        followBtnAriaLabel: followBtn ? followBtn.getAttribute('aria-label') : null,
        chain: chain(el, 14),
      });
    });

    // Find Follow buttons NOT inside mainFeed (right sidebar)
    const rightSidebarFollowBtns = [];
    document.querySelectorAll('button[aria-label^="Follow"], a[aria-label^="Follow"]').forEach(btn => {
      const rect = btn.getBoundingClientRect();
      if (rect.top < 60) return;
      if (mainFeed && mainFeed.contains(btn)) return; // skip feed column
      rightSidebarFollowBtns.push({
        tag: btn.tagName,
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        ariaLabel: btn.getAttribute('aria-label'),
        chain: chain(btn, 14),
      });
    });

    return { promotedEls, rightSidebarFollowBtns };
  });

  console.log('\n═══════ ALL "Promoted" elements ═══════');
  result.promotedEls.forEach((e, i) => {
    console.log(`\n[${i}] <${e.tag}> top=${e.top} left=${e.left} inMainFeed=${e.inMainFeed}`);
    console.log(`    followBtn: "${e.followBtnAriaLabel}"`);
    if (e.feedChildAttrs) console.log(`    feedChild: ${JSON.stringify(e.feedChildAttrs)}`);
    console.log('    chain:');
    e.chain.forEach((n, j) => {
      const a = Object.keys(n.attrs).length ? ' ATTRS:' + JSON.stringify(n.attrs) : '';
      console.log(`      [${j}] ${n.tag} h=${n.h} top=${n.top} left=${n.left} sibs=${n.sibs}${a}`);
    });
  });

  console.log('\n═══════ Follow buttons OUTSIDE mainFeed (right sidebar) ═══════');
  if (result.rightSidebarFollowBtns.length === 0) console.log('(none found)');
  result.rightSidebarFollowBtns.forEach((b, i) => {
    console.log(`\n[${i}] <${b.tag}> "${b.ariaLabel}" top=${b.top} left=${b.left}`);
    console.log('    chain:');
    b.chain.forEach((n, j) => {
      const a = Object.keys(n.attrs).length ? ' ATTRS:' + JSON.stringify(n.attrs) : '';
      console.log(`      [${j}] ${n.tag} h=${n.h} top=${n.top} left=${n.left} sibs=${n.sibs}${a}`);
    });
  });

  await page.waitForTimeout(3000);
} finally {
  await ctx.close();
}
