/**
 * Generate orange-mascot icons at 16, 32, 48, 128px for the Chrome extension.
 * Uses Playwright to render the SVG and screenshot at exact sizes.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir   = path.dirname(fileURLToPath(import.meta.url));
const SIZES   = [16, 32, 48, 128];
const OUT_DIR = path.resolve(__dir, '..', 'icons');

const SVG = `
<svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="100" fill="#FDF6EC"/>
  <ellipse cx="100" cy="115" rx="72" ry="68" fill="#E8943C"/>
  <ellipse cx="80" cy="95" rx="30" ry="22" fill="#F0B870" opacity="0.5"/>
  <rect x="95" y="42" width="10" height="18" rx="5" fill="#5B8C3E"/>
  <ellipse cx="82" cy="52" rx="18" ry="8" fill="#6EAE3E" transform="rotate(-25 82 52)"/>
  <ellipse cx="118" cy="52" rx="18" ry="8" fill="#6EAE3E" transform="rotate(25 118 52)"/>
  <ellipse cx="80" cy="112" rx="8" ry="9" fill="#3D2417"/>
  <ellipse cx="120" cy="112" rx="8" ry="9" fill="#3D2417"/>
  <circle cx="83" cy="108" r="3.5" fill="white"/>
  <circle cx="123" cy="108" r="3.5" fill="white"/>
  <path d="M88 126 Q100 138 112 126" stroke="#3D2417" stroke-width="2.5" stroke-linecap="round" fill="none"/>
  <ellipse cx="66" cy="124" rx="10" ry="7" fill="#F5A0A0" opacity="0.6"/>
  <ellipse cx="134" cy="124" rx="10" ry="7" fill="#F5A0A0" opacity="0.6"/>
</svg>
`;

const browser = await chromium.launch();

for (const size of SIZES) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head><style>
      * { margin: 0; padding: 0; }
      body { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }
      svg { width: ${size}px; height: ${size}px; display: block; }
    </style></head>
    <body>${SVG}</body>
    </html>
  `);
  const buf = await page.screenshot({ type: 'png', omitBackground: true });
  const out = path.join(OUT_DIR, `icon${size}.png`);
  writeFileSync(out, buf);
  console.log(`Wrote ${out}`);
  await page.close();
}

await browser.close();
console.log('Done.');
