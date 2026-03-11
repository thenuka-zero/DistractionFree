/**
 * DistractionFree — LinkedIn toggle monitor server
 *
 * Usage:
 *   node healer/monitor-server.mjs
 *
 * Opens http://localhost:4242 — leave it running and the page auto-checks
 * every 5 minutes.  Results survive between checks in memory.
 *
 * Requires:
 *   healer/session.json  (run: node healer/healer.js --login  if expired)
 */
import http             from 'http';
import fs               from 'fs';
import path             from 'path';
import { fileURLToPath } from 'url';
import cron             from 'node-cron';
import { chromium }     from 'playwright';

const __dir  = path.dirname(fileURLToPath(import.meta.url));
const ROOT   = path.resolve(__dir, '..');

const PORT          = 4242;
const SESSION_FILE  = path.join(__dir, 'session.json');
const MONITOR_HTML  = path.join(ROOT, 'monitor.html');
const EXTENSION_DIR = ROOT;   // manifest.json lives here

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

let latestResults = { checkedAt: null, results: {} };
let runInProgress = false;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ---------------------------------------------------------------------------
// Individual toggle checks
//
// Each function receives a Playwright `page` already on linkedin.com/feed/
// and returns  { status: 'pass' | 'fail' | 'unknown',  reason?: string }
// ---------------------------------------------------------------------------

const CHECKS = {

  /** Feed posts are hidden when feedEnabled=true (on by default) */
  async feedEnabled(page) {
    return page.evaluate(() => {
      const mf = document.querySelector("[data-testid='mainFeed']");
      if (!mf) return { status: 'unknown', reason: 'mainFeed container not found' };

      const posts = [...mf.children].filter(
        (el, i) => i > 0 && !el.classList.contains('df-quote-container')
      );
      if (posts.length === 0)
        return { status: 'unknown', reason: 'Feed not loaded yet' };

      const visibleCount = posts.filter(el => {
        const s = window.getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden';
      }).length;

      if (visibleCount === 0) return { status: 'pass' };
      return { status: 'fail', reason: `${visibleCount} of ${posts.length} feed posts are visible` };
    });
  },

  /** LinkedIn News / Top Stories sidebar tagged and hidden (on by default) */
  async hideNewsSidebar(page) {
    return page.evaluate(() => {
      const el = document.querySelector('[data-df-hide-news-sidebar="true"]');
      if (!el) return { status: 'unknown', reason: 'News sidebar not tagged — sidebar may not have loaded yet' };
      const hidden = window.getComputedStyle(el).display === 'none';
      return hidden
        ? { status: 'pass' }
        : { status: 'fail', reason: 'News sidebar tagged but not hidden — CSS rule may have broken' };
    });
  },

  /** Stats dashboard tagged and hidden (on by default) */
  async hideStatsDashboard(page) {
    return page.evaluate(() => {
      const el = document.querySelector('[data-df-hide-stats-dashboard="true"]');
      if (!el) {
        const anchor = document.querySelector(
          'a[href*="/analytics/creator/content"], a[href*="profile-views"]'
        );
        if (!anchor) return { status: 'unknown', reason: 'Stats section not in DOM yet' };
        return { status: 'fail', reason: 'Stats anchor found but not tagged — JS tagging broke' };
      }
      const hidden = window.getComputedStyle(el).display === 'none';
      return hidden
        ? { status: 'pass' }
        : { status: 'fail', reason: 'Stats dashboard tagged but not hidden' };
    });
  },

  /** Composer (Start a Post) selector still targets the right element */
  async hideStartPost(page) {
    return page.evaluate(() => {
      const el = document.querySelector('[data-df-hide-start-post="true"]');
      if (!el) {
        // Check if mainFeed exists and has a first child (composer should always be there)
        const mf = document.querySelector("[data-testid='mainFeed']");
        if (!mf || !mf.children[0]) return { status: 'unknown', reason: 'mainFeed or composer not loaded yet' };
        return { status: 'fail', reason: 'Composer found in DOM but not tagged — JS tagging broke' };
      }
      return { status: 'pass' };
    });
  },

  /** My Pages section selector still targets the right element */
  async hideMyPages(page) {
    return page.evaluate(() => {
      const el = document.querySelector('[data-df-hide-my-pages="true"]');
      if (!el) {
        // Check if the heading text exists
        const heading = [...document.querySelectorAll('p, span, h2, h3')]
          .find(e => /^my pages/i.test((e.textContent || '').trim()));
        if (!heading) return { status: 'unknown', reason: 'My Pages section not found in DOM' };
        return { status: 'fail', reason: 'My Pages heading found but section not tagged — JS tagging broke' };
      }
      return { status: 'pass' };
    });
  },

  /** Follow suggestion card selector still targets the right element */
  async hideFollowPages(page) {
    return page.evaluate(() => {
      const el = document.querySelector('[data-df-hide-follow-pages="true"]');
      if (el) return { status: 'pass' };
      // No follow card on this load is normal — check if mainFeed is present
      const mf = document.querySelector("[data-testid='mainFeed']");
      if (!mf) return { status: 'unknown', reason: 'mainFeed not loaded yet' };
      return { status: 'unknown', reason: 'No Follow suggestion card found on this load — may not appear every time' };
    });
  },

};

