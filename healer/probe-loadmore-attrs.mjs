/**
 * Dump ALL attributes on the "Load more" button and its wrapper,
 * looking for a stable, language-independent selector.
 */
import { chromium }    from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path             from 'path';

const __dir  = path.dirname(fileURLToPath(import.meta.url));
const session = JSON.parse(readFileSync(path.join(__dir, 'session.json'), 'utf8'));

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: ['--window-size=1280,800'],
});

try {
  await ctx.addCookies(session);
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(5000);

  const result = await page.evaluate(() => {
    let btn = null;
    document.querySelectorAll('button').forEach(el => {
      if ((el.innerText || '').trim().toLowerCase() === 'load more') btn = el;
    });
    if (!btn) return null;

    const allAttrs = el => {
      const out = {};
      for (const a of el.attributes) out[a.name] = a.value;
      return out;
    };

    // Walk up to direct mainFeed child
    const mainFeed = document.querySelector("[data-testid='mainFeed']");
    let container = btn;
    while (container.parentElement && container.parentElement !== mainFeed) {
      container = container.parentElement;
    }

    return {
      button: {
        attrs:    allAttrs(btn),
        tagName:  btn.tagName,
        text:     btn.innerText.trim(),
        outerHTML: btn.outerHTML.slice(0, 400),
      },
      container: {
        attrs:    allAttrs(container),
        tagName:  container.tagName,
        outerHTML: container.outerHTML.slice(0, 600),
      },
    };
  });

  if (!result) {
    console.log('Button not found in DOM.');
  } else {
    console.log('\n=== Button attributes ===');
    console.log(JSON.stringify(result.button.attrs, null, 2));
    console.log('\nButton outerHTML:', result.button.outerHTML);
    console.log('\n=== Container (direct mainFeed child) attributes ===');
    console.log(JSON.stringify(result.container.attrs, null, 2));
    console.log('\nContainer outerHTML:', result.container.outerHTML);
  }
} finally {
  await ctx.close();
}
