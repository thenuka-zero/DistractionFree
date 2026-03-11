/**
 * Probe: find the white box remnant left after hiding the LinkedIn News sidebar.
 * Looks at the sidebar structure to identify what element is still visible.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dir          = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dir, '..');
const session        = JSON.parse(readFileSync(path.join(__dir, 'session.json'), 'utf8'));

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
    '--window-size=1280,900',
  ],
});

try {
  await ctx.addCookies(session);
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://www.linkedin.com/feed/', {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForTimeout(5000);

  const result = await page.evaluate(() => {
    // Find all elements tagged as hidden by the extension
    const tagged = [...document.querySelectorAll('[data-df-hide-news-sidebar="true"]')];

    // For each tagged element, look at its siblings and parent
    const taggedInfo = tagged.map(el => {
      const parent = el.parentElement;
      const siblings = parent ? [...parent.children].map((sib, i) => {
        const st = window.getComputedStyle(sib);
        const rect = sib.getBoundingClientRect();
        return {
          i,
          tag: sib.tagName,
          isTagged: sib.dataset.dfHideNewsSidebar === 'true',
          display: st.display,
          h: sib.offsetHeight,
          w: sib.offsetWidth,
          rectTop: Math.round(rect.top),
          rectH: Math.round(rect.height),
          outerHTML: sib.outerHTML.slice(0, 200),
        };
      }) : [];
      const parentSt = parent ? window.getComputedStyle(parent) : null;
      return {
        tag: el.tagName,
        h: el.offsetHeight,
        parentTag: parent ? parent.tagName : 'none',
        parentDisplay: parentSt ? parentSt.display : 'n/a',
        parentH: parent ? parent.offsetHeight : 0,
        siblings,
      };
    });

    // Also: look at the entire aside structure — find all visible children
    const aside = document.querySelector('aside');
    const asideChildren = aside ? [...aside.children].map((el, i) => {
      const st = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        i,
        tag: el.tagName,
        display: st.display,
        h: el.offsetHeight,
        rectTop: Math.round(rect.top),
        rectH: Math.round(rect.height),
        isNewsTagged: el.dataset.dfHideNewsSidebar === 'true',
        outerHTML: el.outerHTML.slice(0, 300),
      };
    }) : [];

    // Find any visible element in the ~50-300px height range that could be the white box
    // (looks like ~60px tall rounded rect)
    const suspectElements = [];
    document.querySelectorAll('aside *').forEach(el => {
      const rect = el.getBoundingClientRect();
      const st = window.getComputedStyle(el);
      if (
        rect.height > 30 && rect.height < 120 &&
        rect.width > 100 &&
        st.display !== 'none' &&
        !el.dataset.dfHideNewsSidebar
      ) {
        const bg = st.backgroundColor;
        // Only care about white/near-white backgrounds
        if (bg.includes('255, 255, 255') || bg === 'rgba(0, 0, 0, 0)') {
          suspectElements.push({
            tag: el.tagName,
            h: Math.round(rect.height),
            w: Math.round(rect.width),
            rectTop: Math.round(rect.top),
            bg,
            classes: el.className.slice(0, 80),
            componentkey: el.getAttribute('componentkey') || '',
            dataTestid: el.getAttribute('data-testid') || '',
            outerHTML: el.outerHTML.slice(0, 300),
          });
        }
      }
    });

    return { taggedInfo, asideChildren, suspectElements: suspectElements.slice(0, 10) };
  });

  console.log('\n=== Tagged [data-df-hide-news-sidebar] elements ===');
  result.taggedInfo.forEach((t, i) => {
    console.log(`[${i}] ${t.tag} h=${t.h}  parent=${t.parentTag} parentH=${t.parentH}`);
    console.log('  Siblings:');
    t.siblings.forEach(s => {
      const flag = s.isTagged ? ' [TAGGED-HIDDEN]' : '';
      console.log(`    [${s.i}] ${s.tag} display=${s.display} h=${s.h} rectH=${s.rectH}${flag}`);
      console.log(`         ${s.outerHTML.slice(0, 150)}`);
    });
  });

  console.log('\n=== <aside> direct children ===');
  result.asideChildren.forEach(c => {
    const flag = c.isNewsTagged ? ' [NEWS-TAGGED]' : '';
    console.log(`[${c.i}] ${c.tag} display=${c.display} h=${c.h} rectH=${c.rectH}${flag}`);
    console.log(`  ${c.outerHTML.slice(0, 200)}`);
  });

  console.log('\n=== Suspect white-box elements in aside ===');
  result.suspectElements.forEach((el, i) => {
    console.log(`[${i}] ${el.tag} h=${el.h} w=${el.w} top=${el.rectTop}`);
    console.log(`  componentkey="${el.componentkey}"  data-testid="${el.dataTestid}"`);
    console.log(`  classes: ${el.classes}`);
    console.log(`  HTML: ${el.outerHTML.slice(0, 250)}`);
  });

  await page.waitForTimeout(3000);
} finally {
  await ctx.close();
}
