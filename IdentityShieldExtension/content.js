/**
 * Identity Shield - Content Script
 * Handles intelligent in-page form detection and Shadow Persona autofilling.
 */

(function () {
  console.log("[IdentityShield] Content script initialized on:", window.location.hostname);

  // Heuristic matching rules for form fields
  function getFieldType(input) {
    const name = (input.name || "").toLowerCase();
    const id = (input.id || "").toLowerCase();
    const placeholder = (input.placeholder || "").toLowerCase();
    const autocomplete = (input.autocomplete || "").toLowerCase();
    const ariaLabel = (input.getAttribute("aria-label") || "").toLowerCase();
    const type = (input.type || "").toLowerCase();

    // Check associated label text if exists
    let labelText = "";
    if (input.labels && input.labels.length > 0) {
      labelText = Array.from(input.labels).map(l => l.innerText).join(" ").toLowerCase();
    }

    const combined = `${name} ${id} ${placeholder} ${autocomplete} ${ariaLabel} ${labelText} ${type}`;

    if (autocomplete === "email" || type === "email" || /email|e-mail/.test(combined)) {
      return "email";
    }
    if (/first.*name|fname|given.*name|forename/.test(combined)) {
      return "first_name";
    }
    if (/last.*name|lname|surname|family.*name/.test(combined)) {
      return "last_name";
    }
    if (/full.*name|^name$|your.*name|display.*name/.test(combined)) {
      return "name";
    }
    if (/phone|telephone|mobile|cell|contact.*num/.test(combined) || type === "tel") {
      return "phone";
    }
    if (/job|title|occupation|profession|position|role/.test(combined)) {
      return "job";
    }
    if (/company|organization|employer|workplace|business/.test(combined)) {
      return "company";
    }
    if (/street|address|addr.*line|residence/.test(combined)) {
      return "address";
    }
    if (/^city|town|locality/.test(combined)) {
      return "city";
    }
    if (/state|province|region/.test(combined)) {
      return "state";
    }
    if (/zip|postal|pincode|postcode/.test(combined)) {
      return "zipcode";
    }
    if (/country|nation/.test(combined)) {
      return "country";
    }
    if (/username|handle|screen.*name|user.*id/.test(combined)) {
      return "username";
    }
    if (/location/.test(combined)) {
      return "location";
    }

    return null;
  }

  // Safely fills input and triggers modern reactive framework events (React, Vue, Angular)
  function setNativeValue(element, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value') ?
      Object.getOwnPropertyDescriptor(element, 'value').set :
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value').set;

    if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // Visual pulse animation on filled fields
  function flashElement(el) {
    const origTransition = el.style.transition;
    const origBoxShadow = el.style.boxShadow;
    const origBorderColor = el.style.borderColor;

    el.style.transition = "all 0.3s ease";
    el.style.boxShadow = "0 0 10px rgba(0, 240, 255, 0.8)";
    el.style.borderColor = "#00f0ff";

    setTimeout(() => {
      el.style.boxShadow = origBoxShadow;
      el.style.borderColor = origBorderColor;
      el.style.transition = origTransition;
    }, 1500);
  }

  // Autofill all detected form fields on the page
  function autofillPage(persona) {
    if (!persona) return { success: false, count: 0 };

    const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='password']):not([type='checkbox']):not([type='radio']), textarea, select"));
    let filledCount = 0;

    inputs.forEach(input => {
      const fieldType = getFieldType(input);
      if (fieldType && persona[fieldType]) {
        setNativeValue(input, persona[fieldType]);
        flashElement(input);
        filledCount++;
      }
    });

    console.log(`[IdentityShield] Successfully autofilled ${filledCount} fields with shadow persona.`);
    return { success: true, count: filledCount };
  }

  // Listen for messages from popup or background worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "AUTOFILL_SHADOW_IDENTITY") {
      const result = autofillPage(request.persona);
      sendResponse(result);
    } else if (request.action === "PING") {
      sendResponse({ status: "ok" });
    }
    return true;
  });

})();
