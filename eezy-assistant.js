
/* =========================================================
   EEZY AI — Your Township Digital Assistant
   Separate frontend module for Eezy Kasi.
   Uses the existing authenticated super-processor function.
   ========================================================= */

(() => {
  "use strict";

  const FN = SB_URL + "/functions/v1/super-processor";

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
    .eezy-ai-head strong { display: block; font-size: 15px; }
    .eezy-ai-head small { display: block; opacity: .85; font-size: 11px; }
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
      max-width: 88%;
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
    .eezy-ai-suggestions button { font-size: 11px; }
    .eezy-ai-compose {
      display: flex;
      gap: 8px;
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
      padding: 0 15px;
      background: var(--accent, #176b45);
      color: var(--on-accent, #fff);
      font-weight: 700;
      cursor: pointer;
    }
    .eezy-ai-compose button:disabled { opacity: .5; cursor: wait; }
    .eezy-ai-foot {
      padding: 5px 12px 8px;
      color: var(--muted, #777);
      font-size: 10px;
      text-align: center;
      background: var(--surface, #fff);
    }
    @media (max-width: 480px) {
      #eezy-ai-launcher { right: 12px; bottom: max(12px, env(safe-area-inset-bottom)); }
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
      <button type="button" id="eezy-ai-close" aria-label="Close assistant">×</button>
    </div>
    <div class="eezy-ai-tools">
      <span id="eezy-ai-role">Your assistant</span>
      <div>
        <button type="button" id="eezy-ai-en">English</button>
        <button type="button" id="eezy-ai-zu">isiZulu</button>
      </div>
    </div>
    <div class="eezy-ai-messages" id="eezy-ai-messages" aria-live="polite"></div>
    <div class="eezy-ai-suggestions" id="eezy-ai-suggestions"></div>
    <form class="eezy-ai-compose" id="eezy-ai-form">
      <textarea id="eezy-ai-input" maxlength="1000"
        placeholder="Ask Eezy AI anything..." aria-label="Your message"></textarea>
      <button id="eezy-ai-send" type="submit">Send</button>
    </form>
    <div class="eezy-ai-foot">
      Eezy AI can guide you, but cannot complete transactions without your confirmation.
    </div>
  `;

  document.body.append(launcher, panel);

  const messages = panel.querySelector("#eezy-ai-messages");
  const input = panel.querySelector("#eezy-ai-input");
  const form = panel.querySelector("#eezy-ai-form");
  const sendButton = panel.querySelector("#eezy-ai-send");
  const roleLabel = panel.querySelector("#eezy-ai-role");
  const suggestions = panel.querySelector("#eezy-ai-suggestions");

  let language = localStorage.getItem("inanda_lang") === "zu" ? "zu" : "en";
  let activeUserId = null;
  let busy = false;

  const roleNames = {
    cust: "Customer assistant",
    drv: "Driver assistant",
    own: "Business owner assistant",
    adm: "Administrator assistant"
  };

  const suggestionsByRole = {
    cust: [
      ["Find a shop", "Help me find shops and products on Eezy Kasi."],
      ["Book transport", "How do I request a ride or transport?"],
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
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  function greeting(role) {
    if (language === "zu") {
      return "Sawubona! Ngingu-Eezy AI, umsizi wakho we-Eezy Kasi. Ngingakusiza ukuthi usebenzise uhlelo lokusebenza. Ungathanda ukusizwa ngani?";
    }
    const greetings = {
      cust: "Hello! I'm Eezy AI, your Eezy Kasi assistant. I can help you find your way around the app, shops, products and transport.",
      drv: "Hello, driver! I'm Eezy AI. Ask me about using Eezy Kasi, your driver profile and transport requests.",
      own: "Hello! I'm Eezy AI, your business assistant. Ask me about managing your shop, orders and promoting your business.",
      adm: "Hello! I'm Eezy AI. I can help explain Eezy Kasi's features and administrative workflows."
    };
    return greetings[role] || greetings.cust;
  }

  function setLanguage(next) {
    language = next;
    localStorage.setItem("inanda_lang", next);
    panel.querySelector("#eezy-ai-en").style.fontWeight = next === "en" ? "700" : "400";
    panel.querySelector("#eezy-ai-zu").style.fontWeight = next === "zu" ? "700" : "400";
    input.placeholder = next === "zu" ? "Buza u-Eezy AI..." : "Ask Eezy AI anything...";
    if (messages.children.length === 1) {
      messages.replaceChildren();
      addMessage(greeting(currentRole()), "bot");
    }
  }

  function showSuggestions(role) {
    suggestions.replaceChildren();
    (suggestionsByRole[role] || suggestionsByRole.cust).forEach(([label, question]) => {
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

  function sync() {
    const role = currentRole();
    const id = currentId();
    const allowed = !!id && ["cust", "drv", "own", "adm"].includes(role);

    launcher.hidden = !allowed;

    if (!allowed) {
      panel.hidden = true;
      activeUserId = null;
      return;
    }

    if (activeUserId !== id) {
      activeUserId = id;
      messages.replaceChildren();
      roleLabel.textContent = roleNames[role] || "Your assistant";
      addMessage(greeting(role), "bot");
      showSuggestions(role);
      setLanguage(language);
    }
  }

  async function sendMessage(message) {
    if (busy) return;
    const clean = String(message || "").trim().slice(0, 1000);
    if (clean.length < 2) return;

    const role = currentRole();
    if (!role || !currentId()) {
      addMessage("Please sign in again to use Eezy AI.", "bot");
      return;
    }

    addMessage(clean, "me");
    input.value = "";
    busy = true;
    sendButton.disabled = true;
    sendButton.textContent = "...";
    const waiting = addMessage(
      language === "zu" ? "Ngicela ulinde..." : "Eezy AI is thinking...",
      "bot"
    );

    try {
      let token = sess && sess.access_token;
      if (!token) throw new Error("Your session has expired. Please sign in again.");

      async function request(accessToken) {
        return fetch(FN, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SB_KEY,
            "Authorization": "Bearer " + accessToken
          },
          body: JSON.stringify({
            kind: "assistant",
            message: clean,
            lang: language
          })
        });
      }

      let response = await request(token);

      if (response.status === 401 && typeof refreshSession === "function") {
        await refreshSession();
        token = sess && sess.access_token;
        if (token) response = await request(token);
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("You've reached today's Eezy AI usage limit. Please try again tomorrow.");
        }
        throw new Error(data.error || data.message || "Eezy AI could not respond. Please try again later.");
      }

      const answer = data.text || data.answer;
      if (!answer) throw new Error("Eezy AI returned an empty response. Please try again.");
      waiting.textContent = answer;

    } catch (error) {
      waiting.textContent = error.message || "Something went wrong. Please try again.";
    } finally {
      busy = false;
      sendButton.disabled = false;
      sendButton.textContent = "Send";
      messages.scrollTop = messages.scrollHeight;
    }
  }

  launcher.addEventListener("click", () => {
    panel.hidden = false;
    input.focus();
  });

  panel.querySelector("#eezy-ai-close").addEventListener("click", () => {
    panel.hidden = true;
  });

  panel.querySelector("#eezy-ai-en").addEventListener("click", () => setLanguage("en"));
  panel.querySelector("#eezy-ai-zu").addEventListener("click", () => setLanguage("zu"));

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

  setLanguage(language);
  sync();

  const observer = new MutationObserver(sync);
  const app = document.getElementById("app");
  const bar = document.getElementById("bar");
  if (app) observer.observe(app, { childList: true, subtree: true });
  if (bar) observer.observe(bar, { childList: true, subtree: true });

  window.addEventListener("focus", sync);
})();
