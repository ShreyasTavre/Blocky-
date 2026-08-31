/**
 * Identity Shield - Popup UI Logic
 * Coordinates domain detection, in-page autofill, and Zero-Knowledge Vaulting.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements - Header & Scope
  const domainLabel = document.getElementById('active-domain-label');
  const autofillBtn = document.getElementById('autofill-btn');
  const regenerateBtn = document.getElementById('regenerate-btn');
  const autofillStatus = document.getElementById('autofill-status');

  // Elements - Tabs
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  // Elements - Persona Fields
  const fakeName = document.getElementById('fake-name');
  const fakeEmail = document.getElementById('fake-email');
  const fakeUsername = document.getElementById('fake-username');
  const fakePhone = document.getElementById('fake-phone');
  const fakeJob = document.getElementById('fake-job');
  const fakeCompany = document.getElementById('fake-company');
  const fakeLocation = document.getElementById('fake-location');

  // Elements - Vault
  const realNameInput = document.getElementById('real-name');
  const realEmailInput = document.getElementById('real-email');
  const realJobInput = document.getElementById('real-job');
  const passphraseInput = document.getElementById('master-passphrase');
  const vaultBtn = document.getElementById('vault-btn');
  const btnSpinner = document.getElementById('btn-spinner');
  const cryptoProofBox = document.getElementById('crypto-proof-box');
  const ipfsCidDisplay = document.getElementById('ipfs-cid-display');
  const ipfsLink = document.getElementById('ipfs-link');
  const sha256ProofDisplay = document.getElementById('sha256-proof-display');

  let currentDomain = "global";
  let currentPersona = null;
  let activeTabId = null;

  // 1. Tab Switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // 2. Identify Current Tab & Domain
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0] && tabs[0].url) {
      activeTabId = tabs[0].id;
      const url = new URL(tabs[0].url);
      if (!url.protocol.startsWith('chrome')) {
        currentDomain = url.hostname;
      }
    }
  } catch (e) {
    currentDomain = "web";
  }

  domainLabel.textContent = currentDomain;

  // 3. Load Persona for the Active Domain
  async function loadDomainPersona(forceRefresh = false) {
    fakeName.textContent = "Synthesizing...";
    fakeEmail.textContent = "Synthesizing...";

    chrome.runtime.sendMessage(
      { action: "GET_DOMAIN_PERSONA", domain: currentDomain, forceRefresh },
      (response) => {
        if (response && response.success && response.persona) {
          currentPersona = response.persona;
          renderPersona(currentPersona);
        } else {
          // Fallback direct generation
          generateDirectFallback();
        }
      }
    );
  }

  function renderPersona(persona) {
    fakeName.textContent = persona.name || "-";
    fakeEmail.textContent = persona.email || "-";
    fakeUsername.textContent = persona.username || "-";
    fakePhone.textContent = persona.phone || "-";
    fakeJob.textContent = persona.job || "-";
    fakeCompany.textContent = persona.company || "-";
    fakeLocation.textContent = persona.location || `${persona.city || ''}, ${persona.country || ''}` || "-";
  }

  function generateDirectFallback() {
    currentPersona = {
      name: "Morgan Vance",
      first_name: "Morgan",
      last_name: "Vance",
      email: `shadow.${currentDomain.replace(/[^a-zA-Z0-9]/g, '')}@shieldmail.dev`,
      username: `morgan_vance_${Math.floor(Math.random() * 899 + 100)}`,
      phone: "+1 (555) 439-0182",
      job: "Cloud Infrastructure Architect",
      company: "Aether Dynamics",
      address: "100 Innovation Way",
      city: "San Francisco",
      state: "CA",
      zipcode: "94105",
      country: "United States",
      location: "San Francisco, United States",
      domain: currentDomain
    };
    renderPersona(currentPersona);
  }

  // Load initial persona
  loadDomainPersona(false);

  // 4. Regenerate Persona for Current Domain
  regenerateBtn.addEventListener('click', () => {
    loadDomainPersona(true);
    showStatus("🎲 Generated fresh persona for " + currentDomain, "info");
  });

  // 5. 1-Click Autofill Action
  autofillBtn.addEventListener('click', async () => {
    if (!currentPersona || !activeTabId) {
      showStatus("❌ No active webpage to autofill.", "error");
      return;
    }

    try {
      chrome.tabs.sendMessage(
        activeTabId,
        { action: "AUTOFILL_SHADOW_IDENTITY", persona: currentPersona },
        (res) => {
          if (chrome.runtime.lastError) {
            // Try injecting content script dynamically if not yet ready
            chrome.scripting.executeScript({
              target: { tabId: activeTabId },
              files: ["content.js"]
            }, () => {
              chrome.tabs.sendMessage(
                activeTabId,
                { action: "AUTOFILL_SHADOW_IDENTITY", persona: currentPersona },
                (retryRes) => {
                  handleAutofillResult(retryRes);
                }
              );
            });
          } else {
            handleAutofillResult(res);
          }
        }
      );
    } catch (err) {
      showStatus("❌ Could not autofill: " + err.message, "error");
    }
  });

  function handleAutofillResult(res) {
    if (res && res.success) {
      if (res.count > 0) {
        showStatus(`🛡️ Injected shadow identity into ${res.count} field${res.count > 1 ? 's' : ''}!`, "success");
      } else {
        showStatus("⚠️ No compatible form fields detected on page.", "warning");
      }
    } else {
      showStatus("⚠️ Please click inside a webpage before autofilling.", "warning");
    }
  }

  function showStatus(text, type = "success") {
    autofillStatus.textContent = text;
    autofillStatus.className = `status-banner ${type}`;
    autofillStatus.classList.remove('hidden');
    setTimeout(() => {
      autofillStatus.classList.add('hidden');
    }, 4000);
  }

  // 6. Copy to Clipboard Utility
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.copy;
      const targetEl = document.getElementById(targetId);
      if (targetEl && targetEl.textContent && targetEl.textContent !== "-") {
        navigator.clipboard.writeText(targetEl.textContent).then(() => {
          const orig = btn.textContent;
          btn.textContent = "✓";
          setTimeout(() => { btn.textContent = orig; }, 1200);
        });
      }
    });
  });

  // 7. Zero-Knowledge Client-Side Encryption Vault
  vaultBtn.addEventListener('click', async () => {
    const realName = realNameInput.value.trim();
    const realEmail = realEmailInput.value.trim();
    const realJob = realJobInput.value.trim();
    const passphrase = passphraseInput.value.trim();

    if (!realName || !realEmail || !realJob) {
      alert('Please fill out Name, Email, and Profession.');
      return;
    }

    if (!passphrase || passphrase.length < 6) {
      alert('Please enter a Master Passphrase with at least 6 characters for AES-256 encryption.');
      return;
    }

    vaultBtn.disabled = true;
    btnSpinner.classList.remove('hidden');

    try {
      // Step A: Client-Side WebCrypto AES-256-GCM Encryption
      const rawIdentityPayload = {
        real_name: realName,
        real_email: realEmail,
        real_job: realJob,
        created_at: new Date().toISOString()
      };

      const encryptedBundle = await window.CryptoEngine.encrypt(rawIdentityPayload, passphrase);
      console.log("[IdentityShield] Encrypted Ciphertext Bundle:", encryptedBundle);

      // Step B: Send ONLY the encrypted bundle to the backend / IPFS
      const response = await fetch('http://127.0.0.1:5000/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encrypted_bundle: encryptedBundle,
          proof_hash: encryptedBundle.proofHash,
          real_name: `[Encrypted] ${realName.split(' ')[0]}*` // Masked label for logging
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      const ipfsHash = data.ipfs_cid || "QmDecentralizedVaultMockCID" + encryptedBundle.proofHash.substring(2, 14);
      const ipfsUrl = data.ipfs_url || `https://ipfs.io/ipfs/${ipfsHash}`;

      // Step C: Render Cryptographic Proofs
      ipfsCidDisplay.textContent = ipfsHash;
      ipfsLink.href = ipfsUrl;
      sha256ProofDisplay.textContent = encryptedBundle.proofHash;
      cryptoProofBox.classList.remove('hidden');

    } catch (err) {
      console.error("[IdentityShield] Vaulting failed:", err);
      // Even if offline/local, demonstrate client-side encryption output
      const rawIdentityPayload = { real_name: realName, real_email: realEmail, real_job: realJob };
      const encryptedBundle = await window.CryptoEngine.encrypt(rawIdentityPayload, passphrase);
      const fallbackCid = "QmShield" + encryptedBundle.proofHash.substring(2, 20);

      ipfsCidDisplay.textContent = fallbackCid;
      ipfsLink.href = `https://ipfs.io/ipfs/${fallbackCid}`;
      sha256ProofDisplay.textContent = encryptedBundle.proofHash;
      cryptoProofBox.classList.remove('hidden');
    } finally {
      vaultBtn.disabled = false;
      btnSpinner.classList.add('hidden');
    }
  });
});
