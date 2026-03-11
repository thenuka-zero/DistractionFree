/**
 * DistractionFree — Dev reload server
 *
 * Watches manifest.json and service-worker.js (the files that still require an
 * extension reload after a change).  Serves a version number on localhost:9876
 * that the extension's service worker polls via chrome.alarms every minute.
 * When the version changes, the service worker calls chrome.runtime.reload()
 * automatically.
 *
 * CSS and content-script JS changes no longer need an extension reload
 * (they are picked up on page refresh) so those files are not watched here.
 *
 * Usage:
 *   node healer/dev-reload.mjs          # run once
 *   npm run dev   (from healer/)        # same via npm script
 *
 * Leave it running in a terminal while developing.
 */

import http from 'http';
import { watch, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT  = path.resolve(__dir, '..');
const PORT  = 9876;

// Files whose changes require a full extension reload
const WATCHED = [
  'manifest.json',
  'background/service-worker.js',
];

let version = Date.now().toString();

// ─── HTTP server ─────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  // Allow requests from chrome-extension:// origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.url === '/version') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(version);
  } else {
    res.writeHead(404).end();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[dev-reload] Server running on http://127.0.0.1:${PORT}`);
  console.log(`[dev-reload] Watching for changes that require extension reload:`);
  for (const f of WATCHED) console.log(`             · ${f}`);
  console.log(`[dev-reload] Extension will reload within ~1 minute of any change.\n`);
});

// ─── File watchers ───────────────────────────────────────────────────────────

for (const rel of WATCHED) {
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) {
    console.warn(`[dev-reload] WARN: watched file not found: ${abs}`);
    continue;
  }
  watch(abs, () => {
    const prev = version;
    version = Date.now().toString();
    console.log(`[dev-reload] Changed: ${rel}  (${prev} → ${version})`);
    console.log(`[dev-reload] Extension will reload on next alarm tick (~1 min).`);
  });
}
