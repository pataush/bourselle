/* Bourselle — payer quelqu'un.
 * Partagé entre l'app et la page publique g.html : IBAN, QR code de virement (norme EPC, lu par la plupart des applis bancaires
 * européennes), Revolut, Wero, PayPal.me avec le montant, un autre lien de paiement, ou Mobile Money. On choisit le moyen :
 * chacun a son bouton (qui ouvre l'appli si elle est installée) et son QR code (pour payer depuis un autre téléphone).
 * Rien ne passe par Bourselle : l'argent va directement de banque à banque. */
const PAY = {
  clean: s => String(s || "").replace(/\s+/g, "").toUpperCase(),
  ibanOk(s) {
    const v = PAY.clean(s);
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v)) return false;
    const r = (v.slice(4) + v.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
    let m = 0; for (const ch of r) m = (m * 10 + Number(ch)) % 97;
    return m === 1;
  },
  ibanFmt: s => PAY.clean(s).replace(/(.{4})/g, "$1 ").trim(),
  // Contenu du QR code de virement SEPA (EPC069-12, version 002 : BIC facultatif dans l'espace SEPA)
  epc(p, amount, note) {
    if (!p || !p.iban) return "";
    const nm = String(p.name || "").normalize("NFC").slice(0, 50);
    const amt = amount > 0 ? "EUR" + (Math.round(amount * 100) / 100).toFixed(2) : "";
    return ["BCD", "002", "1", "SCT", "", nm, PAY.clean(p.iban), amt, "", "", String(note || "").replace(/\s+/g, " ").slice(0, 50)].join("\n");
  },
  paypalUrl(u, amount, cur) {
    if (!u) return "";
    return "https://paypal.me/" + encodeURIComponent(u) + (amount > 0 ? "/" + (Math.round(amount * 100) / 100).toFixed(2) + (cur || "EUR") : "");
  },
  // Bloc « Payer » : t traduit un texte, money formate un montant
  // Les moyens de paiement proposés, dans l'ordre : paiements rapides, virement, Mobile Money
  methods(p, amount, cur) {
    const m = [];
    if (p.revolut) m.push({ id: "rev", label: "Revolut", sub: "@" + p.revolut, url: "https://revolut.me/" + encodeURIComponent(p.revolut) });
    if (p.wero) m.push({ id: "wero", label: "Wero", sub: p.wero });
    if (p.paypal) m.push({ id: "pp", label: "PayPal", sub: "paypal.me/" + p.paypal, url: PAY.paypalUrl(p.paypal, amount, cur) });
    if (p.link) m.push({ id: "link", label: "Lien de paiement", sub: String(p.link).replace(/^https:\/\/(www\.)?/, "").slice(0, 28), url: p.link });
    if (p.iban) m.push({ id: "iban", label: "Virement", sub: "IBAN " + PAY.ibanFmt(p.iban).slice(0, 9) + "…" });
    if (p.momo && (p.momo.num || p.momo.qr)) m.push({ id: "momo", label: p.momo.op || "Mobile Money", sub: p.momo.num || "QR code" });
    return m;
  },
  // Bloc « Payer » : on choisit le moyen de paiement ; chacun a son bouton pour ouvrir l'appli et son QR code.
  // t traduit un texte, money formate un montant
  html(p, amount, cur, note, t, money) {
    t = t || (x => x); money = money || (v => v.toFixed(2) + " " + (cur || "EUR"));
    const esc2 = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const eurOk = (cur || "EUR") === "EUR", qrTxt = p.iban && eurOk && typeof QR !== "undefined" ? PAY.epc(p, amount, note) : "";
    const qrSvg = txt => { if (!txt || typeof QR === "undefined") return ""; try { return QR.svg(txt, { px: 4 }); } catch (e) { return ""; } };
    const amtTxt = (Math.round(amount * 100) / 100).toFixed(2);
    const rowAmt = amount > 0 ? `<div class="pay-row"><span>${esc2(t("Montant"))}</span><b>${esc2(amtTxt)}</b><button type="button" class="linkbtn" data-copy="${amtTxt}">${esc2(t("Copier"))}</button></div>` : "";
    const rowNote = note ? `<div class="pay-row"><span>${esc2(t("Motif"))}</span><b>${esc2(note)}</b></div>` : "";
    const ms = PAY.methods(p, amount, cur);
    let h = `<div class="pay-box">`;
    if (amount > 0) h += `<div class="pay-amt"><span>${esc2(t("À payer"))}</span><b>${esc2(money(amount))}</b></div>`;
    if (!ms.length) return h + `</div>`;
    h += `<div class="pay-sec">${esc2(t(ms.length > 1 ? "Choisis comment payer" : "Comment payer"))}</div><div class="pay-picks" role="tablist">${ms.map((x, i) => `<button type="button" class="pay-pick pm-${x.id}${i ? "" : " on"}" role="tab" aria-selected="${!i}" data-pm="${x.id}"><b>${esc2(t(x.label))}</b><small>${esc2(x.sub)}</small></button>`).join("")}</div>`;
    for (const [i, x] of ms.entries()) {
      let body = "";
      if (x.url) {
        const svg = qrSvg(x.url);
        body = `<a class="btn primary pay-open" target="_blank" rel="noopener noreferrer" href="${esc2(x.url)}">${esc2(t("Ouvrir {x}").replace("{x}", x.id === "link" ? t("le lien de paiement") : x.label))} ↗</a>
          <p class="pay-hint">${esc2(t(x.id === "link" ? "Le lien s'ouvre dans l'appli concernée si elle est installée, sinon dans le navigateur." : "S'ouvre dans l'appli {x} si elle est installée, sinon sur le site.").replace("{x}", x.label))}</p>
          ${svg ? `<div class="pay-qr">${svg}<p>${esc2(t("Tu paies depuis un autre téléphone ? Scanne ce QR code."))}</p></div>` : ""}
          ${x.id === "pp" ? "" : rowAmt}${rowNote}`;
      } else if (x.id === "wero") {
        body = `<div class="pay-row"><span>Wero</span><b class="mono">${esc2(p.wero)}</b><button type="button" class="linkbtn" data-copy="${esc2(p.wero)}">${esc2(t("Copier"))}</button></div>
          <p class="pay-hint">${esc2(t("Dans l'appli de ta banque, ouvre Wero et envoie le montant à ce numéro ou cet e-mail."))}</p>${rowAmt}${rowNote}`;
      } else if (x.id === "iban") {
        const svg = qrSvg(qrTxt);
        body = `${svg ? `<div class="pay-qr">${svg}<p>${esc2(t("Scanne ce QR code avec l'appli de ta banque : le virement est déjà rempli."))}</p></div>` : ""}
          <div class="pay-row"><span>${esc2(t("Bénéficiaire"))}</span><b>${esc2(p.name)}</b></div>
          <div class="pay-row"><span>IBAN</span><b class="mono">${esc2(PAY.ibanFmt(p.iban))}</b><button type="button" class="linkbtn" data-copy="${esc2(PAY.clean(p.iban))}">${esc2(t("Copier"))}</button></div>${rowAmt}${rowNote}`;
      } else if (x.id === "momo") {
        body = `${p.momo.qr ? `<div class="pay-momoqr"><img data-momoqr="${esc2(p.momo.qr)}" alt="QR ${esc2(p.momo.op)}"><p>${esc2(t("Scanne ce QR code avec ton appli {x}.").replace("{x}", p.momo.op))}</p></div>` : ""}
          ${p.momo.num ? `<div class="pay-row"><span>${esc2(p.momo.op)}</span><b class="mono">${esc2(p.momo.num)}</b><button type="button" class="linkbtn" data-copy="${esc2(p.momo.num)}">${esc2(t("Copier"))}</button></div><p class="pay-hint">${esc2(t("Envoie le montant depuis ton appli {x} à ce numéro.").replace("{x}", p.momo.op))}</p>` : ""}
          ${p.name ? `<div class="pay-row"><span>${esc2(t("Bénéficiaire"))}</span><b>${esc2(p.name)}</b></div>` : ""}${rowAmt}${rowNote}`;
      }
      h += `<div class="pay-panel" data-pp="${x.id}"${i ? " hidden" : ""}>${body}</div>`;
    }
    return h + `</div>`;
  },
  api: () => ((window.APP_CONFIG || {}).plus || {}).api || "",
  qrCache: {},
  async momoQr(id) { if (PAY.qrCache[id]) return PAY.qrCache[id]; const r = await fetch(PAY.api() + "/p/q/" + id); const j = await r.json(); if (!r.ok) throw new Error(j.error || "QR"); return (PAY.qrCache[id] = j.data); },
  bind(root, toastFn) {
    root.querySelectorAll(".pay-box").forEach(box => box.querySelectorAll("[data-pm]").forEach(b => b.onclick = () => {
      box.querySelectorAll("[data-pm]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", String(x === b)); });
      box.querySelectorAll("[data-pp]").forEach(x => x.hidden = x.dataset.pp !== b.dataset.pm);
    }));
    root.querySelectorAll("img[data-momoqr]").forEach(img => PAY.momoQr(img.dataset.momoqr).then(d => { img.src = d; img.onclick = () => typeof showPhoto === "function" && showPhoto(d); }).catch(() => { const w = img.closest(".pay-momoqr"); if (w) w.remove(); }));
    root.querySelectorAll("[data-copy]").forEach(b => b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); toastFn && toastFn("Copié"); } catch (e) { toastFn && toastFn(b.dataset.copy); }
    });
  },
};
// Réduit une photo (ticket) avant envoi : 1280 px au plus, JPEG, moins de 600 Ko
async function shrinkPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error("Image illisible")); i.src = url; });
    for (const [max, q] of [[1280, .72], [1100, .6], [900, .5], [700, .45]]) {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      const d = c.toDataURL("image/jpeg", q); if (d.length < 800000) return d;
    }
    throw new Error("Image trop lourde");
  } finally { URL.revokeObjectURL(url); }
}
// Affiche une photo en plein écran (toucher pour fermer)
function showPhoto(src) {
  const o = document.createElement("div"); o.className = "ph-view"; o.innerHTML = `<img alt="">`; o.firstChild.src = src;
  o.onclick = () => o.remove(); document.body.appendChild(o);
}

