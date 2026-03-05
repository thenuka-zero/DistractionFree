// healer/notifier.js
// macOS desktop notifications via osascript. No npm dependency required.

import { execSync } from 'child_process';

/**
 * Send a macOS desktop notification.
 * Non-fatal: notification failure will not abort the healer run.
 * @param {string} title
 * @param {string} message
 */
export function sendDesktopNotification(title, message) {
  // Escape double quotes to prevent osascript injection / breakage.
  const escapedTitle   = title.replace(/"/g, '\\"');
  const escapedMessage = message.replace(/"/g, '\\"');
  try {
    execSync(
      `osascript -e 'display notification "${escapedMessage}" with title "${escapedTitle}"'`
    );
  } catch {
    // Non-fatal: notification failure should not abort the healer run.
    console.warn('[healer] Could not send desktop notification (osascript failed)');
  }
}
