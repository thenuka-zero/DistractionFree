/**
 * Probe: get exact DOM structure of
 *   1. "My pages" left-sidebar WIDGET (the card showing pages + activity, not the nav link)
 *   2. Promoted "Follow" card (e.g. Bestow) in the feed
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
  await page.waitForTimeout(6000);

  const result = await page.evaluate(() => {
    function chain(el, depth = 10) {
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

    // ── 1. My pages WIDGET (looking for a card in the left sidebar that shows pages + activity)
    // Strategy A: find ANY element with "My pages" or "my pages" and inspect all levels
    const myPagesEls = [];
    for (const el of document.querySelectorAll('p, span, h2, h3, a')) {
      const t = (el.textContent || '').trim();
      if (/^my pages(\s*\(\d+\))?$/i.test(t)) {
        myPagesEls.push({
          tag: el.tagName,
          h: el.offsetHeight,
          left: Math.round(el.getBoundingClientRect().left),
          top: Math.round(el.getBoundingClientRect().top),
          html: el.outerHTML.slice(0, 150),
          chain: chain(el, 12),
        });
      }
    }

    // Strategy B: find the card containing "Activity" count (specific to My Pages widget)
    const activityEls = [];
    for (const el of document.querySelectorAll('p, span, div')) {
      const t = (el.textContent || '').trim();
      if (t === 'Activity' && el.getBoundingClientRect().left < 300) {
        const card = el.closest('[componentkey], .artdeco-card, aside, section');
        if (card) {
          activityEls.push({
            tag: el.tagName,
            top: Math.round(el.getBoundingClientRect().top),
            left: Math.round(el.getBoundingClientRect().left),
            cardKey: card.getAttribute('componentkey') || '',
            cardH: card.offsetHeight,
            cardHtml: card.outerHTML.slice(0, 400),
            chain: chain(card, 8),
          });
        }
      }
    }

    // Strategy C: find "Grow your business" text (in the My Pages widget footer)
    let growEl = null;
    for (const el of document.querySelectorAll('p, span, h3')) {
      if ((el.textContent || '').trim().includes('Grow your business')) {
        growEl = el;
        break;
      }
    }
    const growChain = growEl ? chain(growEl, 10) : null;

    // ── 2. Promoted "Follow" card (with "Promoted" badge)
    const promotedFollowCards = [];
    // Look for "Promoted" label anywhere
    for (const el of document.querySelectorAll('span, p, div, a')) {
      const t = (el.textContent || '').trim();
      if (!/^promoted$/i.test(t)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top < 60) continue;
      // Find the card
      const card = el.closest('[componentkey], .artdeco-card, [data-display-contents]');
      if (!card) continue;
      // Walk up to mainFeed direct child
      const mainFeed = document.querySelector("[data-testid='mainFeed']");
      let node = card;
      while (node && node.parentElement !== mainFeed) node = node.parentElement;
      const feedChild = node && node !== mainFeed ? node : null;
      // Find Follow button inside this card/feedChild
      const followBtn = (feedChild || card).querySelector('button');
      const btnText = followBtn ? (followBtn.textContent || '').trim() : '';
      promotedFollowCards.push({
        promotedTag: el.tagName,
        promotedTop: Math.round(rect.top),
        promotedHtml: el.outerHTML.slice(0, 150),
        cardKey: card.getAttribute('componentkey') || '',
        feedChildTag: feedChild ? feedChild.tagName : null,
        feedChildAttrs: feedChild ? (() => {
          const a = {};
          for (const attr of feedChild.attributes) {
            if (['data-display-contents','componentkey','data-testid'].includes(attr.name)) a[attr.name] = attr.value;
          }
          return a;
        })() : null,
        btnText,
        btnHtml: followBtn ? followBtn.outerHTML.slice(0, 200) : null,
        chain: chain(el, 14),
      });
    }

    // Also check: are there Follow buttons NOT reachable from mainFeed walk-up?
    const allFollowBtns = [];
    document.querySelectorAll('button').forEach(btn => {
      if ((btn.textContent || '').trim() !== 'Follow') return;
      const rect = btn.getBoundingClientRect();
      if (rect.top < 60) return;
      const mainFeed = document.querySelector("[data-testid='mainFeed']");
      let node = btn;
      while (node && node.parentElement !== mainFeed) node = node.parentElement;
      const inMainFeed = node && node !== mainFeed;
      allFollowBtns.push({
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        inMainFeed,
        ariaLabel: btn.getAttribute('aria-label') || '',
        btnHtml: btn.outerHTML.slice(0, 200),
        feedChildAttrs: inMainFeed ? (() => {
          const a = {};
          for (const attr of node.attributes) {
            if (['data-display-contents','componentkey','data-testid'].includes(attr.name)) a[attr.name] = attr.value;
          }
          return a;
        })() : null,
      });
    });

    return { myPagesEls, activityEls, growChain, promotedFollowCards, allFollowBtns };
  });

  // ── Print ──
  console.log('\n═══════ 1. MY PAGES elements ═══════');
  result.myPagesEls.forEach((e, i) => {
    console.log(`\n[${i}] <${e.tag}> h=${e.h} top=${e.top} left=${e.left}`);
    console.log(`    html: ${e.html}`);
    console.log(`    chain:`);
    e.chain.forEach((n, j) => {
      const a = Object.keys(n.attrs).length ? ' ATTRS:' + JSON.stringify(n.attrs) : '';
      console.log(`      [${j}] ${n.tag} h=${n.h} top=${n.top} left=${n.left} sibs=${n.sibs}${a}`);
    });
  });

  console.log('\n═══════ 1b. Activity elements (My Pages widget) ═══════');
  result.activityEls.slice(0, 3).forEach((e, i) => {
    console.log(`\n[${i}] Activity at top=${e.top} left=${e.left}  cardKey="${e.cardKey}" cardH=${e.cardH}`);
    console.log(`    cardHtml: ${e.cardHtml.slice(0, 300)}`);
    console.log(`    chain:`);
    e.chain.forEach((n, j) => {
      const a = Object.keys(n.attrs).length ? ' ATTRS:' + JSON.stringify(n.attrs) : '';
      console.log(`      [${j}] ${n.tag} h=${n.h} top=${n.top} left=${n.left} sibs=${n.sibs}${a}`);
    });
  });

  console.log('\n═══════ 1c. "Grow your business" chain ═══════');
  if (result.growChain) {
    result.growChain.forEach((n, j) => {
      const a = Object.keys(n.attrs).length ? ' ATTRS:' + JSON.stringify(n.attrs) : '';
      console.log(`  [${j}] ${n.tag} h=${n.h} top=${n.top} left=${n.left} sibs=${n.sibs}${a}`);
      console.log(`       cls: ${n.cls}`);
    });
  } else { console.log('(not found)'); }

  console.log('\n═══════ 2. PROMOTED FOLLOW CARDS ═══════');
  if (result.promotedFollowCards.length === 0) console.log('(none found)');
  result.promotedFollowCards.forEach((c, i) => {
    console.log(`\n[${i}] <${c.promotedTag}> top=${c.promotedTop}`);
    console.log(`    promotedHtml: ${c.promotedHtml}`);
    console.log(`    cardKey: "${c.cardKey}"`);
    console.log(`    feedChild: ${c.feedChildTag}  attrs: ${JSON.stringify(c.feedChildAttrs)}`);
    console.log(`    followBtn text: "${c.btnText}"  html: ${c.btnHtml}`);
    console.log(`    chain:`);
    c.chain.forEach((n, j) => {
      const a = Object.keys(n.attrs).length ? ' ATTRS:' + JSON.stringify(n.attrs) : '';
      console.log(`      [${j}] ${n.tag} h=${n.h} top=${n.top} left=${n.left} sibs=${n.sibs}${a}`);
    });
  });

  console.log('\n═══════ 2b. ALL FOLLOW BUTTONS ═══════');
  result.allFollowBtns.forEach((b, i) => {
    console.log(`[${i}] Follow top=${b.top} left=${b.left} inMainFeed=${b.inMainFeed} aria="${b.ariaLabel}"`);
    console.log(`     feedChildAttrs: ${JSON.stringify(b.feedChildAttrs)}`);
    console.log(`     btnHtml: ${b.btnHtml}`);
  });

  await page.waitForTimeout(3000);
} finally {
  await ctx.close();
}