// Prépare le QR code Mobile Money choisi par l'utilisateur (capture de l'appli de l'opérateur) :
// le téléphone le repère quand il sait le faire, sinon on propose un cadre carré à placer sur le QR. On le réduit ensuite.
function trimBox(img) {
  // Cadre de départ : on enlève les bandes de couleur unie autour (fond de l'appli), deux fois (fond puis carte blanche)
  const W = Math.min(400, img.naturalWidth), k = W / img.naturalWidth, H = Math.round(img.naturalHeight * k);
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"); x.drawImage(img, 0, 0, W, H);
  const px = x.getImageData(0, 0, W, H).data, at = (i, j) => { const o = (j * W + i) * 4; return [px[o], px[o + 1], px[o + 2]]; };
  let box = { x: 0, y: 0, w: W, h: H };
  for (let pass = 0; pass < 2; pass++) {
    const ref = at(box.x + 2, box.y + 2), diff = (i, j) => { const p = at(i, j); return Math.abs(p[0] - ref[0]) + Math.abs(p[1] - ref[1]) + Math.abs(p[2] - ref[2]) > 60; };
    let x0 = box.x + box.w, y0 = box.y + box.h, x1 = box.x, y1 = box.y;
    for (let j = box.y; j < box.y + box.h; j += 2) for (let i = box.x; i < box.x + box.w; i += 2) if (diff(i, j)) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
    if (x1 - x0 < 30 || y1 - y0 < 30) break;
    box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  const side = Math.min(Math.max(box.w, box.h) * 1.12, W, H), cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  return { x: Math.max(0, Math.min(W - side, cx - side / 2)) / k, y: Math.max(0, Math.min(H - side, cy - side / 2)) / k, s: side / k };
}
function cropSquare(img, start, t) {
  t = t || (x => x);
  return new Promise((resolve, reject) => {
    const o = document.createElement("div"); o.className = "crop-ov";
    o.innerHTML = `<div class="crop-top">${t("Place le cadre sur ton QR code")}</div><div class="crop-stage"><img alt=""><div class="crop-box"></div></div>
      <input type="range" class="crop-size" min="10" max="100" value="50"><div class="crop-acts"><button type="button" class="btn" data-x>${t("Annuler")}</button><button type="button" class="btn primary" data-ok>${t("Valider")}</button></div>`;
    document.body.appendChild(o);
    const stage = o.querySelector(".crop-stage"), im = o.querySelector("img"), bx = o.querySelector(".crop-box"), rg = o.querySelector(".crop-size");
    im.src = img.src;
    const NW = img.naturalWidth, NH = img.naturalHeight;
    let b = { ...start };
    const draw = () => { const k = im.clientWidth / NW; bx.style.left = b.x * k + "px"; bx.style.top = b.y * k + "px"; bx.style.width = bx.style.height = b.s * k + "px"; };
    const clamp = () => { b.s = Math.max(40, Math.min(b.s, NW, NH)); b.x = Math.max(0, Math.min(b.x, NW - b.s)); b.y = Math.max(0, Math.min(b.y, NH - b.s)); };
    im.onload = () => { rg.value = Math.round(b.s / Math.min(NW, NH) * 100); clamp(); draw(); };
    rg.oninput = () => { const c = { x: b.x + b.s / 2, y: b.y + b.s / 2 }; b.s = Math.min(NW, NH) * rg.value / 100; b.x = c.x - b.s / 2; b.y = c.y - b.s / 2; clamp(); draw(); };
    let drag = null;
    bx.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY, b: { ...b } }; bx.setPointerCapture(e.pointerId); };
    bx.onpointermove = e => { if (!drag) return; const k = im.clientWidth / NW; b.x = drag.b.x + (e.clientX - drag.x) / k; b.y = drag.b.y + (e.clientY - drag.y) / k; clamp(); draw(); };
    bx.onpointerup = () => { drag = null; };
    o.querySelector("[data-x]").onclick = () => { o.remove(); reject(new Error(t("Ajout annulé"))); };
    o.querySelector("[data-ok]").onclick = () => { o.remove(); resolve(b); };
  });
}
async function prepMomoQr(file, t) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error("Image illisible")); i.src = url; });
    let box = null;
    if ("BarcodeDetector" in window) {
      try {
        const det = new BarcodeDetector({ formats: ["qr_code"] }), r = await det.detect(img);
        if (r && r.length) { const q = r[0].boundingBox, m = Math.max(q.width, q.height) * .1, s2 = Math.max(q.width, q.height) + 2 * m; box = { x: Math.max(0, q.x + q.width / 2 - s2 / 2), y: Math.max(0, q.y + q.height / 2 - s2 / 2), s: s2 }; }
      } catch (e) {}
    }
    if (!box) box = await cropSquare(img, trimBox(img), t);   // l'utilisateur ajuste le cadre
    const side = Math.min(box.s, img.naturalWidth - box.x, img.naturalHeight - box.y), k = Math.min(1, 720 / side), c = document.createElement("canvas");
    c.width = c.height = Math.round(side * k);
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, box.x, box.y, side, side, 0, 0, c.width, c.height);
    let d = c.toDataURL("image/png"); if (d.length > 540000) d = c.toDataURL("image/jpeg", .92);
    if (d.length > 540000) throw new Error("Image trop lourde");
    return d;
  } finally { URL.revokeObjectURL(url); }
}