// ---------------------------------------------------------------------------
// Run a full check pass
// ---------------------------------------------------------------------------

async function runCheck() {
  if (runInProgress) {
    log('Check already running — skipping.');
    return;
  }
  runInProgress = true;
  log('Starting LinkedIn toggle check…');

  let ctx;
  try {
    if (!fs.existsSync(SESSION_FILE)) {
      log('ERROR: healer/session.json not found.  Run: node healer/healer.js --login');
      setAllUnknown('session.json missing — run: node healer/healer.js --login');
      return;
    }

    const cookies = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));

    // headless: false is required — JS content scripts do not execute in
    // headless Chrome.  Without them, JS-tagged attributes won't appear in the
    // DOM and those checks will return 'unknown'.
    ctx = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_DIR}`,
        `--load-extension=${EXTENSION_DIR}`,
        '--window-size=1280,800',
      ],
    });

    await ctx.addCookies(cookies);
    const page = ctx.pages()[0] || await ctx.newPage();

    await page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    // Detect session expiry
    const url = page.url();
    if (url.includes('/login') || url.includes('/checkpoint')) {
      log('ERROR: LinkedIn session expired.  Run: node healer/healer.js --login');
      setAllUnknown('LinkedIn session expired — run: node healer/healer.js --login');
      return;
    }

    // Wait for mainFeed to appear
    await page.waitForSelector("[data-testid='mainFeed']", { timeout: 20_000 })
      .catch(() => log('WARN: mainFeed not found within 20 s — proceeding anyway'));

    // Allow JS content scripts + dynamic tagging to complete
    await page.waitForTimeout(4000);

    // Run all checks
    const results = {};
    for (const [key, fn] of Object.entries(CHECKS)) {
      try {
        results[key] = await fn(page);
        log(`  ${key}: ${results[key].status}${results[key].reason ? ' — ' + results[key].reason : ''}`);
      } catch (err) {
        results[key] = { status: 'unknown', reason: `Check threw: ${err.message}` };
        log(`  ${key}: ERROR — ${err.message}`);
      }
    }

    latestResults = { checkedAt: new Date().toISOString(), results };

    const failing = Object.entries(results).filter(([, v]) => v.status === 'fail');
    if (failing.length === 0) {
      log('Check complete — all passing ✓');
    } else {
      log(`Check complete — ${failing.length} failing: ${failing.map(([k]) => k).join(', ')}`);
    }

  } catch (err) {
    log(`Check failed: ${err.message}`);
  } finally {
    if (ctx) await ctx.close().catch(() => {});
    runInProgress = false;
  }
}

function setAllUnknown(reason) {
  latestResults = {
    checkedAt: new Date().toISOString(),
    results: Object.fromEntries(
      Object.keys(CHECKS).map(k => [k, { status: 'unknown', reason }])
    ),
  };
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  // Allow the monitor page to fetch from localhost
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const { method, url } = req;

  // Serve monitor.html
  if (method === 'GET' && (url === '/' || url === '/monitor.html' || url === '/index.html')) {
    try {
      const html = fs.readFileSync(MONITOR_HTML, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Cannot read monitor.html: ${err.message}`);
    }
    return;
  }

  // Return latest results
  if (method === 'GET' && url === '/api/results') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(latestResults));
    return;
  }

  // Trigger a new check run (fire-and-forget — returns immediately)
  if (method === 'POST' && url === '/api/run') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, running: runInProgress || true }));
    if (!runInProgress) {
      runCheck().catch(err => log(`Manual run error: ${err.message}`));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

// ---------------------------------------------------------------------------
// Cron: auto-check every 5 minutes (disabled)
// ---------------------------------------------------------------------------

// cron.schedule('*/5 * * * *', () => {
//   log('Cron: scheduled check triggered');
//   runCheck().catch(err => log(`Cron run error: ${err.message}`));
// });

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

server.listen(PORT, '127.0.0.1', () => {
  log(`Monitor server listening on http://localhost:${PORT}`);
  log(`Open http://localhost:${PORT} in your browser`);
  log('Running initial check…');
  runCheck().catch(err => log(`Initial check error: ${err.message}`));
});
