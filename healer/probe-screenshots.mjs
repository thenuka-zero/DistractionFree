/**
 * Take screenshots every 200ms after navigation starts with extension active.
 */
import { chromium }    from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path             from 'path';

const __dir          = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dir, '..');
const session        = JSON.parse(readFileSync(path.join(__dir, 'session.json'), 'utf8'));
const OUT_DIR        = path.join(__dir, 'flash-screenshots');
mkdirSync(OUT_DIR, { recursive: true });

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
    '--window-size=1280,800',
  ],
});

try {
  await ctx.addCookies(session);
  const page = ctx.pages()[0] || await ctx.newPage();

  // Navigate without waiting — fire-and-forget so we can screenshot during load
  const navPromise = page.goto('https://www.linkedin.com/feed/', { waitUntil: 'load', timeout: 60_000 });
  console.log('Navigating — capturing frames...');

  // Take 20 screenshots, one every 200ms = 4 seconds total
  for (let i = 0; i <= 20; i++) {
    await page.waitForTimeout(200);
    const file = path.join(OUT_DIR, `frame-${String(i).padStart(3,'0')}-${i*200}ms.png`);
    await page.screenshot({ path: file, fullPage: false }).catch(e => console.log(`  frame ${i} err: ${e.message}`));
    process.stdout.write('.');
  }
  console.log('\nDone. Waiting for navigation to settle...');
  await navPromise.catch(() => {});

  console.log(`\nScreenshots in: ${OUT_DIR}`);
  const files = (await import('fs')).readdirSync(OUT_DIR);
  console.log(`${files.length} frames captured`);

} finally {
  await ctx.close();
}
