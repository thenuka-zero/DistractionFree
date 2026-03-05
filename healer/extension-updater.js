// healer/extension-updater.js
// Rewrites content/linkedin.css and content/linkedin.js with updated selectors,
// then creates a local git commit. Never pushes to remote.

import fs          from 'fs';
import path        from 'path';
import { execSync } from 'child_process';

const CSS_FILE = path.resolve(
  import.meta.dirname, '../content/linkedin.css'
);

const JS_FILE = path.resolve(
  import.meta.dirname, '../content/linkedin.js'
);

// The section comment that marks the start of the hide/un-hide block in linkedin.css.
// This is the delimiter used for block-aware replacement.
const CSS_SECTION_DELIMITER = '/* DistractionFree — LinkedIn feed hiding (active by default) */';

/**
 * Block-aware CSS selector replacement.
 *
 * Strategy:
 *   1. Split the CSS file on the section comment delimiter.
 *   2. Reconstruct the hide block from scratch using newSelectors.
 *   3. Reconstruct the un-hide block from scratch using html.${disabledClass} ${newSelector}.
 *   4. Rejoin and write.
 *
 * This avoids accidentally replacing a selector string that appears in a comment
 * or another feature's block.
 *
 * @param {string}   feature         - feature key (e.g. 'feed') — unused here, kept for future multi-feature support
 * @param {string[]} oldSelectors    - selectors being replaced (used for log clarity)
 * @param {string[]} newSelectors    - replacement selectors from Claude
 * @param {string}   disabledClass   - e.g. 'df-linkedin-disabled'
 */
export function updateCSSSelectors(feature, oldSelectors, newSelectors, disabledClass) {
  let css = fs.readFileSync(CSS_FILE, 'utf8');

  // Verify the delimiter exists in the file.
  if (!css.includes(CSS_SECTION_DELIMITER)) {
    throw new Error(
      `CSS section delimiter not found in ${CSS_FILE}. Cannot perform block-aware replacement.`
    );
  }

  // Split on the delimiter.  parts[0] = everything before it (empty string if it's at the top),
  // parts[1] = everything after the delimiter.
  const delimiterIndex = css.indexOf(CSS_SECTION_DELIMITER);
  const beforeDelimiter = css.slice(0, delimiterIndex + CSS_SECTION_DELIMITER.length);
  const afterDelimiter  = css.slice(delimiterIndex + CSS_SECTION_DELIMITER.length);

  // Build the new hide block.
  const hideBlock =
    '\n\n' +
    newSelectors.join(',\n') +
    ' {\n  display: none !important;\n}';

  // Build the new un-hide block.
  const unHideBlock =
    '\n\n/* Un-hide when disabled */\n' +
    newSelectors.map(s => `html.${disabledClass} ${s}`).join(',\n') +
    ' {\n  display: revert !important;\n}';

  // Find the end of the un-hide block in the original afterDelimiter section.
  // We identify the boundary by finding the first occurrence of
  // "display: revert !important;\n}" and taking everything after it.
  //
  // Pattern to match: the hide block + the un-hide block, until we hit
  // the next CSS rule that is NOT part of these two blocks.
  //
  // Approach: find the closing brace of the un-hide block by locating
  // "display: revert !important;\n}" in afterDelimiter.
  const revertPattern = /display:\s*revert\s*!important;\s*\}/;
  const revertMatch   = revertPattern.exec(afterDelimiter);

  let tail;
  if (revertMatch) {
    // Everything after the closing brace of the un-hide block.
    tail = afterDelimiter.slice(revertMatch.index + revertMatch[0].length);
  } else {
    // Fallback: if we can't find the un-hide block, replace everything up to
    // the first rule that starts with a non-whitespace non-dot non-html character
    // that is not part of our selectors.  This is a last resort.
    tail = afterDelimiter;
  }

  const newCss = beforeDelimiter + hideBlock + unHideBlock + tail;
  fs.writeFileSync(CSS_FILE, newCss, 'utf8');
}

/**
 * Replace a JS selector string literal in content/linkedin.js.
 * Handles both single-quoted and double-quoted strings.
 * @param {string} oldSelector
 * @param {string} newSelector
 */
export function updateJSSelector(oldSelector, newSelector) {
  let js = fs.readFileSync(JS_FILE, 'utf8');

  const hasSingle = js.includes(`'${oldSelector}'`);
  const hasDouble = js.includes(`"${oldSelector}"`);

  if (!hasSingle && !hasDouble) {
    throw new Error(`Selector "${oldSelector}" not found in ${JS_FILE}`);
  }

  js = js.replaceAll(`"${oldSelector}"`, `"${newSelector}"`);
  js = js.replaceAll(`'${oldSelector}'`, `'${newSelector}'`);

  fs.writeFileSync(JS_FILE, js, 'utf8');
}

/**
 * Stage changed files and create a local git commit.
 * Never pushes to remote.
 * @param {string[]} changedFiles  - relative paths from repo root (e.g. ['content/linkedin.css'])
 * @param {string}   dateStr       - e.g. '2026-03-05'
 */
export function commitChanges(changedFiles, dateStr) {
  const repoRoot  = path.resolve(import.meta.dirname, '..');
  const filePaths = changedFiles.map(f => `"${f}"`).join(' ');

  execSync(`git -C "${repoRoot}" add ${filePaths}`, { stdio: 'inherit' });

  const commitMessage = `fix: auto-update LinkedIn selectors via healer [${dateStr}]`;
  const result = execSync(
    `git -C "${repoRoot}" commit -m "${commitMessage}"`,
    { encoding: 'utf8' }
  );
  console.log('[healer] git commit:', result.trim());
}
