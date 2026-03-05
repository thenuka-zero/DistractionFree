const DEFAULT_SETTINGS = {
  linkedin: { feedEnabled: true }
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get("settings", (result) => {
    if (!result.settings) {
      chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    }
  });
});
