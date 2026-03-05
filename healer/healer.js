// healer/healer.js
// Main orchestrator for the DistractionFree self-healing selector system.
//
// LAUNCHD SETUP:
// 1. cp healer/com.distractionfree.healer.plist ~/Library/LaunchAgents/
// 2. launchctl load ~/Library/LaunchAgents/com.distractionfree.healer.plist
// Manual trigger: launchctl start com.distractionfree.healer
// Uninstall: launchctl unload ~/Library/LaunchAgents/com.distractionfree.healer.plist && rm ~/Library/LaunchAgents/com.distractionfree.healer.plist
//
// CLI USAGE:
//   node healer/healer.js --login    # One-time: open browser, log in, save session.json
//   node healer/healer.js --check    # Health check only, no writes, exit 0 if healthy
//   node healer/healer.js --fix      # Health check + auto-fix if needed
//   node healer/healer.js --dry-run  # AI discovery only, print proposed changes, no writes
//   node healer/healer.js            # Same as --fix (default for cron)
//   HEALER_CRON=1 node healer/healer.js  # Persistent daemon, runs at 3:00 AM daily

import cron       from 'node-cron';
import { chromium } from 'playwright';
import fs           from 'fs';
import path         from 'path';
import { execSync } from 'child_process';

import { SELECTOR_REGISTRY }           from './registry.js';
import { runHealthCheck }              from './health-check.js';
import {
  captureFeedSnapshot,
  discoverReplacementSelector,
  validateSelectors,
} from './selector-ai.js';
import {
  updateCSSSelectors,
  updateJSSelector,
  commitChanges,
} from './extension-updater.js';
import { sendDesktopNotification }     from './notifier.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_FILE   = path.resolve(import.meta.dirname, 'session.json');
const LOG_FILE       = path.resolve(import.meta.dirname, 'healer.log');
const GITIGNORE_FILE = path.resolve(import.meta.dirname, '..', '.gitignore');
const EXTENSION_PATH = path.resolve(import.meta.dirname, '..');

const MAX_RETRIES   = parseInt(process.env.HEALER_MAX_RETRIES ?? '3', 10);
const LOG_MAX_LINES = 1000;

// ---------------------------------------------------------------------------
// Logging helpers
// ---------------------------------------------------------------------------

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

/**
 * Append a structured JSON log entry to healer.log.
 * Rotates the file to cap at LOG_MAX_LINES entries (oldest removed).
 * @param {object} entry
 */
