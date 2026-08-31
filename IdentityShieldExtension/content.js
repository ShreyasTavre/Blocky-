/**
 * Identity Shield - Content Script
 * 1. Intelligent Form Detection & Shadow Persona Autofilling
 * 2. In-Page Canvas Fingerprint Noise Defense Cloak
 */

(function () {
  // -------------------------------------------------------------
  // Part 1: In-Page Canvas Fingerprint Defense Cloak
  // -------------------------------------------------------------
  function injectCanvasDefense() {
    const script = document.createElement('script');
    script.textContent = `(${function () {
      // Check if already injected
      if (window.__IDENTITY_SHIELD_CANVAS_DEFENSE__) return;
      window.__IDENTITY_SHIELD_CANVAS_DEFENSE__ = true;

      const shiftValue = Math.floor(Math.random() * 2) + 1; // 1 or 2 pixel shift

      // Hook CanvasRenderingContext2D.prototype.getImageData
      const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function (x, y, w, h) {
        const imageData = origGetImageData.apply(this, arguments);
        const data = imageData.data;
        // Inject subtle micro-noise into a small fraction of pixels
        for (let i = 0; i < data.length; i += 32) {
          data[i] = (data[i] + shiftValue) % 256;
        }
        return imageData;
      };

      // Hook HTMLCanvasElement.prototype.toDataURL
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function () {
        try {
          const ctx = this.getContext('2d');
          if (ctx && this.width > 0 && this.height > 0) {
            const imgData = ctx.getImageData(0, 0, Math.min(this.width, 16), Math.min(this.height, 16));
            ctx.putImageData(imgData, 0, 0);
          }
        } catch (e) {}
        return origToDataURL.apply(this, arguments);
      };

      console.log("[IdentityShield] 🛡️ Canvas Fingerprint Defense active on page.");
    }})();`;

    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  // Inject early
  injectCanvasDefense();

  // -------------------------------------------------------------
  // Part 2: Form Autofill Engine
  // -------------------------------------------------------------
  function getFieldType(input) {
    const name = (input.name || "").toLowerCase();
    const id = (input.id || "").toLowerCase();
    const placeholder = (input.placeholder || "").toLowerCase();
    const autocomplete = (input.autocomplete || "").toLowerCase();
    const ariaLabel = (input.getAttribute("aria-label") || "").toLowerCase();
    const type = (input.type || "").toLowerCase();

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

  function flashElement(el) {
    const origTransition = el.style.transition;
    const origOutline = el.style.outline;
    el.style.transition = "outline 0.2s ease";
    el.style.outline = "2px solid #6366f1";

    setTimeout(() => {
      el.style.outline = origOutline;
      el.style.transition = origTransition;
    }, 1200);
  }

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

    return { success: true, count: filledCount };
  }

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
