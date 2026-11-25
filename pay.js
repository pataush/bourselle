/* Bourselle — payer quelqu'un.
 * Partagé entre l'app et la page publique g.html : IBAN, QR code de virement (norme EPC, lu par la plupart des applis bancaires
 * européennes), lien PayPal.me avec le montant, ou un autre lien de paiement (Lydia, Wero, Revolut…).
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
  html(p, amount, cur, note, t, money) {
    t = t || (x => x); money = money || (v => v.toFixed(2) + " " + (cur || "EUR"));
    const esc2 = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const eurOk = (cur || "EUR") === "EUR", qr = p.iban && eurOk && typeof QR !== "undefined" ? PAY.epc(p, amount, note) : "";
    let h = `<div class="pay-box">`;
    if (amount > 0) h += `<div class="pay-amt"><span>${esc2(t("À payer"))}</span><b>${esc2(money(amount))}</b></div>`;
    if (qr) { let svg = ""; try { svg = QR.svg(qr, { px: 4 }); } catch (e) {}
      if (svg) h += `<div class="pay-qr">${svg}<p>${esc2(t("Scanne ce QR code avec l'appli de ta banque : le virement est déjà rempli."))}</p></div>`; }
    if (p.iban) h += `<div class="pay-row"><span>${esc2(t("Bénéficiaire"))}</span><b>${esc2(p.name)}</b></div>
      <div class="pay-row"><span>IBAN</span><b class="mono">${esc2(PAY.ibanFmt(p.iban))}</b><button type="button" class="linkbtn" data-copy="${esc2(PAY.clean(p.iban))}">${esc2(t("Copier"))}</button></div>`;
    if (amount > 0 && p.iban) h += `<div class="pay-row"><span>${esc2(t("Montant"))}</span><b>${esc2((Math.round(amount * 100) / 100).toFixed(2))}</b><button type="button" class="linkbtn" data-copy="${(Math.round(amount * 100) / 100).toFixed(2)}">${esc2(t("Copier"))}</button></div>`;
    if (note && p.iban) h += `<div class="pay-row"><span>${esc2(t("Motif"))}</span><b>${esc2(note)}</b></div>`;
    const btns = [];
    if (p.paypal) btns.push(`<a class="btn primary" target="_blank" rel="noopener" href="${esc2(PAY.paypalUrl(p.paypal, amount, cur))}">${esc2(t("Payer avec PayPal"))}</a>`);
    if (p.link) btns.push(`<a class="btn${p.paypal ? "" : " primary"}" target="_blank" rel="noopener noreferrer" href="${esc2(p.link)}">${esc2(t("Ouvrir son lien de paiement"))}</a>`);
    if (btns.length) h += `<div class="pay-btns">${btns.join("")}</div>`;
    return h + `</div>`;
  },
  bind(root, toastFn) {
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