function appendLog(entry) {
  const line = JSON.stringify(entry);

  let existing = '';
  if (fs.existsSync(LOG_FILE)) {
    existing = fs.readFileSync(LOG_FILE, 'utf8');
  }

  const lines = existing.split('\n').filter(l => l.trim() !== '');
  lines.push(line);

  // Cap at LOG_MAX_LINES — remove oldest entries from the front.
  const trimmed = lines.slice(-LOG_MAX_LINES);

  fs.writeFileSync(LOG_FILE, trimmed.join('\n') + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Startup guardrail: verify healer/session.json is in .gitignore
// ---------------------------------------------------------------------------

function checkGitignore() {
  if (!fs.existsSync(GITIGNORE_FILE)) {
    console.warn('[healer] WARN: .gitignore not found at', GITIGNORE_FILE);
    return false;
  }
  const content = fs.readFileSync(GITIGNORE_FILE, 'utf8');
  return content.includes('healer/session.json');
}

// ---------------------------------------------------------------------------
// Print a results summary table to stdout
// ---------------------------------------------------------------------------

function printResultsTable(results) {
  console.log('\n┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│  DistractionFree Healer — Selector Health Report                            │');
  console.log('├───────────┬──────────────────────────────────────────────┬────────┬─────────┤');
  console.log('│  Feature  │  Selector                                    │  Count │  Status │');
  console.log('├───────────┼──────────────────────────────────────────────┼────────┼─────────┤');

  for (const r of results) {
    const feat  = r.feature.padEnd(9).slice(0, 9);
    const sel   = r.selector.padEnd(44).slice(0, 44);
    const count = String(r.count).padStart(6);
    const stat  = r.status.padEnd(7).slice(0, 7);
    const indicator = r.status === 'HEALTHY' ? '  ✓' : (r.status === 'BROKEN' ? '  ✗' : '  !');
    console.log(`│  ${feat}  │  ${sel}  │  ${count}  │  ${stat}${indicator}  │`);
  }

  console.log('└───────────┴──────────────────────────────────────────────┴────────┴─────────┘\n');
}

// ---------------------------------------------------------------------------
// Extension reload helper (simpler page-navigate approach)
// ---------------------------------------------------------------------------

async function reloadExtension(browserContext, page) {
  // Approach: navigate to a fresh linkedin.com/feed/ page.
  // The updated CSS file is read from disk at next injection, so the new
  // content script rules take effect on the next page load without a full
  // extension reload.
  log('[healer] Navigating to fresh feed page to pick up updated extension files...');
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle' });
}

// ---------------------------------------------------------------------------
// Session expiry check
// ---------------------------------------------------------------------------

function isSessionExpired(url) {
  return url.includes('/login') || url.includes('/checkpoint/');
}

// ---------------------------------------------------------------------------
// --login mode
// ---------------------------------------------------------------------------

async function doLogin() {
  log('[healer] Starting --login mode (headful browser)...');

  const browser = await chromium.launch({ headless: false });
  const page    = await browser.newPage();
  await page.goto('https://www.linkedin.com/login');

  console.log('[healer] Browser opened. Please log in to LinkedIn manually.');
  console.log('[healer] The script will save your session when you reach the feed.');

  // Wait until the user navigates to /feed/ (up to 5 minutes).
  await page.waitForURL('**/feed/**', { timeout: 300_000 });

  const cookies = await browser.contexts()[0].cookies();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2), 'utf8');
  log(`[healer] Session saved to ${SESSION_FILE}`);

  await browser.close();
}

// ---------------------------------------------------------------------------
// Launch browser with session cookies
// ---------------------------------------------------------------------------

async function launchWithSession(headless = true) {
  const browser = await chromium.launchPersistentContext('', {
    headless,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });

  if (!fs.existsSync(SESSION_FILE)) {
    await browser.close();
    throw new Error(
      `session.json not found at ${SESSION_FILE}. Run: node healer/healer.js --login`
    );
  }

  const cookies = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  await browser.addCookies(cookies);

  return browser;
}

// ---------------------------------------------------------------------------
// --check mode
// ---------------------------------------------------------------------------

async function runHealthCheckOnly() {
  log('[healer] Starting --check mode...');

  const headless = process.env.HEALER_HEADLESS !== '0';
  const browser  = await launchWithSession(headless);
  const page     = await browser.newPage();

  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle' });

  // Session expiry detection.
  if (isSessionExpired(page.url())) {
    log('[healer] ERROR: LinkedIn session expired. Run: node healer/healer.js --login');
    await sendDesktopNotification(
      'DistractionFree Healer',
      'LinkedIn session expired. Run: node healer/healer.js --login'
    );
    await browser.close();
    process.exit(1);
  }

  // Wait for feed content to appear.
  await page.waitForSelector(
    '.feed-shared-update-v2, div[data-id^="urn:li:activity:"]',
    { timeout: 30_000 }
  ).catch(() => {
    log('[healer] WARN: Feed elements did not appear within 30s. Proceeding with health check.');
  });

  const results = await runHealthCheck(page, SELECTOR_REGISTRY);

  printResultsTable(results);

  await browser.close();

  const allHealthy = results.every(r => r.status === 'HEALTHY');

  appendLog({
    runAt:       new Date().toISOString(),
    mode:        'check',
    results:     results.map(r => ({ ...r, action: 'checked' })),
    commitSha:   null,
    durationMs:  null,
  });

  process.exit(allHealthy ? 0 : 1);
}

// ---------------------------------------------------------------------------
// --dry-run mode: AI discovery only, no file writes
// ---------------------------------------------------------------------------

