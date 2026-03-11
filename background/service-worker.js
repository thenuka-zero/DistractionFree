// ---------------------------------------------------------------------------
// Dev auto-reload
// Polls a local dev server (started by `node healer/dev-reload.mjs`) once per
// minute.  When the server reports a new version, the extension reloads itself.
// If the server is not running, the fetch fails silently — no impact on normal use.
// ---------------------------------------------------------------------------

const DEV_RELOAD_URL = 'http://127.0.0.1:9876/version';

async function checkDevReload() {
  try {
    const res = await fetch(DEV_RELOAD_URL, { cache: 'no-store' });
    if (!res.ok) return;
    const version = (await res.text()).trim();
    const stored  = await chrome.storage.session.get('devReloadVersion');
    if (stored.devReloadVersion === undefined) {
      // First check — record baseline, don't reload
      await chrome.storage.session.set({ devReloadVersion: version });
      return;
    }
    if (stored.devReloadVersion !== version) {
      await chrome.storage.session.set({ devReloadVersion: version });
      console.log('[DistractionFree] Dev reload triggered — reloading extension');
      chrome.runtime.reload();
    }
  } catch (_) {
    // Dev server not running — no-op
  }
}

// Create the repeating alarm on every service-worker startup.
// chrome.alarms persists through extension reloads; re-creating it is harmless.
chrome.alarms.create('devReloadCheck', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'devReloadCheck') checkDevReload();
});

// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS = {
  linkedin: {
    feedEnabled:            true,
    hidePYMK:               true,
    hideNewsSidebar:        true,
    hideJobRecommendations: false,
    hideLearningRecs:       false,
    hideGroupsWidget:       false,
    hidePremiumUpsell:      true,
    hideProfileViewTeaser:  true,
    hideSearchAppearances:  true,
    hideAIUpsell:           true,
    hideNotificationBadge:  true,
    hideMessagingBadge:     false,
    hideOTWBanners:         false,
    hidePeopleAlsoViewed:   true,
    hideCelebrations:       false,
    hideConnectionCounts:   false,
  }
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get("settings", (result) => {
    if (!result.settings) {
      chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    } else {
      // Merge new keys into existing settings without overwriting user prefs.
      const merged = Object.assign({}, DEFAULT_SETTINGS.linkedin, result.settings.linkedin || {});
      chrome.storage.sync.set({ settings: { ...result.settings, linkedin: merged } });
    }
  });
});
