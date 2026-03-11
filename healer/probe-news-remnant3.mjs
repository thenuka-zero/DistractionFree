/**
 * Probe v3: Targeted — inspect the parent/siblings of the hidden LinkedIn News
 * component to find what remnant white box is left behind.
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

  const result = await page.evaluate(() => {
    // 1. Find the hidden LinkedIn News element
    const hidden = document.querySelector('[data-df-hide-news-sidebar="true"]');
    if (!hidden) return { error: 'No hidden news element found' };

    // 2. Walk up to find a container that has multiple children (likely the sidebar section wrapper)
    let container = hidden;
    let levels = [];
    while (container && container !== document.body) {
      const parent = container.parentElement;
      if (!parent) break;
      const siblings = [...parent.children];
      levels.push({
        level:      levels.length,
        parentTag:  parent.tagName,
        parentKey:  parent.getAttribute('componentkey') || '',
        parentH:    parent.offsetHeight,
        childCount: siblings.length,
        children: siblings.map((sib, i) => {
          const st = window.getComputedStyle(sib);
          const rect = sib.getBoundingClientRect();
          return {
            i,
            tag:        sib.tagName,
            key:        sib.getAttribute('componentkey') || '',
            display:    st.display,
            h:          sib.offsetHeight,
            rectH:      Math.round(rect.height),
            rectTop:    Math.round(rect.top),
            isTagged:   sib.dataset.dfHideNewsSidebar === 'true',
            text:       (sib.innerText || '').trim().slice(0, 60),
            outerHTML:  sib.outerHTML.slice(0, 200),
          };
        }),
      });
      if (siblings.length > 1) break; // found the level with siblings
      container = parent;
    }

    // 3. Also inspect the SearchResults_SearchTyahInputRef element
    const searchEl = document.querySelector('[componentkey="SearchResults_SearchTyahInputRef"]');
    const searchInfo = searchEl ? {
      tag:        searchEl.tagName,
      h:          searchEl.offsetHeight,
      rect:       (() => { const r = searchEl.getBoundingClientRect(); return `top=${Math.round(r.top)} left=${Math.round(r.left)} h=${Math.round(r.height)} w=${Math.round(r.width)}`; })(),
      display:    window.getComputedStyle(searchEl).display,
      parentKey:  searchEl.parentElement ? (searchEl.parentElement.getAttribute('componentkey') || 'none') : 'n/a',
      parentTag:  searchEl.parentElement ? searchEl.parentElement.tagName : 'n/a',
      parentH:    searchEl.parentElement ? searchEl.parentElement.offsetHeight : 0,
      outerHTML:  searchEl.outerHTML.slice(0, 300),
    } : null;

    // 4. Find all visible elements in the sidebar that are NOT tagged
    const sidebar = document.querySelector('aside') ||
                    document.querySelector('[data-view-name="feed-right-sidebar"]') ||
                    document.querySelector('.scaffold-layout__aside');
    const sidebarInfo = sidebar ? {
      tag: sidebar.tagName,
      h: sidebar.offsetHeight,
      classes: sidebar.className.slice(0, 80),
    } : null;

    return { levels, searchInfo, sidebarInfo };
  });

  if (result.error) {
    console.log('ERROR:', result.error);
    process.exit(1);
  }

  console.log('\n=== Ancestor chain from hidden element (stopping at first multi-child level) ===');
  result.levels.forEach(lvl => {
    console.log(`\n[Level ${lvl.level}] parent=${lvl.parentTag} key="${lvl.parentKey}" h=${lvl.parentH} children=${lvl.childCount}`);
    lvl.children.forEach(c => {
      const tag  = c.isTagged ? ' [TAGGED-HIDDEN]' : '';
      const vis  = c.rectH > 0 ? ` visible(h=${c.rectH})` : ` invisible`;
      console.log(`  [${c.i}] ${c.tag} display=${c.display}${vis}${tag} key="${c.key}"`);
      if (c.text) console.log(`       "${c.text}"`);
      console.log(`       ${c.outerHTML.slice(0, 150)}`);
    });
  });

  console.log('\n=== SearchResults_SearchTyahInputRef element ===');
  if (result.searchInfo) {
    console.log('tag:', result.searchInfo.tag);
    console.log('rect:', result.searchInfo.rect);
    console.log('display:', result.searchInfo.display);
    console.log('parent tag:', result.searchInfo.parentTag, 'key:', result.searchInfo.parentKey, 'h:', result.searchInfo.parentH);
    console.log('HTML:', result.searchInfo.outerHTML);
  } else {
    console.log('(not found)');
  }

  console.log('\n=== Sidebar container ===');
  console.log(result.sidebarInfo || '(not found)');

  await page.waitForTimeout(3000);
} finally {
  await ctx.close();
}
