/**
 * Identity Shield - Background Service Worker
 * Manages domain-specific shadow personas, caching, and API coordination.
 */

const API_BASE = "http://127.0.0.1:5000";

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

// Fetch or generate persona for a given domain
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
          console.log(`[IdentityShield] Stored shadow persona for ${domain}:`, data.name);
          resolve(data);
        });
      } catch (err) {
        console.warn(`[IdentityShield] Failed to reach backend, using fallback for ${domain}:`, err.message);
        // Fallback offline persona
        const fallback = {
          name: "Alex Mercer",
          first_name: "Alex",
          last_name: "Mercer",
          email: `shadow.${domain.replace(/[^a-zA-Z0-9]/g, '')}@shieldmail.dev`,
          username: `alex_${Math.floor(Math.random() * 900 + 100)}`,
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

// Listen to tab updates to pre-cache domain personas
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const domain = getDomainFromUrl(tab.url);
    if (domain) {
      getOrCreatePersonaForDomain(domain);
    }
  }
});

// Handle messages from Popup or Content Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_DOMAIN_PERSONA") {
    getOrCreatePersonaForDomain(request.domain, request.forceRefresh || false)
      .then(persona => sendResponse({ success: true, persona }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }

  if (request.action === "GET_ALL_PERSONAS") {
    chrome.storage.local.get(["domainPersonas"], (res) => {
      sendResponse({ success: true, domainPersonas: res.domainPersonas || {} });
    });
    return true;
  }
});