async function runDryRun() {
  log('[healer] Starting --dry-run mode (AI discovery only, no file writes)...');

  const headless = process.env.HEALER_HEADLESS !== '0';
  const browser  = await launchWithSession(headless);
  const page     = await browser.newPage();

  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle' });

  if (isSessionExpired(page.url())) {
    log('[healer] ERROR: LinkedIn session expired. Run: node healer/healer.js --login');
    await browser.close();
    process.exit(1);
  }

  await page.waitForSelector(
    '.feed-shared-update-v2, div[data-id^="urn:li:activity:"]',
    { timeout: 30_000 }
  ).catch(() => {
    log('[healer] WARN: Feed elements did not appear within 30s.');
  });

  const results = await runHealthCheck(page, SELECTOR_REGISTRY);
  printResultsTable(results);

  const broken = results.filter(r => r.status !== 'HEALTHY');
  if (broken.length === 0) {
    log('[healer] All selectors HEALTHY. Nothing to repair.');
    await browser.close();
    return;
  }

  log(`[healer] Found ${broken.length} broken/ineffective selector(s). Running AI discovery...`);
  const htmlSnapshot = await captureFeedSnapshot(page);

  for (const item of broken) {
    log(`\n[healer] --- Dry-run for broken selector: ${item.selector} (${item.status}) ---`);

    const feature = SELECTOR_REGISTRY.find(f =>
      f.selectors.includes(item.selector) ||
      (f.jsSelectors || []).some(j => j.selector === item.selector)
    );

    let aiResult;
    try {
      aiResult = await discoverReplacementSelector(
        item.selector, feature.description, htmlSnapshot
      );
    } catch (err) {
      log(`[healer] ERROR during AI discovery for "${item.selector}": ${err.message}`);
      continue;
    }

    console.log('\n[DRY RUN] Proposed replacement:');
    console.log('  Old selector:', item.selector);
    console.log('  New selectors:', aiResult.newSelectors.join(', '));
    console.log('  Confidence:', aiResult.confidence);
    console.log('  Reasoning:', aiResult.reasoning);

    const validation = await validateSelectors(page, aiResult.newSelectors);
    console.log('  Validation:', JSON.stringify(validation));
  }

  await browser.close();
  log('[healer] Dry-run complete. No files were modified.');
}

// ---------------------------------------------------------------------------
// Full --fix orchestration
// ---------------------------------------------------------------------------

