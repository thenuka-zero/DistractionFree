/**
 * DistractionFree — Popup script
 * Reads/writes settings from chrome.storage.sync
 */
(function () {
  const DEFAULT_SETTINGS = {
    linkedin: { feedEnabled: true }
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
      const key = row.dataset.key;
      if (!site || !key) return;

      const checkbox = row.querySelector("input[type='checkbox']");
      if (!checkbox) return;

      const siteSettings = settings[site] || {};
      checkbox.checked = siteSettings[key] !== undefined ? siteSettings[key] : true;
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
      const key = row.dataset.key;
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
