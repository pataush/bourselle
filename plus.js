/* Bourselle Plus — offres payantes, limites de la version gratuite, codes d'activation,
 * rappels avancés (agenda + notifications) et exports comptables.
 * Chargé après app.js : il complète certaines fonctions de app.js sans les modifier. */

// Clé publique : vérifie que les codes d'activation ont bien été créés avec le générateur de licences.
// (La clé privée correspondante reste chez l'éditeur, elle n'est jamais publiée.)
const PLUS_PUB = { kty: "EC", crv: "P-256", x: "FVolf7Ixuv9wbaEw8Liyh1YbtbrZOsghwVphdfVVOLM", y: "rsfy0EMVoZkRjGF0asb7-kY3EMaDg6ICztrXPUcaaGM" };
const PLUS_CFG = (window.APP_CONFIG && window.APP_CONFIG.plus) || {};
const FREE = { scan: 5, import: 1, tontines: 1, groups: 1, ndf: 5, ndfTrialDays: 30, ...(PLUS_CFG.free || {}) };
const OFFERS = [
  { id: "mensuel", name: "Plus mensuel", price: "2,99 €", per: "par mois", note: "Sans engagement" },
  { id: "annuel", name: "Plus annuel", price: "24,99 €", per: "par an", note: "2 mois offerts", best: true },
  { id: "famille", name: "Famille", price: "39,99 €", per: "par an", note: "Jusqu'à 5 comptes" },
  { id: "vie", name: "Bourselle à vie", price: "59 €", per: "une seule fois", note: "Paiement unique, mises à jour comprises" },
].map(o => ({ ...o, ...((PLUS_CFG.prices || {})[o.id] || {}) }));
const PLAN_NAME = { mensuel: "Plus mensuel", annuel: "Plus annuel", famille: "Famille", vie: "À vie", essai: "Essai" };
const PLUS_WHY = {
  claim: "Réclamer une dette à un autre utilisateur avec son tag est réservé à Bourselle Plus. Recevoir et accepter une réclamation reste gratuit.",
  scan: `Tu as utilisé tes ${FREE.scan} scans de tickets gratuits ce mois-ci.`,
  import: `Tu as utilisé ton import de relevé gratuit ce mois-ci.`,
  tontines: `La version gratuite permet de suivre ${FREE.tontines} tontine.`,
  groups: `La version gratuite permet ${FREE.groups} groupe partagé.`,
  ndf: `Ton mois d'essai est terminé : la version gratuite permet ${FREE.ndf} tickets en note de frais par mois.`,
  rappels: "Les rappels avancés font partie de Bourselle Plus.",
  compta: "Les exports comptables font partie de Bourselle Plus.",
};
const PLUS_LIST = [
  ["Scan de tickets illimité", `gratuit : ${FREE.scan} par mois`],
  ["Import des relevés bancaires illimité", `gratuit : ${FREE.import} par mois`],
  ["Tontines et groupes partagés illimités", `gratuit : ${FREE.tontines} de chaque`],
  ["Notes de frais illimitées", `gratuit : ${FREE.ndf} tickets par mois, illimité le premier mois`],
  ["Rappels avancés", "garanties, prélèvements et tontines dans ton agenda, notifications"],
  ["Réclamer une dette", "avec le tag de la personne : elle la reçoit dans son app et vous suivez les remboursements"],
  ["Exports comptables", "grand livre et synthèse mensuelle, prêts pour Excel"],
  ["Forfait famille", "un seul abonnement pour 5 comptes, chacun garde ses données"],
];

