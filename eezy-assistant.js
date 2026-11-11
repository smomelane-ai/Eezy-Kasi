
/* =========================================================
   EEZY AI — YOUR TOWNSHIP DIGITAL ASSISTANT
   Chat, Smart Township Search, Voice Input.
   English and isiZulu.

   Normal AI: super-processor
   Real shop/product search: eezy-search
   Voice output: handled separately by eezy-voice.js
   ========================================================= */

(() => {
  "use strict";

  if (document.getElementById("eezy-ai-panel")) return;

  const FN = SB_URL + "/functions/v1/super-processor";
  const SEARCH_FN = SB_URL + "/functions/v1/eezy-search";

  /* =====================================================
     STYLES
     ===================================================== */

  const STYLE = `
    #eezy-ai-launcher {
      position: fixed;
      right: 20px;
      bottom: max(20px, env(safe-area-inset-bottom));
      z-index: 99990;
      border: 0;
      border-radius: 999px;
      padding: 13px 19px;
      background: var(--accent, #176b45);
      color: var(--on-accent, #fff);
      font: 700 14px system-ui, sans-serif;
      box-shadow: 0 5px 22px #0003;
      cursor: pointer;
    }

    #eezy-ai-panel {
      position: fixed;
      right: 16px;
      bottom: max(82px, calc(env(safe-area-inset-bottom) + 72px));
      z-index: 99991;
      display: flex;
      flex-direction: column;
      width: min(390px, calc(100vw - 24px));
      height: min(590px, 72vh);
      min-height: 340px;
      background: var(--surface, #fff);
      color: var(--ink, #222);
      border: 1px solid var(--line, #ddd);
      border-radius: 18px;
      box-shadow: 0 12px 42px #0003;
      overflow: hidden;
      font-family: system-ui, sans-serif;
    }

    #eezy-ai-panel[hidden],
    #eezy-ai-launcher[hidden] {
      display: none !important;
    }

    .eezy-ai-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 14px 16px;
      background: var(--accent, #176b45);
      color: var(--on-accent, #fff);
    }

    .eezy-ai-head strong {
      display: block;
      font-size: 15px;
    }

    .eezy-ai-head small {
      display: block;
      opacity: .85;
      font-size: 11px;
    }

    .eezy-ai-head button {
      border: 0;
      background: transparent;
      color: inherit;
      font-size: 23px;
      cursor: pointer;
      padding: 2px 7px;
    }

    .eezy-ai-tools {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--line, #ddd);
      font-size: 12px;
    }

    .eezy-ai-tools button,
    .eezy-ai-suggestions button {
      border: 1px solid var(--line, #ddd);
      border-radius: 999px;
      padding: 6px 10px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: inherit;
    }

    .eezy-ai-messages {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: var(--bg, #f7f7f7);
    }

    .eezy-ai-message {
      max-width: 92%;
      padding: 10px 12px;
      border-radius: 13px;
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .eezy-ai-message.bot {
      align-self: flex-start;
      background: var(--surface, #fff);
      border: 1px solid var(--line, #ddd);
    }

    .eezy-ai-message.me {
      align-self: flex-end;
      background: var(--accent, #176b45);
      color: var(--on-accent, #fff);
    }

    .eezy-ai-suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px 12px;
      border-top: 1px solid var(--line, #ddd);
    }

    .eezy-ai-suggestions button {
      font-size: 11px;
    }

    .eezy-ai-compose {
      display: flex;
      align-items: stretch;
      gap: 7px;
      padding: 10px 12px;
      border-top: 1px solid var(--line, #ddd);
      background: var(--surface, #fff);
    }

    .eezy-ai-compose textarea {
      flex: 1;
      min-width: 0;
      resize: none;
      min-height: 42px;
      max-height: 100px;
      border: 1px solid var(--line, #ddd);
      border-radius: 11px;
      padding: 10px;
      background: var(--bg, #fff);
      color: var(--ink, #222);
      font: 13px system-ui, sans-serif;
    }

    .eezy-ai-compose button {
      border: 0;
      border-radius: 11px;
      padding: 0 12px;
      background: var(--accent, #176b45);
      color: var(--on-accent, #fff);
      font-weight: 700;
      cursor: pointer;
    }

    .eezy-ai-compose #eezy-ai-mic {
      min-width: 43px;
      padding: 0 8px;
      background: var(--bg, #eee);
      color: var(--ink, #222);
      border: 1px solid var(--line, #ddd);
      font-size: 19px;
    }

    .eezy-ai-compose #eezy-ai-mic.listening {
      background: #c62828;
      color: white;
      border-color: #c62828;
      animation: eezy-ai-pulse 1s infinite;
    }

    .eezy-ai-compose button:disabled {
      opacity: .5;
      cursor: wait;
    }

    @keyframes eezy-ai-pulse {
      50% { opacity: .55; }
    }

    .eezy-ai-foot {
      padding: 5px 12px 8px;
      color: var(--muted, #777);
      font-size: 10px;
      text-align: center;
      background: var(--surface, #fff);
    }

    @media (max-width: 480px) {
      #eezy-ai-launcher {
        right: 12px;
        bottom: max(12px, env(safe-area-inset-bottom));
      }

      #eezy-ai-panel {
        right: 8px;
        bottom: max(72px, calc(env(safe-area-inset-bottom) + 64px));
        width: calc(100vw - 16px);
        height: min(72vh, 590px);
      }
    }
  `;

  const style = document.createElement("style");
  style.id = "eezy-ai-styles";
  style.textContent = STYLE;
  document.head.appendChild(style);

  /* =====================================================
     INTERFACE
     ===================================================== */

  const launcher = document.createElement("button");
  launcher.id = "eezy-ai-launcher";
  launcher.type = "button";
  launcher.textContent = "✦ Eezy AI";
  launcher.setAttribute("aria-label", "Open Eezy AI assistant");
  launcher.hidden = true;

  const panel = document.createElement("section");
  panel.id = "eezy-ai-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Eezy AI assistant");

  panel.innerHTML = `
    <div class="eezy-ai-head">
      <div>
        <strong>✦ Eezy AI</strong>
        <small>Your Township Digital Assistant</small>
      </div>
      <button type="button" id="eezy-ai-close"
        aria-label="Close assistant">×</button>
    </div>

    <div class="eezy-ai-tools">
      <span id="eezy-ai-role">Your assistant</span>
      <div>
        <button type="button" id="eezy-ai-en">English</button>
        <button type="button" id="eezy-ai-zu">isiZulu</button>
      </div>
    </div>

    <div class="eezy-ai-messages" id="eezy-ai-messages"
      aria-live="polite"></div>

    <div class="eezy-ai-suggestions"
      id="eezy-ai-suggestions"></div>

    <form class="eezy-ai-compose" id="eezy-ai-form">
      <textarea id="eezy-ai-input" maxlength="1000"
        placeholder="Ask Eezy AI anything..."
        aria-label="Your message"></textarea>

      <button id="eezy-ai-mic" type="button"
        aria-label="Speak to Eezy AI"
        title="Tap to speak">🎙️</button>

      <button id="eezy-ai-send" type="submit">Send</button>
    </form>

    <div class="eezy-ai-foot">
      Eezy AI can guide you, but cannot complete transactions
      without your confirmation.
    </div>
  `;

  document.body.append(launcher, panel);

  const messages = panel.querySelector("#eezy-ai-messages");
  const input = panel.querySelector("#eezy-ai-input");
  const form = panel.querySelector("#eezy-ai-form");
  const sendButton = panel.querySelector("#eezy-ai-send");
  const micButton = panel.querySelector("#eezy-ai-mic");
  const roleLabel = panel.querySelector("#eezy-ai-role");
  const suggestions = panel.querySelector("#eezy-ai-suggestions");

  /* =====================================================
     STATE
     ===================================================== */

  let language =
    localStorage.getItem("inanda_lang") === "zu" ? "zu" : "en";

  let activeUserId = null;
  let activeRole = null;
  let busy = false;
  let recognition = null;
  let listening = false;
  let voiceBaseText = "";

  const roleNames = {
    cust: "Customer assistant",
    drv: "Driver assistant",
    own: "Business owner assistant",
    adm: "Administrator assistant"
  };

  const suggestionsByRole = {
    cust: [
      ["Find a shop", "Find a shop"],
      ["Find Kota", "Find me Kota"],
      ["Find affordable food", "Find affordable food"],
      ["Using the app", "Show me how to use Eezy Kasi."]
    ],
    drv: [
      ["Driver help", "How do I use Eezy Kasi as a driver?"],
      ["My profile", "How can I manage my driver profile?"],
      ["Transport jobs", "How do transport requests work?"]
    ],
    own: [
      ["Business help", "How can I manage my business on Eezy Kasi?"],
      ["Promote my shop", "Give me ideas to promote my business."],
      ["Orders", "How do customer orders work?"]
    ],
    adm: [
      ["Admin help", "Explain the administrator tools in Eezy Kasi."],
      ["Platform help", "What should I check when helping a user?"]
    ]
  };

  /* =====================================================
     USER AND MESSAGE HELPERS
     ===================================================== */

  function currentRole() {
    try {
      return user && user.tab ? user.tab : null;
    } catch (_) {
      return null;
    }
  }

  function currentId() {
    try {
      return sess && sess.user ? sess.user.id : null;
    } catch (_) {
      return null;
    }
  }

  function addMessage(text, who) {
    const bubble = document.createElement("div");
    bubble.className = "eezy-ai-message " + who;
    bubble.textContent = String(text || "");
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  function greeting(role) {
    if (language === "zu") {
      return "Sawubona! Ngingu-Eezy AI, umsizi wakho we-Eezy Kasi. Ngingakusiza ukuthi usebenzise uhlelo lokusebenza. Ungathanda ukusizwa ngani?";
    }

    const greetings = {
      cust: "Hello! I'm Eezy AI, your Eezy Kasi assistant. I can help you find shops, products and transport, and show you how to use the app.",
      drv: "Hello, driver! I'm Eezy AI. Ask me about using Eezy Kasi, your driver profile and transport requests.",
      own: "Hello! I'm Eezy AI, your business assistant. Ask me about managing your shop, orders and promoting your business.",
      adm: "Hello! I'm Eezy AI. I can help explain Eezy Kasi's features and administrative workflows."
    };

    return greetings[role] || greetings.cust;
  }

  function stopVoice() {
    if (recognition && listening) {
      try {
        recognition.stop();
      } catch (_) {}
    }

    listening = false;
    micButton.classList.remove("listening");
    micButton.textContent = "🎙️";
    micButton.title = "Tap to speak";
  }

  /* =====================================================
     LANGUAGE
     ===================================================== */

  function setLanguage(next) {
    language = next === "zu" ? "zu" : "en";

    try {
      localStorage.setItem("inanda_lang", language);
    } catch (_) {}

    panel.querySelector("#eezy-ai-en").style.fontWeight =
      language === "en" ? "700" : "400";

    panel.querySelector("#eezy-ai-zu").style.fontWeight =
      language === "zu" ? "700" : "400";

    input.placeholder =
      language === "zu"
        ? "Buza u-Eezy AI..."
        : "Ask Eezy AI anything...";

    if (recognition) {
      recognition.lang = language === "zu" ? "zu-ZA" : "en-ZA";
    }

    if (messages.children.length === 1) {
      messages.replaceChildren();
      addMessage(greeting(currentRole()), "bot");
    }
  }

  function showSuggestions(role) {
    suggestions.replaceChildren();

    (suggestionsByRole[role] || suggestionsByRole.cust)
      .forEach(([label, question]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;

        button.addEventListener("click", () => {
          input.value = question;
          form.requestSubmit();
        });

        suggestions.appendChild(button);
      });
  }

  /* =====================================================
     LOGIN / ROLE VISIBILITY
     ===================================================== */

  function sync() {
    const role = currentRole();
    const id = currentId();

    const allowed =
      !!id && ["cust", "drv", "own", "adm"].includes(role);

    launcher.hidden = !allowed;

    if (!allowed) {
      panel.hidden = true;
      stopVoice();
      activeUserId = null;
      activeRole = null;
      return;
    }

    if (activeUserId !== id || activeRole !== role) {
      stopVoice();

      activeUserId = id;
      activeRole = role;

      messages.replaceChildren();
      roleLabel.textContent = roleNames[role] || "Your assistant";

      addMessage(greeting(role), "bot");
      showSuggestions(role);
    }
  }

  /* =====================================================
     SMART TOWNSHIP SEARCH
     ===================================================== */

  function isSearchRequest(message) {
    const text = String(message || "").toLowerCase();

    return (
      /\b(find|search|look for|looking for|where can i|where is|show me|buy|selling|sell|available|shops?|products?|menu|near me|nearby|affordable|cheap|cheapest|meals?|food|groceries)\b/i.test(text) ||
      /\b(kota|vetkoek|amagwinya|chicken|burger|pizza|chips|hotdog|hot-dog|russian|sandwich|indomie)\b/i.test(text) ||
      /\b(ngifuna|ngitholele|ngibheke|ukuthenga|ngithola|ngingathenga|izitolo|umkhiqizo|imikhiqizo|ukudla)\b/i.test(text)
    );
  }

  function understandSearch(message) {
    let text = String(message || "")
      .toLowerCase()
      .replace(/[?!.,;:()[\]{}"'`]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!isSearchRequest(text)) return null;

    let area = "";
    let maxPrice = null;

    /* Extract explicit maximum price, for example: under R30 */
    const pricePattern =
      /\b(?:under|below|less than|max(?:imum)?|up to|ngaphansi kuka)\s*r?\s*(\d+(?:\.\d{1,2})?)/i;

    const priceMatch = text.match(pricePattern);

    if (priceMatch) {
      maxPrice = Number(priceMatch[1]);
      text = text.replace(pricePattern, " ");
    }

    /* Extract an area, for example: in Geneva or near Inanda */
    const areaPattern =
      /\b(?:in|near|around)\s+([a-z][a-z\s-]*?)(?=\s+(?:under|below|less than|max(?:imum)?|up to)\b|$)/i;

    const areaMatch = text.match(areaPattern);

    if (areaMatch) {
      const candidate = areaMatch[1].trim();

      if (candidate && !/^(me|my area)$/i.test(candidate)) {
        area = candidate;
      }

      text = text.replace(areaPattern, " ");
    }

    /* Recognise isiZulu location spelling such as eGeneva */
    const zuluAreaMatch = text.match(/\be([a-z][a-z-]{2,})\b/i);

    if (!area && zuluAreaMatch) {
      area = zuluAreaMatch[1];
      text = text.replace(zuluAreaMatch[0], " ");
    }

    /* Remove search instructions, but keep useful search terms. */
    const removePhrases = [
      /\bwhere can i get\b/gi,
      /\bwhere can i buy\b/gi,
      /\bwhere do i find\b/gi,
      /\bi am looking for\b/gi,
      /\bi'm looking for\b/gi,
      /\blooking for\b/gi,
      /\bsearch for\b/gi,
      /\blook for\b/gi,
      /\bfind me\b/gi,
      /\bshow me\b/gi,
      /\bhelp me find\b/gi,
      /\bi want to buy\b/gi,
      /\bi want\b/gi,
      /\bi need\b/gi,
      /\bdo you have\b/gi,
      /\bdo you sell\b/gi,
      /\bwho sells\b/gi,
      /\bplease\b/gi,
      /\bngitholele\b/gi,
      /\bngibheke\b/gi,
      /\bngifuna\b/gi,
      /\bukuthenga\b/gi,
      /\bngingathenga\b/gi,
      /\bngithola\b/gi,
      /\bnear me\b/gi,
      /\bnearby\b/gi,
      /\baround me\b/gi,
      /\bon eezy kasi\b/gi,
      /\bon eezy\b/gi,
      /\bshops?\b/gi,
      /\bproducts?\b/gi,
      /\bitems?\b/gi,
      /\bstores?\b/gi,
      /\bavailable\b/gi,
      /\bselling\b/gi,
      /\bsell\b/gi,
      /\bbuy\b/gi,
      /\bfind\b/gi,
      /\bsearch\b/gi,
      /\bshow\b/gi,
      /\bme\b/gi,
      /\bthe\b/gi,
      /\ba\b/gi,
      /\ban\b/gi,
      /\bi\b/gi,
      /\bfor\b/gi,
      /\bto\b/gi,
      /\bon\b/gi,
      /\bof\b/gi,
      /\bis\b/gi,
      /\bare\b/gi,
      /\band\b/gi,
      /\baffordable\b/gi,
      /\bcheap(?:est)?\b/gi
    ];

    removePhrases.forEach(pattern => {
      text = text.replace(pattern, " ");
    });

    /*
     * Map broad food words to the food category search term.
     * Do not delete "food": the backend needs to receive it.
     */
    text = text.replace(/\bmeals?\b/gi, "food");

    /*
     * Convert known isiZulu product spelling iKota to Kota.
     * Do not strip the letter i from every word:
     * that would damage names such as Indomie.
     */
    text = text.replace(/\bikota\b/gi, "kota");

    const query = text
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);

    /*
     * A generic shop request can browse open shops.
     * Empty query is allowed through to the search endpoint.
     */
    const browseAll =
      !query && !area && maxPrice === null;

    if (!query && !area && maxPrice === null && !browseAll) {
      return null;
    }

    return {
      query,
      area,
      max_price_rands: maxPrice,
      browse_all: browseAll
    };
  }

  /* =====================================================
     AUTHENTICATED REQUEST HELPER
     Refreshes an expired session once.
     ===================================================== */

  async function requestWithSession(url, body) {
    let token = sess && sess.access_token;

    if (!token) {
      throw new Error(
        "Your session has expired. Please sign in again."
      );
    }

    async function makeRequest(accessToken) {
      return fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SB_KEY,
          "Authorization": "Bearer " + accessToken
        },
        body: JSON.stringify(body)
      });
    }

    let response = await makeRequest(token);

    if (
      response.status === 401 &&
      typeof refreshSession === "function"
    ) {
      await refreshSession();
      token = sess && sess.access_token;

      if (token) {
        response = await makeRequest(token);
      }
    }

    return response;
  }

  /* =====================================================
     SEARCH REQUEST
     ===================================================== */

  async function searchTownship(filters) {
    if (
      !filters.query &&
      !filters.area &&
      filters.max_price_rands === null &&
      !filters.browse_all
    ) {
      throw new Error(
        language === "zu"
          ? "Sicela usho igama lomkhiqizo noma indawo."
          : "Please enter a product, shop or area to search."
      );
    }

    const response = await requestWithSession(
      SEARCH_FN,
      filters
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(
          "Search is temporarily limited. Please try again later."
        );
      }

      throw new Error(
        data.error || data.message ||
        "Eezy Search could not complete your search. Please try again."
      );
    }

    if (!data.success) {
      throw new Error(
        data.error || "Eezy Search returned an unexpected result."
      );
    }

    return data;
  }

  /* =====================================================
     SEARCH RESULTS
     ===================================================== */

  function money(cents) {
    if (
      cents === null ||
      cents === undefined ||
      !Number.isFinite(Number(cents))
    ) {
      return null;
    }

    return "R" + (Number(cents) / 100).toFixed(2);
  }

  function formatSearchResults(data) {
    const shops = Array.isArray(data.shops) ? data.shops : [];
    const products = Array.isArray(data.products) ? data.products : [];

    if (!shops.length && !products.length) {
      return language === "zu"
        ? "Angitholanga isitolo noma umkhiqizo ohambisana nalokho okuseshile ezitolo ezivuliwe. Zama elinye igama noma indawo."
        : "I couldn't find a matching product or shop in the currently open shops. Try another product name or search term.";
    }

    const lines = [];

    lines.push(
      language === "zu"
        ? "Nansi imiphumela engiyithole ku-Eezy Kasi:"
        : "Here are the live results I found on Eezy Kasi:"
    );

    if (products.length) {
      lines.push("");
      lines.push(language === "zu" ? "IMIKHIQIZO:" : "PRODUCTS:");

      products.forEach((product, index) => {
        const shop = product.shop || {};
        const shopName = shop.name || "Shop";
        const area = shop.area ? " — " + shop.area : "";

        lines.push("");
        lines.push((index + 1) + ". " + product.name);
        lines.push("   Shop: " + shopName + area);

        const pickupPrice = money(product.pickup_price_cents);
        const appPrice = money(product.app_price_cents);
        const shopPrice = money(product.shop_price_cents);

        if (pickupPrice) {
          lines.push("   Pickup price: " + pickupPrice);
        }

        if (appPrice) {
          lines.push("   App price: " + appPrice);
        }

        if (shopPrice) {
          lines.push("   Shop price: " + shopPrice);
        }

        if (product.description) {
          lines.push("   " + product.description);
        }
      });
    }

    if (shops.length) {
      lines.push("");
      lines.push(language === "zu" ? "IZITOLO:" : "SHOPS:");

      shops.forEach((shop, index) => {
        const area = shop.area ? " — " + shop.area : "";

        lines.push((index + 1) + ". " + shop.name + area);

        if (shop.category) {
          lines.push("   Category: " + shop.category);
        }

        if (Array.isArray(shop.places) && shop.places.length) {
          lines.push("   Places: " + shop.places.join(", "));
        }
      });
    }

    lines.push("");
    lines.push(
      language === "zu"
        ? "Le miphumela ivela kudatha etholakalayo manje. Hlola imininingwane ngaphambi kokufaka i-oda."
        : "These results come from available shop data. Please check the details before placing an order."
    );

    return lines.join("\n");
  }

  /* =====================================================
     VOICE INPUT
     ===================================================== */

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = language === "zu" ? "zu-ZA" : "en-ZA";

    recognition.onstart = () => {
      listening = true;
      micButton.classList.add("listening");
      micButton.textContent = "⏹️";
      micButton.title = "Listening — tap to stop";
    };

    recognition.onresult = event => {
      let transcript = "";
      let hasFinalResult = false;

      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          hasFinalResult = true;
        }
      }

      const separator = voiceBaseText.trim() ? " " : "";

      input.value = (
        voiceBaseText + separator + transcript
      ).slice(0, 1000);

      if (hasFinalResult) {
        input.focus();
      }
    };

    recognition.onerror = event => {
      const errors = {
        "not-allowed": "Please allow microphone access in your browser settings.",
        "service-not-allowed": "Your browser has blocked voice recognition.",
        "no-speech": "We didn't hear anything. Please try again.",
        "network": "Voice recognition needs an internet connection.",
        "audio-capture": "No working microphone was detected."
      };

      if (event.error !== "aborted") {
        addMessage(
          errors[event.error] ||
          "Voice recognition encountered a problem.",
          "bot"
        );
      }

      stopVoice();
    };

    recognition.onend = () => {
      listening = false;
      micButton.classList.remove("listening");
      micButton.textContent = "🎙️";
      micButton.title = "Tap to speak";
    };

    micButton.addEventListener("click", () => {
      if (listening) {
        recognition.stop();
        return;
      }

      if (!window.isSecureContext) {
        addMessage(
          "Voice input requires a secure HTTPS connection.",
          "bot"
        );
        return;
      }

      if (busy) return;

      voiceBaseText = input.value.trim();

      try {
        recognition.lang = language === "zu" ? "zu-ZA" : "en-ZA";
        recognition.start();
      } catch (_) {
        addMessage(
          "Please wait a moment and try the microphone again.",
          "bot"
        );
      }
    });

  } else {
    micButton.disabled = true;
    micButton.textContent = "🚫";
    micButton.title =
      "Voice recognition is not supported by this browser.";
  }

  /* =====================================================
     SEND MESSAGE
     Smart Search first for customer search requests.
     Normal AI for all other conversations.
     ===================================================== */

  async function sendMessage(message) {
    if (busy) return;

    const clean = String(message || "").trim().slice(0, 1000);

    if (clean.length < 2) return;

    const role = currentRole();

    if (!role || !currentId()) {
      addMessage(
        "Please sign in again to use Eezy AI.",
        "bot"
      );
      return;
    }

    stopVoice();
    addMessage(clean, "me");
    input.value = "";

    busy = true;
    sendButton.disabled = true;
    micButton.disabled = true;
    sendButton.textContent = "...";

    const waiting = addMessage(
      language === "zu"
        ? "Ngicela ulinde..."
        : "Eezy AI is thinking...",
      "bot"
    );

    try {
      const searchFilters = understandSearch(clean);

      /* Real database search for customers */
      if (role === "cust" && searchFilters) {
        waiting.textContent =
          language === "zu"
            ? "Ngibheka ezitolo ezivuliwe..."
            : "Searching available shops and products...";

        const searchData = await searchTownship(searchFilters);

        waiting.textContent = formatSearchResults(searchData);

        return;
      }

      /* Normal assistant conversation */
      const response = await requestWithSession(FN, {
        kind: "assistant",
        message: clean,
        lang: language
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(
            "You've reached today's Eezy AI usage limit. Please try again tomorrow."
          );
        }

        throw new Error(
          data.error ||
          data.message ||
          "Eezy AI could not respond. Please try again later."
        );
      }

      const answer = data.text || data.answer;

      if (!answer) {
        throw new Error(
          "Eezy AI returned an empty response. Please try again."
        );
      }

      waiting.textContent = answer;

    } catch (error) {
      waiting.textContent =
        error && error.message
          ? error.message
          : "Something went wrong. Please try again.";

    } finally {
      busy = false;
      sendButton.disabled = false;
      micButton.disabled = !recognition;
      sendButton.textContent = "Send";
      messages.scrollTop = messages.scrollHeight;
    }
  }

  /* =====================================================
     BUTTONS AND EVENTS
     ===================================================== */

  launcher.addEventListener("click", () => {
    panel.hidden = false;
    input.focus();
  });

  panel.querySelector("#eezy-ai-close").addEventListener("click", () => {
    stopVoice();
    panel.hidden = true;
  });

  panel.querySelector("#eezy-ai-en").addEventListener("click", () => {
    stopVoice();
    setLanguage("en");
  });

  panel.querySelector("#eezy-ai-zu").addEventListener("click", () => {
    stopVoice();
    setLanguage("zu");
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    sendMessage(input.value);
  });

  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  /* =====================================================
     INITIALISE
     ===================================================== */

  setLanguage(language);
  sync();

  const observer = new MutationObserver(sync);

  const app = document.getElementById("app");
  const bar = document.getElementById("bar");

  if (app) {
    observer.observe(app, {
      childList: true,
      subtree: true
    });
  }

  if (bar) {
    observer.observe(bar, {
      childList: true,
      subtree: true
    });
  }

  window.addEventListener("focus", sync);

})();
