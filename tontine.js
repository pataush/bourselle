/* Bourselle — tontines complètes.
 * Types : rotative (le pot tourne), épargne commune (partagée à la fin), épargne + prêts aux membres.
 * Parts multiples (½, 1, 2…), ordre de passage (tirage, échanges, enchères), pénalités de retard,
 * frais de gestion, caisse de secours, suivi de chaque membre (relances WhatsApp, reçus),
 * bureau, séances avec compte-rendu, règlement intérieur, devise propre à chaque tontine.
 * Chargé après app.js : remplace les fonctions « tontine » de app.js. Les anciennes tontines sont reprises telles quelles. */

const TON_TYPES = [["rotative", "Rotative"], ["epargne", "Épargne commune"], ["pret", "Épargne + prêts"]];
const TON_TYPE_HINT = {
  rotative: "À chaque tour, un membre (ou deux demi-parts) reçoit tout le pot.",
  epargne: "Tout le monde cotise ; la cagnotte est partagée à la fin, au prorata des versements.",
  pret: "Tout le monde cotise ; la caisse prête aux membres avec intérêts, puis tout est partagé à la fin.",
};
const TON_CUR = APP_CURRENCIES;   // mêmes devises que le reste de l'app
const CFA_EUR = 655.957;                      // parité fixe franc CFA / euro
const ZERO_DEC = new Set(NO_CENTS);
const TON_ROLES = [["", "Membre"], ["president", "Président(e)"], ["tresorier", "Trésorier(e)"], ["secretaire", "Secrétaire"]];
const TON_PARTS = [[0.5, "½ part"], [1, "1 part"], [1.5, "1 part ½"], [2, "2 parts"], [3, "3 parts"]];
const roleName = r => (TON_ROLES.find(x => x[0] === r) || ["", ""])[1];
const tonView = {}, tonRound = {};

// ---------- Devises ----------
function baseCur() { return (settings && settings.currency) || "EUR"; }
function tcur(t) { return t.currency || baseCur(); }
function curFmt(c, v) {
  try { return new Intl.NumberFormat(appLocale(), { style: "currency", currency: c, minimumFractionDigits: ZERO_DEC.has(c) ? 0 : 2, maximumFractionDigits: ZERO_DEC.has(c) ? 0 : 2 }).format(v || 0); }
  catch (e) { return `${(v || 0).toLocaleString("fr-FR")} ${c}`; }
}
function tm(t, v) { return curFmt(tcur(t), v); }
// Nombre d'unités de la devise de la tontine pour 1 unité de la devise du budget.
function fixedRate(from, to) {
  if (typeof fxFixed === "function") return fxFixed(from, to);
  if (from === to) return 1;
  const cfa = c => c === "XOF" || c === "XAF";
  if (cfa(from) && cfa(to)) return 1;
  if (cfa(from) && to === "EUR") return CFA_EUR;
  if (from === "EUR" && cfa(to)) return 1 / CFA_EUR;
  return 0;
}
function tRate(t) { return fixedRate(tcur(t), baseCur()) || Number(t.rate) || 1; }
function toBase(t, v) { return Math.round((Number(v) || 0) / tRate(t) * 100) / 100; }
function tmB(t, v) { return tcur(t) === baseCur() ? tm(t, v) : `${tm(t, v)} <span class="hint">≈ ${esc(eur(toBase(t, v)))}</span>`; }

// ---------- Modèle ----------
function tnorm(t) {
  if (!t || t._v === 2) return t;
  if (t.trackAll == null) t.trackAll = false;   // anciennes tontines : seul mon suivi existait
  t.type = t.type || "rotative";
  t.currency = t.currency || "EUR";
  t.members = (t.members || []).map(m => ({ parts: 1, role: "", phone: "", ...m }));
  t.order = t.order && t.order.length ? t.order : t.members.map(m => m.id);
  t.pays = t.pays || {}; t.bids = t.bids || {}; t.caisseEv = t.caisseEv || []; t.meetings = t.meetings || []; t.loans = t.loans || [];
  t.fee = Number(t.fee) || 0; t.caisseContrib = Number(t.caisseContrib) || 0;
  t.penalty = t.penalty || { mode: "", value: 0, grace: 0 };
  t.periods = Number(t.periods) || t.members.length || 1;
  t._v = 2;
  return t;
}
const tmem = (t, mid) => t.members.find(m => m.id === mid) || { id: mid, name: "?", parts: 1 };
const mparts = (t, mid) => Number(tmem(t, mid).parts) || 1;
const totalParts = t => t.members.reduce((s, m) => s + (Number(m.parts) || 1), 0);
// L'ordre est une liste de « mains » (une entrée par part entière, et une pour une demi-part).
function mainsOf(members) {
  const full = [], half = [];
  for (const m of members) { const p = Number(m.parts) || 1; for (let i = 0; i < Math.floor(p); i++) full.push(m.id); if (p % 1) half.push(m.id); }
  return [...full, ...half];
}
function slotsOf(t) {
  const seen = {}, slots = []; let cur = null;
  for (const mid of t.order) {
    const p = mparts(t, mid), i = (seen[mid] = (seen[mid] || 0) + 1);
    const w = i <= Math.floor(p) ? 1 : 0.5;
    if (cur && cur.w < 0.999 && cur.w + w <= 1.0001) { cur.m.push(mid); cur.sh.push(w); cur.w += w; }
    else { cur = { m: [mid], sh: [w], w }; slots.push(cur); }
  }
  return slots;
}
function syncOrder(t) {   // garde l'ordre existant, ajuste au nombre de parts de chacun
  const want = {}; for (const m of t.members) { const p = Number(m.parts) || 1; want[m.id] = Math.floor(p) + (p % 1 ? 1 : 0); }
  const count = {}, out = [];
  for (const mid of t.order || []) if (want[mid] && (count[mid] = (count[mid] || 0) + 1) <= want[mid]) out.push(mid);
  for (const mid of mainsOf(t.members)) { const have = out.filter(x => x === mid).length; if (have < want[mid]) out.push(mid); }
  t.order = out;
}
tonRounds = function (t) {
  tnorm(t);
  const out = []; let d = t.start;
  if (t.type === "rotative") slotsOf(t).forEach((s, k) => { out.push({ k, date: d, who: s.m[0], m: s.m, sh: s.sh }); d = advance(d, t.freq); });
  else for (let k = 0; k < (Number(t.periods) || 1); k++) { out.push({ k, date: d, who: null, m: [], sh: [] }); d = advance(d, t.freq); }
  return out;
};
tonPot = function (t) { tnorm(t); return (Number(t.amount) || 0) * totalParts(t); };
tonMember = function (t, mid) { return tmem(t, mid).name; };
const cotOf = (t, mid) => (Number(t.amount) || 0) * mparts(t, mid);
const dueOf = (t, mid) => cotOf(t, mid) + (Number(t.fee) || 0) + (Number(t.caisseContrib) || 0);
function potFor(t, r, mid) {   // ce que reçoit ce membre à ce tour (rotative), enchère déduite
  const i = r.m.indexOf(mid); if (i < 0) return 0;
  const net = tonPot(t) - (Number(t.bids[r.k] && t.bids[r.k].amount) || 0);
  return Math.round(net * r.sh[i] * 100) / 100;
}
function penaltyFor(t, r, mid, payDate) {
  const p = t.penalty || {}; if (!p.mode || !(Number(p.value) > 0)) return 0;
  if (!payDate || payDate <= addDays(r.date, Number(p.grace) || 0)) return 0;
  return p.mode === "pct" ? Math.round(cotOf(t, mid) * Number(p.value)) / 100 : Number(p.value);
}
const myTx = (id, k, type) => allItems().find(x => x.tontine === id && x.round === k && x.type === type);
function payRec(id, t, k, mid) {
  const p = t.pays[k + ":" + mid]; if (p) return p;
  if (mid === t.me) { const x = myTx(id, k, "epargne"); if (x) return { date: x.date, amount: dueOf(t, mid), pen: 0, budget: true }; }
  return null;
}
tonPaid = function (id, k) { const t = tontines[id]; return !!(t && payRec(id, tnorm(t), k, t.me)); };
tonReceived = function (id, k) { return !!myTx(id, k, "rentree"); };
function addMyTx(id, t, k, kind, date, amt) {
  const pre = { pay: "tn-", pot: "tp-", fin: "tf-", loan: "tl-", rep: "tr-" }[kind], tid = pre + id + "-" + k;
  if (allItems().some(x => x.id === tid)) return false;
  const key = date.slice(0, 7), cur = tcur(t) !== baseCur() ? ` (${tm(t, amt)})` : "", tour = t.type === "rotative" ? "tour" : "période";
  const base = { amount: toBase(t, amt), date, tontine: id, round: typeof k === "number" ? k : -2, created: Date.now() };
  const tx = kind === "pay" ? { ...base, type: "epargne", cat: "Tontine", note: `Tontine ${t.name} – cotisation ${tour} ${k + 1}${cur}` }
    : kind === "pot" ? { ...base, type: "rentree", cat: "Tontine", note: `Tontine ${t.name} – pot reçu (tour ${k + 1})${cur}` }
    : kind === "fin" ? { ...base, type: "rentree", cat: "Tontine", note: `Tontine ${t.name} – ma part finale${cur}` }
    : kind === "loan" ? { ...base, type: "rentree", cat: "Tontine", note: `Tontine ${t.name} – prêt reçu${cur}` }
    : { ...base, type: "depense", cat: "credits", note: `Tontine ${t.name} – remboursement de prêt${cur}` };
  months[key] = months[key] || { items: {} };
  months[key].items[tid] = tx; saveMonth(key);
  return true;
}
function setPaid(id, t, k, mid, date, pen) {
  const r = tonRounds(t)[k]; date = date || todayISO();
  const p = pen != null ? pen : penaltyFor(t, r, mid, date);
  t.n = (t.n || 0) + 1;
  t.pays[k + ":" + mid] = { date, amount: dueOf(t, mid), pen: p, n: t.n };
  if (mid === t.me) { addMyTx(id, t, k, "pay", date, dueOf(t, mid) + p); t.skipped = (t.skipped || []).filter(x => x !== k); }
  saveTontines();
}
function unsetPaid(id, t, k, mid) {
  delete t.pays[k + ":" + mid];
  if (mid === t.me) { tonRemoveTx(id, k, "epargne"); t.skipped = Array.from(new Set([...(t.skipped || []), k])); }
  saveTontines();
}