// ---------- Codes d'activation ----------
let plusState = { ok: false };
const isPlus = () => !!plusState.ok;
function b64uBytes(s) { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); }
async function verifyLicence(code) {
  const m = /^BRS1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(code || "").replace(/\s+/g, ""));
  if (!m || !(window.crypto && crypto.subtle)) return { ok: false, why: "format" };
  try {
    const key = await crypto.subtle.importKey("jwk", PLUS_PUB, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const good = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, b64uBytes(m[2]), new TextEncoder().encode(m[1]));
    if (!good) return { ok: false, why: "format" };
    return { ok: true, p: JSON.parse(new TextDecoder().decode(b64uBytes(m[1]))), code: m[0] };
  } catch (e) { return { ok: false, why: "format" }; }
}
function myEmail() { try { return ((store && store.user && store.user().email) || "").trim().toLowerCase(); } catch (e) { return ""; } }
function licenceFits(p) {
  const em = (p.e || []).map(s => String(s).toLowerCase());
  if (em.length && !em.includes(myEmail())) return { ok: false, why: "email" };
  if (p.x && p.x < todayISO()) return { ok: false, why: "expired" };
  return { ok: true };
}
// Accès complet du propriétaire : empreinte SHA-256 de l'adresse (l'adresse elle-même n'est pas publiée).
const OWNER_HASHES = ["91959f39f66b2a1ca4ba68dc60665c1c43737e3b151bda7a01055d3b430fdd0e"];
async function isOwner() {
  const em = myEmail(); if (!em || !(window.crypto && crypto.subtle)) return false;
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(em));
  return OWNER_HASHES.includes([...new Uint8Array(d)].map(x => x.toString(16).padStart(2, "0")).join(""));
}
async function refreshPlus() {
  const code = settings && settings.licence;
  let st = { ok: false };
  if (await isOwner()) { const changed = !plusState.ok || plusState.plan !== "vie"; plusState = { ok: true, plan: "vie", until: "", emails: [myEmail()], owner: true }; return changed; }
  if (code) {
    const r = await verifyLicence(code);
    if (r.ok) { const f = licenceFits(r.p); st = { ok: f.ok, why: f.why, plan: r.p.p, until: r.p.x || "", emails: r.p.e || [] }; }
    else st = { ok: false, why: "format" };
  }
  const changed = JSON.stringify(st) !== JSON.stringify(plusState);
  plusState = st;
  return changed;
}
function licenceError(why, p) {
  if (why === "email") return `Ce code est réservé à ${(p && p.e || []).join(", ") || "un autre compte"}. Connecte-toi avec ce compte, ou demande un code pour ${myEmail() || "ton adresse"}.`;
  if (why === "expired") return `Ce code a expiré le ${frDate(p && p.x)}. Renouvelle ton abonnement pour en recevoir un nouveau.`;
  return "Ce code n'est pas valide. Vérifie qu'il est copié en entier (il commence par BRS1.).";
}

// ---------- Compteurs de la version gratuite ----------
function usedThisMonth(k) { const u = (settings.usage || {})[todayISO().slice(0, 7)] || {}; return u[k] || 0; }
function countUse(k) {
  const mk = todayISO().slice(0, 7), old = addMonths(todayISO(), -3).slice(0, 7);
  settings.usage = settings.usage || {};
  for (const key of Object.keys(settings.usage)) if (key < old) delete settings.usage[key];
  settings.usage[mk] = { ...(settings.usage[mk] || {}), [k]: usedThisMonth(k) + 1 };
  saveSettings();
}
function canUse(k) { return isPlus() || usedThisMonth(k) < FREE[k]; }
// ---------- Notes de frais : 1 mois d'essai illimité, puis 5 tickets par mois ----------
function ndfTrialEnd() { if (!settings.ndfTrial) return null; const d = new Date(settings.ndfTrial + "T12:00:00"); d.setDate(d.getDate() + FREE.ndfTrialDays); return d.toISOString().slice(0, 10); }
function ndfInTrial() { const e = ndfTrialEnd(); return !e || todayISO() < e; }
function ndfCount(ym, exceptId) { return allItems().filter(x => x.type === "depense" && x.ndf && x.date && x.date.startsWith(ym) && x.id !== exceptId).length; }
function ndfAllowed(id, date) {
  if (isPlus() || ndfInTrial()) return true;
  const ym = date.slice(0, 7), prev = id && allItems().find(x => x.id === id);
  if (prev && prev.ndf && prev.date && prev.date.startsWith(ym)) return true;   // modifier une note existante reste possible
  return ndfCount(ym, id) < FREE.ndf;
}
function ndfQuotaHTML(ym) {
  if (isPlus()) return "";
  if (ndfInTrial()) { const e = ndfTrialEnd(); return `<div class="banner">${e ? `<span>Mois d'essai : notes de frais illimitées jusqu'au</span> <b>${esc(frDate(e))}</b>.` : `<span>Ton premier mois de notes de frais est illimité.</span>`} <span>Ensuite : ${FREE.ndf} tickets gratuits par mois.</span></div>`; }
  const n = ndfCount(ym || todayISO().slice(0, 7));
  return `<div class="banner"><span>Version gratuite :</span> <b class="num">${Math.min(n, FREE.ndf)} / ${FREE.ndf}</b> <span>tickets en note de frais ce mois-ci.</span> <button type="button" class="btn" id="ndfPlus" style="margin-left:6px">Illimité avec Plus</button></div>`;
}

