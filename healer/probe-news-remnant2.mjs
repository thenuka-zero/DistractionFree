/**
 * Probe v2: Find the white box remnant after hiding LinkedIn News.
 * Takes a screenshot + dumps all visible elements in the right rail area.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
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

  // Screenshot to visually confirm the white box
  await page.screenshot({ path: path.join(__dir, 'news-remnant-screenshot.png'), fullPage: false });
  console.log('Screenshot saved to healer/news-remnant-screenshot.png');

  const result = await page.evaluate(() => {
    // Find ALL elements in the right-side area (x > 800px) that are visible and white-ish
    const allVisible = [];
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.left < 800 || rect.width < 50 || rect.height < 20) return;
      const st = window.getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) < 0.1) return;
      // Must have some visual presence (background or border)
      const bg = st.backgroundColor;
      const border = st.border;
      const hasWhiteBg = bg.includes('255, 255, 255');
      const hasBorder  = border && !border.startsWith('0px') && !border.includes('none');
      if (!hasWhiteBg && !hasBorder) return;

      allVisible.push({
        tag: el.tagName,
        rectTop: Math.round(rect.top),
        rectLeft: Math.round(rect.left),
        rectH: Math.round(rect.height),
        rectW: Math.round(rect.width),
        bg,
        border: border ? border.slice(0, 40) : '',
        componentkey: el.getAttribute('componentkey') || '',
        dataTestid: el.getAttribute('data-testid') || '',
        classes: el.className.slice(0, 80),
        isNewsTagged: el.dataset.dfHideNewsSidebar === 'true',
        outerHTML: el.outerHTML.slice(0, 200),
      });
    });

    // Also: dump ALL componentkey elements and whether they're tagged
    const allCK = [...document.querySelectorAll('[componentkey]')].map(el => {
      const rect = el.getBoundingClientRect();
      return {
        key: el.getAttribute('componentkey'),
        h: el.offsetHeight,
        rectH: Math.round(rect.height),
        rectTop: Math.round(rect.top),
        isTagged: el.dataset.dfHideNewsSidebar === 'true',
        text: (el.innerText || '').trim().slice(0, 80),
      };
    });

    return { allVisible: allVisible.slice(0, 20), allCK };
  });

  console.log('\n=== All componentkey elements (sorted by position) ===');
  result.allCK.sort((a, b) => a.rectTop - b.rectTop).forEach(ck => {
    const flag = ck.isTagged ? ' [HIDDEN]' : '';
    const vis  = ck.rectH > 0 ? ` visible(h=${ck.rectH})` : ' invisible';
    console.log(`  top=${ck.rectTop}${vis}${flag}  key=${ck.key.slice(0, 36)}`);
    if (ck.text) console.log(`    "${ck.text.slice(0, 60)}"`);
  });

  console.log('\n=== Visible white elements in right rail (x>800) ===');
  result.allVisible
    .sort((a, b) => a.rectTop - b.rectTop)
    .forEach((el, i) => {
      const flag = el.isNewsTagged ? ' [NEWS-TAGGED]' : '';
      console.log(`[${i}] ${el.tag} top=${el.rectTop} h=${el.rectH} w=${el.rectW}${flag}`);
      console.log(`  componentkey="${el.componentkey}"  testid="${el.dataTestid}"`);
      console.log(`  classes: ${el.classes}`);
      console.log(`  HTML: ${el.outerHTML.slice(0, 180)}`);
    });

  await page.waitForTimeout(3000);
} finally {
  await ctx.close();
}
