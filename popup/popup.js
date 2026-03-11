/**
 * DistractionFree — Popup script
 * Reads/writes settings from chrome.storage.sync
 */
(function () {
  const DEFAULT_SETTINGS = {
    linkedin: {
      feedEnabled:            true,
      hidePYMK:               true,
      hideNewsSidebar:        true,
      hideStartPost:          false,
      hideMyPages:            false,
      hideFollowPages:        false,
      hideStatsDashboard:     true,
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

  let settings = {};

  function loadSettings() {
    chrome.storage.sync.get("settings", (result) => {
      settings = result.settings || DEFAULT_SETTINGS;
      updateTogglesFromSettings();
    });
  }

  function updateTogglesFromSettings() {
    document.querySelectorAll(".toggle-row").forEach((row) => {
      const site = row.dataset.site;
      const key  = row.dataset.key;
      if (!site || !key) return;

      const checkbox = row.querySelector("input[type='checkbox']");
      if (!checkbox) return;

      const siteSettings = settings[site] || {};
      const htmlDefault  = checkbox.defaultChecked;
      checkbox.checked = siteSettings[key] !== undefined ? siteSettings[key] : htmlDefault;
    });
  }

  function saveSetting(site, key, value) {
    if (!settings[site]) settings[site] = {};
    settings[site][key] = value;
    chrome.storage.sync.set({ settings });
  }

  function bindToggles() {
    document.querySelectorAll(".toggle-row").forEach((row) => {
      const site = row.dataset.site;
      const key  = row.dataset.key;
      if (!site || !key) return;

      const checkbox = row.querySelector("input[type='checkbox']");
      if (!checkbox) return;

      checkbox.addEventListener("change", () => {
        saveSetting(site, key, checkbox.checked);
      });
    });
  }

  loadSettings();
  bindToggles();
})();
