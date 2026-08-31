/**
 * Identity Shield - Background Service Worker
 * Manages domain personas, WebRequest tracker detection radar, and global privacy telemetry.
 */

const API_BASE = "http://127.0.0.1:5000";

// In-memory per-tab detected trackers registry
const tabTrackers = {};

// Known telemetry, analytics, and fingerprinting tracker signatures
const TRACKER_RULES = [
  { name: "Google Analytics / GTM", pattern: /google-analytics\.com|googletagmanager\.com|analytics\.google\.com/i, category: "Analytics & Telemetry" },
  { name: "Meta / Facebook Pixel", pattern: /connect\.facebook\.net|facebook\.com\/tr/i, category: "Ad Profiling" },
  { name: "Hotjar Session Recorder", pattern: /static\.hotjar\.com|hotjar\.com/i, category: "Session Recording" },
  { name: "TikTok Ad Pixel", pattern: /analytics\.tiktok\.com/i, category: "Ad Profiling" },
  { name: "FingerprintJS Pro", pattern: /fpjs\.io|fingerprintjs\.com|api\.fpjs\.io/i, category: "Device Fingerprinting" },
  { name: "Criteo Retargeter", pattern: /criteo\.net|criteo\.com/i, category: "Ad Profiling" },
  { name: "Segment.io Telemetry", pattern: /cdn\.segment\.com|api\.segment\.io/i, category: "Telemetry" },
  { name: "Mixpanel Analytics", pattern: /api\.mixpanel\.com|cdn\.mxpnl\.com/i, category: "Analytics" },
  { name: "CrazyEgg Heatmap", pattern: /script\.crazyegg\.com/i, category: "Session Recording" },
  { name: "Amplitude Telemetry", pattern: /api\.amplitude\.com|cdn\.amplitude\.com/i, category: "Telemetry" }
];

// Helper to extract clean domain/host
function getDomainFromUrl(url) {
  if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:")) {
    return null;
  }
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch (e) {
    return null;
  }
}

// Update Extension Action Badge on the tab
function updateTabBadge(tabId) {
  const trackers = tabTrackers[tabId] || [];
  const count = trackers.length;
  chrome.action.setBadgeText({ tabId, text: count > 0 ? count.toString() : "" });
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#6366f1" });
}

// 1. WebRequest Interceptor for Tracker Detection
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const { tabId, url } = details;
    if (tabId < 0) return;

    for (const rule of TRACKER_RULES) {
      if (rule.pattern.test(url)) {
        if (!tabTrackers[tabId]) {
          tabTrackers[tabId] = [];
        }

        // Avoid recording duplicate tracker names on the same tab
        const exists = tabTrackers[tabId].some(t => t.name === rule.name);
        if (!exists) {
          tabTrackers[tabId].push({
            name: rule.name,
            category: rule.category,
            url: url,
            timestamp: Date.now()
          });

          // Increment global stats in storage
          chrome.storage.local.get(["globalStats"], (res) => {
            const stats = res.globalStats || { trackersDetected: 0, autofillsCount: 0, vaultsCount: 0 };
            stats.trackersDetected = (stats.trackersDetected || 0) + 1;
            chrome.storage.local.set({ globalStats: stats });
          });

          updateTabBadge(tabId);
        }
        break;
      }
    }
  },
  { urls: ["<all_urls>"] }
);

// Reset tab tracker cache on navigation or close
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" && changeInfo.url) {
    tabTrackers[tabId] = [];
    updateTabBadge(tabId);
  }

  if (changeInfo.status === "complete" && tab.url) {
    const domain = getDomainFromUrl(tab.url);
    if (domain) {
      getOrCreatePersonaForDomain(domain);
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabTrackers[tabId];
});

// 2. Fetch or generate persona for a given domain
async function getOrCreatePersonaForDomain(domain, forceRefresh = false) {
  if (!domain) return null;

  return new Promise((resolve) => {
    chrome.storage.local.get(["domainPersonas"], async (res) => {
      const personas = res.domainPersonas || {};

      if (personas[domain] && !forceRefresh) {
        return resolve(personas[domain]);
      }

      try {
        const query = `${API_BASE}/generate?domain=${encodeURIComponent(domain)}${forceRefresh ? '&force=true' : ''}`;
        const response = await fetch(query);
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        const data = await response.json();
        
        // Save to domain storage
        personas[domain] = data;
        chrome.storage.local.set({ domainPersonas: personas }, () => {
          resolve(data);
        });
      } catch (err) {
        // Fallback offline persona
        const fallback = {
          name: "Morgan Vance",
          first_name: "Morgan",
          last_name: "Vance",
          email: `shadow.${domain.replace(/[^a-zA-Z0-9]/g, '')}@shieldmail.dev`,
          username: `morgan_${Math.floor(Math.random() * 900 + 100)}`,
          phone: "+1 (555) 019-2834",
          job: "Security Analyst",
          company: "Nexus Protocol",
          address: "742 Evergreen Terrace",
          city: "Springfield",
          state: "OR",
          zipcode: "97477",
          country: "United States",
          location: "Springfield, United States",
          domain: domain
        };
        personas[domain] = fallback;
        chrome.storage.local.set({ domainPersonas: personas }, () => resolve(fallback));
      }
    });
  });
}

// 3. Message Routing for Popup & Content Scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_DOMAIN_PERSONA") {
    getOrCreatePersonaForDomain(request.domain, request.forceRefresh || false)
      .then(persona => sendResponse({ success: true, persona }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "GET_TAB_TRACKERS") {
    const tabId = request.tabId;
    const trackers = tabTrackers[tabId] || [];
    chrome.storage.local.get(["globalStats", "canvasDefenseActive"], (res) => {
      sendResponse({
        success: true,
        trackers,
        canvasDefenseActive: res.canvasDefenseActive !== false, // default true
        globalStats: res.globalStats || { trackersDetected: 0, autofillsCount: 0, vaultsCount: 0 }
      });
    });
    return true;
  }

  if (request.action === "TOGGLE_CANVAS_DEFENSE") {
    chrome.storage.local.set({ canvasDefenseActive: request.active }, () => {
      sendResponse({ success: true, active: request.active });
    });
    return true;
  }

  if (request.action === "INCREMENT_STAT") {
    chrome.storage.local.get(["globalStats"], (res) => {
      const stats = res.globalStats || { trackersDetected: 0, autofillsCount: 0, vaultsCount: 0 };
      if (request.statName && typeof stats[request.statName] === "number") {
        stats[request.statName] += 1;
        chrome.storage.local.set({ globalStats: stats });
      }
      sendResponse({ success: true, stats });
    });
    return true;
  }
});