// ---------- Calculs ----------
function lateList(id, t) {   // cotisations en retard de tous les membres
  const today = todayISO(), out = [], grace = Number(t.penalty && t.penalty.grace) || 0;
  for (const r of tonRounds(t)) {
    if (addDays(r.date, grace) >= today) break;
    for (const m of t.members) if ((t.trackAll || m.id === t.me) && !payRec(id, t, r.k, m.id) && !(m.id === t.me && (t.skipped || []).includes(r.k))) out.push({ r, m, due: dueOf(t, m.id) + penaltyFor(t, r, m.id, today) });
  }
  return out;
}
function caisseOf(id, t) {
  const lines = []; let bal = 0;
  const add = (date, label, v) => { lines.push({ date, label, v }); bal += v; };
  let fees = 0, cc = 0, pens = 0;
  for (const r of tonRounds(t)) for (const m of t.members) { const p = payRec(id, t, r.k, m.id); if (!p) continue; fees += Number(t.fee) || 0; cc += Number(t.caisseContrib) || 0; pens += Number(p.pen) || 0; }
  if (fees) add("", "Frais de gestion encaissés", fees);
  if (cc) add("", "Cotisations à la caisse de secours", cc);
  if (pens) add("", "Pénalités de retard", pens);
  for (const [k, b] of Object.entries(t.bids || {})) if (Number(b.amount) > 0) add(tonRounds(t)[k] ? tonRounds(t)[k].date : "", `Enchère du tour ${Number(k) + 1}`, Number(b.amount));
  for (const e of t.caisseEv) add(e.date, `${e.kind === "in" ? "Entrée" : "Sortie"} · ${e.label}${e.mid ? " (" + tmem(t, e.mid).name + ")" : ""}`, e.kind === "in" ? Number(e.amount) : -Number(e.amount));
  return { bal: Math.round(bal * 100) / 100, lines };
}
const loanDue = l => Math.round(Number(l.amount) * (1 + (Number(l.rate) || 0) / 100) * 100) / 100;
const loanPaid = l => (l.repaid || []).reduce((s, x) => s + Number(x.amount), 0);
function fundOf(id, t) {   // épargne commune / prêts : cagnotte et parts de chacun
  const cot = {}; let tot = 0;
  for (const r of tonRounds(t)) for (const m of t.members) { const p = payRec(id, t, r.k, m.id); if (p) { const v = cotOf(t, m.id); cot[m.id] = (cot[m.id] || 0) + v; tot += v; } }
  const lent = t.loans.reduce((s, l) => s + Number(l.amount), 0), back = t.loans.reduce((s, l) => s + loanPaid(l), 0);
  const interest = t.loans.reduce((s, l) => s + Math.max(0, loanPaid(l) - Number(l.amount)), 0);
  const cash = tot - lent + back, value = tot + interest;   // valeur = cotisations + intérêts déjà encaissés
  const share = mid => tot ? Math.round(value * (cot[mid] || 0) / tot * 100) / 100 : 0;
  return { cot, tot, lent, back, interest, cash, value, share, out: t.loans.reduce((s, l) => s + Math.max(0, loanDue(l) - loanPaid(l)), 0) };
}
tonState = function (id, t) {
  tnorm(t);
  const today = todayISO(), rounds = tonRounds(t), last = rounds[rounds.length - 1];
  const cur = rounds.find(r => r.date >= today) || null;
  const unpaid = rounds.filter(r => r.date <= today && !payRec(id, t, r.k, t.me) && !(t.skipped || []).includes(r.k));
  const mineAll = t.type === "rotative" ? rounds.filter(r => r.m.includes(t.me)) : [];
  const mine = mineAll.find(r => !tonReceived(id, r.k)) || mineAll[mineAll.length - 1] || null;
  const paid = rounds.filter(r => payRec(id, t, r.k, t.me));
  const contributed = paid.reduce((s, r) => { const p = payRec(id, t, r.k, t.me); return s + (Number(p.amount) || 0) + (Number(p.pen) || 0); }, 0);
  let received = mineAll.filter(r => tonReceived(id, r.k)).reduce((s, r) => s + potFor(t, r, t.me), 0);
  if (t.type !== "rotative" && myTx(id, -1, "rentree")) received += fundOf(id, t).share(t.me);
  const ended = last && last.date < today;
  const done = t.closed || (ended && unpaid.length === 0 && (t.type !== "rotative" ? !!myTx(id, -1, "rentree") : mineAll.every(r => tonReceived(id, r.k))));
  return { rounds, cur, done, ended, unpaid, mine, mineAll, paidN: paid.length, contributed, received };
};
tontineAlerts = function () {
  let n = 0;
  for (const [id, t] of Object.entries(tontines)) { if (tnorm(t).closed) continue; const s = tonState(id, t); if (s.unpaid.length || (s.mine && !tonReceived(id, s.mine.k) && daysUntil(s.mine.date) <= 7 && daysUntil(s.mine.date) >= -30)) n++; }
  return n;
};
applyTontines = function () {
  let n = 0; const today = todayISO();
  for (const [id, t] of Object.entries(tontines)) {
    tnorm(t); if (!t.auto || t.closed || !t.me) continue;
    for (const r of tonRounds(t)) {
      if (r.date > today) break;
      if (!payRec(id, t, r.k, t.me) && !(t.skipped || []).includes(r.k)) { setPaid(id, t, r.k, t.me, r.date, 0); n++; }
      if (r.m.includes(t.me) && !tonReceived(id, r.k)) n += addMyTx(id, t, r.k, "pot", r.date, potFor(t, r, t.me)) ? 1 : 0;
    }
  }
  return n;
};
tontineUpcoming = function (today, key) {
  const up = [];
  for (const [id, t] of Object.entries(tontines)) {
    if (tnorm(t).closed) continue;
    const rounds = tonRounds(t);
    for (const r of rounds) {
      if (r.date.slice(0, 7) !== key) continue;
      if (!payRec(id, t, r.k, t.me) && !(t.skipped || []).includes(r.k)) up.push({ date: r.date, name: `Tontine ${t.name}`, amount: toBase(t, dueOf(t, t.me)), type: "epargne", src: r.date <= today ? "Cotisation à payer" : "Cotisation" });
      if (r.m.includes(t.me) && !tonReceived(id, r.k)) up.push({ date: r.date, name: `Pot de la tontine ${t.name}`, amount: toBase(t, potFor(t, r, t.me)), type: "rentree", src: "Ton tour" });
    }
    const last = rounds[rounds.length - 1];
    if (t.type !== "rotative" && last && last.date.slice(0, 7) === key && !myTx(id, -1, "rentree"))
      up.push({ date: last.date, name: `Part finale · ${t.name}`, amount: toBase(t, fundOf(id, t).share(t.me) + cotOf(t, t.me) * rounds.filter(r => !payRec(id, t, r.k, t.me)).length), type: "rentree", src: "Fin de la tontine" });
  }
  return up;
};
tontineMoisHTML = function () {
  const items = [];
  for (const [id, t] of Object.entries(tontines)) {
    if (tnorm(t).closed) continue; const s = tonState(id, t);
    if (s.unpaid.length) items.push(`${esc(t.name)} : ${s.unpaid.length} cotisation${s.unpaid.length > 1 ? "s" : ""} à payer`);
    if (s.mine && !tonReceived(id, s.mine.k) && daysUntil(s.mine.date) >= -30 && daysUntil(s.mine.date) <= warnDays()) items.push(`${esc(t.name)} : tu reçois ${tm(t, potFor(t, s.mine, t.me))} le ${esc(frDate(s.mine.date))}`);
    const late = lateList(id, t).filter(x => x.m.id !== t.me).length;
    if (late && isOrganizer(t)) items.push(`${esc(t.name)} : ${late} cotisation${late > 1 ? "s" : ""} de membres en retard`);
  }
  return items.length ? `<button class="card" id="goTon" style="text-align:left;width:100%;cursor:pointer;border-left:6px solid #2f6fb0"><h2>Tontines<small>${items.length}</small></h2><div class="hint">${items.slice(0, 3).join("<br>")}</div></button>` : "";
};
const isOrganizer = t => ["president", "tresorier", "secretaire"].includes(tmem(t, t.me).role);

