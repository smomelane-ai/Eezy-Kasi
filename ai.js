/* Eezy Kasi: Eezy AI helper for shop owners (write a product description, make a WhatsApp/Facebook promotion, translate).
   Loaded by index.html with one line: <script src="ai.js" defer></script>
   It uses the app's own helpers (sb, go, render, snapForm, fld, sel, esc, H, ST, user, sess, SB_URL, SB_KEY, refreshSession).
   The AI key never lives here: this file only calls the Supabase Edge Function "eezy-ai", which checks the login and the daily limit. */
(function () {
  "use strict";
  const FN = SB_URL + "/functions/v1/super-processor";

  const css = document.createElement("style");
  css.textContent = ".aibox{background:var(--bg);border:1px dashed var(--line);border-radius:12px;padding:12px;margin:8px 0}.aibox h3{margin:0 0 4px;font-size:15px}.aibox .btn{margin-top:8px}.aipromo{width:100%;font:inherit;font-size:15px;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);margin-top:8px}.aigrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}";
  document.head.appendChild(css);

  const val = id => ((document.getElementById(id) || {}).value || "").trim();

  async function call(body, retried) {
    const r = await fetch(FN, {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: "Bearer " + sess.access_token, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    let j = null; try { j = await r.json(); } catch (e) {}
    if (r.status === 401 && !retried) { try { await refreshSession(); } catch (e) { throw new Error("Your login ended. Please log out and log in again."); } return call(body, true); }
    if (!r.ok || !j || !j.text) throw new Error((j && j.error) || "Eezy AI could not answer right now. Please try again.");
    return j.text;
  }

  function boxHtml() {
    const f = ST.form || {};
    return `<div class="aibox" id="aibox"><h3>✨ Eezy AI</h3>
      <small>Type the item name and a few details above, then tap a button. Always read and fix the words before you save.</small>
      ${sel("ailang", "Language", [["en", "English"], ["zu", "isiZulu"]])}
      <div class="aigrid"><button type="button" class="btn" data-a="aiwrite">✨ Write with Eezy AI</button><button type="button" class="btn ghost" data-a="aitranslate">🌍 Translate my text</button></div>
      <h3 style="margin-top:14px">📣 Promotion</h3>
      ${sel("aichan", "Where will you post it?", [["whatsapp", "WhatsApp status or group"], ["facebook", "Facebook"]])}
      ${fld("aispecial", "Special offer (optional)", "e.g. 2 for R40 until Friday")}
      <button type="button" class="btn ghost" data-a="aipromo">📣 Make a promotion</button>
      ${f.aipromo ? `<textarea class="aipromo" id="f_aipromo" rows="6" maxlength="600" aria-label="Your promotion">${esc(f.aipromo)}</textarea>
        <div class="aigrid"><button type="button" class="btn ghost" data-a="aicopy">Copy</button><button type="button" class="btn" data-a="aiwa">Send on WhatsApp</button></div>` : ""}
    </div>`;
  }

  function inject() {
    if (!(user && user.tab === "own" && ST.shop)) return;
    const ta = document.getElementById("f_mdesc");
    if (!ta || document.getElementById("aibox")) return;
    ta.insertAdjacentHTML("afterend", boxHtml());
  }

  const _render = window.render;
  window.render = function () {
    _render.apply(this, arguments);
    try { inject(); } catch (e) {}
  };

  const base = () => {
    const name = val("f_mname"), price = parseFloat(val("f_mprice"));
    if (name.length < 2) throw new Error("Type the item name first.");
    return { name: name.slice(0, 60), price: price > 0 ? price : null, details: val("f_mdesc").slice(0, 200), lang: (ST.form.ailang === "zu" ? "zu" : "en"), category: (ST.shop && ST.shop.category) || "food" };
  };

  Object.assign(H, {
    aiwrite: () => go(async () => {
      snapForm(); const b = base();
      ST.note = "Eezy AI is writing…"; render();
      const text = await call({ kind: "describe", ...b });
      ST.form.mdesc = text.slice(0, 200); ST.note = "Done. Read it, fix anything that is not right, then tap Add item.";
    }),
    aitranslate: () => go(async () => {
      snapForm(); const details = val("f_mdesc");
      if (details.length < 2) throw new Error("Type or write the description first, then tap Translate.");
      ST.note = "Eezy AI is translating…"; render();
      const text = await call({ kind: "translate", details: details.slice(0, 200), lang: (ST.form.ailang === "zu" ? "zu" : "en") });
      ST.form.mdesc = text.slice(0, 200); ST.note = "Translated. Ask someone who speaks the language to check it if you can.";
    }),
    aipromo: () => go(async () => {
      snapForm(); const b = base();
      ST.note = "Eezy AI is writing your promotion…"; render();
      ST.form.aipromo = await call({ kind: "promo", ...b, channel: ST.form.aichan === "facebook" ? "facebook" : "whatsapp", special: val("f_aispecial").slice(0, 100) });
      ST.note = "Done. Edit it if you like, then copy it or send it on WhatsApp.";
    }),
    aicopy: () => {
      const t = val("f_aipromo");
      try { navigator.clipboard.writeText(t).then(() => { ST.note = "Copied. Paste it into your post."; render(); }, () => prompt("Copy this text:", t)); } catch (e) { prompt("Copy this text:", t); }
      return Promise.resolve();
    },
    aiwa: () => { const t = val("f_aipromo"); if (t) window.open("https://wa.me/?text=" + encodeURIComponent(t), "_blank", "noopener"); return Promise.resolve(); }
  });
})();
