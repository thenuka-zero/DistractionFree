/**
 * Probe: Find the right-sidebar promoted "Follow us" card structure
 * (ExxonMobil / company follow ad in the right rail).
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
    function chain(el, depth = 14) {
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
          html: node.outerHTML.slice(0, 150),
        });
        node = node.parentElement;
      }
      return out;
    }

    const mainFeed = document.querySelector("[data-testid='mainFeed']");

    // 1. All "Promoted" text elements on right side (left > 600)
    const rightPromoted = [];
    document.querySelectorAll('p, span, div').forEach(el => {
      const t = (el.textContent || '').trim();
      if (!/^promoted$/i.test(t)) return;
      const rect = el.getBoundingClientRect();
      if (rect.left <= 600) return;
      if (rect.top < 60) return;
      const inMainFeed = mainFeed && mainFeed.contains(el);
      rightPromoted.push({
        tag: el.tagName,
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        inMainFeed,
        chain: chain(el, 14),
      });
    });

    // 2. Elements containing "Follow us" text
    const followUsEls = [];
    document.querySelectorAll('p, span, h3, h2, div').forEach(el => {
      if (el.children.length > 2) return;
      const t = (el.textContent || '').trim();
      if (!/^follow us$/i.test(t)) return;
      const rect = el.getBoundingClientRect();
      if (rect.top < 60) return;
      const inMainFeed = mainFeed && mainFeed.contains(el);
      followUsEls.push({
        tag: el.tagName,
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        inMainFeed,
        chain: chain(el, 14),
      });
    });

    // 3. All Follow buttons anywhere on the page (not just mainFeed)
    const allFollowBtns = [];
    document.querySelectorAll('button, a').forEach(btn => {
      const t = (btn.textContent || '').trim();
      const label = btn.getAttribute('aria-label') || '';
      if (!/^follow/i.test(t) && !/^follow/i.test(label)) return;
      const rect = btn.getBoundingClientRect();
      if (rect.top < 60 || rect.height === 0) return;
      const inMainFeed = mainFeed && mainFeed.contains(btn);
      allFollowBtns.push({
        tag: btn.tagName,
        text: t.slice(0, 40),
        ariaLabel: label.slice(0, 60),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        inMainFeed,
        chain: chain(btn, 14),
      });
    });

    // 4. data-view-name elements in right sidebar (left > 600)
    const rightViewNames = [];
    document.querySelectorAll('[data-view-name]').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.left <= 600 || rect.top < 60) return;
      rightViewNames.push({
        viewName: el.getAttribute('data-view-name'),
        h: el.offsetHeight,
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        html: el.outerHTML.slice(0, 200),
      });
    });

    // 5. componentkey elements in right sidebar
    const rightComponentKeys = [];
    document.querySelectorAll('[componentkey]').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.left <= 600 || rect.top < 60) return;
      rightComponentKeys.push({
        key: el.getAttribute('componentkey').slice(0, 40),
        h: el.offsetHeight,
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        html: el.outerHTML.slice(0, 200),
      });
    });

    return { rightPromoted, followUsEls, allFollowBtns, rightViewNames, rightComponentKeys };
  });

  console.log('\n═══════ RIGHT SIDEBAR "Promoted" elements ═══════');
  if (result.rightPromoted.length === 0) console.log('(none found)');
  result.rightPromoted.forEach((e, i) => {
    console.log(`\n[${i}] <${e.tag}> top=${e.top} left=${e.left} inMainFeed=${e.inMainFeed}`);
    console.log('    chain:');
    e.chain.forEach((n, j) => {
      const a = Object.keys(n.attrs).length ? ' ATTRS:' + JSON.stringify(n.attrs) : '';
      console.log(`      [${j}] ${n.tag} h=${n.h} top=${n.top} left=${n.left} sibs=${n.sibs}${a}`);
      if (j < 2) console.log(`           html: ${n.html.slice(0, 120)}`);
    });
  });

  console.log('\n═══════ "Follow us" elements ═══════');
  if (result.followUsEls.length === 0) console.log('(none found)');
  result.followUsEls.forEach((e, i) => {
    console.log(`\n[${i}] <${e.tag}> top=${e.top} left=${e.left} inMainFeed=${e.inMainFeed}`);
    console.log('    chain:');
    e.chain.forEach((n, j) => {
      const a = Object.keys(n.attrs).length ? ' ATTRS:' + JSON.stringify(n.attrs) : '';
      console.log(`      [${j}] ${n.tag} h=${n.h} top=${n.top} left=${n.left} sibs=${n.sibs}${a}`);
      if (j < 2) console.log(`           html: ${n.html.slice(0, 120)}`);
    });
  });

  console.log('\n═══════ ALL Follow buttons ═══════');
  if (result.allFollowBtns.length === 0) console.log('(none found)');
  result.allFollowBtns.forEach((b, i) => {
    console.log(`\n[${i}] <${b.tag}> "${b.text}" aria="${b.ariaLabel}" top=${b.top} left=${b.left} inMainFeed=${b.inMainFeed}`);
    console.log('    chain:');
    b.chain.forEach((n, j) => {
      const a = Object.keys(n.attrs).length ? ' ATTRS:' + JSON.stringify(n.attrs) : '';
      console.log(`      [${j}] ${n.tag} h=${n.h} top=${n.top} left=${n.left} sibs=${n.sibs}${a}`);
    });
  });

  console.log('\n═══════ Right sidebar data-view-name elements ═══════');
  result.rightViewNames.forEach((v, i) => {
    console.log(`[${i}] "${v.viewName}" h=${v.h} top=${v.top} left=${v.left}`);
    console.log(`     ${v.html.slice(0, 120)}`);
  });

  console.log('\n═══════ Right sidebar componentkey elements ═══════');
  result.rightComponentKeys.forEach((v, i) => {
    console.log(`[${i}] key="${v.key}" h=${v.h} top=${v.top} left=${v.left}`);
    console.log(`     ${v.html.slice(0, 120)}`);
  });

  await page.waitForTimeout(3000);
} finally {
  await ctx.close();
}
