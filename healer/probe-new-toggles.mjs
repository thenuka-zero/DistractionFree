/**
 * Probe: identify the DOM structure of:
 *   1. "Start a post" composer block
 *   2. "My pages" left sidebar section
 *   3. Promoted "Follow" pages module
 * Runs WITHOUT extension so everything is visible.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dir  = path.dirname(fileURLToPath(import.meta.url));
const session = JSON.parse(readFileSync(path.join(__dir, 'session.json'), 'utf8'));

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: ['--window-size=1280,900'],   // NO extension
});

function ancestorChain(el, depth = 6) {
  const chain = [];
  let node = el;
  for (let i = 0; i < depth && node && node !== document.body; i++) {
    const attrs = {};
    for (const a of node.attributes) {
      if (['id','data-testid','componentkey','data-display-contents','data-view-name'].includes(a.name))
        attrs[a.name] = a.value;
    }
    const rect = node.getBoundingClientRect();
    chain.push({
      tag:  node.tagName,
      h:    node.offsetHeight,
      top:  Math.round(rect.top),
      left: Math.round(rect.left),
      sibs: node.parentElement ? node.parentElement.children.length : 0,
      attrs,
      cls:  node.className.slice(0, 60),
    });
    node = node.parentElement;
  }
  return chain;
}

try {
  await ctx.addCookies(session);
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://www.linkedin.com/feed/', {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForTimeout(5000);

  await page.screenshot({ path: path.join(__dir, 'new-toggles-screenshot.png') });

  const result = await page.evaluate(() => {
    function ancestorChain(el, depth) {
      const chain = [];
      let node = el;
      for (let i = 0; i < depth && node && node !== document.body; i++) {
        const attrs = {};
        for (const a of node.attributes) {
          if (['id','data-testid','componentkey','data-display-contents','data-view-name'].includes(a.name))
            attrs[a.name] = a.value;
        }
        const rect = node.getBoundingClientRect();
        chain.push({
          tag:  node.tagName,
          h:    node.offsetHeight,
          top:  Math.round(rect.top),
          left: Math.round(rect.left),
          sibs: node.parentElement ? node.parentElement.children.length : 0,
          attrs,
          cls:  node.className.slice(0, 70),
          html: node.outerHTML.slice(0, 150),
        });
        node = node.parentElement;
      }
      return chain;
    }

    // ── 1. Start a post composer ──────────────────────────────────────────
    const mainFeed = document.querySelector("[data-testid='mainFeed']");
    const composer = mainFeed ? mainFeed.children[0] : null;
    const composerChain = composer ? ancestorChain(composer, 4) : null;

    // Also look for the share box by test id
    const shareBox = document.querySelector("[data-testid='share-box-feed-entry-point']") ||
                     document.querySelector("[data-testid='create-post-button']");
    const shareBoxInfo = shareBox ? {
      testid: shareBox.getAttribute('data-testid'),
      h: shareBox.offsetHeight,
      html: shareBox.outerHTML.slice(0, 200),
    } : null;

    // ── 2. My pages section ───────────────────────────────────────────────
    let myPagesEl = null;
    for (const el of document.querySelectorAll('p, span, h2, h3, button')) {
      const t = (el.textContent || '').trim();
      if (/^my pages(\s*\(\d+\))?$/i.test(t)) { myPagesEl = el; break; }
    }
    const myPagesChain = myPagesEl ? ancestorChain(myPagesEl, 8) : null;

    // ── 3. Follow / promoted pages module ────────────────────────────────
    // Strategy A: look for sidebar cards containing a "Follow" button
    const followEls = [];
    document.querySelectorAll('button, a').forEach(btn => {
      const t = (btn.textContent || '').trim();
      if (t !== 'Follow') return;
      const rect = btn.getBoundingClientRect();
      if (rect.top < 60) return; // skip nav
      const card = btn.closest('[componentkey], .artdeco-card, aside, section');
      if (!card) return;
      const cardRect = card.getBoundingClientRect();
      // Only sidebar (left x<310 or right x>860)
      const inSidebar = cardRect.left < 310 || cardRect.left > 860;
      followEls.push({
        btnTop:   Math.round(rect.top),
        btnLeft:  Math.round(rect.left),
        inSidebar,
        cardKey:  card.getAttribute('componentkey') || '',
        cardH:    card.offsetHeight,
        cardTop:  Math.round(cardRect.top),
        cardLeft: Math.round(cardRect.left),
        cardHtml: card.outerHTML.slice(0, 300),
        chain:    ancestorChain(card, 6),
      });
    });

    // Strategy B: look for heading text patterns used for follow suggestions
    const followHeadings = [];
    const patterns = [
      /^pages for you$/i,
      /^companies/i,
      /^suggested for you$/i,
      /^pages$/i,
      /^grow your network$/i,
    ];
    for (const el of document.querySelectorAll('p, span, h2, h3')) {
      const t = (el.textContent || '').trim();
      if (patterns.some(p => p.test(t))) {
        const card = el.closest('[componentkey], .artdeco-card, aside, section');
        followHeadings.push({
          text: t,
          tag: el.tagName,
          top: Math.round(el.getBoundingClientRect().top),
          cardKey: card ? (card.getAttribute('componentkey') || '') : '',
          cardHtml: card ? card.outerHTML.slice(0, 300) : '',
        });
      }
    }

    return { composerChain, shareBoxInfo, myPagesChain, followEls, followHeadings };
  });

  // ── Print ──────────────────────────────────────────────────────────────

  console.log('\n═══════ 1. START A POST COMPOSER ═══════');
  if (result.composerChain) {
    result.composerChain.forEach((n, i) => {
      const stable = Object.keys(n.attrs).length
        ? '  ATTRS: ' + JSON.stringify(n.attrs) : '';
      console.log(`[${i}] ${n.tag} h=${n.h} top=${n.top} left=${n.left} sibs=${n.sibs}${stable}`);
      console.log(`     cls: ${n.cls}`);
    });
  }
  if (result.shareBoxInfo) {
    console.log('\nShare box element:', JSON.stringify(result.shareBoxInfo, null, 2));
  }

  console.log('\n═══════ 2. MY PAGES SECTION ═══════');
  if (result.myPagesChain) {
    result.myPagesChain.forEach((n, i) => {
      const stable = Object.keys(n.attrs).length
        ? '  ATTRS: ' + JSON.stringify(n.attrs) : '';
      console.log(`[${i}] ${n.tag} h=${n.h} top=${n.top} left=${n.left} sibs=${n.sibs}${stable}`);
      console.log(`     cls: ${n.cls}`);
    });
  } else {
    console.log('(not found)');
  }

  console.log('\n═══════ 3. FOLLOW BUTTONS IN SIDEBAR ═══════');
  if (result.followEls.length === 0) {
    console.log('(none found in sidebar)');
  }
  result.followEls.forEach((f, i) => {
    console.log(`\n[${i}] Follow btn at top=${f.btnTop} left=${f.btnLeft}  inSidebar=${f.inSidebar}`);
    console.log(`    card: key="${f.cardKey}" h=${f.cardH} top=${f.cardTop} left=${f.cardLeft}`);
    console.log(`    cardHtml: ${f.cardHtml}`);
    console.log(`    chain:`);
    f.chain.forEach((n, j) => {
      const stable = Object.keys(n.attrs).length ? ' ATTRS:' + JSON.stringify(n.attrs) : '';
      console.log(`      [${j}] ${n.tag} h=${n.h} top=${n.top} left=${n.left} sibs=${n.sibs}${stable}`);
    });
  });

  console.log('\n═══════ 3b. FOLLOW-SUGGESTION HEADINGS ═══════');
  if (result.followHeadings.length === 0) {
    console.log('(none found)');
  }
  result.followHeadings.forEach((h, i) => {
    console.log(`[${i}] "${h.text}" (${h.tag}) top=${h.top}  cardKey="${h.cardKey}"`);
    console.log(`     html: ${h.cardHtml.slice(0, 200)}`);
  });

  await page.waitForTimeout(3000);
} finally {
  await ctx.close();
}
