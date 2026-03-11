/**
 * Inspect the children INSIDE Child[3] (Ethan's post wrapper) to understand
 * why the post is invisible even though display:contents is set correctly.
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

  await page.goto('https://www.linkedin.com/notifications/', {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForTimeout(3000);

  const url = await page.evaluate(() =>
    ([...document.querySelectorAll('a')].find(a => a.href.includes('highlightedUpdateUrn')) || {}).href
  );
  if (!url) { console.log('No notification URL'); process.exit(1); }

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  const result = await page.evaluate(() => {
    const mainFeed = document.querySelector("[data-testid='mainFeed']");
    if (!mainFeed) return { error: 'no mainFeed' };

    // mainFeed computed styles
    const mfSt = window.getComputedStyle(mainFeed);
    const mainFeedInfo = {
      display:    mfSt.display,
      overflow:   mfSt.overflow,
      height:     mfSt.height,
      maxHeight:  mfSt.maxHeight,
      h:          mainFeed.offsetHeight,
    };

    // Find the highlighted post wrapper (Child[3])
    const highlighted = mainFeed.querySelector('.df-highlighted-post');
    if (!highlighted) return { mainFeedInfo, error: 'no highlighted post found' };

    // Get the highlighted post's computed style
    const hSt = window.getComputedStyle(highlighted);

    // Get its children
    const children = [...highlighted.children].slice(0, 5).map((el, i) => {
      const st = window.getComputedStyle(el);
      return {
        i,
        tag:        el.tagName,
        h:          el.offsetHeight,
        w:          el.offsetWidth,
        display:    st.display,
        visibility: st.visibility,
        opacity:    st.opacity,
        overflow:   st.overflow,
        position:   st.position,
        top:        st.top,
        rect:       (() => { const r = el.getBoundingClientRect(); return `top=${r.top.toFixed(0)} left=${r.left.toFixed(0)} w=${r.width.toFixed(0)} h=${r.height.toFixed(0)}`; })(),
        classes:    el.className.slice(0, 60),
      };
    });

    // Scroll position and viewport
    const scrollY = window.scrollY;
    const vpH     = window.innerHeight;

    return {
      mainFeedInfo,
      highlightedDisplay:   hSt.display,
      highlightedH:         highlighted.offsetHeight,
      highlightedRect:      (() => { const r = highlighted.getBoundingClientRect(); return `top=${r.top.toFixed(0)} h=${r.height.toFixed(0)}`; })(),
      childCount:           highlighted.children.length,
      children,
      scrollY,
      vpH,
    };
  });

  console.log('\n=== mainFeed ===');
  console.log(JSON.stringify(result.mainFeedInfo, null, 2));

  console.log('\n=== Highlighted post wrapper ===');
  console.log('display:  ', result.highlightedDisplay);
  console.log('h:        ', result.highlightedH);
  console.log('rect:     ', result.highlightedRect);
  console.log('children: ', result.childCount);
  console.log('scrollY:  ', result.scrollY, '  vpH:', result.vpH);

  console.log('\n=== Highlighted post children (first 5) ===');
  for (const c of result.children || []) {
    console.log(`[${c.i}] ${c.tag} h=${c.h} w=${c.w} display=${c.display} vis=${c.visibility} op=${c.opacity}`);
    console.log(`     rect: ${c.rect}`);
    console.log(`     overflow=${c.overflow} position=${c.position}`);
    if (c.classes) console.log(`     classes: ${c.classes}`);
  }

  if (result.error) console.log('\nERROR:', result.error);

  await page.waitForTimeout(3000);
} finally {
  await ctx.close();
}
