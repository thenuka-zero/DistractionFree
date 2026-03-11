/**
 * Probe: find "Top Stories" / LinkedIn News section in the right sidebar.
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
  await page.waitForTimeout(5000);

  const result = await page.evaluate(() => {
    // Gather all data-view-name values on the page
    const allDvn = new Set();
    document.querySelectorAll('[data-view-name]').forEach(el => allDvn.add(el.getAttribute('data-view-name')));

    // Find any element containing "top stories" (case-insensitive)
    const topStoryEls = [];
    document.querySelectorAll('h1,h2,h3,h4,h5,h6,span,p,div,section,aside').forEach(el => {
      const t = (el.textContent || '').trim();
      if (/^top stories$/i.test(t) || /^linkedin news$/i.test(t) || /^today.s news/i.test(t)) {
        const anc = el.closest('[data-view-name],[data-testid],section,aside,div.relative') || el.parentElement;
        topStoryEls.push({
          text:     t.slice(0, 80),
          tag:      el.tagName,
          dvn:      el.getAttribute('data-view-name') || 'none',
          parentDvn: el.parentElement ? el.parentElement.getAttribute('data-view-name') : 'n/a',
          ancestorDvn: anc ? anc.getAttribute('data-view-name') : 'n/a',
          ancestorTestid: anc ? anc.getAttribute('data-testid') : 'n/a',
          ancestorOuterHTML: anc ? anc.outerHTML.slice(0, 300) : 'n/a',
        });
      }
    });

    // Also find the right sidebar container
    const aside = document.querySelector('aside');
    const asideDvns = aside
      ? [...aside.querySelectorAll('[data-view-name]')].map(el => el.getAttribute('data-view-name'))
      : [];

    return { allDvn: [...allDvn].sort(), topStoryEls, asideDvns };
  });

  console.log('\n=== All data-view-name values on feed page ===');
  result.allDvn.forEach(v => v && console.log(` ${v}`));

  console.log('\n=== "Top Stories" / "LinkedIn News" heading elements ===');
  if (!result.topStoryEls.length) {
    console.log('  (none found)');
  }
  result.topStoryEls.forEach((el, i) => {
    console.log(`\n[${i}] text="${el.text}" tag=${el.tag}`);
    console.log(`  own dvn="${el.dvn}"  parent dvn="${el.parentDvn}"  ancestor dvn="${el.ancestorDvn}"`);
    console.log(`  ancestor testid="${el.ancestorTestid}"`);
    console.log(`  ancestor HTML: ${el.ancestorOuterHTML}`);
  });

  console.log('\n=== data-view-name values inside <aside> ===');
  result.asideDvns.filter(Boolean).forEach(v => console.log(` ${v}`));

  await page.waitForTimeout(3000);
} finally {
  await ctx.close();
}