async function runHealer() {
  const startTime = Date.now();
  log('[healer] Starting --fix mode...');

  const headless = process.env.HEALER_HEADLESS !== '0';
  const browser  = await launchWithSession(headless);
  const page     = await browser.newPage();

  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle' });

  // Session expiry detection.
  if (isSessionExpired(page.url())) {
    log('[healer] ERROR: LinkedIn session expired. Run: node healer/healer.js --login');
    await sendDesktopNotification(
      'DistractionFree Healer',
      'LinkedIn session expired. Run: node healer/healer.js --login'
    );
    await browser.close();
    process.exit(1);
  }

  // Wait up to 30s for any feed post to render.
  await page.waitForSelector(
    '.feed-shared-update-v2, div[data-id^="urn:li:activity:"]',
    { timeout: 30_000 }
  ).catch(() => {
    log('[healer] WARN: Feed elements did not appear within 30s. Proceeding anyway.');
  });

  let retryCount = 0;
  let results    = await runHealthCheck(page, SELECTOR_REGISTRY);

  printResultsTable(results);

  // Track repairs for the log entry.
  const logResults = results.map(r => ({ ...r, action: 'checked' }));

  // Clone the registry in-memory so we can update it during the retry loop
  // without mutating the imported constant.
  const registry = SELECTOR_REGISTRY.map(f => ({
    ...f,
    selectors:   [...f.selectors],
    jsSelectors: (f.jsSelectors || []).map(j => ({ ...j })),
  }));

  while (retryCount < MAX_RETRIES) {
    const broken = results.filter(r => r.status !== 'HEALTHY');
    if (broken.length === 0) {
      log('[healer] All selectors HEALTHY.');
      break;
    }

    log(`[healer] Found ${broken.length} broken/ineffective selector(s). Attempt ${retryCount + 1}/${MAX_RETRIES}.`);

    const htmlSnapshot = await captureFeedSnapshot(page);
    const changedFiles  = new Set();
    const commitDate    = new Date().toISOString().slice(0, 10);

    for (const item of broken) {
      log(`[healer] Repairing: ${item.selector} (${item.status})`);

      const feature = registry.find(f =>
        f.selectors.includes(item.selector) ||
        (f.jsSelectors || []).some(j => j.selector === item.selector)
      );

      if (!feature) {
        log(`[healer] WARN: Could not find registry entry for selector "${item.selector}". Skipping.`);
        continue;
      }

      // --- AI discovery ---
      let aiResult;
      try {
        aiResult = await discoverReplacementSelector(
          item.selector, feature.description, htmlSnapshot
        );
      } catch (err) {
        log(`[healer] ERROR during AI discovery for "${item.selector}": ${err.message}`);
        // Log and continue without crashing.
        const logEntry = logResults.find(r => r.selector === item.selector);
        if (logEntry) logEntry.action = `error: ${err.message}`;
        continue;
      }

      log(`[healer] Claude suggestion (confidence=${aiResult.confidence}): ${aiResult.newSelectors.join(', ')}`);
      log(`[healer] Reasoning: ${aiResult.reasoning}`);

      // --- Confidence gate ---
      if (aiResult.confidence === 'low') {
        log('[healer] WARN: Confidence is low. Skipping auto-fix. Human review required.');
        await sendDesktopNotification(
          'DistractionFree Healer',
          `Low-confidence selector fix needed for "${feature.description}". Check healer.log.`
        );
        const logEntry = logResults.find(r => r.selector === item.selector);
        if (logEntry) {
          logEntry.action     = 'skipped-low-confidence';
          logEntry.confidence = aiResult.confidence;
          logEntry.reasoning  = aiResult.reasoning;
        }
        continue;
      }

      // --- Pre-write validation ---
      const validation = await validateSelectors(page, aiResult.newSelectors);
      const anyInvalidSyntax = validation.some(v => v.matchCount === -1);

      if (anyInvalidSyntax) {
        log('[healer] WARN: Claude returned invalid CSS syntax. Discarding entire response.');
        log(JSON.stringify(validation));
        continue;
      }

      const allMatch = validation.every(v => v.valid);
      if (!allMatch) {
        log('[healer] WARN: Proposed selectors did not match live DOM. Skipping.');
        log(JSON.stringify(validation));
        continue;
      }

      // --- File updates ---
      const isCSSSelector    = feature.selectors.includes(item.selector);
      const isJSSelectorEntry = (feature.jsSelectors || []).find(j => j.selector === item.selector);

      try {
        if (isCSSSelector) {
          updateCSSSelectors(
            feature.feature,
            [item.selector],
            aiResult.newSelectors,
            feature.cssDisabledClass
          );
          changedFiles.add('content/linkedin.css');
          log(`[healer] Updated CSS: ${item.selector} → ${aiResult.newSelectors.join(', ')}`);
        }

        if (isJSSelectorEntry) {
          updateJSSelector(item.selector, aiResult.newSelectors[0]);
          changedFiles.add('content/linkedin.js');
          log(`[healer] Updated JS: ${item.selector} → ${aiResult.newSelectors[0]}`);
        }
      } catch (err) {
        log(`[healer] ERROR during file update for "${item.selector}": ${err.message}`);
        continue;
      }

      // Update registry in-memory for the confirmation re-check.
      if (isCSSSelector) {
        const idx = feature.selectors.indexOf(item.selector);
        feature.selectors.splice(idx, 1, ...aiResult.newSelectors);
      }
      if (isJSSelectorEntry) {
        isJSSelectorEntry.selector = aiResult.newSelectors[0];
      }

      // Update log results entry.
      const logEntry = logResults.find(r => r.selector === item.selector);
      if (logEntry) {
        logEntry.action      = 'replaced';
        logEntry.oldSelector = item.selector;
        logEntry.newSelectors = aiResult.newSelectors;
        logEntry.confidence  = aiResult.confidence;
        logEntry.reasoning   = aiResult.reasoning;
      }
    }

    // --- Git commit ---
    let commitSha = null;
    if (changedFiles.size > 0) {
      try {
        commitChanges([...changedFiles], commitDate);
        log(`[healer] Committed changes: ${[...changedFiles].join(', ')}`);

        // Read back the SHA of the new commit.
        const repoRoot = path.resolve(import.meta.dirname, '..');
        commitSha = execSync(`git -C "${repoRoot}" rev-parse --short HEAD`, { encoding: 'utf8' }).trim();
        log(`[healer] Commit SHA: ${commitSha}`);
      } catch (err) {
        log(`[healer] ERROR during git commit: ${err.message}`);
      }

      // Navigate to a fresh feed page so the updated CSS takes effect.
      await reloadExtension(null, page);

      // Wait for content to render again.
      await page.waitForSelector(
        '.feed-shared-update-v2, div[data-id^="urn:li:activity:"]',
        { timeout: 30_000 }
      ).catch(() => {
        log('[healer] WARN: Feed elements did not reappear after extension reload.');
      });
    }

    // --- Confirmation health check ---
    results = await runHealthCheck(page, registry);
    printResultsTable(results);
    retryCount++;

    // Write log entry for this attempt.
    appendLog({
      runAt:      new Date().toISOString(),
      mode:       'fix',
      attempt:    retryCount,
      results:    logResults,
      commitSha,
      durationMs: Date.now() - startTime,
    });
  }

  // --- Post-loop: check if still broken after max retries ---
  const stillBroken = results.filter(r => r.status !== 'HEALTHY');
  if (stillBroken.length > 0 && retryCount >= MAX_RETRIES) {
    log(`[healer] ERROR: Failed to repair selectors after ${MAX_RETRIES} attempts.`);
    await sendDesktopNotification(
      'DistractionFree Healer — Action Required',
      `${stillBroken.length} selector(s) could not be auto-fixed after ${MAX_RETRIES} attempts. Manual intervention required.`
    );
    await browser.close();
    process.exit(1);
  }

  // All healthy — write a final log entry if we haven't written one yet.
  if (retryCount === 0) {
    appendLog({
      runAt:      new Date().toISOString(),
      mode:       'fix',
      attempt:    0,
      results:    logResults,
      commitSha:  null,
      durationMs: Date.now() - startTime,
    });
  }

  log('[healer] Run complete. All selectors healthy.');
  await browser.close();
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

// Startup gitignore check.
const gitignoreOk = checkGitignore();
if (!gitignoreOk) {
  console.warn('[healer] WARN: healer/session.json is NOT listed in .gitignore.');
  if (args.includes('--fix') || args.length === 0) {
    console.error('[healer] ERROR: Refusing to run --fix mode without gitignore protection for session.json.');
    console.error('[healer] Add "healer/session.json" to your root .gitignore and retry.');
    process.exit(1);
  }
}

if (args.includes('--login')) {
  await doLogin();
} else if (args.includes('--check')) {
  await runHealthCheckOnly();
} else if (args.includes('--dry-run')) {
  await runDryRun();
} else if (args.includes('--fix') || args.length === 0) {
  if (process.env.HEALER_CRON === '1') {
    // Running as a persistent daemon — schedule at 3:00 AM PT.
    cron.schedule('0 3 * * *', runHealer, { timezone: 'America/Los_Angeles' });
    console.log('[healer] Cron daemon started. Health check runs daily at 3:00 AM PT.');
  } else {
    // Single-shot run (CLI --fix or bare invocation).
    await runHealer();
    process.exit(0);
  }
} else {
  console.error(`[healer] Unknown argument(s): ${args.join(' ')}`);
  console.error('Usage: node healer.js [--login | --check | --fix | --dry-run]');
  process.exit(1);
}
