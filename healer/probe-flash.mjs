/**
 * Probe: capture mainFeed children at multiple time points
 * to find the window where posts are visible but not yet attributed.
 * Runs WITHOUT extension to see raw LinkedIn render sequence.
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

  // Install a watcher that snapshots mainFeed children every 50ms from the
  // very start of the page load, before any LinkedIn JS runs.
  await page.addInitScript(`
    window.__dfSnapshots = [];

    function snap(label) {
      const mf = document.querySelector("[data-testid='mainFeed']");
      if (!mf) { window.__dfSnapshots.push({ label, noFeed: true }); return; }
      window.__dfSnapshots.push({
        label,
        children: [...mf.children].map(el => ({
          tag:          el.tagName,
          dvn:          el.getAttribute('data-view-name'),   // null if absent
          tid:          el.getAttribute('data-testid'),
          cls:          el.className.slice(0, 50),
          height:       el.offsetHeight,
          display:      getComputedStyle(el).display,
        })),
      });
    }

    // Snap at DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => snap('DOMContentLoaded'));

    // Snap every 100ms for the first 3 seconds
    let elapsed = 0;
    const t = setInterval(() => {
      elapsed += 100;
      snap(elapsed + 'ms');
      if (elapsed >= 3000) clearInterval(t);
    }, 100);
  `);

  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(3500);

  const snapshots = await page.evaluate(() => window.__dfSnapshots);

  // Find the first snapshot where any child is visible AND has no data-view-name
  // (i.e., a post is in the DOM but not yet attributed — the flash window)
  console.log('\n=== Snapshot summary ===');
  for (const snap of snapshots) {
    if (snap.noFeed) { console.log(`${snap.label}: mainFeed not in DOM`); continue; }
    const visibleUnattributed = snap.children.filter(c =>
      c.dvn === null && c.height > 0 && c.display !== 'none'
    );
    const visibleAttributed = snap.children.filter(c =>
      c.dvn !== null && c.height > 0 && c.display !== 'none'
    );
    const posts = snap.children.filter(c => c.dvn === 'feed-full-update');
    if (visibleUnattributed.length > 0 || posts.length > 0) {
      console.log(`\n${snap.label}:`);
      console.log(`  children: ${snap.children.length}`);
      console.log(`  visible+no-dvn: ${visibleUnattributed.length}`, visibleUnattributed.map(c => `${c.cls.slice(0,30)} h=${c.height}`));
      console.log(`  visible+dvn:    ${visibleAttributed.length}`, visibleAttributed.map(c => `dvn=${c.dvn} h=${c.height}`));
      console.log(`  feed-full-update count: ${posts.length}`);
    }
  }

  // Also print the first snapshot that has any mainFeed children at all
  const firstWithChildren = snapshots.find(s => !s.noFeed && s.children.length > 0);
  console.log('\n=== First snapshot with mainFeed children ===');
  console.log(firstWithChildren?.label, JSON.stringify(firstWithChildren?.children?.slice(0, 5), null, 2));

} finally {
  await ctx.close();
}
