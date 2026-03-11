/**
 * Probe: verify the news sidebar white-box fix.
 * Runs with extension, takes screenshot, checks what's tagged and its height.
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

  await page.screenshot({ path: path.join(__dir, 'news-fix-screenshot.png') });
  console.log('Screenshot saved.');

  const result = await page.evaluate(() => {
    const tagged = [...document.querySelectorAll('[data-df-hide-news-sidebar="true"]')];
    return tagged.map(el => {
      const rect = el.getBoundingClientRect();
      const st   = window.getComputedStyle(el);
      return {
        tag:     el.tagName,
        display: st.display,
        h:       el.offsetHeight,
        rectH:   Math.round(rect.height),
        rectTop: Math.round(rect.top),
        key:     el.getAttribute('componentkey') || '',
        text:    (el.innerText || '').trim().slice(0, 60),
      };
    });
  });

  console.log('\n=== Tagged [data-df-hide-news-sidebar] elements ===');
  result.forEach((el, i) => {
    console.log(`[${i}] ${el.tag} display=${el.display} h=${el.h} rectH=${el.rectH} rectTop=${el.rectTop}`);
    if (el.key) console.log(`     componentkey="${el.key}"`);
    if (el.text) console.log(`     "${el.text}"`);
  });

  await page.waitForTimeout(3000);
} finally {
  await ctx.close();
}
