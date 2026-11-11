
/* =========================================================
   EEZY AI — ENGLISH + NATURAL ISIZULU VOICE
   English: Browser speech synthesis
   isiZulu: Azure Speech through Supabase Edge Function
   ========================================================= */

(() => {
  "use strict";

  if (window.EezyVoiceLoaded) return;
  window.EezyVoiceLoaded = true;

  const SPEECH_URL =
    SB_URL + "/functions/v1/eezy-speech";

  const STYLE = `
    .eezy-ai-speech-controls {
      display: flex;
      flex-wrap: wrap;
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
      cursor: wait;
    }

    .eezy-ai-voice-status {
      width: 100%;
      font: 11px system-ui, sans-serif;
      color: var(--muted, #777);
    }
  `;

  const style = document.createElement("style");
  style.id = "eezy-ai-voice-styles";
  style.textContent = STYLE;
  document.head.appendChild(style);

  let activeButton = null;
  let activeAudio = null;
  let activeObjectUrl = null;
  let activeRequest = null;

  function resetButton() {
    if (activeButton) {
      activeButton.textContent = "🔊 Listen";
      activeButton.disabled = false;
      activeButton = null;
    }
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    if (activeRequest) {
      activeRequest.abort();
      activeRequest = null;
    }

    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio = null;
    }

    if (activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl);
      activeObjectUrl = null;
    }

    resetButton();
  }

  function getMessageText(bubble) {
    const copy = bubble.cloneNode(true);

    copy.querySelectorAll(
      ".eezy-ai-speech-controls"
    ).forEach(el => el.remove());

    return copy.textContent.trim();
  }

  function finishPlayback(button) {
    if (activeButton === button) {
      if (activeAudio) activeAudio = null;

      if (activeObjectUrl) {
        URL.revokeObjectURL(activeObjectUrl);
        activeObjectUrl = null;
      }

      activeRequest = null;
      resetButton();
    }
  }

  function showError(button, message) {
    button.disabled = false;
    button.textContent = "🔊 Try again";
    button.title = message;

    const controls = button.closest(
      ".eezy-ai-speech-controls"
    );

    const status = controls?.querySelector(
      ".eezy-ai-voice-status"
    );

    if (status) {
      status.textContent = message;
    }

    if (activeButton === button) {
      activeButton = null;
    }
  }

  async function speakZulu(text, button) {
    if (!window.isSecureContext) {
      showError(button, "Voice playback requires HTTPS.");
      return;
    }

    const session = typeof sess !== "undefined" ? sess : null;
    let token = session && session.access_token;

    if (!token) {
      showError(button, "Please sign in again.");
      return;
    }

    activeButton = button;
    button.textContent = "🔊 Loading isiZulu...";
    button.disabled = true;

    const controls = button.closest(
      ".eezy-ai-speech-controls"
    );

    const status = controls?.querySelector(
      ".eezy-ai-voice-status"
    );

    if (status) status.textContent = "";

    activeRequest = new AbortController();

    try {
      async function requestSpeech(accessToken) {
        return fetch(SPEECH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SB_KEY,
            "Authorization": "Bearer " + accessToken
          },
          body: JSON.stringify({ text }),
          signal: activeRequest.signal
        });
      }

      let response = await requestSpeech(token);

      if (
        response.status === 401 &&
        typeof refreshSession === "function"
      ) {
        await refreshSession();

        const refreshed =
          typeof sess !== "undefined" ? sess : null;

        token = refreshed && refreshed.access_token;

        if (token) {
          response = await requestSpeech(token);
        }
      }

      if (!response.ok) {
        let errorMessage = "Could not generate isiZulu audio.";

        try {
          const data = await response.json();
          if (data.error) errorMessage = data.error;
        } catch (_) {}

        throw new Error(errorMessage);
      }

      const audioBlob = await response.blob();

      if (!audioBlob.size) {
        throw new Error("The speech service returned empty audio.");
      }

      if (activeButton !== button) return;

      activeObjectUrl = URL.createObjectURL(audioBlob);
      activeAudio = new Audio(activeObjectUrl);

      activeAudio.onended = () => {
        finishPlayback(button);
      };

      activeAudio.onerror = () => {
        finishPlayback(button);
        showError(button, "Audio playback failed. Please try again.");
      };

      button.textContent = "🔊 Speaking...";

      await activeAudio.play();

    } catch (error) {
      if (error.name === "AbortError") return;

      console.error("Eezy AI voice error:", error);

      if (activeButton === button) {
        resetButton();
      }

      showError(
        button,
        error.message || "Voice service unavailable."
      );
    }
  }

  function speakEnglish(text, button) {
    if (
      !("speechSynthesis" in window) ||
      !("SpeechSynthesisUtterance" in window)
    ) {
      showError(button, "English speech is not supported here.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = "en-ZA";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();

    const matchingVoice = voices.find(voice =>
      voice.lang.toLowerCase() === "en-za"
    ) || voices.find(voice =>
      voice.lang.toLowerCase().startsWith("en")
    );

    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    activeButton = button;
    button.textContent = "🔊 Speaking...";
    button.disabled = true;

    utterance.onend = () => finishPlayback(button);

    utterance.onerror = () => {
      finishPlayback(button);
      showError(button, "English voice playback failed.");
    };

    window.speechSynthesis.speak(utterance);
  }

  function speakMessage(bubble, button) {
    const text = getMessageText(bubble);

    if (!text) return;

    stopSpeaking();

    const language =
      localStorage.getItem("inanda_lang") === "zu"
        ? "zu"
        : "en";

    if (language === "zu") {
      speakZulu(text, button);
    } else {
      speakEnglish(text, button);
    }
  }

  function addControls(bubble) {
    if (!bubble.classList.contains("bot")) return;

    if (bubble.querySelector(".eezy-ai-speech-controls")) {
      return;
    }

    const text = getMessageText(bubble);

    if (
      !text ||
      text === "Eezy AI is thinking..." ||
      text === "Ngicela ulinde..."
    ) {
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

    const status = document.createElement("span");
    status.className = "eezy-ai-voice-status";

    controls.append(listen, stop, status);
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

    if (!panel || panel.dataset.voiceCloseReady) return;

    panel.dataset.voiceCloseReady = "yes";

    const close = panel.querySelector("#eezy-ai-close");
    const english = panel.querySelector("#eezy-ai-en");
    const zulu = panel.querySelector("#eezy-ai-zu");

    if (close) close.addEventListener("click", stopSpeaking);
    if (english) english.addEventListener("click", stopSpeaking);
    if (zulu) zulu.addEventListener("click", stopSpeaking);
  }

  initialise();

  const pageObserver = new MutationObserver(initialise);

  pageObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  window.addEventListener("beforeunload", stopSpeaking);

})();