// ---------- Écran « Bourselle Plus » ----------
function showPlus(feature) {
  const mine = plusState;
  const offers = OFFERS.map(o => `<div class="offer${o.best ? " best" : ""}">
      ${o.best ? `<span class="offer-tag">Le plus choisi</span>` : ""}
      <div class="offer-top"><b>${esc(o.name)}</b><span class="offer-price num">${esc(o.price)} <small>${esc(o.per)}</small></span></div>
      <div class="hint">${esc(o.note)}</div>
      <button type="button" class="btn ${o.best ? "primary" : ""}" data-buy="${o.id}">Choisir</button></div>`).join("");
  const f = openForm(`<div class="f2 plus-sheet"><h3>Bourselle Plus</h3>
    ${feature && PLUS_WHY[feature] ? `<div class="banner">${esc(PLUS_WHY[feature])}</div>` : ""}
    ${mine.ok ? `<p class="hint" style="margin:0">Ton offre : <b>${esc(PLAN_NAME[mine.plan] || "Plus")}</b>${mine.until ? `, valable jusqu'au ${esc(frDate(mine.until))}` : ""}. Merci pour ton soutien !</p>` : `<p class="hint" style="margin:0">Le budget au quotidien reste gratuit. Plus débloque les outils qui font gagner du temps.</p>`}
    <ul class="plus-list">${PLUS_LIST.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join("")}</ul>
    <div class="offers">${offers}</div>
    <p class="hint" id="buyMsg" role="status" style="margin:0"></p>
    <label class="lbl" for="plusCode">J'ai un code d'activation</label>
    <textarea class="field" id="plusCode" rows="3" placeholder="BRS1.…" spellcheck="false" autocapitalize="off"></textarea>
    <p class="hint" style="margin:0">Le code est envoyé par e-mail après le paiement. Il est lié à l'adresse de ton compte${myEmail() ? ` (${esc(myEmail())})` : ""}.</p>
    ${PLUS_CFG.api && PLUS_CFG.mail ? `<button type="button" class="btn" id="plusResend" style="align-self:flex-start">Je n'ai pas reçu mon code</button>` : ""}</div>`,
    () => {
      const code = val("plusCode");
      if (!code) return true;
      activateCode(code);
      return false;
    });
  const sub = f.querySelector("button[type=submit]"); sub.textContent = "Activer le code";
  f.querySelector("#f2Cancel").textContent = "Fermer";
  f.querySelectorAll("[data-buy]").forEach(b => b.onclick = () => buy(b.dataset.buy));
  const rs = f.querySelector("#plusResend"); if (rs) rs.onclick = () => resendCode(rs);
}
// Redemander son code : le serveur l'envoie à l'adresse du compte (jamais affiché ici).
async function resendCode(btn) {
  const em = myEmail(), msg = document.getElementById("buyMsg");
  if (!em) { if (msg) msg.textContent = "Connecte-toi avec le compte utilisé pour le paiement, puis réessaie."; return; }
  btn.disabled = true;
  try {
    const r = await fetch(PLUS_CFG.api.replace(/\/$/, "") + "/resend", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: em }) });
    if (!r.ok) throw new Error(r.status);
    if (msg) msg.textContent = `Si un achat est enregistré pour ${em}, le code vient d'être renvoyé à cette adresse. Pense à regarder dans les indésirables.`;
  } catch (e) { if (msg) msg.textContent = "Envoi impossible pour l'instant. Réessaie dans quelques minutes."; }
  setTimeout(() => { btn.disabled = false; }, 60000);
}
function buy(id) {
  const url = (PLUS_CFG.checkout || {})[id], msg = document.getElementById("buyMsg");
  const o = OFFERS.find(x => x.id === id);
  if (url) {
    let u = url;
    if (/stripe\.com/.test(u) && myEmail()) u += (u.includes("?") ? "&" : "?") + "prefilled_email=" + encodeURIComponent(myEmail());
    window.open(u, "_blank", "noopener");
    if (msg) msg.textContent = `Paiement ouvert dans un nouvel onglet. Ton code d'activation t'est envoyé par e-mail ensuite : colle-le ci-dessous.`;
    return;
  }
  const contact = PLUS_CFG.contact || "https://github.com/pataush/bourselle/issues";
  if (msg) msg.innerHTML = `Le paiement en ligne arrive très bientôt. Pour obtenir dès maintenant l'offre <b>${esc(o ? o.name : id)}</b>, <a href="${esc(contact)}" target="_blank" rel="noopener">contacte-nous</a> : tu recevras ton code d'activation.`;
}
async function activateCode(code) {
  const r = await verifyLicence(code);
  if (!r.ok) { toast(licenceError("format")); return; }
  const fit = licenceFits(r.p);
  if (!fit.ok) { toast(licenceError(fit.why, r.p)); return; }
  settings.licence = r.code; saveSettings();
  await refreshPlus();
  closeForm(); render();
  toast(`Bourselle Plus activé${plusState.until ? ` jusqu'au ${frDate(plusState.until)}` : ""}. Merci !`);
}

// ---------- Limites de la version gratuite ----------
{
  const _applyData = applyData;
  applyData = function (d) {
    _applyData(d);
    plusState = { ok: false };
    refreshPlus().then(ch => { if (ch && store) render(); });
  };
  document.getElementById("scanBtn").onclick = () => {
    if (!canUse("scan")) return showPlus("scan");
    document.getElementById("scanInput").click();
  };
  const _runScan = runScan;
  runScan = function (file) { if (!isPlus()) countUse("scan"); return _runScan(file); };
  const _startImport = startImport;
  startImport = function () { if (!canUse("import")) return showPlus("import"); return _startImport(); };
  const _reviewImport = reviewImport;
  reviewImport = function (rows, format, fname) {
    const r = _reviewImport(rows, format, fname);
    // Le relevé compte dans la limite gratuite seulement s'il est vraiment importé.
    const btn = document.querySelector("#sheet2 button[type=submit]");
    if (btn && !isPlus()) btn.addEventListener("click", () => { if (form2) countUse("import"); }, { once: true, capture: true });
    return r;
  };
  const _editTontine = editTontine;
  editTontine = function (id) { if (!id && !isPlus() && Object.keys(tontines).length >= FREE.tontines) return showPlus("tontines"); return _editTontine(id); };
  const _editGroup = editGroup;
  editGroup = function (id) { if (!id && !isPlus() && Object.keys(groups).length >= FREE.groups) return showPlus("groups"); return _editGroup(id); };
}

// ---------- Rappels avancés : agenda (.ics) et notifications ----------
function remindDays() { const v = Number(settings.remindDays); return v >= 0 && v <= 60 ? v : 3; }
function icsDate(iso) { return iso.replace(/-/g, ""); }
function icsText(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/[,;]/g, m => "\\" + m).replace(/\r?\n/g, "\\n"); }
function icsFold(line) {   // 75 octets maximum par ligne (UTF-8), suite précédée d'un espace
  const enc = new TextEncoder(), out = []; let curL = "", n = 0;
  for (const ch of line) { const b = enc.encode(ch).length; if (n + b > (out.length ? 74 : 75)) { out.push(curL); curL = ""; n = 0; } curL += ch; n += b; }
  out.push(curL); return out.join("\r\n ");
}
const RRULE = { semaine: "FREQ=WEEKLY", mois: "FREQ=MONTHLY", trimestre: "FREQ=MONTHLY;INTERVAL=3", semestre: "FREQ=MONTHLY;INTERVAL=6", an: "FREQ=YEARLY" };
function reminderEvents() {
  const ev = [];
  for (const x of garItems()) {
    if (daysUntil(x.warranty.end) < 0) continue;
    ev.push({ uid: "gar-" + x.id, date: x.warranty.end, title: `Fin de garantie : ${x.warranty.item || "article"}`, desc: [x.warranty.shop && "Magasin : " + x.warranty.shop, x.warranty.serial && "N° de série : " + x.warranty.serial, x.warranty.info].filter(Boolean).join("\n"), alarms: [warnDays(), 7] });
  }
  for (const [id, s] of Object.entries(subs)) {
    if (s.status === "resilie") continue;
    const nx = nextOcc(s);
    if (nx) ev.push({ uid: "abo-" + id, date: nx, rrule: RRULE[s.freq], title: `Prélèvement ${s.name} : ${eur(s.amount)}`, desc: s.note || "", alarms: [remindDays()] });
    if (s.engEnd && daysUntil(s.engEnd) >= 0) {
      const lim = s.preavis ? addDays(s.engEnd, -Number(s.preavis)) : s.engEnd;
      if (daysUntil(lim) >= 0) ev.push({ uid: "eng-" + id, date: lim, title: `${s.name} : dernier jour pour résilier`, desc: `Fin d'engagement le ${frDate(s.engEnd)}`, alarms: [7, 1] });
    }
  }
  for (const [id, t] of Object.entries(tontines)) {
    if (t.closed) continue;
    for (const r of tonRounds(t)) if (daysUntil(r.date) >= 0)
      ev.push({ uid: `ton-${id}-${r.k}`, date: r.date, title: `Tontine ${t.name} : cotisation ${typeof tm === "function" ? tm(t, dueOf(t, t.me)) : eur(t.amount)}${(r.m || [r.who]).includes(t.me) ? " · c'est ton tour de recevoir" : ""}`, desc: "", alarms: [remindDays()] });
  }
  return ev;
}
function buildICS() {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bourselle//Rappels//FR", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Bourselle"];
  for (const e of reminderEvents()) {
    L.push("BEGIN:VEVENT", `UID:${e.uid}@bourselle`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${icsDate(e.date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(e.date, 1))}`, icsFold(`SUMMARY:${icsText(window.T ? T(e.title) : e.title)}`));
    if (e.rrule) L.push(`RRULE:${e.rrule}`);
    if (e.desc) L.push(icsFold(`DESCRIPTION:${icsText(e.desc)}`));
    for (const d of [...new Set(e.alarms)].filter(d => d >= 0)) L.push("BEGIN:VALARM", "ACTION:DISPLAY", icsFold(`DESCRIPTION:${icsText(e.title)}`), `TRIGGER:-P${d}DT${d ? 0 : 9}H`.replace("-P0DT9H", "PT9H"), "END:VALARM");
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.join("\r\n") + "\r\n";
}
function dueSoon() {
  const n = remindDays(), out = [];
  for (const e of reminderEvents()) { const d = daysUntil(e.date); if (d >= 0 && d <= Math.max(n, e.uid.startsWith("gar-") ? 7 : n)) out.push(`${window.T ? T(e.title) : e.title} (${d === 0 ? "aujourd'hui" : d === 1 ? "demain" : "dans " + d + " jours"})`); }
  return out;
}
function notifyDue() {
  if (!isPlus() || !settings.notif || !("Notification" in window) || Notification.permission !== "granted") return;
  const key = "bourselle-notif-" + todayISO();
  try { if (localStorage.getItem(key)) return; } catch (e) {}
  const list = dueSoon(); if (!list.length) return;
  try { new Notification("Bourselle · à venir", { body: list.slice(0, 4).join("\n") + (list.length > 4 ? `\n+ ${list.length - 4} autre(s)` : ""), icon: "icons/icon-192.png", tag: "bourselle-due" }); localStorage.setItem(key, "1"); } catch (e) {}
}

// ---------- Exports comptables ----------
const nb = v => (Math.round((Number(v) || 0) * 100) / 100).toFixed(2).replace(".", ",");
function csvOut(rows) { return "\uFEFF" + rows.map(r => r.map(v => { v = String(v ?? ""); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(";")).join("\r\n"); }
function itemsOfYear(y) { return allItems().filter(x => x.date && x.date.startsWith(y + "-")).sort((a, b) => a.date.localeCompare(b.date) || (a.created || 0) - (b.created || 0)); }
function poste(x) { return x.type === "depense" ? catById(x.cat).name : x.cat || TYPE_LABEL[x.type]; }
function buildLedger(y) {
  const rows = [["Date", "Pièce", "Libellé", "Type", "Poste", "Débit (sortie)", "Crédit (entrée)", "Solde cumulé", "Justificatifs", "Note de frais", "Montant HT", "TVA", "Taux de TVA"].map(h => window.T ? T(h) : h)];
  let bal = 0, n = 0, deb = 0, cre = 0, vat = 0;
  for (const x of itemsOfYear(y)) {
    const a = Number(x.amount) || 0, inn = x.type === "rentree";
    bal += inn ? a : -a; if (inn) cre += a; else deb += a;
    rows.push([frDate(x.date), `${y}-${String(++n).padStart(4, "0")}`, x.note || poste(x), TYPE_LABEL[x.type] || x.type, poste(x), inn ? "" : nb(a), inn ? nb(a) : "", nb(bal), (x.files || []).length || "", x.ndf ? (x.ndfStatus === "rembourse" ? "Remboursée" : "À rembourser") : "",
      ...(x.vat ? (() => { const k = x.orig && x.vat.cur === x.orig.cur && x.orig.rate ? 1 / x.orig.rate : 1, v = x.vat.amount * k; vat += v; return [nb(a - v), nb(v), x.vat.rate != null ? nb(x.vat.rate) + " %" : (x.vat.rates || []).map(e => nb(e.rate) + " %").join(" + ")]; })() : ["", "", ""])]);
  }
  rows.push([], ["", "", "Totaux", "", "", nb(deb), nb(cre), nb(cre - deb), "", "", "", nb(vat), ""]);
  return csvOut(rows);
}
function buildSynthese(y) {
  const items = itemsOfYear(y), lines = new Map();
  for (const x of items) {
    const k = `${x.type}|${poste(x)}`;
    if (!lines.has(k)) lines.set(k, { type: x.type, name: poste(x), m: Array(12).fill(0) });
    lines.get(k).m[Number(x.date.slice(5, 7)) - 1] += Number(x.amount) || 0;
  }
  const head = (window.LANG === "en" ? ["Type", "Item", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Total"] : ["Type", "Poste", "janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc.", "Total"]), rows = [head];
  const tot = {};
  for (const t of ["rentree", "depense", "epargne", "invest"]) {
    const ls = [...lines.values()].filter(l => l.type === t).sort((a, b) => a.name.localeCompare(b.name, "fr"));
    if (!ls.length) continue;
    const sum = Array(12).fill(0);
    for (const l of ls) { l.m.forEach((v, i) => sum[i] += v); rows.push([TYPE_LABEL[t], l.name, ...l.m.map(nb), nb(l.m.reduce((s, v) => s + v, 0))]); }
    tot[t] = sum;
    rows.push(["", `Total ${TYPE_LABEL[t].toLowerCase()}`, ...sum.map(nb), nb(sum.reduce((s, v) => s + v, 0))], []);
  }
  const z = Array(12).fill(0), res = z.map((_, i) => (tot.rentree || z)[i] - (tot.depense || z)[i] - (tot.epargne || z)[i] - (tot.invest || z)[i]);
  rows.push(["", "Résultat (rentrées − sorties)", ...res.map(nb), nb(res.reduce((s, v) => s + v, 0))]);
  return csvOut(rows);
}

// ---------- Carte « Bourselle Plus » dans les Réglages ----------
function plusCardHTML() {
  const st = plusState, lock = isPlus() ? "" : ` <span class="plus-lock">Plus</span>`;
  const years = [...new Set(allItems().map(x => x.date.slice(0, 4)))].sort().reverse();
  if (!years.includes(String(cur.y))) years.unshift(String(cur.y));
  const status = st.ok
    ? `<div class="plus-status on"><b>Bourselle Plus · ${esc(PLAN_NAME[st.plan] || "Plus")}</b><span>${st.until ? `Valable jusqu'au ${esc(frDate(st.until))}` : "Sans date de fin"}${st.plan === "famille" && st.emails.length ? ` · ${st.emails.length} compte${st.emails.length > 1 ? "s" : ""}` : ""}</span></div>`
    : `<div class="plus-status"><b>Version gratuite</b><span>${settings.licence && st.why === "expired" ? "Ton abonnement Plus a expiré : renouvelle-le pour retrouver les outils Plus." : settings.licence && st.why === "email" ? "Ton code Plus est lié à un autre compte." : "Ce mois-ci :"}</span></div>
       <div class="plus-usage">
         <div><span>Scans de tickets</span><b class="num">${usedThisMonth("scan")} / ${FREE.scan}</b></div>
         <div><span>Imports de relevés</span><b class="num">${usedThisMonth("import")} / ${FREE.import}</b></div>
         <div><span>Tontines</span><b class="num">${Object.keys(tontines).length} / ${FREE.tontines}</b></div>
         <div><span>Groupes partagés</span><b class="num">${Object.keys(groups).length} / ${FREE.groups}</b></div>
         <div><span>Notes de frais ce mois-ci</span><b class="num">${ndfInTrial() ? "essai" : `${ndfCount(todayISO().slice(0, 7))} / ${FREE.ndf}`}</b></div></div>`;
  return `<div class="card plus-card"><h2>Bourselle Plus<small>${st.ok ? "activé" : "en option"}</small></h2>${status}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn ${st.ok ? "" : "primary"}" id="plusOpen">${st.ok ? "Mon offre" : "Découvrir Plus"}</button></div>
    <h3 class="plus-h">Rappels avancés${lock}</h3>
    <label class="hint" for="remindDays">Me prévenir ce nombre de jours avant chaque prélèvement et chaque cotisation de tontine :</label>
    <input class="field num" id="remindDays" inputmode="numeric" value="${remindDays()}" style="margin-top:6px;max-width:120px">
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" id="icsBtn">Ajouter à mon agenda</button><button class="btn" id="notifBtn">${settings.notif && "Notification" in window && Notification.permission === "granted" ? "Notifications activées ✓" : "Activer les notifications"}</button></div>
    <p class="hint">L'agenda (Google Agenda, Outlook, iPhone) reçoit les fins de garantie, les prélèvements, les dates limites de résiliation et les tours de tontine, avec une alerte. Les notifications s'affichent quand tu ouvres Bourselle.</p>
    <h3 class="plus-h">Exports comptables${lock}</h3>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><select class="field" id="cYear" style="max-width:110px" aria-label="Année">${years.map(y => `<option${y === String(cur.y) ? " selected" : ""}>${y}</option>`).join("")}</select>
      <button class="btn" id="ledgerBtn">Grand livre</button><button class="btn" id="syntheseBtn">Synthèse mensuelle</button></div>
    <p class="hint">Fichiers CSV pour Excel ou ton comptable : toutes les opérations avec solde cumulé, et les totaux par poste et par mois.</p></div>`;
}
function bindPlusCard() {
  const $ = id => document.getElementById(id);
  $("plusOpen").onclick = () => showPlus();
  $("remindDays").onchange = e => { const v = parseInt(e.target.value, 10); if (v >= 0 && v <= 60) { settings.remindDays = v; saveSettings(); } else e.target.value = remindDays(); };
  $("icsBtn").onclick = () => {
    if (!isPlus()) return showPlus("rappels");
    const n = reminderEvents().length;
    if (!n) { toast("Rien à ajouter pour l'instant : ajoute des garanties, des abonnements ou une tontine."); return; }
    saveFile("bourselle-rappels.ics", new Blob([buildICS()], { type: "text/calendar;charset=utf-8" }));
    toast(`${n} rappel${n > 1 ? "s" : ""} prêt${n > 1 ? "s" : ""} : ouvre le fichier pour les ajouter à ton agenda.`);
  };
  $("notifBtn").onclick = async () => {
    if (!isPlus()) return showPlus("rappels");
    if (!("Notification" in window)) { toast("Ce navigateur ne gère pas les notifications. Utilise plutôt « Ajouter à mon agenda »."); return; }
    const p = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (p !== "granted") { toast("Notifications refusées : tu peux les autoriser dans les réglages du navigateur."); return; }
    settings.notif = true; saveSettings(); render();
    try { localStorage.removeItem("bourselle-notif-" + todayISO()); } catch (e) {}
    notifyDue(); toast("Notifications activées");
  };
  $("ledgerBtn").onclick = () => { if (!isPlus()) return showPlus("compta"); const y = $("cYear").value; saveFile(`bourselle-grand-livre-${y}.csv`, buildLedger(y)); };
  $("syntheseBtn").onclick = () => { if (!isPlus()) return showPlus("compta"); const y = $("cYear").value; saveFile(`bourselle-synthese-${y}.csv`, buildSynthese(y)); };
}
{
  const _renderReglages = renderReglages;
  renderReglages = function () {
    _renderReglages();
    const first = view.querySelector(".card");
    if (first) { first.insertAdjacentHTML("afterend", plusCardHTML()); bindPlusCard(); }
  };
  const _render = render;
  let notified = false;
  render = function () { _render(); if (!notified && store && isPlus()) { notified = true; setTimeout(notifyDue, 1500); } };
}
// Les données ont pu être chargées avant ce fichier (mode démo) : on vérifie le code tout de suite aussi.
if (settings) refreshPlus().then(ch => { if (ch && store) render(); });
// Retour de la page de paiement (…/bourselle/?plus=merci) : on ouvre l'écran Plus pour coller le code reçu.
if (/[?&]plus=merci\b/.test(location.search)) {
  history.replaceState(null, "", location.pathname);
  setTimeout(() => { if (store) { showPlus(); const m = document.getElementById("buyMsg"); if (m) m.textContent = "Merci pour ton achat ! Ton code d'activation arrive par e-mail dans quelques minutes : colle-le ci-dessous."; } }, 1500);
}
