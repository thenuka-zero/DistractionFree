/**
 * Probe: Deep-dive the top-right-sidebar container (the ExxonMobil promoted card)
 * and find stable attributes to target it via CSS.
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
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);

  const result = await page.evaluate(() => {
    const mainFeed = document.querySelector("[data-testid='mainFeed']");

    // Find the top-right-sidebar element: left>600, top<300, tallest container
    // that is NOT inside mainFeed
    const candidates = [];
    document.querySelectorAll('div, aside, section').forEach(el => {
      if (mainFeed && mainFeed.contains(el)) return;
      const rect = el.getBoundingClientRect();
      if (rect.left < 600 || rect.top < 60 || rect.top > 300) return;
      if (rect.height < 100) return;

      // Collect all attrs
      const attrs = {};
      for (const a of el.attributes) attrs[a.name] = a.value.slice(0, 80);

      candidates.push({
        tag: el.tagName,
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        h: el.offsetHeight,
        attrs,
        // Look for iframes inside
        iframes: el.querySelectorAll('iframe').length,
        // Look for role=button with "Follow"
        followDivBtns: [...el.querySelectorAll('[role="button"]')].filter(b =>
          /follow/i.test(b.textContent || '')
        ).length,
        // Text snippet
        textSnippet: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
        html: el.outerHTML.slice(0, 300),
      });
    });
    // Sort by area (h * width) descending — we want the main card container
    candidates.sort((a, b) => b.h - a.h);

    // All div[role="button"] in right sidebar
    const rightRoleBtns = [];
    document.querySelectorAll('[role="button"]').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.left < 600 || rect.top < 60 || rect.height < 10) return;
      if (mainFeed && mainFeed.contains(el)) return;
      const t = (el.textContent || '').trim();
      rightRoleBtns.push({
        tag: el.tagName,
        text: t.slice(0, 60),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        h: el.offsetHeight,
        attrs: Object.fromEntries([...el.attributes].map(a => [a.name, a.value.slice(0, 60)])),
      });
    });

    // All text inside right sidebar (left>600) that contain "Follow" or "Promoted"
    const rightTextEls = [];
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length > 0) return; // leaf nodes only
      const t = (el.textContent || '').trim();
      if (!/follow|promoted|sponsor/i.test(t)) return;
      const rect = el.getBoundingClientRect();
      if (rect.left < 600 || rect.top < 60 || rect.height === 0) return;
      if (mainFeed && mainFeed.contains(el)) return;
      const attrs = {};
      for (const a of el.attributes) attrs[a.name] = a.value.slice(0, 60);
      rightTextEls.push({
        tag: el.tagName,
        text: t.slice(0, 80),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        h: el.offsetHeight,
        attrs,
      });
    });

    // Check right sidebar for iframes
    const rightIframes = [];
    document.querySelectorAll('iframe').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.left < 600 || rect.top < 60) return;
      const attrs = {};
      for (const a of el.attributes) attrs[a.name] = a.value.slice(0, 80);
      rightIframes.push({
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        h: el.offsetHeight,
        w: el.offsetWidth,
        attrs,
        html: el.outerHTML.slice(0, 300),
      });
    });

    return { candidates: candidates.slice(0, 8), rightRoleBtns, rightTextEls, rightIframes };
  });

  console.log('\n═══════ TOP RIGHT SIDEBAR CONTAINERS ═══════');
  result.candidates.forEach((c, i) => {
    console.log(`\n[${i}] <${c.tag}> h=${c.h} top=${c.top} left=${c.left} iframes=${c.iframes} followDivBtns=${c.followDivBtns}`);
    console.log(`     attrs: ${JSON.stringify(c.attrs).slice(0, 300)}`);
    console.log(`     text: "${c.textSnippet.slice(0, 150)}"`);
    console.log(`     html: ${c.html.slice(0, 200)}`);
  });

  console.log('\n═══════ RIGHT SIDEBAR role="button" elements ═══════');
  if (result.rightRoleBtns.length === 0) console.log('(none)');
  result.rightRoleBtns.forEach((b, i) => {
    console.log(`[${i}] <${b.tag}> "${b.text}" top=${b.top} left=${b.left} h=${b.h}`);
    console.log(`     attrs: ${JSON.stringify(b.attrs).slice(0, 200)}`);
  });

  console.log('\n═══════ RIGHT SIDEBAR text: follow/promoted/sponsor (leaf nodes) ═══════');
  if (result.rightTextEls.length === 0) console.log('(none)');
  result.rightTextEls.forEach((e, i) => {
    console.log(`[${i}] <${e.tag}> "${e.text}" top=${e.top} left=${e.left}`);
    console.log(`     attrs: ${JSON.stringify(e.attrs).slice(0, 150)}`);
  });

  console.log('\n═══════ RIGHT SIDEBAR iframes ═══════');
  if (result.rightIframes.length === 0) console.log('(none)');
  result.rightIframes.forEach((f, i) => {
    console.log(`[${i}] iframe h=${f.h} w=${f.w} top=${f.top} left=${f.left}`);
    console.log(`     attrs: ${JSON.stringify(f.attrs).slice(0, 200)}`);
    console.log(`     html: ${f.html.slice(0, 200)}`);
  });

  await page.waitForTimeout(3000);
} finally {
  await ctx.close();
}
