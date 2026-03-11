import { chromium }    from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path             from 'path';
const __dir = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dir, '..');
const session = JSON.parse(readFileSync(path.join(__dir, 'session.json'), 'utf8'));

const ctx = await chromium.launchPersistentContext('', {
  headless: true,
  args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
});
await ctx.addCookies(session);
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000);

const r = await page.evaluate(() => {
  const mf = document.querySelector("[data-testid='mainFeed']");
  const htmlClasses = document.documentElement.className;
  const mfStyle = mf ? {
    inlineOverflow: mf.style.overflow || '(empty)',
    inlineAll:      mf.getAttribute('style') || '(none)',
    computedOverflow: getComputedStyle(mf).overflow,
  } : null;

  // Find all CSS rules that set overflow on mainFeed
  const overflowRules = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules || []) {
        if (rule.selectorText && rule.selectorText.includes('mainFeed') && rule.style.overflow) {
          overflowRules.push({
            selector: rule.selectorText,
            overflow: rule.style.overflow,
            priority: rule.style.getPropertyPriority('overflow'),
            href: sheet.href ? sheet.href.slice(-60) : '(inline)',
          });
        }
      }
    } catch(e) {}
  }

  return {
    jsRan: htmlClasses.includes('df-') || !!document.querySelector('.df-quote-container'),
    htmlClasses: htmlClasses.slice(0, 200),
    mfFound: !!mf,
    mfStyle,
    overflowRules,
    quoteFound: !!document.querySelector('.df-quote-container'),
  };
});

console.log(JSON.stringify(r, null, 2));
await ctx.close();
