
/* =========================================================
   EEZY AI — VOICE OUTPUT
   Adds spoken replies without changing the existing assistant.
   Uses the browser's built-in speech synthesis.
   ========================================================= */

(() => {
  "use strict";

  if (window.EezyVoiceLoaded) return;
  window.EezyVoiceLoaded = true;

  const STYLE = `
    .eezy-ai-speech-controls {
      display: flex;
      gap: 7px;
      margin-top: 8px;
    }

    .eezy-ai-speech-controls button {
      border: 1px solid var(--line, #ddd);
      border-radius: 999px;
      padding: 5px 10px;
      background: var(--bg, #f7f7f7);
      color: var(--ink, #222);
      font: 12px system-ui, sans-serif;
      cursor: pointer;
    }

    .eezy-ai-speech-controls button:disabled {
      opacity: .5;
      cursor: default;
    }
  `;

  const style = document.createElement("style");
  style.id = "eezy-ai-voice-styles";
  style.textContent = STYLE;
  document.head.appendChild(style);

  if (!("speechSynthesis" in window) ||
      !("SpeechSynthesisUtterance" in window)) {
    console.warn("Eezy AI: speech output is not supported.");
    return;
  }

  let activeButton = null;

  function stopSpeaking() {
    window.speechSynthesis.cancel();

    if (activeButton) {
      activeButton.textContent = "🔊 Listen";
      activeButton.disabled = false;
      activeButton = null;
    }
  }

  function getMessageText(bubble) {
    const copy = bubble.cloneNode(true);

    copy.querySelectorAll(
      ".eezy-ai-speech-controls"
    ).forEach(el => el.remove());

    return copy.textContent.trim();
  }

  function speakMessage(bubble, button) {
    const text = getMessageText(bubble);

    if (!text) return;

    stopSpeaking();

    const language =
      localStorage.getItem("inanda_lang") === "zu"
        ? "zu-ZA"
        : "en-ZA";

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = language;
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();

    const matchingVoice = voices.find(voice =>
      voice.lang.toLowerCase() === language.toLowerCase()
    ) || voices.find(voice =>
      voice.lang.toLowerCase().startsWith(
        language.substring(0, 2).toLowerCase()
      )
    );

    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    activeButton = button;
    button.textContent = "🔊 Speaking...";
    button.disabled = true;

    utterance.onend = () => {
      if (activeButton === button) {
        button.textContent = "🔊 Listen";
        button.disabled = false;
        activeButton = null;
      }
    };

    utterance.onerror = () => {
      if (activeButton === button) {
        button.textContent = "🔊 Listen";
        button.disabled = false;
        activeButton = null;
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  function addControls(bubble) {
    if (!bubble.classList.contains("bot")) return;

    if (bubble.querySelector(".eezy-ai-speech-controls")) {
      return;
    }

    const text = getMessageText(bubble);

    if (!text || text === "Eezy AI is thinking..." ||
        text === "Ngicela ulinde...") {
      return;
    }

    const controls = document.createElement("div");
    controls.className = "eezy-ai-speech-controls";

    const listen = document.createElement("button");
    listen.type = "button";
    listen.textContent = "🔊 Listen";
    listen.title = "Listen to this Eezy AI response";

    listen.addEventListener("click", () => {
      speakMessage(bubble, listen);
    });

    const stop = document.createElement("button");
    stop.type = "button";
    stop.textContent = "⏹ Stop";
    stop.title = "Stop speaking";

    stop.addEventListener("click", stopSpeaking);

    controls.append(listen, stop);
    bubble.appendChild(controls);
  }

  function observeMessages() {
    const messages = document.getElementById(
      "eezy-ai-messages"
    );

    if (!messages || messages.dataset.voiceReady === "yes") {
      return;
    }

    messages.dataset.voiceReady = "yes";

    messages.querySelectorAll(".eezy-ai-message.bot")
      .forEach(addControls);

    const observer = new MutationObserver(() => {
      messages.querySelectorAll(".eezy-ai-message.bot")
        .forEach(addControls);
    });

    observer.observe(messages, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  function initialise() {
    observeMessages();

    const panel = document.getElementById("eezy-ai-panel");

    if (panel && !panel.dataset.voiceCloseReady) {
      panel.dataset.voiceCloseReady = "yes";

      const close = panel.querySelector("#eezy-ai-close");

      if (close) {
        close.addEventListener("click", stopSpeaking);
      }

      const english = panel.querySelector("#eezy-ai-en");
      const zulu = panel.querySelector("#eezy-ai-zu");

      if (english) {
        english.addEventListener("click", stopSpeaking);
      }

      if (zulu) {
        zulu.addEventListener("click", stopSpeaking);
      }
    }
  }

  initialise();

  const pageObserver = new MutationObserver(initialise);

  pageObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  window.addEventListener("beforeunload", stopSpeaking);

})();
