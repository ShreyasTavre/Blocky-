chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only trigger when the tab has completely finished loading
  if (changeInfo.status === 'complete' && tab.url) {
    // Skip internal chrome pages
    if (tab.url.startsWith("chrome://")) return;

    console.log(`[IdentityShield] Tab updated: ${tab.url}. Fetching fake identity...`);

    fetch("http://127.0.0.1:5000/generate")
      .then(response => response.json())
      .then(data => {
        console.log(`[IdentityShield] Successfully fetched identity!`, data);
        console.log(`Your fake name for this session: ${data.name}`);
      })
      .catch(error => {
        console.error("[IdentityShield] Failed to reach Identity Engine API:", error);
      });
  }
});