// ---------- Messages (WhatsApp, reçus) ----------
function waLink(phone, text) { const d = String(phone || "").replace(/[^\d]/g, "").replace(/^00/, ""); return `https://wa.me/${d}?text=${encodeURIComponent(text)}`; }
const TT = x => (window.T ? window.T(x) : x);
function relanceText(t, r, m, due) { return TT(`Bonjour ${m.name}, petit rappel : ta cotisation de ${tm(t, due)} pour la tontine « ${t.name} » (${t.type === "rotative" ? "tour" : "période"} ${r.k + 1}, le ${frDate(r.date)}) n'est pas encore réglée. Merci !`); }
function receiptText(t, r, m, p) {
  const tres = t.members.find(x => x.role === "tresorier");
  return TT(`REÇU n° ${p.n || "—"}\nTontine « ${t.name} »\n${m.name} a versé ${tm(t, Number(p.amount) + Number(p.pen || 0))}${p.pen ? ` (dont ${tm(t, p.pen)} de pénalité)` : ""} le ${frDate(p.date)}\npour le ${t.type === "rotative" ? "tour" : "période"} ${r.k + 1} du ${frDate(r.date)}.${tres ? `\nTrésorier(e) : ${tres.name}` : ""}`);
}
async function shareText(text, title) {
  try { if (navigator.share) { await navigator.share({ title, text }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(text); toast("Texte copié : colle-le dans ta messagerie"); } catch (e) { toast("Partage impossible ici"); }
}
function printDoc(title, body) {
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body{font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#16324a;margin:28px}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:18px 0 6px;border-bottom:1px solid #dfe5ea;padding-bottom:3px}
    table{border-collapse:collapse;width:100%;font-size:12.5px}td,th{border:1px solid #dfe5ea;padding:5px 6px;text-align:left}th{background:#f3f5f7}.m{color:#6b7c8c;font-size:12px}pre{white-space:pre-wrap;font:inherit}
    @media print{button{display:none}}</style></head><body><button onclick="print()" style="float:right;padding:8px 14px">Imprimer / PDF</button>${body}
    <p class="m" style="margin-top:24px">Document généré par Bourselle le ${esc(frDate(todayISO()))}.</p></body></html>`;
  const w = window.open("", "_blank");
  const out = window.i18nHTML ? i18nHTML(html) : html;
  if (w) { w.document.open(); w.document.write(out); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 400); }
  else saveFile(`${title.replace(/[^\w\-]+/g, "-")}.html`, new Blob([out], { type: "text/html" }));
}

// ---------- Écran Tontines ----------
renderTontines = function () {
  const list = Object.entries(tontines).map(([id, t]) => ({ id, t: tnorm(t), s: tonState(id, t) }));
  const next = list.filter(x => !x.t.closed && x.s.mine && !tonReceived(x.id, x.s.mine.k) && x.s.mine.date >= todayISO()).sort((a, b) => a.s.mine.date.localeCompare(b.s.mine.date))[0];
  document.getElementById("periodLabel").textContent = "Tontines";
  document.getElementById("resCap").textContent = next ? `Ton prochain pot · ${next.t.name}` : "Tontines en cours";
  const big = document.getElementById("resBig"); big.className = "big num";
  big.textContent = next ? tm(next.t, potFor(next.t, next.s.mine, next.t.me)) : String(list.filter(x => !x.s.done).length);
  document.getElementById("resPill").innerHTML = next ? `<span class="pill" style="background:rgba(255,255,255,.15);color:#fff">le ${esc(frDate(next.s.mine.date))} · ${esc(leftTxt(daysUntil(next.s.mine.date)))}</span>` : "";
  let html = banner;
  if (!list.length) html += `<div class="card"><div class="empty">Aucune tontine.<br>Appuie sur + pour suivre une tontine (aussi appelée Drewo, Hagbad, Susu, Njangi…) : rotative, épargne commune ou avec prêts aux membres.</div></div>`;
  for (const { id, t, s } of list.sort((a, b) => a.s.done - b.s.done)) html += tonCardHTML(id, t, s);
  html += `<p class="hint" style="text-align:center;margin:4px 0 0">Tes cotisations comptent comme de l'épargne et ce que tu reçois comme une rentrée${baseCur() ? ", convertis dans la devise de ton budget" : ""} : la tontine apparaît dans ton budget et ta prévision de fin de mois.</p>`;
  view.innerHTML = html;
  bindTontines();
};
function tonCardHTML(id, t, s) {
  const rot = t.type === "rotative", N = s.rounds.length, pot = tonPot(t);
  const late = lateList(id, t), lateOthers = late.filter(x => x.m.id !== t.me);
  const cls = s.done ? "off" : s.unpaid.length || lateOthers.length ? "soon" : "";
  const v = tonView[id] || "";
  const tabs = [["tours", rot ? "Tours" : "Périodes"], ["membres", `Membres${lateOthers.length ? ` (${lateOthers.length} retard${lateOthers.length > 1 ? "s" : ""})` : ""}`], ["caisse", "Caisse"]];
  if (t.type === "pret") tabs.push(["prets", "Prêts"]);
  if (!rot) tabs.push(["partage", "Partage final"]);
  tabs.push(["seances", "Séances"], ["reglement", "Règlement"]);
  const f = !rot ? fundOf(id, t) : null;
  let sum = "";
  if (rot) {
    const c = s.cur;
    sum = `${t.members.length} membres · ${N} tours · pot de ${tm(t, pot)}
      ${c && !s.done ? `<br>Prochain tour (${c.k + 1}/${N}) le ${esc(frDate(c.date))} : <b>${c.m.map(mid => esc(tmem(t, mid).name) + (mid === t.me ? " (toi)" : "")).join(" + ")}</b>${t.bids[c.k] ? ` · enchère ${tm(t, t.bids[c.k].amount)}` : ""}` : ""}
      ${s.mine ? `<br>${tonReceived(id, s.mine.k) ? `Tu as reçu ${tm(t, potFor(t, s.mine, t.me))} le ${esc(frDate(s.mine.date))}` : `<b>Ton tour : n°${s.mine.k + 1}, le ${esc(frDate(s.mine.date))}</b> (${esc(leftTxt(daysUntil(s.mine.date)))}) · ${tm(t, potFor(t, s.mine, t.me))}`}` : ""}`;
  } else {
    sum = `${t.members.length} membres · ${N} périodes · cagnotte ${tm(t, f.value)}${t.type === "pret" ? ` (dont ${tm(t, f.out)} prêtés en cours)` : ""}
      <br>Ta part estimée : <b>${tm(t, f.share(t.me))}</b> · fin le ${esc(frDate(s.rounds[N - 1].date))}`;
  }
  const bal = s.received - s.contributed;
  return `<div class="gar ${cls}" style="${cls ? "" : "border-left-color:#2f6fb0"}">
    <div class="top"><span class="n">${esc(t.name)}</span><span class="st" style="${cls ? "" : "background:#2f6fb0"}">${s.done ? "Terminée" : s.unpaid.length ? "Cotisation à payer" : lateOthers.length ? "Retards" : "En cours"}</span></div>
    <div class="top"><span class="amt num">${tm(t, dueOf(t, t.me))} <small class="hint">/ ${TON_UNIT[t.freq]}</small></span><span class="hint">${esc((TON_TYPES.find(x => x[0] === t.type) || [, ""])[1])}${tcur(t) !== baseCur() ? " · " + esc(tcur(t)) : ""}</span></div>
    <div class="bar"><i style="width:${N ? s.paidN / N * 100 : 0}%;background:#2f6fb0"></i></div>
    <div class="s">${sum}
      <br>Versé ${tmB(t, s.contributed)} · reçu ${tm(t, s.received)}${rot ? ` → ${bal > 0.004 ? `tu as reçu ${tm(t, bal)} d'avance` : bal < -0.004 ? `${tm(t, -bal)} t'attendent` : "équilibré"}` : ""}
      ${s.unpaid.length ? `<br><b style="color:var(--bad)">${s.unpaid.length} de tes cotisations en retard</b>` : ""}</div>
    <div class="acts">
      ${!s.done && (s.unpaid[0] || (s.cur && !payRec(id, t, s.cur.k, t.me))) ? `<button class="btn primary" data-ta="pay" data-id="${esc(id)}">Payer ma cotisation</button>` : ""}
      ${rot && s.mine && !tonReceived(id, s.mine.k) && daysUntil(s.mine.date) <= 7 ? `<button class="btn primary" data-ta="pot" data-id="${esc(id)}">J'ai reçu le pot</button>` : ""}
      ${!rot && s.ended && !myTx(id, -1, "rentree") ? `<button class="btn primary" data-ta="fin" data-id="${esc(id)}">J'ai reçu ma part</button>` : ""}
      <button class="btn" data-ta="edit" data-id="${esc(id)}">Modifier</button></div>
    <div class="chips ton-tabs">${tabs.map(([k, l]) => `<button class="chip" data-tv="${esc(id)}:${k}" aria-pressed="${v === k}">${esc(l)}</button>`).join("")}</div>
    ${v ? `<div class="ton-panel">${tonPanelHTML(id, t, s, v)}</div>` : ""}
  </div>`;
}
function tonPanelHTML(id, t, s, v) {
  const today = todayISO(), rot = t.type === "rotative";
  if (v === "tours") {
    return `<div class="fc-list">${s.rounds.map(r => {
      const nPaid = t.members.filter(m => payRec(id, t, r.k, m.id)).length, mineP = payRec(id, t, r.k, t.me);
      const who = rot ? r.m.map((mid, i) => `${esc(tmem(t, mid).name)}${r.sh[i] < 1 ? " (½)" : ""}${mid === t.me ? " (toi)" : ""}`).join(" + ") : "";
      return `<div class="fc-it ton-row"><span>${r.k + 1}</span><span class="num">${esc(frDate(r.date))}</span>
        <span>${rot ? `<b style="${r.m.includes(t.me) ? "" : "font-weight:500"}">${who}</b>${r.m.includes(t.me) && tonReceived(id, r.k) ? " ✓ reçu" : ""}${t.bids[r.k] ? `<br><small class="hint">Enchère ${tm(t, t.bids[r.k].amount)} → caisse</small>` : ""}<br>` : ""}<small class="hint">${nPaid}/${t.members.length} ont cotisé</small></span>
        <span class="ton-btns"><button class="chip" data-tp="${esc(id)}:${r.k}" aria-pressed="${!!mineP}">${mineP ? "Cotisé ✓" : r.date <= today ? "À payer" : "À venir"}</button>
        ${rot && r.date >= today ? `<button class="chip" data-tx="${esc(id)}:${r.k}:swap">Échanger</button><button class="chip" data-tx="${esc(id)}:${r.k}:bid">Enchère</button>` : ""}</span></div>`;
    }).join("")}</div>`;
  }
  if (v === "membres") {
    const rounds = s.rounds, late = lateList(id, t);
    const def = ((late[0] && late[0].r) || s.unpaid[0] || rounds.find(r => r.date >= today) || rounds[rounds.length - 1]).k;
    const k = tonRound[id] != null ? tonRound[id] : def, r = rounds[k];
    const tot = mid => rounds.reduce((a, rr) => { const p = payRec(id, t, rr.k, mid); return p ? a + Number(p.amount) + Number(p.pen || 0) : a; }, 0);
    return `<div class="ton-round"><button class="chip" data-tr="${esc(id)}:${k - 1}" ${k <= 0 ? "disabled" : ""}>‹</button><b>${rot ? "Tour" : "Période"} ${k + 1}/${rounds.length} · ${esc(frDate(r.date))}</b><button class="chip" data-tr="${esc(id)}:${k + 1}" ${k >= rounds.length - 1 ? "disabled" : ""}>›</button></div>
      <div class="fc-list">${t.members.map(m => {
        const p = payRec(id, t, k, m.id), isLate = !p && addDays(r.date, Number(t.penalty.grace) || 0) < today;
        return `<div class="fc-it ton-mem"><span><b>${esc(m.name)}${m.id === t.me ? " (toi)" : ""}</b>${m.role ? ` <span class="ton-role">${esc(roleName(m.role))}</span>` : ""}${m.parts !== 1 ? ` <small class="hint">${esc((TON_PARTS.find(x => x[0] === Number(m.parts)) || [, m.parts + " parts"])[1])}</small>` : ""}
          <br><small class="hint">${p ? `Payé ${tm(t, Number(p.amount) + Number(p.pen || 0))} le ${esc(frDate(p.date))}${p.pen ? ` (pénalité ${tm(t, p.pen)})` : ""}` : `${tm(t, dueOf(t, m.id))} ${isLate ? `<b style="color:var(--bad)">en retard</b>` : "à verser"}`} · total versé ${tm(t, tot(m.id))}</small></span>
          <span class="ton-btns">${p ? `<button class="chip" data-tm="${esc(id)}:${k}:${m.id}:receipt">Reçu</button><button class="chip" data-tm="${esc(id)}:${k}:${m.id}:undo">Annuler</button>`
            : `<button class="chip" aria-pressed="true" data-tm="${esc(id)}:${k}:${m.id}:pay">Payé</button>${isLate && m.id !== t.me ? `<a class="chip" target="_blank" rel="noopener" href="${esc(waLink(m.phone, relanceText(t, r, m, dueOf(t, m.id) + penaltyFor(t, r, m.id, today))))}">Relancer</a>` : ""}`}</span></div>`;
      }).join("")}</div>
      ${late.length ? `<div class="banner" style="margin-top:8px">${late.length} cotisation${late.length > 1 ? "s" : ""} en retard au total, pour ${tm(t, late.reduce((a, x) => a + x.due, 0))} (pénalités comprises).</div>
        <div class="acts" style="margin-top:6px"><button class="btn" data-ta="relall" data-id="${esc(id)}">Relancer tous les retards</button></div>` : ""}`;
  }
  if (v === "caisse") {
    const c = caisseOf(id, t);
    return `<div class="ton-kpi"><span>Solde de la caisse</span><b class="num">${tm(t, c.bal)}</b></div>
      <p class="hint" style="margin:4px 0">Frais : ${tm(t, t.fee)} / membre / ${TON_UNIT[t.freq]} · caisse de secours : ${tm(t, t.caisseContrib)} / membre · pénalité : ${t.penalty.mode ? (t.penalty.mode === "pct" ? t.penalty.value + " %" : tm(t, t.penalty.value)) + (t.penalty.grace ? ` après ${t.penalty.grace} j de délai` : "") : "aucune"}</p>
      <div class="fc-list">${c.lines.length ? c.lines.map(l => `<div class="fc-it" style="grid-template-columns:80px 1fr auto"><span class="num">${esc(l.date ? frDate(l.date) : "")}</span><span>${esc(l.label)}</span><b class="num" style="color:${l.v < 0 ? "var(--bad)" : "var(--good)"}">${l.v < 0 ? "−" : "+"} ${tm(t, Math.abs(l.v))}</b></div>`).join("") : `<p class="hint">Rien pour l'instant.</p>`}</div>
      <div class="acts" style="margin-top:8px"><button class="btn" data-ta="caisseOut" data-id="${esc(id)}">Aide / dépense</button><button class="btn" data-ta="caisseIn" data-id="${esc(id)}">Entrée (don…)</button></div>`;
  }
  if (v === "prets") {
    const f = fundOf(id, t);
    return `<div class="ton-kpi"><span>Disponible dans la caisse</span><b class="num">${tm(t, f.cash)}</b></div>
      <p class="hint" style="margin:4px 0">Cotisations ${tm(t, f.tot)} · prêté ${tm(t, f.lent)} · remboursé ${tm(t, f.back)} · intérêts gagnés ${tm(t, f.interest)}</p>
      <div class="fc-list">${t.loans.length ? t.loans.map(l => { const left = Math.max(0, loanDue(l) - loanPaid(l)); return `<div class="fc-it ton-mem"><span><b>${esc(tmem(t, l.mid).name)}</b> · ${tm(t, l.amount)} à ${esc(String(l.rate || 0).replace(".", ","))} %<br><small class="hint">Prêté le ${esc(frDate(l.date))}${l.due ? `, à rendre le ${esc(frDate(l.due))}` : ""} · ${left > 0.004 ? `reste ${tm(t, left)} sur ${tm(t, loanDue(l))}` : "remboursé ✓"}${left > 0.004 && l.due && l.due < today ? ` · <b style="color:var(--bad)">en retard</b>` : ""}</small></span>
        <span class="ton-btns">${left > 0.004 ? `<button class="chip" data-tl="${esc(id)}:${l.id}">Remboursement</button>` : ""}</span></div>`; }).join("") : `<p class="hint">Aucun prêt.</p>`}</div>
      <div class="acts" style="margin-top:8px"><button class="btn" data-ta="loan" data-id="${esc(id)}">Nouveau prêt</button></div>`;
  }
  if (v === "partage") {
    const f = fundOf(id, t);
    return `<p class="hint" style="margin:0 0 6px">À la fin, la cagnotte (${tm(t, f.value)}${t.type === "pret" ? ", intérêts compris" : ""}) est partagée au prorata de ce que chacun a versé. Montants à ce jour :</p>
      <div class="fc-list">${t.members.map(m => `<div class="fc-it" style="grid-template-columns:1fr auto auto"><span>${esc(m.name)}${m.id === t.me ? " (toi)" : ""}</span><span class="hint num">versé ${tm(t, f.cot[m.id] || 0)}</span><b class="num">${tm(t, f.share(m.id))}</b></div>`).join("")}</div>
      ${t.type === "pret" && f.out > 0.004 ? `<div class="banner" style="margin-top:8px">${tm(t, f.out)} de prêts restent à rembourser avant le partage.</div>` : ""}`;
  }
  if (v === "seances") {
    const bureau = t.members.filter(m => m.role);
    return `<p class="hint" style="margin:0 0 6px"><b>Bureau :</b> ${bureau.length ? bureau.map(m => `${esc(roleName(m.role))} ${esc(m.name)}`).join(" · ") : "pas encore désigné (Modifier › membres)"}</p>
      <div class="fc-list">${t.meetings.length ? t.meetings.slice().sort((a, b) => b.date.localeCompare(a.date)).map(mt => `<div class="fc-it ton-mem"><span><b>Séance du ${esc(frDate(mt.date))}</b>${mt.k != null && mt.k !== "" ? ` · ${rot ? "tour" : "période"} ${Number(mt.k) + 1}` : ""}<br><small class="hint">${(mt.present || []).length}/${t.members.length} présents${mt.notes ? " · " + esc(mt.notes.slice(0, 60)) + (mt.notes.length > 60 ? "…" : "") : ""}</small></span>
        <span class="ton-btns"><button class="chip" data-ts="${esc(id)}:${mt.id}:pdf">Compte-rendu</button><button class="chip" data-ts="${esc(id)}:${mt.id}:edit">Modifier</button></span></div>`).join("") : `<p class="hint">Aucune séance enregistrée.</p>`}</div>
      <div class="acts" style="margin-top:8px"><button class="btn" data-ta="meet" data-id="${esc(id)}">Nouvelle séance</button><button class="btn" data-ta="bilan" data-id="${esc(id)}">Bilan complet (PDF)</button></div>`;
  }
  if (v === "reglement") {
    return `<textarea class="field" id="tnRules-${esc(id)}" rows="10" placeholder="Règles de la tontine : montant, date limite, pénalités, que faire en cas de départ…">${esc(t.rules || "")}</textarea>
      <div class="acts" style="margin-top:8px"><button class="btn primary" data-ta="rulesSave" data-id="${esc(id)}">Enregistrer</button><button class="btn" data-ta="rulesTpl" data-id="${esc(id)}">Proposer un modèle</button><button class="btn" data-ta="rulesPdf" data-id="${esc(id)}">Imprimer / PDF</button><button class="btn" data-ta="rulesShare" data-id="${esc(id)}">Partager</button></div>`;
  }
  return "";
}
function rulesTemplate(t) { return window.LANG === "en" ? rulesTemplateEN(t) : rulesTemplateFR(t); }
function rulesTemplateEN(t) {
  const rot = t.type === "rotative", p = t.penalty, per = { semaine: "week", mois: "month", an: "year" }[t.freq] || "period";
  const role = r => ({ president: "Chair", tresorier: "Treasurer", secretaire: "Secretary" })[r] || "Member";
  const bureau = t.members.filter(m => m.role).map(m => `- ${role(m.role)}: ${m.name}`).join("\n");
  return `RULES – SAVINGS CIRCLE “${t.name}”

1. Purpose
${rot ? "Members pay a contribution every turn; each turn, the pot goes to the recipient(s) set by the payout order." : t.type === "pret" ? "Members pay a contribution every period. The fund may lend to members, with interest. At the end, the fund is shared out in proportion to payments." : "Members pay a contribution every period. At the end, the fund is shared out in proportion to payments."}

2. Contribution
${tm(t, t.amount)} per share, every ${per}, starting on ${frDate(t.start)}.${t.members.some(m => Number(m.parts) !== 1) ? " A member may hold several shares or a half-share; their contribution and what they receive are proportional." : ""}

3. Late payments
${p.mode ? `Any contribution paid more than ${Number(p.grace) || 0} day(s) after the due date incurs a penalty of ${p.mode === "pct" ? p.value + "% of the contribution" : tm(t, p.value)}, paid into the fund.` : "Late payments must be reported to the committee. No penalty applies."}

4. Fees and emergency fund
${t.fee ? `Management fee: ${tm(t, t.fee)} per member per ${per}.` : "No management fee."} ${t.caisseContrib ? `Emergency fund: ${tm(t, t.caisseContrib)} per member per ${per}, to help a member in case of an event (bereavement, birth, illness…), as decided by the committee.` : ""}
${rot ? `
5. Payout order
The order is set in advance (by lot or agreement). Two members may swap turns with the committee's approval. A member may get an earlier turn through a bid: the bid amount goes into the fund.
` : t.type === "pret" ? `
5. Loans
A member who is up to date with contributions may borrow from the fund. The interest rate and repayment date are set when the loan is made. Interest benefits all members at the final share-out.
` : ""}
6. Leaving the savings circle
A member who has already received the pot must keep paying all contributions until the end. A member who leaves before receiving the pot is refunded their payments at the end of the savings circle, unless the committee decides otherwise.

7. Committee
${bureau || "- To be appointed"}

Done on ${frDate(todayISO())}. Members' signatures:
${t.members.map(m => `- ${m.name}: ________________`).join("\n")}`;
}
function rulesTemplateFR(t) {
  const rot = t.type === "rotative", p = t.penalty;
  const bureau = t.members.filter(m => m.role).map(m => `- ${roleName(m.role)} : ${m.name}`).join("\n");
  return `RÈGLEMENT INTÉRIEUR – TONTINE « ${t.name} »

1. Objet
${rot ? "Les membres versent une cotisation à chaque tour ; à chaque tour, le pot est remis au(x) bénéficiaire(s) prévu(s) par l'ordre de passage." : t.type === "pret" ? "Les membres versent une cotisation à chaque période. La caisse peut accorder des prêts aux membres, avec intérêts. À la fin, la cagnotte est partagée au prorata des versements." : "Les membres versent une cotisation à chaque période. À la fin, la cagnotte est partagée au prorata des versements."}

2. Cotisation
${tm(t, t.amount)} par part, ${TON_FREQ.find(x => x[0] === t.freq)[1].toLowerCase()}, à partir du ${frDate(t.start)}.${t.members.some(m => Number(m.parts) !== 1) ? " Un membre peut détenir plusieurs parts ou une demi-part ; sa cotisation et ce qu'il reçoit sont proportionnels." : ""}

3. Retards
${p.mode ? `Toute cotisation versée plus de ${Number(p.grace) || 0} jour(s) après la date prévue entraîne une pénalité de ${p.mode === "pct" ? p.value + " % de la cotisation" : tm(t, p.value)}, versée à la caisse.` : "Les retards doivent être signalés au bureau. Aucune pénalité n'est prévue."}

4. Frais et caisse de secours
${t.fee ? `Frais de gestion : ${tm(t, t.fee)} par membre et par ${TON_UNIT[t.freq]}.` : "Pas de frais de gestion."} ${t.caisseContrib ? `Caisse de secours : ${tm(t, t.caisseContrib)} par membre et par ${TON_UNIT[t.freq]}, pour aider un membre en cas d'événement (décès, naissance, maladie…), sur décision du bureau.` : ""}
${rot ? `
5. Ordre de passage
L'ordre est fixé à l'avance (tirage au sort ou accord). Deux membres peuvent échanger leur tour avec l'accord du bureau. Un membre peut obtenir un tour plus tôt par enchère : le montant de l'enchère est versé à la caisse.
` : t.type === "pret" ? `
5. Prêts
Un membre à jour de ses cotisations peut emprunter à la caisse. Le taux d'intérêt et la date de remboursement sont fixés au moment du prêt. Les intérêts profitent à tous les membres lors du partage final.
` : ""}
6. Départ d'un membre
Un membre qui a déjà reçu le pot reste tenu de verser toutes ses cotisations jusqu'à la fin. Un membre qui part avant d'avoir reçu le pot est remboursé de ses versements à la fin de la tontine, sauf décision contraire du bureau.

7. Bureau
${bureau || "- À désigner"}

Fait le ${frDate(todayISO())}. Signatures des membres :
${t.members.map(m => `- ${m.name} : ________________`).join("\n")}`;
}
function meetingDoc(id, t, mt) {
  const rot = t.type === "rotative", r = mt && mt.k !== "" && mt.k != null ? tonRounds(t)[Number(mt.k)] : null, c = caisseOf(id, t);
  let body = `<h1>Tontine « ${esc(t.name)} »</h1><p class="m">${esc((TON_TYPES.find(x => x[0] === t.type) || [, ""])[1])} · ${tm(t, t.amount)} par part / ${TON_UNIT[t.freq]} · ${t.members.length} membres</p>`;
  if (mt) {
    body += `<h2>Compte-rendu de la séance du ${esc(frDate(mt.date))}</h2>
      <p><b>Présents (${(mt.present || []).length}) :</b> ${esc(t.members.filter(m => (mt.present || []).includes(m.id)).map(m => m.name).join(", ") || "—")}<br>
      <b>Absents :</b> ${esc(t.members.filter(m => !(mt.present || []).includes(m.id)).map(m => m.name).join(", ") || "—")}</p>`;
    if (r) body += `<h2>${rot ? "Tour" : "Période"} ${r.k + 1} du ${esc(frDate(r.date))}</h2>${rot ? `<p><b>Bénéficiaire :</b> ${esc(r.m.map(mid => tmem(t, mid).name).join(" + "))} · pot ${tm(t, tonPot(t) - (Number(t.bids[r.k] && t.bids[r.k].amount) || 0))}</p>` : ""}
      <table><tr><th>Membre</th><th>À verser</th><th>Versé le</th><th>Montant</th><th>Pénalité</th></tr>${t.members.map(m => { const p = payRec(id, t, r.k, m.id); return `<tr><td>${esc(m.name)}</td><td>${tm(t, dueOf(t, m.id))}</td><td>${p ? esc(frDate(p.date)) : "<b>non payé</b>"}</td><td>${p ? tm(t, p.amount) : ""}</td><td>${p && p.pen ? tm(t, p.pen) : ""}</td></tr>`; }).join("")}</table>`;
    if (mt.notes) body += `<h2>Ordre du jour / échanges</h2><pre>${esc(mt.notes)}</pre>`;
    if (mt.decisions) body += `<h2>Décisions</h2><pre>${esc(mt.decisions)}</pre>`;
  } else {
    body += `<h2>Calendrier et cotisations</h2><table><tr><th>${rot ? "Tour" : "Période"}</th><th>Date</th>${rot ? "<th>Bénéficiaire</th>" : ""}<th>Cotisations reçues</th></tr>${tonRounds(t).map(rr => `<tr><td>${rr.k + 1}</td><td>${esc(frDate(rr.date))}</td>${rot ? `<td>${esc(rr.m.map(mid => tmem(t, mid).name).join(" + "))}</td>` : ""}<td>${t.members.filter(m => payRec(id, t, rr.k, m.id)).length}/${t.members.length}</td></tr>`).join("")}</table>`;
    const late = lateList(id, t);
    body += `<h2>Retards</h2>${late.length ? `<table><tr><th>Membre</th><th>${rot ? "Tour" : "Période"}</th><th>Montant dû</th></tr>${late.map(x => `<tr><td>${esc(x.m.name)}</td><td>${x.r.k + 1} (${esc(frDate(x.r.date))})</td><td>${tm(t, x.due)}</td></tr>`).join("")}</table>` : "<p>Aucun retard.</p>"}`;
    if (!rot) { const f = fundOf(id, t); body += `<h2>Partage (à ce jour)</h2><table><tr><th>Membre</th><th>Versé</th><th>Part</th></tr>${t.members.map(m => `<tr><td>${esc(m.name)}</td><td>${tm(t, f.cot[m.id] || 0)}</td><td>${tm(t, f.share(m.id))}</td></tr>`).join("")}</table>`; }
    if (t.loans.length) body += `<h2>Prêts</h2><table><tr><th>Membre</th><th>Montant</th><th>Taux</th><th>Dû</th><th>Remboursé</th></tr>${t.loans.map(l => `<tr><td>${esc(tmem(t, l.mid).name)}</td><td>${tm(t, l.amount)}</td><td>${l.rate || 0} %</td><td>${tm(t, loanDue(l))}</td><td>${tm(t, loanPaid(l))}</td></tr>`).join("")}</table>`;
  }
  body += `<h2>Caisse</h2><p>Solde : <b>${tm(t, c.bal)}</b></p>`;
  const bureau = t.members.filter(m => m.role);
  if (bureau.length) body += `<h2>Bureau</h2><p>${bureau.map(m => `${esc(roleName(m.role))} : ${esc(m.name)}`).join("<br>")}</p><p style="margin-top:30px">Signatures : ${bureau.map(m => esc(m.name) + " ________").join("&nbsp;&nbsp; ")}</p>`;
  printDoc(mt ? `Compte-rendu ${t.name} ${mt.date}` : `Bilan ${t.name}`, body);
}

// ---------- Actions ----------
function bindTontines() {
  const T = id => tnorm(tontines[id]);
  view.querySelectorAll("[data-tv]").forEach(b => b.onclick = () => { const [id, k] = b.dataset.tv.split(":"); tonView[id] = tonView[id] === k ? "" : k; render(); });
  view.querySelectorAll("[data-tr]").forEach(b => b.onclick = () => { const [id, k] = b.dataset.tr.split(":"); tonRound[id] = Number(k); render(); });
  view.querySelectorAll("[data-tp]").forEach(b => b.onclick = () => {
    const [id, ks] = b.dataset.tp.split(":"), k = Number(ks), t = T(id);
    if (payRec(id, t, k, t.me)) unsetPaid(id, t, k, t.me); else setPaid(id, t, k, t.me, todayISO());
    render();
  });
  view.querySelectorAll("[data-tm]").forEach(b => b.onclick = () => {
    const [id, ks, mid, a] = b.dataset.tm.split(":"), k = Number(ks), t = T(id), r = tonRounds(t)[k], m = tmem(t, mid);
    if (a === "pay") return payForm(id, t, r, m);
    if (a === "undo") { if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = "Confirmer ?"; return; } unsetPaid(id, t, k, mid); render(); return; }
    if (a === "receipt") { const p = payRec(id, t, k, mid), txt = receiptText(t, r, m, p); if (m.phone && m.id !== t.me) window.open(waLink(m.phone, txt), "_blank", "noopener"); else shareText(txt, "Reçu de cotisation"); }
  });
  view.querySelectorAll("[data-tx]").forEach(b => b.onclick = () => { const [id, k, a] = b.dataset.tx.split(":"), t = T(id); if (a === "swap") swapForm(id, t, Number(k)); else bidForm(id, t, Number(k)); });
  view.querySelectorAll("[data-tl]").forEach(b => b.onclick = () => { const [id, lid] = b.dataset.tl.split(":"); repayForm(id, T(id), lid); });
  view.querySelectorAll("[data-ts]").forEach(b => b.onclick = () => { const [id, mid, a] = b.dataset.ts.split(":"), t = T(id), mt = t.meetings.find(x => x.id === mid); if (a === "pdf") meetingDoc(id, t, mt); else meetingForm(id, t, mt); });
  view.querySelectorAll("[data-ta]").forEach(b => b.onclick = () => {
    const id = b.dataset.id, t = T(id), s = tonState(id, t), a = b.dataset.ta;
    if (a === "edit") return editTontine(id);
    if (a === "pay") { const r = s.unpaid[0] || s.cur; setPaid(id, t, r.k, t.me, todayISO()); render(); toast(`Cotisation ${t.type === "rotative" ? "du tour" : "de la période"} ${r.k + 1} enregistrée (${tm(t, dueOf(t, t.me) + (t.pays[r.k + ":" + t.me].pen || 0))})`); }
    if (a === "pot") { addMyTx(id, t, s.mine.k, "pot", todayISO(), potFor(t, s.mine, t.me)); render(); toast(`${tm(t, potFor(t, s.mine, t.me))} ajoutés à tes rentrées`); }
    if (a === "fin") { const v = fundOf(id, t).share(t.me); addMyTx(id, t, -1, "fin", todayISO(), v); render(); toast(`Ta part (${tm(t, v)}) est ajoutée à tes rentrées`); }
    if (a === "relall") { const late = lateList(id, t).filter(x => x.m.id !== t.me); const txt = `Tontine « ${t.name} » – cotisations en retard :\n` + late.map(x => `• ${x.m.name} : ${tm(t, x.due)} (${t.type === "rotative" ? "tour" : "période"} ${x.r.k + 1}, ${frDate(x.r.date)})`).join("\n") + "\nMerci de régulariser rapidement 🙏"; window.open(waLink("", TT(txt)), "_blank", "noopener"); }
    if (a === "caisseOut" || a === "caisseIn") caisseForm(id, t, a === "caisseIn" ? "in" : "out");
    if (a === "loan") loanForm(id, t);
    if (a === "meet") meetingForm(id, t, null);
    if (a === "bilan") meetingDoc(id, t, null);
    if (a === "rulesSave") { t.rules = document.getElementById("tnRules-" + id).value.slice(0, 20000); saveTontines(); toast("Règlement enregistré"); }
    if (a === "rulesTpl") { const el = document.getElementById("tnRules-" + id); if (el.value.trim() && el.dataset.c !== "1") { el.dataset.c = "1"; toast("Appuie encore une fois pour remplacer le texte actuel par le modèle"); return; } el.value = rulesTemplate(t); el.dataset.c = ""; }
    if (a === "rulesPdf") { const txt = document.getElementById("tnRules-" + id).value || rulesTemplate(t); printDoc(`Règlement ${t.name}`, `<pre>${esc(txt)}</pre>`); }
    if (a === "rulesShare") shareText(document.getElementById("tnRules-" + id).value || rulesTemplate(t), `Règlement ${t.name}`);
  });
}
const memberOpts = (t, sel) => t.members.map(m => `<option value="${esc(m.id)}"${m.id === sel ? " selected" : ""}>${esc(m.name)}${m.id === t.me ? " (toi)" : ""}</option>`).join("");
function payForm(id, t, r, m) {
  const today = todayISO();
  openForm(`<div class="f2"><h3>Cotisation de ${esc(m.name)}</h3><p class="hint" style="margin:0">${t.type === "rotative" ? "Tour" : "Période"} ${r.k + 1} du ${esc(frDate(r.date))} · à verser ${tm(t, dueOf(t, m.id))}</p>
    ${fld("pmDate", "Date du versement", `type="date" value="${today}"`)}
    ${fld("pmPen", `Pénalité de retard (${esc(tcur(t))})`, `inputmode="decimal" value="${String(penaltyFor(t, r, m.id, today) || "").replace(".", ",")}"`)}
    <p class="hint" style="margin:6px 0 0">La pénalité est calculée selon les règles de la tontine ; tu peux la modifier ou la mettre à 0.</p></div>`, () => {
    const d = val("pmDate"); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { toast("Indique la date"); return false; }
    setPaid(id, t, r.k, m.id, d, parseAmount(val("pmPen")) || 0); render(); toast(`Versement de ${m.name} enregistré`);
  });
  document.getElementById("pmDate").addEventListener("change", e => { document.getElementById("pmPen").value = String(penaltyFor(t, r, m.id, e.target.value) || "").replace(".", ","); });
}
function swapForm(id, t, k) {
  const rounds = tonRounds(t), today = todayISO(), r = rounds[k];
  const opts = rounds.filter(x => x.k !== k && x.date >= today).map(x => `<option value="${x.k}">Tour ${x.k + 1} (${esc(frDate(x.date))}) · ${esc(x.m.map(mid => tmem(t, mid).name).join(" + "))}</option>`).join("");
  if (!opts) { toast("Aucun autre tour à venir pour échanger"); return; }
  openForm(`<div class="f2"><h3>Échanger le tour ${k + 1}</h3><p class="hint" style="margin:0">${esc(r.m.map(mid => tmem(t, mid).name).join(" + "))} · ${esc(frDate(r.date))}</p>
    <label class="lbl" for="swK">Échanger avec</label><select class="field" id="swK">${opts}</select></div>`, () => {
    const k2 = Number(val("swK")), sl = slotsOf(t), mains = sl.map(s => s.m.slice());
    [mains[k], mains[k2]] = [mains[k2], mains[k]];
    t.order = mains.flat(); saveTontines(); render(); toast(`Tours ${k + 1} et ${k2 + 1} échangés`);
  });
}
function bidForm(id, t, k) {
  const r = tonRounds(t)[k], b = t.bids[k] || {};
  openForm(`<div class="f2"><h3>Enchère sur le tour ${k + 1}</h3>
    <p class="hint" style="margin:0">Le bénéficiaire du tour (${esc(r.m.map(mid => tmem(t, mid).name).join(" + "))}, le ${esc(frDate(r.date))}) laisse ce montant à la caisse : il reçoit le pot moins l'enchère. Pour donner le tour à quelqu'un d'autre, utilise d'abord « Échanger ».</p>
    ${fld("bidAmt", `Montant de l'enchère (${esc(tcur(t))})`, `inputmode="decimal" value="${b.amount ? String(b.amount).replace(".", ",") : ""}"`)}
    <p class="hint" style="margin:6px 0 0">Pot du tour : ${tm(t, tonPot(t))}. Laisse vide pour retirer l'enchère.</p></div>`, () => {
    const v = parseAmount(val("bidAmt"));
    if (v > 0) { if (v >= tonPot(t)) { toast("L'enchère doit être inférieure au pot"); return false; } t.bids[k] = { amount: v }; } else delete t.bids[k];
    saveTontines(); render(); toast(v > 0 ? `Enchère de ${tm(t, v)} enregistrée` : "Enchère retirée");
  });
}
function caisseForm(id, t, kind) {
  openForm(`<div class="f2"><h3>${kind === "in" ? "Entrée dans la caisse" : "Aide ou dépense de la caisse"}</h3>
    ${fld("ceLabel", "Motif", `placeholder="${kind === "in" ? "ex. don, reliquat" : "ex. décès dans la famille, naissance, frais de salle"}"`)}
    <div class="two"><div>${fld("ceAmt", `Montant (${esc(tcur(t))})`, `inputmode="decimal"`)}</div><div>${fld("ceDate", "Date", `type="date" value="${todayISO()}"`)}</div></div>
    <label class="lbl" for="ceMid">Membre concerné (facultatif)</label><select class="field" id="ceMid"><option value="">—</option>${memberOpts(t, "")}</select></div>`, () => {
    const a = parseAmount(val("ceAmt")), l = val("ceLabel");
    if (!l || !(a > 0)) { toast("Indique un motif et un montant"); return false; }
    t.caisseEv.push({ id: newId(), kind, label: l.slice(0, 80), amount: a, date: val("ceDate") || todayISO(), mid: val("ceMid") });
    saveTontines(); render(); toast("Caisse mise à jour");
  });
}
function loanForm(id, t) {
  const f = fundOf(id, t);
  openForm(`<div class="f2"><h3>Nouveau prêt</h3><p class="hint" style="margin:0">Disponible : ${tm(t, f.cash)}</p>
    <label class="lbl" for="lnMid">Emprunteur</label><select class="field" id="lnMid">${memberOpts(t, "")}</select>
    <div class="two"><div>${fld("lnAmt", `Montant (${esc(tcur(t))})`, `inputmode="decimal"`)}</div><div>${fld("lnRate", "Intérêt (%)", `inputmode="decimal" value="${String(t.loanRate || 10).replace(".", ",")}"`)}</div></div>
    <div class="two"><div>${fld("lnDate", "Date du prêt", `type="date" value="${todayISO()}"`)}</div><div>${fld("lnDue", "À rembourser avant le", `type="date" value="${addMonths(todayISO(), 3)}"`)}</div></div>
    <p class="hint" style="margin:6px 0 0">Intérêt simple : l'emprunteur rend le montant + le pourcentage indiqué.</p></div>`, () => {
    const a = parseAmount(val("lnAmt")), rate = parseAmount(val("lnRate")) || 0, mid = val("lnMid");
    if (!(a > 0)) { toast("Indique le montant du prêt"); return false; }
    if (a > f.cash + 0.004) { toast(`La caisse ne contient que ${tm(t, f.cash)}`); return false; }
    const l = { id: newId(), mid, amount: a, rate, date: val("lnDate") || todayISO(), due: val("lnDue"), repaid: [] };
    t.loans.push(l); t.loanRate = rate;
    if (mid === t.me) addMyTx(id, t, l.id, "loan", l.date, a);
    saveTontines(); render(); toast(`Prêt de ${tm(t, a)} à ${tmem(t, mid).name} : ${tm(t, loanDue(l))} à rembourser`);
  });
}
function repayForm(id, t, lid) {
  const l = t.loans.find(x => x.id === lid), left = Math.max(0, loanDue(l) - loanPaid(l));
  openForm(`<div class="f2"><h3>Remboursement · ${esc(tmem(t, l.mid).name)}</h3><p class="hint" style="margin:0">Reste à rembourser : ${tm(t, left)}</p>
    <div class="two"><div>${fld("rpAmt", `Montant (${esc(tcur(t))})`, `inputmode="decimal" value="${String(left).replace(".", ",")}"`)}</div><div>${fld("rpDate", "Date", `type="date" value="${todayISO()}"`)}</div></div></div>`, () => {
    const a = parseAmount(val("rpAmt")); if (!(a > 0)) { toast("Indique le montant"); return false; }
    l.repaid.push({ date: val("rpDate") || todayISO(), amount: Math.min(a, left) });
    if (l.mid === t.me) addMyTx(id, t, l.id + "-" + l.repaid.length, "rep", val("rpDate") || todayISO(), Math.min(a, left));
    saveTontines(); render(); toast("Remboursement enregistré");
  });
}
function meetingForm(id, t, mt) {
  const rounds = tonRounds(t), today = todayISO(), x = mt || { date: today, k: (rounds.find(r => r.date >= today) || rounds[rounds.length - 1]).k, present: t.members.map(m => m.id), notes: "", decisions: "" };
  openForm(`<div class="f2"><h3>${mt ? "Modifier la séance" : "Nouvelle séance"}</h3>
    <div class="two"><div>${fld("mtDate", "Date", `type="date" value="${esc(x.date)}"`)}</div><div><label class="lbl" for="mtK">${t.type === "rotative" ? "Tour" : "Période"}</label><select class="field" id="mtK"><option value="">—</option>${rounds.map(r => `<option value="${r.k}"${String(r.k) === String(x.k) ? " selected" : ""}>${r.k + 1} · ${esc(frDate(r.date))}</option>`).join("")}</select></div></div>
    <span class="lbl">Présents</span><div class="ton-checks">${t.members.map(m => `<label><input type="checkbox" value="${esc(m.id)}" ${(x.present || []).includes(m.id) ? "checked" : ""}> ${esc(m.name)}</label>`).join("")}</div>
    <label class="lbl" for="mtNotes">Ordre du jour / échanges</label><textarea class="field" id="mtNotes" rows="4">${esc(x.notes || "")}</textarea>
    <label class="lbl" for="mtDec">Décisions</label><textarea class="field" id="mtDec" rows="3">${esc(x.decisions || "")}</textarea></div>`, () => {
    const d = val("mtDate"); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { toast("Indique la date"); return false; }
    const rec = { id: mt ? mt.id : newId(), date: d, k: val("mtK"), present: [...document.querySelectorAll(".ton-checks input:checked")].map(i => i.value), notes: document.getElementById("mtNotes").value.slice(0, 5000), decisions: document.getElementById("mtDec").value.slice(0, 5000) };
    t.meetings = t.meetings.filter(m => m.id !== rec.id).concat(rec); saveTontines(); render(); toast("Séance enregistrée");
  }, mt ? () => { t.meetings = t.meetings.filter(m => m.id !== mt.id); saveTontines(); render(); } : null);
}

// ---------- Création / modification ----------
editTontine = function (id) {
  const t = id ? clone(tnorm(tontines[id])) : tnorm({ name: "", amount: "", freq: "mois", start: todayISO(), members: [{ id: "m" + Math.random().toString(36).slice(2, 8), name: "", parts: 1, role: "", phone: "" }], me: "", order: [], auto: true, currency: baseCur(), type: "rotative", trackAll: true });
  if (!id) { t.me = t.members[0].id; t.periods = ""; }
  let type = t.type, freq = t.freq, members = t.members.map(m => ({ ...m })), me = t.me, order = t.order.slice();
  openForm(`<div class="f2"><h3>${id ? "Modifier la tontine" : "Nouvelle tontine"}</h3>
    ${fld("tnName", "Nom", `placeholder="ex. Tontine famille, Njangi du quartier" value="${esc(t.name)}"`)}
    <span class="lbl">Type</span><div class="chips" id="tnType"></div><p class="hint" id="tnTypeHint" style="margin:4px 0 0"></p>
    <div class="two"><div><label class="lbl" for="tnCur">Devise</label><select class="field" id="tnCur">${TON_CUR.map(([c, l]) => `<option value="${c}"${c === tcur(t) ? " selected" : ""}>${esc(c)} · ${esc(l)}</option>`).join("")}</select></div>
      <div id="tnRateWrap">${fld("tnRate", "", `inputmode="decimal" value="${t.rate ? String(t.rate).replace(".", ",") : ""}"`)}</div></div>
    <div class="two"><div>${fld("tnAmount", "Cotisation par part", `inputmode="decimal" value="${t.amount === "" ? "" : esc(String(t.amount).replace(".", ","))}"`)}</div>
      <div>${fld("tnStart", "Date de la 1re cotisation", `type="date" value="${esc(t.start)}"`)}</div></div>
    <span class="lbl">Fréquence</span><div class="chips" id="tnFreq"></div>
    <div id="tnPeriodsWrap">${fld("tnPeriods", "Nombre de périodes", `inputmode="numeric" value="${esc(t.periods)}"`)}</div>
    <span class="lbl">Membres <small class="hint">(coche « moi » sur ta ligne · téléphone pour les relances WhatsApp)</small></span>
    <div id="tnMembers" class="ton-members"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><button type="button" class="btn" id="tnAdd">+ Ajouter un membre</button><button type="button" class="btn" id="tnPaste">Coller une liste de prénoms</button></div>
    <div id="tnOrderWrap"><span class="lbl">Ordre de passage (qui reçoit le pot, et quand)</span><div id="tnOrder" class="fc-list" style="margin-top:0"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="btn" id="tnDraw">Tirer au sort</button><button type="button" class="btn" id="tnReset">Ordre des membres</button></div></div>
    <p class="hint" id="tnPot" style="margin:8px 0 0"></p>
    <details class="ton-more" ${t.fee || t.caisseContrib || t.penalty.mode ? "open" : ""}><summary>Pénalités, frais et caisse de secours</summary>
      <div class="two"><div><label class="lbl" for="tnPenMode">Pénalité de retard</label><select class="field" id="tnPenMode"><option value="">Aucune</option><option value="fixe"${t.penalty.mode === "fixe" ? " selected" : ""}>Montant fixe</option><option value="pct"${t.penalty.mode === "pct" ? " selected" : ""}>% de la cotisation</option></select></div>
        <div>${fld("tnPenVal", "Valeur", `inputmode="decimal" value="${t.penalty.value ? String(t.penalty.value).replace(".", ",") : ""}"`)}</div></div>
      ${fld("tnGrace", "Délai de grâce (jours)", `inputmode="numeric" value="${esc(t.penalty.grace || "")}" placeholder="0"`)}
      <div class="two"><div>${fld("tnFee", "Frais de gestion / membre / tour", `inputmode="decimal" value="${t.fee ? String(t.fee).replace(".", ",") : ""}" placeholder="0"`)}</div>
        <div>${fld("tnCaisse", "Caisse de secours / membre / tour", `inputmode="decimal" value="${t.caisseContrib ? String(t.caisseContrib).replace(".", ",") : ""}" placeholder="0"`)}</div></div></details>
    <label class="toggle" for="tnTrack" style="margin-top:12px"><span>Suivre les versements de tous les membres (retards, relances, reçus)</span><input type="checkbox" id="tnTrack" ${t.trackAll ? "checked" : ""}></label>
    <label class="toggle" for="tnAuto" style="margin-top:8px"><span>Ajouter tout seul mes cotisations et ce que je reçois dans mon budget, à leur date</span><input type="checkbox" id="tnAuto" ${t.auto ? "checked" : ""}></label>
    ${id ? `<label class="toggle" for="tnClosed" style="margin-top:8px"><span>Tontine terminée</span><input type="checkbox" id="tnClosed" ${t.closed ? "checked" : ""}></label>` : ""}</div>`,
    () => {
      readMembers();
      const name = val("tnName"), amount = parseAmount(val("tnAmount")), start = val("tnStart"), cur = val("tnCur");
      const named = members.filter(m => m.name.trim());
      if (!name) { toast("Donne un nom à la tontine"); return false; }
      if (!(amount > 0)) { toast("Indique le montant de la cotisation"); return false; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) { toast("Indique la date de la première cotisation"); return false; }
      if (named.length < 2) { toast("Indique au moins deux membres"); return false; }
      if (!named.some(m => m.id === me)) { toast("Coche « moi » sur ta ligne"); return false; }
      if (new Set(named.map(m => m.name.trim().toLowerCase())).size !== named.length) { toast("Deux membres ont le même nom : ajoute une initiale"); return false; }
      const rate = parseNum(val("tnRate"));
      if (!fixedRate(cur, baseCur()) && !(rate > 0)) { toast(`Indique le taux : combien de ${cur} pour 1 ${baseCur()}`); return false; }
      const nt = { ...t, name: name.slice(0, 60), type, amount, start, freq, currency: cur, rate: fixedRate(cur, baseCur()) ? 0 : rate,
        members: named.map(m => ({ ...m, name: m.name.trim().slice(0, 40), phone: (m.phone || "").trim().slice(0, 25) })), me, order: order.slice(),
        periods: Math.max(1, parseInt(val("tnPeriods"), 10) || named.length),
        penalty: { mode: val("tnPenMode"), value: parseAmount(val("tnPenVal")) || 0, grace: parseInt(val("tnGrace"), 10) || 0 },
        fee: parseAmount(val("tnFee")) || 0, caisseContrib: parseAmount(val("tnCaisse")) || 0,
        auto: document.getElementById("tnAuto").checked, trackAll: document.getElementById("tnTrack").checked, closed: document.getElementById("tnClosed") ? document.getElementById("tnClosed").checked : false, created: t.created || Date.now(), _v: 2 };
      syncOrder(nt);
      if (type === "rotative") {
        if ((totalParts(nt) * 2) % 2) { toast("Les demi-parts doivent aller par deux (nombre total de parts entier)"); return false; }
        if (slotsOf(nt).some(s => s.w < 0.999)) { toast("Place les demi-parts deux par deux, l'une après l'autre, dans l'ordre de passage"); return false; }
      }
      const nid = id || newId();
      tontines[nid] = nt; saveTontines(); applyRecurring(); render(); toast(id ? "Tontine modifiée" : "Tontine créée");
    },
    id ? () => {
      for (const x of allItems()) if (x.tontine === id) { delete months[x.key].items[x.id].tontine; delete months[x.key].items[x.id].round; saveMonth(x.key); }
      delete tontines[id]; saveTontines(); render(); toast("Tontine supprimée (les opérations déjà enregistrées restent dans ton budget)");
    } : null);

  function readMembers() {
    document.querySelectorAll("#tnMembers .ton-mrow").forEach(row => {
      const m = members.find(x => x.id === row.dataset.id); if (!m) return;
      m.name = row.querySelector("[data-f=name]").value; m.phone = row.querySelector("[data-f=phone]").value;
      m.parts = Number(row.querySelector("[data-f=parts]").value) || 1; m.role = row.querySelector("[data-f=role]").value;
    });
  }
  function drawMembers() {
    document.getElementById("tnMembers").innerHTML = members.map(m => `<div class="ton-mrow" data-id="${esc(m.id)}">
      <label class="ton-me"><input type="radio" name="tnMe" value="${esc(m.id)}" ${m.id === me ? "checked" : ""}> moi</label>
      <input class="field" data-f="name" placeholder="Prénom" value="${esc(m.name)}" aria-label="Prénom">
      <input class="field" data-f="phone" placeholder="Téléphone" inputmode="tel" value="${esc(m.phone || "")}" aria-label="Téléphone">
      <select class="field" data-f="parts" aria-label="Parts">${TON_PARTS.map(([v, l]) => `<option value="${v}"${Number(m.parts) === v ? " selected" : ""}>${l}</option>`).join("")}</select>
      <select class="field" data-f="role" aria-label="Rôle">${TON_ROLES.map(([v, l]) => `<option value="${v}"${m.role === v ? " selected" : ""}>${l}</option>`).join("")}</select>
      <button type="button" class="chip" data-del="${esc(m.id)}" aria-label="Retirer">✕</button></div>`).join("");
    document.querySelectorAll("#tnMembers input, #tnMembers select").forEach(el => el.addEventListener(el.type === "radio" ? "change" : "input", () => { if (el.type === "radio") me = el.value; readMembers(); refreshOrder(); }));
    document.querySelectorAll("#tnMembers [data-del]").forEach(b => b.onclick = () => { readMembers(); if (members.length <= 1) return; members = members.filter(m => m.id !== b.dataset.del); if (me === b.dataset.del) me = members[0].id; drawMembers(); refreshOrder(); });
  }
  function refreshOrder() {
    const tmp = { members: members.filter(m => m.name.trim()), order };
    syncOrder(tmp); order = tmp.order; drawOrder();
  }
  function drawOrder() {
    const tmp = { members: members.filter(m => m.name.trim()), order, start: val("tnStart") || todayISO(), freq, type };
    const isRot = type === "rotative";
    document.getElementById("tnOrderWrap").hidden = !isRot;
    document.getElementById("tnPeriodsWrap").hidden = isRot;
    document.getElementById("tnTypeHint").textContent = TON_TYPE_HINT[type];
    const cur = val("tnCur"), fx = fixedRate(cur, baseCur());
    document.getElementById("tnRateWrap").hidden = !!fx;
    if (!fx && !val("tnRate") && typeof fxRate === "function") fxRate(cur).then(i => { const el = document.getElementById("tnRate"); if (i && el && !el.value && val("tnCur") === cur) el.value = numStr(fxRound(i.rate)); });
    document.querySelector("#tnRateWrap .lbl").textContent = `Taux : ${cur} pour 1 ${baseCur()}`;
    const a = parseAmount(val("tnAmount")), tp = totalParts(tmp);
    if (isRot) {
      const slots = slotsOf(tmp); let d = tmp.start;
      document.getElementById("tnOrder").innerHTML = slots.length ? slots.map((s, i) => { const row = `<div class="fc-it" style="grid-template-columns:22px 80px 1fr auto"><span>${i + 1}</span><span class="num">${esc(frDate(d))}</span>
        <span>${s.m.map((mid, j) => { const m = tmp.members.find(x => x.id === mid); return `${esc(m ? m.name : "?")}${s.sh[j] < 1 ? " (½)" : ""}${mid === me ? " (toi)" : ""}`; }).join(" + ")}${s.w < 0.999 ? ` <b style="color:var(--bad)">demi-part seule</b>` : ""}</span>
        <span>${i > 0 ? `<button type="button" class="chip" data-up="${i}" style="padding:2px 8px" aria-label="Monter">↑</button>` : ""}</span></div>`; d = advance(d, freq); return row; }).join("") : `<p class="hint">Indique les membres pour voir l'ordre de passage.</p>`;
      document.querySelectorAll("#tnOrder [data-up]").forEach(b => b.onclick = () => { const i = Number(b.dataset.up), sl = slotsOf(tmp).map(s => s.m.slice()); [sl[i - 1], sl[i]] = [sl[i], sl[i - 1]]; order = sl.flat(); drawOrder(); });
      document.getElementById("tnPot").textContent = a > 0 && tp >= 2 ? `Pot à chaque tour : ${curFmt(cur, a * tp)} (${String(tp).replace(".", ",")} parts × ${curFmt(cur, a)}). Durée : ${slots.length} tours.` : "";
    } else {
      const n = parseInt(val("tnPeriods"), 10) || 0;
      document.getElementById("tnPot").textContent = a > 0 && tp && n ? `Chaque période : ${curFmt(cur, a * tp)} collectés · cagnotte finale ≈ ${curFmt(cur, a * tp * n)}${type === "pret" ? " + intérêts des prêts" : ""}.` : "";
    }
  }
  chipsPick("tnType", TON_TYPES, type, v => { type = v; drawOrder(); });
  chipsPick("tnFreq", TON_FREQ, freq, v => { freq = v; drawOrder(); });
  drawMembers(); refreshOrder();
  for (const fid of ["tnAmount", "tnStart", "tnPeriods", "tnCur"]) document.getElementById(fid).addEventListener(fid === "tnCur" ? "change" : "input", drawOrder);
  document.getElementById("tnAdd").onclick = () => { readMembers(); members.push({ id: "m" + Math.random().toString(36).slice(2, 8), name: "", parts: 1, role: "", phone: "" }); drawMembers(); const last = document.querySelector("#tnMembers .ton-mrow:last-child [data-f=name]"); if (last) last.focus(); };
  document.getElementById("tnPaste").onclick = () => {
    const raw = prompt("Colle les prénoms, séparés par des virgules ou des retours à la ligne :"); if (!raw) return;
    readMembers(); members = members.filter(m => m.name.trim() || m.id === me);
    for (const n of raw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)) if (!members.some(m => m.name.trim().toLowerCase() === n.toLowerCase())) members.push({ id: "m" + Math.random().toString(36).slice(2, 8), name: n.slice(0, 40), parts: 1, role: "", phone: "" });
    drawMembers(); refreshOrder();
  };
  document.getElementById("tnDraw").onclick = () => { const tmp = { members: members.filter(m => m.name.trim()), order }; const sl = slotsOf(tmp).map(s => s.m.slice()); for (let i = sl.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [sl[i], sl[j]] = [sl[j], sl[i]]; } order = sl.flat(); drawOrder(); toast("Ordre tiré au sort"); };
  document.getElementById("tnReset").onclick = () => { order = mainsOf(members.filter(m => m.name.trim())); drawOrder(); };
};

// Les anciennes tontines sont mises au nouveau format au chargement.
{
  const _applyData = applyData;
  applyData = function (d) { _applyData(d); for (const t of Object.values(tontines)) tnorm(t); };
  for (const t of Object.values(tontines)) tnorm(t);
}
