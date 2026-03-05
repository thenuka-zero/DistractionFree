// healer/selector-ai.js
// Claude API integration for discovering replacement CSS selectors.
// Invoked only when the health check finds BROKEN or INEFFECTIVE selectors.

import Anthropic from '@anthropic-ai/sdk';

// Initialise client; reads ANTHROPIC_API_KEY from process.env automatically.
const client = new Anthropic();

/**
 * Capture the outerHTML of the LinkedIn feed container, capped at 50KB.
 * Falls back to <main> or <body> if the preferred selector is unavailable.
 * @param {import('playwright').Page} page
 * @returns {Promise<string>} HTML snapshot
 */
export async function captureFeedSnapshot(page) {
  const html = await page.evaluate(() => {
    const container =
      document.querySelector('.scaffold-finite-scroll__content') ||
      document.querySelector('main') ||
      document.body;
    const raw = container.outerHTML;
    // Cap at 50KB to stay within Claude's practical context window for this task.
    return raw.length > 51_200 ? raw.slice(0, 51_200) + '\n<!-- TRUNCATED -->' : raw;
  });
  return html;
}

/**
 * Ask Claude to discover a replacement selector for a broken one.
 * Returns { newSelectors: string[], confidence: 'high'|'medium'|'low', reasoning: string }.
 * Throws on API error, JSON parse failure, or malformed response.
 * @param {string} brokenSelector
 * @param {string} featureName
 * @param {string} htmlSnapshot
 * @returns {Promise<{ newSelectors: string[], confidence: string, reasoning: string }>}
 */
export async function discoverReplacementSelector(brokenSelector, featureName, htmlSnapshot) {
  const prompt = `
You are a CSS selector expert helping maintain a Chrome extension called DistractionFree.

The extension hides distracting LinkedIn UI elements using CSS selectors injected at document_start.

PROBLEM:
The CSS selector \`${brokenSelector}\` was used to hide LinkedIn's "${featureName}" but it no longer
matches any elements. LinkedIn has updated their DOM structure.

CURRENT LINKEDIN FEED HTML (up to 50KB):
\`\`\`html
${htmlSnapshot}
\`\`\`

TASK:
Analyze the HTML and find the new CSS selector(s) that would target the same content that
\`${brokenSelector}\` used to target.

REQUIREMENTS:
- Selectors must be valid CSS (usable with document.querySelectorAll)
- Prefer stable attributes (data-* attributes, aria-* attributes, id attributes) over
  generated class names (e.g. classes that look like "feed-shared-update-v2__dPwkl")
- If multiple selectors are needed for full coverage, list all of them
- Do NOT suggest selectors that would hide the entire page or large layout containers

Return ONLY valid JSON in exactly this shape, with no markdown fencing:
{
  "newSelectors": ["selector1", "selector2"],
  "confidence": "high" | "medium" | "low",
  "reasoning": "one or two sentences explaining what changed and why these selectors work"
}

confidence guide:
- "high": you found a clear stable attribute or id that definitively identifies the element
- "medium": you found class names that look stable but may be partially generated
- "low": you are guessing based on structural position; human review is needed
`.trim();

  // 30-second timeout on the API call.
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 30_000);

  let message;
  try {
    message = await client.messages.create(
      {
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        messages:   [{ role: 'user', content: prompt }],
      },
      { signal: controller.signal }
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const raw = message.content[0].text.trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Claude returned non-JSON response: ${raw.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed.newSelectors) || parsed.newSelectors.length === 0) {
    throw new Error('Claude response missing newSelectors array');
  }
  if (!['high', 'medium', 'low'].includes(parsed.confidence)) {
    throw new Error(`Claude returned unknown confidence value: ${parsed.confidence}`);
  }

  return parsed; // { newSelectors, confidence, reasoning }
}

/**
 * Validate that Claude's proposed selectors actually match elements in the live DOM.
 * A selector with matchCount === -1 means invalid CSS syntax.
 * @param {import('playwright').Page} page
 * @param {string[]} selectors
 * @returns {Promise<Array<{ selector: string, matchCount: number, valid: boolean }>>}
 */
export async function validateSelectors(page, selectors) {
  // Wait up to 5 seconds for the DOM to settle before validating.
  await page.waitForTimeout(5_000);

  const results = [];
  for (const sel of selectors) {
    let count = 0;
    try {
      count = await page.evaluate((s) => document.querySelectorAll(s).length, sel);
    } catch {
      count = -1; // invalid CSS syntax
    }
    results.push({ selector: sel, matchCount: count, valid: count > 0 });
  }
  return results;
}
