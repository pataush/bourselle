
// ---------- Données de base ----------
const TYPES = [
  { id: "depense", label: "Dépense", sign: -1 },
  { id: "rentree", label: "Rentrée", sign: 1 },
  { id: "epargne", label: "Épargne", sign: -1 },
  { id: "invest", label: "Invest.", sign: -1 },
];
const DEFAULT_SETTINGS = {
  cats: [
    { id: "logement", name: "Logement", budget: 900, color: "#1f4e79", fixe: true },
    { id: "energie", name: "Énergie & eau", budget: 120, color: "#2e86c1", fixe: true },
    { id: "telecom", name: "Télécom & abonnements", budget: 60, color: "#48c9b0", fixe: true },
    { id: "assurances", name: "Assurances", budget: 80, color: "#16a085", fixe: true },
    { id: "credits", name: "Crédits", budget: 0, color: "#7d3c98", fixe: true },
    { id: "courses", name: "Courses", budget: 450, color: "#e6b800", fixe: false },
    { id: "transport", name: "Transport & carburant", budget: 150, color: "#e67e22", fixe: false },
    { id: "sante", name: "Santé", budget: 40, color: "#e74c3c", fixe: false },
    { id: "enfants", name: "Enfants & éducation", budget: 100, color: "#af7ac5", fixe: false },
    { id: "loisirs", name: "Loisirs & sorties", budget: 120, color: "#ec7063", fixe: false },
    { id: "shopping", name: "Shopping & habillement", budget: 80, color: "#5d6d7e", fixe: false },
    { id: "maison", name: "Maison & entretien", budget: 50, color: "#a04000", fixe: false },
    { id: "impots", name: "Impôts & taxes", budget: 150, color: "#34495e", fixe: true },
    { id: "cadeaux", name: "Cadeaux & dons", budget: 30, color: "#f1948a", fixe: false },
    { id: "divers", name: "Divers", budget: 50, color: "#9aa5ad", fixe: false },
  ],
  rentree: ["Salaire", "Prime", "Allocations / aides", "Revenus locatifs", "Remboursement", "Vente", "Autre"],
  epargne: ["Livret A", "LDDS", "LEP", "PEL", "Autre"],
  invest: ["Actions / ETF", "Assurance-vie", "PER", "Immobilier / SCPI", "Crypto", "Autre"],
  warnDays: 60,
};
const DURS = [[6, "6 mois"], [12, "1 an"], [24, "2 ans"], [36, "3 ans"], [60, "5 ans"], [0, "Date précise"]];
function addMonths(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(y, m - 1 + n, 1); const dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(d, dim));
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}
function daysUntil(iso) { const a = new Date(iso + "T12:00:00"), b = new Date(todayISO() + "T12:00:00"); return Math.round((a - b) / 86400000); }
function frDate(iso) { return iso ? iso.split("-").reverse().join("/") : ""; }
function warnDays() { return Number(settings.warnDays) > 0 ? Number(settings.warnDays) : 60; }
function garStatus(w) { const d = daysUntil(w.end); return d < 0 ? "exp" : d <= warnDays() ? "soon" : "ok"; }
function garItems() { return allItems().filter(x => x.warranty && x.warranty.end); }
function leftTxt(d) {
  const a = Math.abs(d);
  const unit = a >= 60 ? `${Math.round(a / 30.4)} mois` : `${a} jour${a > 1 ? "s" : ""}`;
  return d < 0 ? `expirée depuis ${unit}` : d === 0 ? "expire aujourd'hui" : `encore ${unit}`;
}
const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const MOIS_C = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];

// ---------- État ----------
let settings = clone(DEFAULT_SETTINGS);
let months = {};          // "2026-11" -> { items: { id: tx } }
let tab = "mois";
const now = new Date();
let cur = { y: now.getFullYear(), m: now.getMonth() + 1 };
let store = null;         // adaptateur de stockage (voir storage.js)
let assets = null;        // = store quand il accepte les factures
let subs = {};            // abonnements
let debts = {};           // dettes
let recs = {};            // opérations automatiques
let goals = {};           // objectifs d'épargne
let groups = {};          // dépenses partagées
let tontines = {};        // tontines

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function ym(y, m) { return `${y}-${String(m).padStart(2, "0")}`; }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
// Devise du budget (Réglages › Langue et devise) : tous les montants sont affichés dans cette devise.
const APP_CURRENCIES = [["EUR", "Euro (€)"], ["XOF", "Franc CFA BCEAO (Afrique de l'Ouest)"], ["XAF", "Franc CFA BEAC (Afrique centrale)"], ["USD", "Dollar américain ($)"],
  ["GBP", "Livre sterling (£)"], ["CAD", "Dollar canadien"], ["CHF", "Franc suisse"], ["MAD", "Dirham marocain"], ["DZD", "Dinar algérien"], ["TND", "Dinar tunisien"],
  ["GNF", "Franc guinéen"], ["CDF", "Franc congolais"], ["HTG", "Gourde haïtienne"], ["NGN", "Naira"], ["GHS", "Cedi"], ["KMF", "Franc comorien"], ["MGA", "Ariary"],
  ["JPY", "Yen japonais"], ["CNY", "Yuan chinois"], ["INR", "Roupie indienne"], ["AUD", "Dollar australien"], ["NZD", "Dollar néo-zélandais"], ["SEK", "Couronne suédoise"], ["NOK", "Couronne norvégienne"], ["DKK", "Couronne danoise"], ["PLN", "Zloty polonais"], ["CZK", "Couronne tchèque"], ["HUF", "Forint hongrois"], ["RON", "Leu roumain"], ["TRY", "Livre turque"], ["RUB", "Rouble russe"], ["BRL", "Real brésilien"], ["MXN", "Peso mexicain"], ["ARS", "Peso argentin"], ["ZAR", "Rand sud-africain"], ["EGP", "Livre égyptienne"], ["KES", "Shilling kényan"], ["UGX", "Shilling ougandais"], ["TZS", "Shilling tanzanien"], ["RWF", "Franc rwandais"], ["BIF", "Franc burundais"], ["ETB", "Birr éthiopien"], ["CVE", "Escudo cap-verdien"], ["MRU", "Ouguiya mauritanien"], ["MUR", "Roupie mauricienne"], ["AED", "Dirham des Émirats"], ["SAR", "Riyal saoudien"], ["QAR", "Riyal qatari"], ["KWD", "Dinar koweïtien"], ["ILS", "Shekel israélien"], ["LBP", "Livre libanaise"], ["SGD", "Dollar de Singapour"], ["HKD", "Dollar de Hong Kong"], ["KRW", "Won sud-coréen"], ["THB", "Baht thaïlandais"], ["VND", "Dông vietnamien"], ["PHP", "Peso philippin"], ["XPF", "Franc pacifique (CFP)"]];
const NO_CENTS = ["XOF", "XAF", "GNF", "CDF", "KMF", "MGA", "JPY", "UGX", "RWF", "BIF", "LBP", "KRW", "VND", "XPF"];
let fmt, fmt0;
function appLocale() { const c = (typeof settings !== "undefined" && settings && settings.currency) || "EUR"; return window.LANG === "en" ? (c === "USD" ? "en-US" : "en-GB") : "fr-FR"; }
function applyCurrency() {
  const c = (typeof settings !== "undefined" && settings && settings.currency) || "EUR", z = NO_CENTS.includes(c);
  try { fmt = new Intl.NumberFormat(appLocale(), { style: "currency", currency: c, minimumFractionDigits: z ? 0 : 2, maximumFractionDigits: z ? 0 : 2 }); }
  catch (e) { fmt = new Intl.NumberFormat(appLocale(), { style: "currency", currency: "EUR" }); }
  fmt0 = new Intl.NumberFormat(appLocale(), { style: "currency", currency: fmt.resolvedOptions().currency, maximumFractionDigits: 0 });
  const sp = document.querySelector(".amount span"); if (sp) sp.textContent = curSym();
}
function curSym() { try { return (fmt.formatToParts(1).find(p => p.type === "currency") || {}).value || "€"; } catch (e) { return "€"; } }
applyCurrency();
function baseCurrency() { return (typeof settings !== "undefined" && settings && settings.currency) || "EUR"; }
function fmtCur(c, v) {
  const z = NO_CENTS.includes(c);
  try { return new Intl.NumberFormat(appLocale(), { style: "currency", currency: c, minimumFractionDigits: z ? 0 : 2, maximumFractionDigits: z ? 0 : 2 }).format(v || 0); }
  catch (e) { return `${v} ${c}`; }
}
function curSymOf(c) { try { return (new Intl.NumberFormat(appLocale(), { style: "currency", currency: c }).formatToParts(1).find(p => p.type === "currency") || {}).value || c; } catch (e) { return c; } }

// Devise proposée selon la région de l'appareil : fuseau horaire (où l'on est) puis région de la langue (ex. fr-SN).
const CC_CUR = { FR: "EUR", BE: "EUR", LU: "EUR", MC: "EUR", DE: "EUR", AT: "EUR", IT: "EUR", ES: "EUR", PT: "EUR", NL: "EUR", IE: "EUR", FI: "EUR", GR: "EUR", SK: "EUR", SI: "EUR", EE: "EUR", LV: "EUR", LT: "EUR", MT: "EUR", CY: "EUR", HR: "EUR", AD: "EUR", RE: "EUR", GP: "EUR", MQ: "EUR", GF: "EUR", YT: "EUR", PM: "EUR", BL: "EUR", MF: "EUR",
  SN: "XOF", CI: "XOF", ML: "XOF", BF: "XOF", NE: "XOF", TG: "XOF", BJ: "XOF", GW: "XOF", CM: "XAF", GA: "XAF", CG: "XAF", CF: "XAF", TD: "XAF", GQ: "XAF",
  US: "USD", PR: "USD", EC: "USD", SV: "USD", PA: "USD", GB: "GBP", CA: "CAD", CH: "CHF", LI: "CHF", MA: "MAD", DZ: "DZD", TN: "TND", GN: "GNF", CD: "CDF", HT: "HTG", NG: "NGN", GH: "GHS", KM: "KMF", MG: "MGA",
  JP: "JPY", CN: "CNY", IN: "INR", AU: "AUD", NZ: "NZD", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", TR: "TRY", RU: "RUB", BR: "BRL", MX: "MXN", AR: "ARS", ZA: "ZAR", EG: "EGP",
  KE: "KES", UG: "UGX", TZ: "TZS", RW: "RWF", BI: "BIF", ET: "ETB", CV: "CVE", MR: "MRU", MU: "MUR", AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", IL: "ILS", LB: "LBP", SG: "SGD", HK: "HKD", KR: "KRW", TH: "THB", VN: "VND", PH: "PHP", NC: "XPF", PF: "XPF", WF: "XPF" };
const TZ_CC = { Paris: "FR", Brussels: "BE", Luxembourg: "LU", Monaco: "MC", Berlin: "DE", Vienna: "AT", Rome: "IT", Madrid: "ES", Lisbon: "PT", Amsterdam: "NL", Dublin: "IE", Helsinki: "FI", Athens: "GR", Bratislava: "SK", Ljubljana: "SI", Tallinn: "EE", Riga: "LV", Vilnius: "LT", Malta: "MT", Nicosia: "CY", Zagreb: "HR", Andorra: "AD",
  Reunion: "RE", Guadeloupe: "GP", Martinique: "MQ", Cayenne: "GF", Mayotte: "YT", Miquelon: "PM",
  Dakar: "SN", Abidjan: "CI", Bamako: "ML", Ouagadougou: "BF", Niamey: "NE", Lome: "TG", "Porto-Novo": "BJ", Bissau: "GW", Douala: "CM", Libreville: "GA", Brazzaville: "CG", Bangui: "CF", Ndjamena: "TD", Malabo: "GQ",
  London: "GB", Zurich: "CH", Vaduz: "LI", Casablanca: "MA", "El_Aaiun": "MA", Algiers: "DZ", Tunis: "TN", Conakry: "GN", Kinshasa: "CD", Lubumbashi: "CD", "Port-au-Prince": "HT", Lagos: "NG", Accra: "GH", Comoro: "KM", Antananarivo: "MG",
  Tokyo: "JP", Shanghai: "CN", Kolkata: "IN", Calcutta: "IN", Auckland: "NZ", Stockholm: "SE", Oslo: "NO", Copenhagen: "DK", Warsaw: "PL", Prague: "CZ", Budapest: "HU", Bucharest: "RO", Istanbul: "TR", Moscow: "RU",
  Johannesburg: "ZA", Cairo: "EG", Nairobi: "KE", Kampala: "UG", "Dar_es_Salaam": "TZ", Kigali: "RW", Bujumbura: "BI", "Addis_Ababa": "ET", "Cape_Verde": "CV", Nouakchott: "MR", Mauritius: "MU", Dubai: "AE", Riyadh: "SA", Qatar: "QA", Kuwait: "KW",
  Jerusalem: "IL", "Tel_Aviv": "IL", Beirut: "LB", Singapore: "SG", "Hong_Kong": "HK", Seoul: "KR", Bangkok: "TH", "Ho_Chi_Minh": "VN", Saigon: "VN", Manila: "PH", Noumea: "NC", Tahiti: "PF", Wallis: "WF",
  "Puerto_Rico": "PR", "Mexico_City": "MX", Cancun: "MX", Monterrey: "MX", Tijuana: "MX", "Sao_Paulo": "BR", Bahia: "BR", Fortaleza: "BR", Recife: "BR", Manaus: "BR", Belem: "BR", "Buenos_Aires": "AR", Cordoba: "AR" };
function regionCurrency() {
  const ok = c => c && APP_CURRENCIES.some(x => x[0] === c);
  let tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
  const city = tz.split("/").pop();
  let tzCur = CC_CUR[TZ_CC[city]];
  if (!tzCur) {
    if (/^(Australia)\//.test(tz)) tzCur = "AUD";
    else if (/^America\/(Toronto|Vancouver|Montreal|Halifax|Winnipeg|Edmonton|Regina|St_Johns|Moncton|Whitehorse|Yellowknife|Iqaluit)/.test(tz)) tzCur = "CAD";
    else if (/^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana|Kentucky|North_Dakota|Menominee|Juneau|Sitka|Nome|Adak)|Pacific\/Honolulu|US\/)/.test(tz)) tzCur = "USD";
  }
  let langCur = null;
  for (const l of navigator.languages || [navigator.language || ""]) { const m = /-([A-Za-z]{2})\b/.exec(l || ""); if (m && ok(CC_CUR[m[1].toUpperCase()])) { langCur = CC_CUR[m[1].toUpperCase()]; break; } }
  // Africa/Abidjan et Africa/Lagos servent aussi à plusieurs pays voisins : la région de la langue départage.
  if ((city === "Abidjan" || city === "Lagos") && langCur && !["EUR", "USD", "GBP"].includes(langCur)) return langCur;
  if (ok(tzCur)) return tzCur;
  if (ok(langCur)) return langCur;
  return window.LANG === "en" ? "USD" : "EUR";
}

// ---------- Taux de change ----------
// Taux = nombre d'unités de la devise étrangère pour 1 unité de la devise du budget.
// Parités fixes (franc CFA, franc comorien ↔ euro) ; sinon taux du jour (ExchangeRate-API, Frankfurter en secours),
// gardé sur l'appareil une journée, et le dernier taux utilisé en dernier recours.
const FX_PEG = { XOF: 655.957, XAF: 655.957, KMF: 491.96775, CVE: 110.265, XPF: 119.33174 };
function fxFixed(cur, base) {
  if (cur === base) return 1;
  const pe = c => c === "EUR" ? 1 : FX_PEG[c];
  return pe(cur) && pe(base) ? pe(cur) / pe(base) : 0;
}
const FX_KEY = "bourselle-fx";
function fxCache() { try { return JSON.parse(localStorage.getItem(FX_KEY) || "null"); } catch (e) { return null; } }
let fxLoading = null;
async function fxLoad(force) {
  const base = baseCurrency(), c = fxCache();
  if (!force && c && c.base === base && c.day === todayISO()) return c;
  if (fxLoading) return fxLoading;
  fxLoading = (async () => {
    const sources = [
      async () => { const r = await (await fetch(`https://open.er-api.com/v6/latest/${base}`)).json(); if (r.result !== "success") throw 0; return { rates: r.rates, src: "ExchangeRate-API", url: "https://www.exchangerate-api.com", at: (r.time_last_update_utc || "") }; },
      async () => { const r = await (await fetch(`https://api.frankfurter.app/latest?from=${base}`)).json(); if (!r.rates) throw 0; return { rates: r.rates, src: "Frankfurter (BCE)", url: "https://frankfurter.dev", at: r.date || "" }; },
    ];
    for (const get of sources) {
      try { const d = await Promise.race([get(), new Promise((_, rej) => setTimeout(() => rej(0), 6000))]); const v = { base, day: todayISO(), ...d }; try { localStorage.setItem(FX_KEY, JSON.stringify(v)); } catch (e) {} return v; }
      catch (e) {}
    }
    return c && c.base === base ? c : null;   // hors ligne : derniers taux connus
  })();
  try { return await fxLoading; } finally { fxLoading = null; }
}
// { rate, src, live } pour une devise, ou null si inconnue
async function fxRate(cur) {
  const base = baseCurrency(), fx = fxFixed(cur, base);
  if (fx) return { rate: fx, src: "fixe" };
  const c = await fxLoad();
  if (c && c.rates && c.rates[cur]) return { rate: c.rates[cur], src: c.src, url: c.url, live: c.day === todayISO() };
  const last = (settings.fxLast || {})[cur];
  return last ? { rate: last, src: "dernier" } : null;
}
function numStr(v) { return window.LANG === "en" ? String(v) : String(v).replace(".", ","); }
function fxRound(r) { return r >= 100 ? Math.round(r * 1000) / 1000 : r >= 1 ? Math.round(r * 10000) / 10000 : Math.round(r * 1e6) / 1e6; }
function eur(v, round) { return (round ? fmt0 : fmt).format(v || 0); }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function catById(id) { return settings.cats.find(c => c.id === id) || { id, name: id || "Sans catégorie", color: "#9aa5ad", budget: 0 }; }
function itemsOf(y, m) { const d = months[ym(y, m)]; return d ? Object.entries(d.items || {}).map(([id, t]) => ({ ...t, id })) : []; }

function totals(list) {
  const t = { rentree: 0, depense: 0, epargne: 0, invest: 0, fixe: 0, variable: 0, byCat: {}, ndf: 0, ndfTodo: 0 };
  for (const x of list) {
    const a = Number(x.amount) || 0;
    if (x.type === "depense" && x.ndf) { t.ndf += a; if (x.ndfStatus !== "rembourse") t.ndfTodo += a; continue; }
    t[x.type] = (t[x.type] || 0) + a;
    if (x.type === "depense") {
      t.byCat[x.cat] = (t.byCat[x.cat] || 0) + a;
      if (x.fixe) t.fixe += a; else t.variable += a;
    }
  }
  t.result = t.rentree - t.depense;
  t.reste = t.rentree - t.depense - t.epargne - t.invest;
  return t;
}

// ---------- Stockage ----------
function setSync(state, txt) {
  document.getElementById("syncDot").className = "dot " + state;
  document.getElementById("syncTxt").textContent = txt;
}
let version = null, saveTimer = null, saving = false, dirty = false, lastError = null;
function snapshot() { return { app: "bourselle", version: 1, savedAt: new Date().toISOString(), months, settings, subs, debts, recs, goals, groups, tontines }; }
function applyData(d) {
  months = (d && d.months) || {}; subs = (d && d.subs) || {}; debts = (d && d.debts) || {}; recs = (d && d.recs) || {}; goals = (d && d.goals) || {}; groups = (d && d.groups) || {}; tontines = (d && d.tontines) || {};
  settings = { ...clone(DEFAULT_SETTINGS), ...((d && d.settings) || {}) };
  if (!(d && d.settings) && window.LANG === "en" && window.T) {   // nouveau compte en anglais : catégories par défaut en anglais
    for (const c of settings.cats) c.name = T(c.name);
    for (const k of ["rentree", "epargne", "invest"]) settings[k] = settings[k].map(x => T(x));
  }
  if (!(d && d.settings) && !settings.currency) settings.currency = regionCurrency();   // nouveau compte : devise de la région
  applyCurrency();
}
function saveNow() { clearTimeout(saveTimer); if (dirty) flush(); }   // suppressions : enregistrer sans attendre
function scheduleSave() {
  dirty = true; setSync("", "Modifications en attente…");
  clearTimeout(saveTimer); saveTimer = setTimeout(flush, 700);
}
async function flush() {
  if (!store || saving || !dirty) return;
  saving = true; dirty = false; setSync("", "Enregistrement…");
  try {
    version = await store.save(snapshot());
    lastError = null; hideReconnect();
    setSync("ok", "Enregistré · " + store.label);
  } catch (e) {
    dirty = true; lastError = e;
    if (e.code === "auth") { setSync("warn", "Reconnexion nécessaire"); showReconnect(); }
    else if (e.code === "quota") { setSync("warn", "Drive plein"); toast("Ton Drive est plein : libère de la place pour continuer à enregistrer."); }
    else { setSync("warn", "Non enregistré – nouvel essai…"); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 8000); }
  } finally {
    saving = false;
    if (dirty && !lastError) { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 300); }
  }
}
window.addEventListener("beforeunload", e => { if (dirty || saving) { flush(); e.preventDefault(); e.returnValue = ""; } });
// Un autre appareil a-t-il modifié les données ? On vérifie quand l'app revient au premier plan.
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "hidden") { flush(); return; }
  if (!store || dirty || saving || store.id === "local") return;
  try {
    const v = await store.remoteVersion();
    if (v && version && v !== version) {
      const r = await store.load();
      if (!dirty && !saving) { applyData(r.data); version = r.version; applyRecurring(); render(); toast("Données mises à jour depuis un autre appareil"); }
    }
  } catch (e) { if (e.code === "auth") showReconnect(); }
});
// Google : le jeton dure 1 h. On le renouvelle pendant un geste de l'utilisateur (sinon le navigateur bloque la fenêtre).
document.addEventListener("click", () => {
  if (store && store.tokenExpiresSoon && store.tokenExpiresSoon()) store.refresh().then(() => { if (dirty) flush(); }).catch(() => {});
}, true);
function showReconnect() { document.getElementById("reconnect").hidden = false; }
function hideReconnect() { document.getElementById("reconnect").hidden = true; }
document.getElementById("reconnectBtn").onclick = async () => {
  try { await store.signIn(true); hideReconnect(); lastError = null; dirty = true; flush(); }
  catch (e) { toast("Reconnexion impossible : " + (e.message || "réessaie")); }
};

function saveMonth() { scheduleSave(); }
function saveSettings() { scheduleSave(); }
function saveSubs() { scheduleSave(); }
function saveDebts() { scheduleSave(); }
function saveRecs() { scheduleSave(); }
function saveGoals() { scheduleSave(); }
function saveGroups() { scheduleSave(); }
function saveTontines() { scheduleSave(); }

function upsertTx(tx, oldKey) {
  const key = tx.date.slice(0, 7);
  if (oldKey && oldKey !== key && months[oldKey]) { delete months[oldKey].items[tx.id]; saveMonth(oldKey); }
  months[key] = months[key] || { items: {} };
  const { id, ...body } = tx;
  months[key].items[id] = body;
  saveMonth(key);
  render();
}
function deleteTx(id, key) {
  if (!months[key]) return;
  const old = months[key].items[id];
  if (old && old.files) for (const f of old.files) dropAsset(f.id);
  delete months[key].items[id];
  saveMonth(key);
  render();
}
const blobCache = new Map();
function fileURL(id) {
  if (!blobCache.has(id)) blobCache.set(id, store.fileBlob(id).then(b => URL.createObjectURL(b)).catch(e => { blobCache.delete(id); throw e; }));
  return blobCache.get(id);
}
function hydrate(root) {
  root.querySelectorAll("img[data-fid]").forEach(img => {
    fileURL(img.dataset.fid).then(u => { img.src = u; }).catch(() => { img.replaceWith(Object.assign(document.createElement("span"), { className: "hint", textContent: "Indisponible" })); });
  });
}
function dropAsset(id) { if (assets && id) assets.deleteFile(id).catch(() => {}); }
function allItems() { const out = []; for (const [k, d] of Object.entries(months)) for (const [id, t] of Object.entries(d.items || {})) out.push({ ...t, id, key: k }); return out; }
function setItem(x, patch) { const m = months[x.key]; if (!m || !m.items[x.id]) return; m.items[x.id] = { ...m.items[x.id], ...patch }; saveMonth(x.key); render(); }
function newId() { return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ---------- Graphiques ----------
function donut(parts, size = 150) {
  const total = parts.reduce((s, p) => s + p.v, 0);
  const r = size / 2 - 10, c = size / 2, w = 22;
  if (!total) return `<svg class="chart" viewBox="0 0 ${size} ${size}" role="img" aria-label="Aucune dépense"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${w}"/><text x="${c}" y="${c + 4}" text-anchor="middle">Aucune dépense</text></svg>`;
  let a0 = -Math.PI / 2, out = "";
  for (const p of parts) {
    if (!p.v) continue;
    const frac = p.v / total;
    if (frac >= 0.9999) { out += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${p.color}" stroke-width="${w}"/>`; break; }
    const a1 = a0 + frac * Math.PI * 2;
    const x0 = c + r * Math.cos(a0), y0 = c + r * Math.sin(a0), x1 = c + r * Math.cos(a1), y1 = c + r * Math.sin(a1);
    out += `<path d="M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${frac > .5 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}" fill="none" stroke="${p.color}" stroke-width="${w}"/>`;
    a0 = a1;
  }
  return `<svg class="chart" viewBox="0 0 ${size} ${size}" role="img" aria-label="Répartition des dépenses">${out}
    <text x="${c}" y="${c - 4}" text-anchor="middle" style="font-size:10px">Total</text>
    <text x="${c}" y="${c + 13}" text-anchor="middle" style="font-size:14px;font-weight:700;fill:var(--ink)">${esc(eur(total, true))}</text></svg>`;
}

function niceMax(v) { if (v <= 0) return 100; const p = Math.pow(10, Math.floor(Math.log10(v))); for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= v) return k * p; return 10 * p; }

function resultBars(vals) {
  const W = 340, H = 170, L = 44, R = 6, T = 10, B = 22;
  const mx = Math.max(0, ...vals), mn = Math.min(0, ...vals);
  const top = niceMax(mx || (mn ? -mn / 4 : 100)), bot = mn < 0 ? -niceMax(-mn) : 0;
  const y = v => T + (top - v) / (top - bot) * (H - T - B);
  const bw = (W - L - R) / 12;
  let g = "";
  for (const v of [...new Set([top, 0, bot])]) { g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" ${v === 0 ? 'stroke-width="1.5"' : 'stroke-dasharray="3 3"'}/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${esc(eur(v, true))}</text>`; }
  vals.forEach((v, i) => {
    const x = L + i * bw + bw * .18, w = bw * .64;
    if (v) { const y0 = y(Math.max(v, 0)), h = Math.abs(y(v) - y(0)); g += `<rect x="${x}" y="${y0}" width="${w}" height="${Math.max(h, 1)}" rx="3" fill="${v >= 0 ? "var(--good)" : "var(--bad)"}"><title>${MOIS_C[i]} : ${eur(v)}</title></rect>`; }
    g += `<text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${MOIS_C[i].slice(0, 3)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Résultat mensuel">${g}</svg>`;
}

function pairBars(a, b) {
  const W = 340, H = 170, L = 44, R = 6, T = 10, B = 22;
  const top = niceMax(Math.max(1, ...a, ...b));
  const y = v => T + (top - v) / top * (H - T - B);
  const bw = (W - L - R) / 12;
  let g = "";
  for (const v of [top, top / 2, 0]) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" ${v ? 'stroke-dasharray="3 3"' : ""}/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${esc(eur(v, true))}</text>`;
  for (let i = 0; i < 12; i++) {
    const x = L + i * bw + bw * .12, w = bw * .36;
    if (a[i]) g += `<rect x="${x}" y="${y(a[i])}" width="${w}" height="${y(0) - y(a[i])}" rx="2" fill="#2f6fb0"><title>Rentrées ${MOIS_C[i]} : ${eur(a[i])}</title></rect>`;
    if (b[i]) g += `<rect x="${x + w + 1}" y="${y(b[i])}" width="${w}" height="${y(0) - y(b[i])}" rx="2" fill="var(--accent)"><title>Dépenses ${MOIS_C[i]} : ${eur(b[i])}</title></rect>`;
    g += `<text x="${x + w}" y="${H - 6}" text-anchor="middle">${MOIS_C[i].slice(0, 3)}</text>`;
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rentrées et dépenses par mois">${g}</svg>`;
}

function catParts(byCat) {
  return Object.entries(byCat).filter(([, v]) => v > 0).map(([id, v]) => ({ id, v, color: catById(id).color, name: catById(id).name })).sort((a, b) => b.v - a.v);
}
function legendHTML(parts) {
  const tot = parts.reduce((s, p) => s + p.v, 0);
  return `<div class="legend">${parts.map(p => `<div class="row"><span class="sw" style="background:${p.color}"></span><span>${esc(p.name)}</span><span class="num">${esc(eur(p.v, true))} <span class="p">${Math.round(p.v / tot * 100)}%</span></span></div>`).join("")}</div>`;
}

// ---------- Rendu ----------
function setHeader(label, cap, value, neutral) {
  document.getElementById("periodLabel").textContent = label.charAt(0).toUpperCase() + label.slice(1);
  document.getElementById("resCap").textContent = cap;
  const big = document.getElementById("resBig");
  big.textContent = (value > 0 && !neutral ? "+" : "") + eur(value);
  big.className = "big num " + (neutral ? "" : value > 0 ? "good" : value < 0 ? "bad" : "");
  document.getElementById("resPill").innerHTML = neutral ? "" : value > 0 ? `<span class="pill good">Positif</span>` : value < 0 ? `<span class="pill bad">Négatif</span>` : "";
}

function tilesHTML(t) {
  return `<div class="tiles">
    <div class="tile"><div class="k"><span class="sw" style="background:#2f6fb0"></span>Rentrées</div><div class="v num">${eur(t.rentree)}</div></div>
    <div class="tile"><div class="k"><span class="sw" style="background:var(--accent)"></span>Dépenses</div><div class="v num">${eur(t.depense)}</div></div>
    <div class="tile"><div class="k"><span class="sw" style="background:var(--good)"></span>Épargne + invest.</div><div class="v num">${eur(t.epargne + t.invest)}</div></div>
    <div class="tile"><div class="k"><span class="sw" style="background:var(--muted)"></span>Reste disponible</div><div class="v num" style="color:${t.reste < 0 ? "var(--bad)" : "inherit"}">${eur(t.reste)}</div></div>
  </div>`;
}

function renderMois() {
  const list = itemsOf(cur.y, cur.m).sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0));
  const t = totals(list);
  setHeader(`${MOIS[cur.m - 1]} ${cur.y}`, "Résultat du mois (rentrées − dépenses)", t.result);
  const parts = catParts(t.byCat);
  const budCats = settings.cats.filter(c => (c.budget || 0) > 0 || t.byCat[c.id]);
  const fixPct = t.depense ? t.fixe / t.depense * 100 : 0;

  let html = banner + tilesHTML(t) + bilanHTML() + forecastHTML(t);
  const todoAll = allItems().filter(x => x.type === "depense" && x.ndf && x.ndfStatus !== "rembourse");
  if (todoAll.length) {
    const sum = todoAll.reduce((s, x) => s + Number(x.amount), 0);
    html += `<button class="card" id="goFrais" style="text-align:left;width:100%;cursor:pointer"><h2>Notes de frais à rembourser<small>${todoAll.length} en attente</small></h2>
      <div style="display:flex;justify-content:space-between;align-items:center"><span class="num" style="font-family:var(--display);font-size:1.3rem;font-weight:600">${esc(eur(sum))}</span><span class="hint">Voir le détail ›</span></div></button>`;
  }

  const soonG = garItems().filter(x => garStatus(x.warranty) === "soon");
  if (soonG.length) {
    html += `<button class="card" id="goGar" style="text-align:left;width:100%;cursor:pointer;border-left:6px solid var(--w-soon)"><h2>Garanties bientôt expirées<small>${soonG.length}</small></h2>
      <div class="hint">${soonG.slice(0, 3).map(x => `${esc(x.warranty.item)} : ${esc(leftTxt(daysUntil(x.warranty.end)))}`).join("<br>")}</div></button>`;
  }
  const soonA = Object.values(subs).filter(x => subStatus(x).st === "soon");
  if (soonA.length) {
    html += `<button class="card" id="goAbo" style="text-align:left;width:100%;cursor:pointer;border-left:6px solid var(--w-soon)"><h2>Abonnements à surveiller<small>${soonA.length}</small></h2>
      <div class="hint">${soonA.slice(0, 3).map(x => `${esc(x.name)} : ${esc(subStatus(x).why)}`).join("<br>")}</div></button>`;
  }
  html += tontineMoisHTML();
  const prevM = cur.m === 1 ? { y: cur.y - 1, m: 12 } : { y: cur.y, m: cur.m - 1 };
  const prevFix = itemsOf(prevM.y, prevM.m).filter(x => x.fixe && x.type === "depense" && !x.ndf);
  const hasFix = list.some(x => x.fixe && x.type === "depense");
  if (prevFix.length && !hasFix) {
    html += `<div class="card"><h2>Charges fixes<small>${prevFix.length} en ${MOIS[prevM.m - 1]}</small></h2>
      <p class="hint" style="margin:0 0 10px">Reprendre tes charges fixes de ${MOIS[prevM.m - 1]} (${esc(eur(prevFix.reduce((s, x) => s + Number(x.amount), 0)))}) pour ce mois, aux mêmes jours ?</p>
      <button class="btn primary block" id="copyFix">Reprendre les charges fixes</button></div>`;
  }

  html += `<div class="card"><h2>Dépenses par catégorie<small>${list.filter(x => x.type === "depense").length} dépenses</small></h2>
    ${parts.length ? `<div class="donut-wrap">${donut(parts)}${legendHTML(parts)}</div>` : `<div class="empty">Aucune dépense ce mois-ci. Appuie sur + pour en ajouter une.</div>`}</div>`;

  if (t.depense) html += `<div class="card"><h2>Fixes ou variables</h2>
    <div class="split"><i style="width:${fixPct}%;background:#1f4e79"></i><i style="width:${100 - fixPct}%;background:var(--accent)"></i></div>
    <div class="split-legend"><span><span class="sw" style="background:#1f4e79"></span> Fixes ${esc(eur(t.fixe, true))}</span><span>Variables ${esc(eur(t.variable, true))} <span class="sw" style="background:var(--accent)"></span></span></div></div>`;

  html += compareHTML();
  html += `<div class="card"><h2>Budget du mois<small>dépensé / prévu</small></h2><div class="bud">${budCats.map(c => {
    const sp = t.byCat[c.id] || 0, b = c.budget || 0, pct = b ? Math.min(100, sp / b * 100) : 100, over = b ? sp > b : sp > 0;
    return `<div class="row ${over ? "over" : ""}"><div class="t"><span>${esc(c.name)}</span><span class="num">${esc(eur(sp, true))} / ${b ? esc(eur(b, true)) : "pas de budget"}</span></div>
      <div class="bar"><i style="width:${pct}%;background:${over ? "var(--bad)" : c.color}"></i></div></div>`;
  }).join("") || `<div class="empty">Fixe tes budgets dans « Budget & réglages ».</div>`}</div></div>`;

  html += `<div class="card"><h2>Opérations<button class="linkbtn" id="impBtn">Importer un relevé</button></h2>${list.length ? txListHTML(list) : `<div class="empty">Rien d'enregistré pour ${MOIS[cur.m - 1]}.</div>`}</div>`;
  view.innerHTML = html;
  const ib = document.getElementById("impBtn"); if (ib) ib.onclick = startImport;
  const gf = document.getElementById("goFrais"); if (gf) gf.onclick = () => switchTab("frais");
  const gg = document.getElementById("goGar"); if (gg) gg.onclick = () => switchTab("garanties");
  const gtn = document.getElementById("goTon"); if (gtn) gtn.onclick = () => switchTab("tontines");
  const ga = document.getElementById("goAbo"); if (ga) ga.onclick = () => switchTab("abos");
  const cf = document.getElementById("copyFix");
  if (cf) cf.onclick = () => {
    const key = ym(cur.y, cur.m);
    months[key] = months[key] || { items: {} };
    const dim = new Date(cur.y, cur.m, 0).getDate();
    for (const x of prevFix) {
      const d = Math.min(dim, Number(x.date.slice(8, 10)));
      const { id, ...body } = x;
      const { files, ndf, ndfStatus, ndfPaidOn, warranty, ...rest } = body;
      months[key].items[newId()] = { ...rest, date: `${key}-${String(d).padStart(2, "0")}`, created: Date.now() };
    }
    saveMonth(key); render(); toast(`${prevFix.length} charges fixes ajoutées`);
  };
  view.querySelectorAll(".tx").forEach(b => b.onclick = () => openSheet(list.find(x => x.id === b.dataset.id)));
}

const CLIP = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M21 11l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.7 3.7 0 0 1 5.2 5.2l-9.2 9.2a1.8 1.8 0 0 1-2.6-2.6L15.7 6"/></svg>`;
function txListHTML(list, withYear) {
  let html = "", lastDay = "";
  for (const x of list) {
    if (x.date !== lastDay) {
      lastDay = x.date;
      const d = new Date(x.date + "T12:00:00");
      html += `<div class="day">${esc(d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", ...(withYear && x.date.slice(0, 4) !== String(now.getFullYear()) ? { year: "numeric" } : {}) }))}</div>`;
    }
    let name, color, sub, cls, sign;
    if (x.type === "depense") { const c = catById(x.cat); name = x.note || c.name; color = c.color; sub = c.name + (x.fixe ? " · fixe" : ""); cls = "out"; sign = "−"; }
    else if (x.type === "rentree") { name = x.note || x.cat; color = "#2f6fb0"; sub = "Rentrée · " + x.cat; cls = "in"; sign = "+"; }
    else { name = x.note || x.cat; color = x.type === "epargne" ? "#1f8a5b" : "#16324a"; sub = (x.type === "epargne" ? "Épargne · " : "Investissement · ") + x.cat; cls = "save"; sign = "→"; }
    html += `<button class="tx" data-id="${esc(x.id)}"><span class="ic" style="background:${color}">${esc((x.type === "depense" ? catById(x.cat).name : x.cat || "?").slice(0, 2))}</span>
      <span><div class="n">${esc(name)}${x.ndf ? `<span class="badge ${x.ndfStatus === "rembourse" ? "done" : "todo"}">${x.ndfStatus === "rembourse" ? "Remboursée" : "Note de frais"}</span>` : ""}</div><div class="s">${esc(sub)}${x.files && x.files.length ? `<span class="clip">${CLIP}${x.files.length}</span>` : ""}${x.warranty ? ` · garantie jusqu'au ${esc(frDate(x.warranty.end))}` : ""}</div></span><span class="a num ${cls}">${sign} ${esc(eur(x.amount))}${x.orig && x.orig.cur !== baseCurrency() ? `<small class="orig">${esc(fmtCur(x.orig.cur, x.orig.amount))}</small>` : ""}</span></button>`;
  }
  return html;
}

function renderAnnee() {
  const per = [];
  let all = [];
  for (let m = 1; m <= 12; m++) { const l = itemsOf(cur.y, m); per.push(totals(l)); all = all.concat(l); }
  const t = totals(all);
  setHeader(String(cur.y), "Résultat de l'année (rentrées − dépenses)", t.result);
  const parts = catParts(t.byCat);
  let html = banner + tilesHTML(t);
  html += `<div class="card"><h2>Résultat mois par mois</h2>${resultBars(per.map(p => p.result))}
    <div class="legend-inline"><span><span class="sw" style="background:var(--good)"></span>Positif</span><span><span class="sw" style="background:var(--bad)"></span>Négatif</span></div></div>`;
  html += `<div class="card"><h2>Rentrées et dépenses</h2>${pairBars(per.map(p => p.rentree), per.map(p => p.depense))}
    <div class="legend-inline"><span><span class="sw" style="background:#2f6fb0"></span>Rentrées</span><span><span class="sw" style="background:var(--accent)"></span>Dépenses</span></div></div>`;
  html += `<div class="card"><h2>Dépenses de l'année par catégorie</h2>${parts.length ? `<div class="donut-wrap">${donut(parts)}${legendHTML(parts)}</div>` : `<div class="empty">Aucune dépense en ${cur.y}.</div>`}</div>`;
  html += `<div class="card"><h2>Détail par mois</h2><div style="overflow-x:auto"><table class="yr num"><thead><tr><th>Mois</th><th>Rentrées</th><th>Dépenses</th><th>Épargne/inv.</th><th>Résultat</th></tr></thead><tbody>
    ${per.map((p, i) => `<tr data-m="${i + 1}"><td>${MOIS_C[i]}</td><td>${eur(p.rentree, true)}</td><td>${eur(p.depense, true)}</td><td>${eur(p.epargne + p.invest, true)}</td><td class="${p.result > 0 ? "good" : p.result < 0 ? "bad" : ""}">${eur(p.result, true)}</td></tr>`).join("")}
    <tr class="tot"><td>Total</td><td>${eur(t.rentree, true)}</td><td>${eur(t.depense, true)}</td><td>${eur(t.epargne + t.invest, true)}</td><td class="${t.result > 0 ? "good" : t.result < 0 ? "bad" : ""}">${eur(t.result, true)}</td></tr></tbody></table></div>
    <p class="hint" style="margin:8px 0 0">Touche un mois pour l'ouvrir.</p></div>`;
  view.innerHTML = html;
  view.querySelectorAll("tr[data-m]").forEach(r => r.onclick = () => { cur.m = Number(r.dataset.m); switchTab("mois"); });
}

function renderReglages() {
  setHeader(`${MOIS[cur.m - 1]} ${cur.y}`, "Résultat du mois (rentrées − dépenses)", totals(itemsOf(cur.y, cur.m)).result);
  const totalBud = settings.cats.reduce((s, c) => s + (Number(c.budget) || 0), 0);
  const u = store ? store.user() : { name: "", email: "" };
  let html = banner + `<div class="card"><h2>Mon compte<small>${esc(store ? store.label : "")}</small></h2>
    <div style="font-weight:600">${esc(u.name || "")}</div><div class="hint">${esc(u.email || "")}</div>
    <p class="hint">${store && store.id !== "local" ? `Tes données et tes factures sont dans le dossier « Bourselle » de ton ${esc(store.label)}. Personne d'autre n'y a accès.` : "Mode démo : les données restent dans ce navigateur et peuvent être perdues. Connecte-toi pour les mettre dans ton Drive."}</p>
    ${store && store.id === "local" ? `<p class="hint" style="margin:0 0 8px"><b>Associe un compte</b> pour retrouver Bourselle sur tous tes appareils : tes données d'essai seront transférées dans ton cloud.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="linkGoogle"${CFG.googleClientId ? "" : " disabled"}>Se connecter avec Google</button><button class="btn primary" id="linkMicrosoft"${CFG.microsoftClientId ? "" : " disabled"}>Se connecter avec Microsoft</button></div>
    <div style="margin-top:8px"><button class="btn danger" id="logout" data-l="Quitter le mode essai">Quitter le mode essai</button></div></div>`
    : `<div style="display:flex;gap:8px;flex-wrap:wrap">${store && store.folderUrl() ? `<a class="btn" href="${esc(store.folderUrl())}" target="_blank" rel="noopener">Ouvrir mon dossier</a>` : ""}<button class="btn danger" id="logout" data-l="Se déconnecter">Se déconnecter</button></div></div>`}
  <div class="card"><h2>Langue et devise</h2>
    <div class="two"><div><label class="lbl" for="setLang">Langue</label><select class="field" id="setLang"><option value="fr"${window.LANG !== "en" ? " selected" : ""}>Français</option><option value="en"${window.LANG === "en" ? " selected" : ""}>English</option></select></div>
      <div><label class="lbl" for="setCur">Devise</label><select class="field" id="setCur">${APP_CURRENCIES.map(([c, l]) => `<option value="${c}"${c === (settings.currency || "EUR") ? " selected" : ""}>${esc(c)} · ${esc(l)}</option>`).join("")}</select></div></div>
    ${(() => { const rc = regionCurrency(), lb = (APP_CURRENCIES.find(x => x[0] === rc) || [, rc])[1]; return rc !== baseCurrency() ? `<div class="banner" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:10px"><span><span>Devise de ta région :</span> <b>${esc(rc)} · ${esc(lb)}</b></span><button class="btn" type="button" id="useRegionCur" data-c="${esc(rc)}">Utiliser cette devise</button></div>` : ""; })()}
    <p class="hint">En changeant de devise, tu peux convertir tous tes montants au taux du jour. Les tontines peuvent avoir leur propre devise, convertie dans celle-ci.</p>
    <p class="hint">Une opération peut aussi être saisie dans une autre devise (bouton à côté du montant) : elle est convertie au taux du jour, que tu peux corriger. Taux fournis par <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener">Rates By Exchange Rate API</a>${(fxCache() || {}).day ? ` · mis à jour le ${esc(frDate(fxCache().day))}` : ""}.</p></div>
  <div class="card"><h2>Budget mensuel par catégorie<small>total ${esc(eur(totalBud, true))}</small></h2>
    ${settings.cats.map((c, i) => `<div class="set-row"><input type="color" value="${esc(c.color)}" data-i="${i}" data-f="color" aria-label="Couleur ${esc(c.name)}">
      <input class="field" value="${esc(c.name)}" data-i="${i}" data-f="name" aria-label="Nom de la catégorie">
      <input class="field num" inputmode="decimal" value="${c.budget || ""}" placeholder="0 ${esc(curSym())}" data-i="${i}" data-f="budget" aria-label="Budget ${esc(c.name)}"></div>`).join("")}
    <div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="addCat">+ Ajouter une catégorie</button></div>
    <p class="hint">Les modifications sont enregistrées dès que tu quittes le champ.</p></div>`;
  html += importCardHTML();
  html += recsCardHTML();
  html += `<div class="card"><h2>Rappel des garanties</h2><label class="hint" for="warnDays">Signaler une garantie comme « bientôt expirée » ce nombre de jours avant la fin :</label>
    <input class="field num" id="warnDays" inputmode="numeric" value="${warnDays()}" style="margin-top:8px;max-width:120px"></div>`;
  for (const k of ["rentree", "epargne", "invest"]) {
    const lbl = { rentree: "Sources de rentrées", epargne: "Comptes épargne", invest: "Types d'investissement" }[k];
    html += `<div class="card"><h2>${lbl}</h2><input class="field" id="list-${k}" value="${esc(settings[k].join(", "))}" aria-label="${lbl}"><p class="hint">Sépare les choix par des virgules.</p></div>`;
  }
  html += `<div class="card"><h2>Exporter mes données</h2>
    <p class="hint" style="margin-top:0">Fichier CSV de toutes tes opérations, à ouvrir dans Excel ou à coller dans ton tableau de suivi.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="dl">Télécharger le CSV</button><button class="btn" id="cp">Copier le CSV</button></div>
    <p class="hint">Sauvegarde complète (budgets, abonnements, dettes…), sans les factures qui restent dans ton Drive.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="dlAll">Sauvegarde complète (JSON)</button>
    <label class="btn" for="importFile" style="cursor:pointer">Importer un fichier</label><input type="file" id="importFile" accept=".json,application/json" hidden></div>
    <p class="hint">Importer ajoute les données du fichier (par exemple l'export de l'ancienne version) à celles que tu as déjà, sans rien effacer.</p></div>
    <div class="card"><h2>Installer sur ton téléphone</h2><p class="hint" style="margin:0">iPhone : dans Safari, bouton Partager puis « Sur l'écran d'accueil ». Android : dans Chrome, menu ⋮ puis « Ajouter à l'écran d'accueil ».</p></div>`;
  view.innerHTML = html;
  view.querySelectorAll("[data-f]").forEach(inp => inp.onchange = () => {
    const c = settings.cats[Number(inp.dataset.i)], f = inp.dataset.f;
    if (f === "budget") c.budget = parseAmount(inp.value) || 0;
    else if (f === "name") { if (!inp.value.trim()) { inp.value = c.name; return; } c.name = inp.value.trim(); }
    else c.color = inp.value;
    saveSettings(); render();
  });
  document.getElementById("addCat").onclick = () => {
    settings.cats.push({ id: "c" + Date.now().toString(36), name: "Nouvelle catégorie", budget: 0, color: "#8e9eab", fixe: false });
    saveSettings(); render();
  };
  for (const k of ["rentree", "epargne", "invest"]) document.getElementById("list-" + k).onchange = e => {
    const v = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
    if (v.length) { settings[k] = v; saveSettings(); }
  };
  bindRecsCard();
  document.getElementById("setCur").onchange = e => changeCurrency(e.target.value);
  const urc = document.getElementById("useRegionCur"); if (urc) urc.onclick = () => { const sel = document.getElementById("setCur"); if (sel) sel.value = urc.dataset.c; changeCurrency(urc.dataset.c); };
  document.getElementById("setLang").onchange = e => { if (typeof setLang === "function") setLang(e.target.value); };
  document.getElementById("impBtn2").onclick = startImport;
  document.getElementById("warnDays").onchange = e => { const v = parseInt(e.target.value, 10); if (v > 0 && v < 1000) { settings.warnDays = v; saveSettings(); render(); } else e.target.value = warnDays(); };
  document.getElementById("dl").onclick = exportCSV;
  document.getElementById("dlAll").onclick = () => {
    const m = clone(months);
    for (const d of Object.values(m)) for (const t of Object.values(d.items || {})) delete t.files;
    saveFile(`bourselle-sauvegarde-${todayISO()}.json`, JSON.stringify({ app: "bourselle", version: 1, exportedAt: new Date().toISOString(), months: m, settings, subs, debts, recs, goals, groups, tontines }, null, 1));
  };
  document.getElementById("importFile").onchange = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || (d.app !== "bourselle" && d.app !== "mon-budget")) throw new Error("format");
      const n = importData(d);
      render(); toast(`${n} élément${n > 1 ? "s" : ""} importé${n > 1 ? "s" : ""}`);
    } catch (err) { toast("Ce fichier n'est pas une sauvegarde de Bourselle."); }
  };
  document.getElementById("logout").onclick = e => {
    const b = e.currentTarget;
    if (dirty || saving) { toast("Patiente, l'enregistrement est en cours…"); flush(); return; }
    if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = store && store.id === "local" ? "Confirmer (tes données restent sur cet appareil)" : "Confirmer la déconnexion"; setTimeout(() => { b.dataset.c = ""; b.textContent = b.dataset.l; }, 3000); return; }
    signOut();
  };
  for (const [bid, pid] of [["linkGoogle", "google"], ["linkMicrosoft", "microsoft"]]) { const lb = document.getElementById(bid); if (lb) lb.onclick = () => linkAccount(pid); }
  document.getElementById("cp").onclick = async () => { try { await navigator.clipboard.writeText(buildCSV()); toast("CSV copié"); } catch (e) { toast("Copie impossible ici"); } };
}

function buildCSV(filter) {
  const rows = [["Date", "Type", "Catégorie / source", "Note", "Montant", "Fixe", "Note de frais", "Statut", "Justificatifs", "Article garanti", "Fin de garantie", "Magasin", "N° de série", "Infos garantie", "Montant d'origine", "Devise d'origine", "Taux"].map(h => window.T ? T(h) : h)];
  const all = [];
  for (const [k, d] of Object.entries(months)) for (const [id, t] of Object.entries(d.items || {})) if (!filter || filter(t)) all.push(t);
  all.sort((a, b) => a.date.localeCompare(b.date));
  for (const t of all) rows.push([t.date.split("-").reverse().join("/"), TYPES.find(x => x.id === t.type)?.label || t.type,
    t.type === "depense" ? catById(t.cat).name : t.cat, t.note || "", String(t.amount).replace(".", ","), t.fixe ? "Fixe" : "Variable",
    t.ndf ? "Oui" : "", t.ndf ? (t.ndfStatus === "rembourse" ? "Remboursée" + (t.ndfPaidOn ? " le " + t.ndfPaidOn.split("-").reverse().join("/") : "") : "À rembourser") : "",
    String((t.files || []).length || ""), t.warranty ? t.warranty.item : "", t.warranty ? frDate(t.warranty.end) : "",
    t.warranty ? t.warranty.shop || "" : "", t.warranty ? t.warranty.serial || "" : "", t.warranty ? t.warranty.info || "" : "",
    t.orig ? String(t.orig.amount).replace(".", ",") : "", t.orig ? t.orig.cur : "", t.orig ? String(t.orig.rate).replace(".", ",") : ""]);
  return "﻿" + rows.map(r => r.map(v => /[;"\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v).join(";")).join("\r\n");
}
function downloadURL(url, filename) {
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
}
function saveFile(filename, data) {
  const type = filename.endsWith(".csv") ? "text/csv;charset=utf-8" : filename.endsWith(".json") ? "application/json" : "application/octet-stream";
  const u = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  downloadURL(u, filename); setTimeout(() => URL.revokeObjectURL(u), 60000);
  return true;
}
function importData(d) {
  let n = 0;
  for (const [k, m] of Object.entries(d.months || {})) {
    months[k] = months[k] || { items: {} };
    for (const [id, t] of Object.entries((m && m.items) || {})) {
      if (months[k].items[id]) continue;
      const { files, ...rest } = t; months[k].items[id] = rest; n++;
    }
  }
  for (const [id, x] of Object.entries(d.subs || {})) if (!subs[id]) { subs[id] = x; n++; }
  for (const [id, x] of Object.entries(d.debts || {})) if (!debts[id]) { debts[id] = x; n++; }
  for (const [id, x] of Object.entries(d.recs || {})) if (!recs[id]) { recs[id] = x; n++; }
  for (const [id, x] of Object.entries(d.goals || {})) if (!goals[id]) { goals[id] = x; n++; }
  for (const [id, x] of Object.entries(d.groups || {})) if (!groups[id]) { groups[id] = x; n++; }
  for (const [id, x] of Object.entries(d.tontines || {})) if (!tontines[id]) { tontines[id] = x; n++; }
  if (d.settings && Array.isArray(d.settings.cats)) {
    for (const c of d.settings.cats) {
      const mine = settings.cats.find(x => x.id === c.id);
      if (!mine) settings.cats.push(c); else if (!mine.budget && c.budget) mine.budget = c.budget;
    }
    for (const k of ["rentree", "epargne", "invest"]) if (Array.isArray(d.settings[k])) settings[k] = Array.from(new Set([...settings[k], ...d.settings[k]]));
    if (d.settings.warnDays) settings.warnDays = d.settings.warnDays;
  }
  scheduleSave();
  return n;
}
function exportCSV() { saveFile(`bourselle-${todayISO()}.csv`, buildCSV()); }

let banner = "";
function showBanner(t) { banner = `<div class="banner">${esc(t)}</div>`; }
const view = document.getElementById("view");
// Ordre des suivis : d'abord un ordre par défaut (du plus courant au plus rare), puis il s'adapte à
// ce que chaque personne ouvre le plus souvent sur son appareil. Recalculé à l'ouverture de l'app
// seulement, pour que les onglets ne bougent pas pendant qu'on s'en sert.
const SUBS_DEF = [["abos", "Abonnements"], ["tontines", "Tontines"], ["objectifs", "Objectifs"], ["economies", "Économies"], ["partage", "Partage"], ["dettes", "Dettes"], ["frais", "Frais"], ["garanties", "Garanties"]];
const SUB_KEY = "bourselle-suivis";
function subUse() { try { return JSON.parse(localStorage.getItem(SUB_KEY) || "{}") || {}; } catch (e) { return {}; } }
function bumpSub(k) { try { const u = subUse(); u[k] = (u[k] || 0) + 1; localStorage.setItem(SUB_KEY, JSON.stringify(u)); } catch (e) {} }
const SUBS = SUBS_DEF;   // ordre fixe : abonnements, tontines, objectifs, économies, partage, dettes, frais, garanties
let lastSub = SUBS[0][0];
function isSub(t) { return SUBS.some(([k]) => k === t); }
function render() {
  const arrows = !["garanties", "abos", "dettes", "recherche", "objectifs", "economies", "partage", "tontines"].includes(tab);
  if (!document.getElementById("app").hidden) document.getElementById("fab").hidden = tab === "economies";
  document.getElementById("prev").style.visibility = arrows ? "visible" : "hidden";
  document.getElementById("next").style.visibility = arrows ? "visible" : "hidden";
  if (tab === "mois") renderMois(); else if (tab === "annee") renderAnnee(); else if (tab === "frais") renderFrais();
  else if (tab === "garanties") renderGaranties(); else if (tab === "abos") renderAbos(); else if (tab === "dettes") renderDettes(); else if (tab === "recherche") renderRecherche(); else if (tab === "objectifs") renderObjectifs(); else if (tab === "economies" && typeof renderEconomies === "function") renderEconomies(); else if (tab === "partage") renderPartage(); else if (tab === "tontines") renderTontines(); else renderReglages();
  const nGar = garItems().filter(x => garStatus(x.warranty) === "soon").length;
  const nAbo = Object.values(subs).filter(x => subStatus(x).st === "soon").length;
  const nFrais = allItems().filter(x => x.type === "depense" && x.ndf && x.ndfStatus !== "rembourse").length;
  const nTon = tontineAlerts();
  const cnt = document.getElementById("garCnt"); cnt.hidden = !(nGar + nAbo + nTon); cnt.textContent = nGar + nAbo + nTon;
  const sn = document.getElementById("subnav");
  sn.hidden = !isSub(tab);
  if (isSub(tab)) {
    const c = { frais: nFrais, garanties: nGar, abos: nAbo, dettes: 0, objectifs: 0, economies: 0, partage: 0, tontines: nTon };
    sn.innerHTML = `<div class="seg" role="tablist">${SUBS.map(([k, l]) => `<button type="button" role="tab" aria-pressed="${k === tab}" data-sub="${k}">${l}${c[k] ? `<span class="cnt">${c[k]}</span>` : ""}</button>`).join("")}</div>`;
    sn.querySelectorAll("[data-sub]").forEach(b => b.onclick = () => switchTab(b.dataset.sub));
    const act = sn.querySelector('[aria-pressed="true"]'); if (act) act.scrollIntoView({ inline: "center", block: "nearest" });
  }
}
function switchTab(t) {
  if (t === "suivis") t = lastSub;
  if (isSub(t)) { if (t !== tab) bumpSub(t); lastSub = t; }
  tab = t;
  document.querySelectorAll("nav.tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === t || (b.dataset.tab === "suivis" && isSub(t)))));
  render(); window.scrollTo(0, 0);
}
document.querySelectorAll("nav.tabs button").forEach(b => b.onclick = () => switchTab(b.dataset.tab));
function step(d) {
  if (tab === "annee" || tab === "frais") cur.y += d;
  else { cur.m += d; if (cur.m < 1) { cur.m = 12; cur.y--; } if (cur.m > 12) { cur.m = 1; cur.y++; } }
  render();
}
document.getElementById("searchBtn").onclick = () => switchTab("recherche");
document.getElementById("prev").onclick = () => step(-1);
document.getElementById("next").onclick = () => step(1);

let toastT;
function toast(t) { const el = document.getElementById("toast"); el.textContent = t; el.style.display = "block"; clearTimeout(toastT); toastT = setTimeout(() => el.style.display = "none", 3200); }

// ---------- Formulaire ----------
let form = null;
const MAX_FILE = 20 * 1024 * 1024;
function parseNum(s) { const v = parseFloat(String(s).replace(/\s/g, "").replace(",", ".")); return isFinite(v) ? v : NaN; }
function parseAmount(s) { const v = parseFloat(String(s).replace(/\s/g, "").replace(",", ".")); return isFinite(v) ? Math.round(v * 100) / 100 : NaN; }
function openSheet(tx) {
  const editing = !!tx;
  const base = cur.y === now.getFullYear() && cur.m === now.getMonth() + 1 ? todayISO() : `${ym(cur.y, cur.m)}-01`;
  form = editing ? { ...clone(tx), oldKey: tx.date.slice(0, 7) }
    : { id: newId(), type: "depense", amount: "", cat: "courses", date: tab === "frais" ? todayISO() : base, note: "", fixe: false, ndf: tab === "frais", ndfStatus: "a_rembourser" };
  form.files = form.files || []; form.uploaded = []; form.removed = []; form.busy = 0; form.repeat = ""; hideGarAsk();
  const w = form.warranty || null;
  form.gar = { on: !!w, months: w ? (w.months ?? 0) : 24, end: w ? w.end : "" };
  document.getElementById("gItem").value = w ? w.item || "" : "";
  document.getElementById("gShop").value = w ? w.shop || "" : "";
  document.getElementById("gSerial").value = w ? w.serial || "" : "";
  document.getElementById("gInfo").value = w ? w.info || "" : "";
  document.getElementById("gEnd").value = w ? w.end : "";
  form.ocur = form.orig && form.orig.cur ? form.orig.cur : baseCurrency();
  form.orate = form.orig && form.orig.rate ? form.orig.rate : "";
  const amt0 = form.orig && form.orig.amount != null ? form.orig.amount : form.amount;
  document.getElementById("fAmount").value = amt0 === "" ? "" : String(amt0).replace(".", ",");
  const cs = document.getElementById("fCur");
  if (cs) {
    cs.innerHTML = APP_CURRENCIES.map(([c]) => `<option value="${c}">${esc(curSymOf(c) === c ? c : curSymOf(c) + " " + c)}</option>`).join("");
    cs.value = form.ocur;
    cs.onchange = () => { form.ocur = cs.value; form.orate = ""; drawFx(true); };
  }
  drawFx(false);
  document.getElementById("fDate").value = form.date;
  document.getElementById("fNote").value = form.note || "";
  document.getElementById("fDelete").hidden = !editing;
  drawForm();
  document.getElementById("sheetRoot").classList.add("open");
  if (!editing) setTimeout(() => document.getElementById("fAmount").focus(), 60);
}
function drawFx(fetchRate) {
  const line = document.getElementById("fxLine"); if (!line || !form) return;
  const base = baseCurrency(), cur = form.ocur || base;
  line.hidden = cur === base;
  if (cur === base) return;
  const show = info => {
    if (!form || form.ocur !== cur) return;
    const ri = document.getElementById("fRate");
    if (!form.orate && info) form.orate = fxRound(info.rate);
    if (ri && document.activeElement !== ri) ri.value = form.orate ? numStr(form.orate) : "";
    const src = document.getElementById("fxSrc");
    if (src) src.innerHTML = !info ? "Indique le taux de change." : info.src === "fixe" ? "Parité fixe." : info.src === "dernier" ? "Dernier taux utilisé (taux du jour indisponible hors connexion)." : `Taux du jour : <a href="${esc(info.url)}" target="_blank" rel="noopener">${esc(info.src)}</a>. Tu peux le corriger (taux de ta banque ou de ton transfert).`;
    fxPreview();
  };
  document.getElementById("fxBase").textContent = `1 ${curSymOf(base)} =`;
  document.getElementById("fxCur").textContent = curSymOf(cur);
  if (form.orate && !fetchRate) { show({ rate: form.orate, src: form.orig && form.orig.src || "dernier" }); return; }
  document.getElementById("fxSrc").textContent = "Recherche du taux du jour…";
  fxRate(cur).then(show);
}
function fxPreview() {
  const el = document.getElementById("fxEq"); if (!el || !form) return;
  const a = parseAmount(document.getElementById("fAmount").value), r = parseNum(document.getElementById("fRate").value);
  el.textContent = a > 0 && r > 0 ? `≈ ${eur(Math.round(a / r * 100) / 100)}` : "";
}
document.getElementById("fAmount").addEventListener("input", () => { if (form && form.ocur && form.ocur !== baseCurrency()) fxPreview(); });
document.getElementById("fRate").addEventListener("input", e => { if (!form) return; form.orate = parseNum(e.target.value) || ""; fxPreview(); });
// ---------- Changer la devise du budget ----------
// R = nombre d'unités de la nouvelle devise pour 1 unité de l'ancienne.
function convertAll(R, to) {
  const r2 = v => Math.round((Number(v) || 0) * R * 100) / 100;
  for (const d of Object.values(months)) for (const t of Object.values(d.items || {})) {
    if (t.orig && t.orig.cur === to) { t.amount = t.orig.amount; t.orig.rate = 1; }
    else { t.amount = r2(t.amount); if (t.orig && t.amount > 0) t.orig.rate = Math.round(t.orig.amount / t.amount * 1e6) / 1e6; }
  }
  for (const c of settings.cats) if (c.budget) c.budget = r2(c.budget);
  for (const x of Object.values(subs)) x.amount = r2(x.amount);
  for (const x of Object.values(recs)) x.amount = r2(x.amount);
  for (const x of Object.values(goals)) { x.target = r2(x.target); if (x.initial) x.initial = r2(x.initial); }
  for (const x of Object.values(debts)) { x.amount = r2(x.amount); if (x.monthly) x.monthly = r2(x.monthly); for (const p of x.payments || []) p.amount = r2(p.amount); }
  for (const g of Object.values(groups)) for (const e of Object.values(g.expenses || {})) e.amount = r2(e.amount);
  for (const t of Object.values(tontines)) if (t.rate) t.rate = Math.round(Number(t.rate) / R * 1e6) / 1e6;   // taux = devise de la tontine pour 1 unité du budget
  const fl = settings.fxLast || {}; for (const k of Object.keys(fl)) fl[k] = Math.round(fl[k] / R * 1e6) / 1e6;
}
function changeCurrency(to) {
  const from = baseCurrency(), sel = document.getElementById("setCur");
  if (to === from) return;
  const hasData = Object.values(months).some(d => Object.keys(d.items || {}).length) || Object.keys(subs).length || Object.keys(debts).length || Object.keys(goals).length || Object.keys(recs).length;
  if (!hasData) { settings.currency = to; applyCurrency(); saveSettings(); render(); toast(`Devise : ${to}`); return; }
  let mode = "convert";
  const f = openForm(`<div class="f2"><h3>Passer de ${esc(from)} à ${esc(to)}</h3>
    <div class="chips" id="ccMode"></div>
    <div id="ccRateWrap"><div class="fx-rate" style="margin-top:12px"><span>1 ${esc(curSymOf(from))} =</span><input id="ccRate" class="field num" inputmode="decimal" aria-label="Taux de change"><span>${esc(curSymOf(to))}</span></div>
      <p class="hint" id="ccSrc" style="margin:6px 0 0">Recherche du taux du jour…</p>
      <p class="hint" id="ccEx" style="margin:6px 0 0"></p></div>
    <p class="hint" id="ccHelp" style="margin:10px 0 0"></p></div>`, () => {
    if (mode === "convert") {
      const R = parseNum(val("ccRate"));
      if (!(R > 0)) { toast("Indique le taux de change"); return false; }
      convertAll(R, to);
    }
    settings.currency = to; applyCurrency(); localStorage.removeItem(FX_KEY);
    saveSettings(); saveMonth(); saveSubs(); saveDebts(); saveRecs(); saveGoals(); saveGroups(); saveTontines();
    render(); toast(mode === "convert" ? `Tous les montants sont convertis en ${to}` : `Devise : ${to}`);
  });
  f.querySelector("button[type=submit]").textContent = "Changer la devise";
  document.getElementById("f2Cancel").addEventListener("click", () => { if (sel) sel.value = from; });
  document.getElementById("s2bg").addEventListener("click", () => { if (sel) sel.value = from; }, { once: true });
  const help = () => {
    document.getElementById("ccRateWrap").hidden = mode !== "convert";
    document.getElementById("ccHelp").textContent = mode === "convert"
      ? "Tous tes montants (opérations, budgets, abonnements, dettes, objectifs, groupes) sont convertis à ce taux. Les opérations saisies dans la nouvelle devise retrouvent leur montant exact."
      : "Les montants ne changent pas : seul le symbole de la devise change. À choisir si tes montants étaient déjà dans la nouvelle devise.";
  };
  chipsPick("ccMode", [["convert", "Convertir mes montants"], ["label", "Changer seulement l'affichage"]], mode, v => { mode = v; help(); });
  help();
  const ex = () => { const R = parseNum(val("ccRate")); document.getElementById("ccEx").textContent = R > 0 ? `Exemple : ${fmtCur(from, 100)} → ${fmtCur(to, Math.round(100 * R * 100) / 100)}` : ""; };
  document.getElementById("ccRate").addEventListener("input", ex);
  const fx = fxFixed(to, from);
  const fill = (rate, txt) => { const el = document.getElementById("ccRate"); if (el && !el.value) el.value = numStr(fxRound(rate)); document.getElementById("ccSrc").innerHTML = txt; ex(); };
  if (fx) fill(fx, "Parité fixe.");
  else fetch(`https://open.er-api.com/v6/latest/${from}`).then(r => r.json()).then(d => {
    if (d.result === "success" && d.rates[to]) fill(d.rates[to], `Taux du jour : <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener">ExchangeRate-API</a>. Tu peux le corriger.`); else throw 0;
  }).catch(() => { const c = fxCache(); const r = c && c.base === from && c.rates && c.rates[to]; if (r) fill(r, "Dernier taux connu (hors connexion)."); else document.getElementById("ccSrc").textContent = "Indique le taux de change."; });
}
function closeSheet(saved) {
  if (form && !saved) for (const id of form.uploaded) dropAsset(id);   // annulé : on retire les fichiers ajoutés
  document.getElementById("sheetRoot").classList.remove("open"); form = null;
}
function drawForm() {
  document.getElementById("typeSeg").innerHTML = TYPES.map(t => `<button type="button" aria-pressed="${t.id === form.type}" data-t="${t.id}">${t.label}</button>`).join("");
  document.querySelectorAll("#typeSeg button").forEach(b => b.onclick = () => {
    form.type = b.dataset.t;
    form.cat = form.type === "depense" ? "courses" : settings[form.type][0];
    form.fixe = form.type === "depense" ? catById(form.cat).fixe : false;
    if (form.type !== "depense") form.ndf = false;
    drawForm();
  });
  const opts = form.type === "depense" ? settings.cats.map(c => ({ id: c.id, name: c.name, color: c.color })) : settings[form.type].map(s => ({ id: s, name: s }));
  if (form.type !== "depense" && !opts.some(o => o.id === form.cat)) opts.push({ id: form.cat, name: form.cat });
  document.getElementById("catLbl").textContent = { depense: "Catégorie", rentree: "Source", epargne: "Compte", invest: "Type d'investissement" }[form.type];
  document.getElementById("fCats").innerHTML = opts.map(o => `<button type="button" class="chip" aria-pressed="${o.id === form.cat}" data-c="${esc(o.id)}">${o.color ? `<span class="sw" style="background:${o.color}"></span>` : ""}${esc(o.name)}</button>`).join("");
  document.querySelectorAll("#fCats .chip").forEach(b => b.onclick = () => {
    form.cat = b.dataset.c;
    if (form.type === "depense" && !form.ndf) form.fixe = !!catById(form.cat).fixe;
    drawForm();
  });
  const isDep = form.type === "depense";
  const fx = document.getElementById("fFixe");
  fx.checked = !!form.fixe && !form.ndf; fx.disabled = !isDep || form.ndf;
  fx.closest(".toggle").style.opacity = isDep && !form.ndf ? 1 : .45;
  fx.onchange = () => form.fixe = fx.checked;
  // note de frais
  document.getElementById("ndfWrap").hidden = !isDep;
  const nd = document.getElementById("fNdf");
  nd.checked = !!form.ndf;
  nd.onchange = () => { form.ndf = nd.checked; if (form.ndf) { form.fixe = false; form.ndfStatus = form.ndfStatus || "a_rembourser"; } drawForm(); };
  const st = document.getElementById("fNdfStatus");
  st.hidden = !form.ndf;
  st.querySelectorAll("button").forEach(b => { b.setAttribute("aria-pressed", String(b.dataset.s === (form.ndfStatus || "a_rembourser"))); b.onclick = () => { form.ndfStatus = b.dataset.s; drawForm(); }; });
  drawGar();
  drawGoalPick();
  drawRep();
  document.getElementById("scanBtn").hidden = !!form.oldKey || form.type !== "depense";
  drawFiles();
}
function garEnd() {
  if (!form) return "";
  if (form.gar.months > 0) { const d = document.getElementById("fDate").value; return /^\d{4}-\d{2}-\d{2}$/.test(d) ? addMonths(d, form.gar.months) : ""; }
  return document.getElementById("gEnd").value;
}
function drawGar() {
  const isDep = form.type === "depense";
  document.getElementById("garWrap").hidden = !isDep;
  const cb = document.getElementById("fGar");
  cb.checked = form.gar.on;
  cb.onchange = () => { form.gar.on = cb.checked; drawGar(); if (cb.checked) document.getElementById("gItem").focus(); };
  document.getElementById("garFields").hidden = !form.gar.on;
  document.getElementById("gDur").innerHTML = DURS.map(([m, l]) => `<button type="button" class="chip" aria-pressed="${form.gar.months === m}" data-m="${m}">${l}</button>`).join("");
  document.querySelectorAll("#gDur .chip").forEach(b => b.onclick = () => {
    form.gar.months = Number(b.dataset.m);
    if (!form.gar.months && !document.getElementById("gEnd").value) document.getElementById("gEnd").value = addMonths(document.getElementById("fDate").value || todayISO(), 24);
    drawGar();
  });
  document.getElementById("gEnd").hidden = form.gar.months > 0;
  const end = garEnd();
  document.getElementById("gEndTxt").textContent = end ? `Garantie jusqu'au ${frDate(end)} (${leftTxt(daysUntil(end))})` : "";
}
document.getElementById("fDate").addEventListener("change", () => { if (form) drawGar(); });
document.getElementById("gEnd").addEventListener("change", () => { if (form) drawGar(); });
// La facture d'un achat garanti vient d'être retirée : proposer de supprimer aussi la garantie.
function askDropWarranty() {
  let box = document.getElementById("garAsk");
  if (!box) { box = document.createElement("div"); box.id = "garAsk"; box.className = "banner"; document.getElementById("filesHint").after(box); }
  const item = (document.getElementById("gItem").value || "").trim() || (document.getElementById("fNote").value || "").trim();
  box.hidden = false;
  box.innerHTML = `<div style="margin-bottom:8px"><span>Cette facture servait de preuve pour la garantie</span>${item ? ` <b>« ${esc(item)} »</b>` : ""}. <span>Supprimer aussi la garantie ?</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn" id="garKeep">Garder la garantie</button><button type="button" class="btn danger" id="garDrop">Supprimer la garantie</button></div>`;
  document.getElementById("garKeep").onclick = () => { box.hidden = true; };
  document.getElementById("garDrop").onclick = () => { form.gar.on = false; drawGar(); box.hidden = true; toast("Garantie retirée : enregistre pour confirmer"); };
}
function hideGarAsk() { const b = document.getElementById("garAsk"); if (b) b.hidden = true; }
function drawFiles() {
  const box = document.getElementById("fFiles"), hint = document.getElementById("filesHint");
  let html = form.files.map((f, i) => `<button type="button" class="file" data-i="${i}" aria-label="Voir ${esc(f.name)}">
      ${String(f.type).startsWith("image/") ? `<img data-fid="${esc(f.id)}" alt="">` : `<span class="pdf">PDF</span>`}
      <span class="x" data-x="${i}" role="button" aria-label="Retirer ${esc(f.name)}">✕</span></button>`).join("");
  for (let k = 0; k < form.busy; k++) html += `<div class="file busy"><span class="hint">Envoi…</span></div>`;
  if (assets) html += `<label class="file add" for="fFileInput">+ Photo<br>ou PDF</label>`;
  box.innerHTML = html; hydrate(box);
  hint.textContent = assets ? (form.files.length ? "Touche un justificatif pour le voir ou le télécharger." : "Prends la facture en photo ou choisis un PDF (20 Mo max).")
    : "Les factures demandent un compte Google ou Microsoft (pas disponible en mode démo).";
  box.querySelectorAll(".file[data-i]").forEach(b => b.onclick = ev => {
    const x = ev.target.closest("[data-x]");
    const f = form.files[Number(b.dataset.i)];
    if (x) {
      form.files.splice(Number(b.dataset.i), 1);
      if (form.uploaded.includes(f.id)) { dropAsset(f.id); form.uploaded = form.uploaded.filter(id => id !== f.id); }
      else form.removed.push(f.id);
      drawFiles();
      if (!form.files.length && form.gar.on) askDropWarranty();
      return;
    }
    openViewer(f);
  });
}
document.getElementById("fFileInput").onchange = e => { const picked = Array.from(e.target.files || []); e.target.value = ""; uploadPicked(picked); };
async function uploadPicked(picked) {
  if (!assets || !form) return;
  const f0 = form;
  for (const file of picked) {
    if (file.size > MAX_FILE) { toast(`« ${file.name} » dépasse 20 Mo.`); continue; }
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    let type = file.type;
    if (!type) type = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : ["jpg", "jpeg"].includes(ext) ? "image/jpeg" : "";
    if (!["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"].includes(type)) { toast("Format non accepté : utilise une photo JPG/PNG ou un PDF."); continue; }
    f0.busy++; if (form === f0) drawFiles();
    try {
      const res = await assets.uploadFile(file, type);
      f0.files.push({ id: res.id, name: res.name || ("facture." + (type === "application/pdf" ? "pdf" : "jpg")), type: res.type });
      f0.uploaded.push(res.id);
      if (form !== f0) dropAsset(res.id);   // formulaire fermé entre-temps
    } catch (err) {
      const c = err && err.code;
      if (c === "auth") showReconnect();
      toast(c === "quota" ? "Ton Drive est plein." : c === "auth" ? "Reconnecte-toi puis réessaie." : "Envoi impossible. Vérifie ta connexion et réessaie.");
    }
    f0.busy--; if (form === f0) drawFiles();
  }
}
document.getElementById("fab").onclick = () => tab === "abos" ? editSub(null) : tab === "dettes" ? editDebt(null) : tab === "objectifs" ? editGoal(null) : tab === "partage" ? (openGroup ? editGroupExpense(openGroup, null) : editGroup(null)) : tab === "tontines" ? editTontine(null) : openSheet(null);
document.getElementById("sheetBg").onclick = () => closeSheet(false);
document.getElementById("fCancel").onclick = () => closeSheet(false);
document.getElementById("fDelete").onclick = () => {
  if (!form) return;
  const btn = document.getElementById("fDelete");
  const gar = form.gar && form.gar.on, nf = (form.files || []).length;
  if (btn.dataset.confirm !== "1") {
    btn.dataset.confirm = "1"; btn.textContent = "Confirmer ?";
    if (gar || nf) toast(gar ? "La garantie et la facture de cet achat seront aussi supprimées." : "La facture jointe sera aussi supprimée.");
    setTimeout(() => { btn.dataset.confirm = ""; btn.textContent = "Supprimer"; }, 4000); return;
  }
  btn.dataset.confirm = ""; btn.textContent = "Supprimer";
  for (const id of form.uploaded) dropAsset(id);
  deleteTx(form.id, form.oldKey); closeSheet(true); toast(gar ? "Opération et garantie supprimées" : "Opération supprimée");
  saveNow();
};
document.getElementById("sheet").onsubmit = e => {
  e.preventDefault();
  if (form.busy) { toast("Patiente, la facture est en cours d'envoi…"); return; }
  const amountIn = parseAmount(document.getElementById("fAmount").value);
  const date = document.getElementById("fDate").value;
  if (!(amountIn > 0)) { toast("Indique un montant supérieur à 0"); document.getElementById("fAmount").focus(); return; }
  const ocur = form.ocur || baseCurrency(), foreign = ocur !== baseCurrency();
  const orate = foreign ? parseNum(document.getElementById("fRate").value) : 1;
  if (foreign && !(orate > 0)) { toast("Indique le taux de change"); document.getElementById("fRate").focus(); return; }
  const amount = foreign ? Math.round(amountIn / orate * 100) / 100 : amountIn;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast("Choisis une date"); return; }
  const isNdf = form.type === "depense" && !!form.ndf;
  const tx = { id: form.id, type: form.type, amount, cat: form.cat, date, note: document.getElementById("fNote").value.trim().slice(0, 80),
    fixe: form.type === "depense" && !isNdf ? !!form.fixe : false, created: form.created || Date.now(), files: form.files };
  if (form.type === "depense" && form.gar.on) {
    const end = garEnd();
    const item = document.getElementById("gItem").value.trim() || tx.note;
    if (!item) { toast("Indique le nom de l'article garanti"); document.getElementById("gItem").focus(); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) { toast("Choisis la date de fin de garantie"); return; }
    tx.warranty = { item: item.slice(0, 80), months: form.gar.months, end,
      shop: document.getElementById("gShop").value.trim().slice(0, 60), serial: document.getElementById("gSerial").value.trim().slice(0, 60),
      info: document.getElementById("gInfo").value.trim().slice(0, 200) };
  }
  if (isNdf) { tx.ndf = true; tx.ndfStatus = form.ndfStatus || "a_rembourser"; if (tx.ndfStatus === "rembourse") tx.ndfPaidOn = form.ndfPaidOn || todayISO(); }
  if (foreign) {
    tx.orig = { cur: ocur, amount: amountIn, rate: orate };
    settings.fxLast = { ...(settings.fxLast || {}), [ocur]: orate }; saveSettings();
  }
  if (form.rec) tx.rec = form.rec;
  if ((tx.type === "epargne" || tx.type === "invest") && form.goal && goals[form.goal]) tx.goal = form.goal;
  const old = form.oldKey, removed = form.removed, repeat = !form.oldKey && !isNdf ? form.repeat : "";
  closeSheet(true);
  for (const id of removed) dropAsset(id);
  const k = date.slice(0, 7).split("-");
  if (tab === "mois" || tab === "reglages") { cur.y = Number(k[0]); cur.m = Number(k[1]); }
  upsertTx(tx, old);
  if (repeat) {
    const rid = newId();
    recs[rid] = { type: tx.type, amount: tx.amount, cat: tx.cat, note: tx.note, freq: repeat, next: advance(date, repeat), until: "", active: true, created: Date.now() };
    months[date.slice(0, 7)].items[tx.id].rec = rid; saveMonth(date.slice(0, 7));
    saveRecs(); applyRecurring(); render();
  }
  toast(old ? "Opération modifiée" : isNdf ? "Note de frais ajoutée" : "Opération ajoutée");
};

// ---------- Visionneuse de justificatifs ----------
let vFile = null;
function extFor(f) {
  const n = String(f.name || ""); const e = n.includes(".") ? n.split(".").pop().toLowerCase() : "";
  if (["jpg", "jpeg", "png", "webp", "gif", "pdf"].includes(e)) return n;
  const map = { "application/pdf": "pdf", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
  return (n || "facture") + "." + (map[f.type] || "jpg");
}
async function openViewer(f) {
  vFile = f;
  document.getElementById("vName").textContent = f.name || "Justificatif";
  const body = document.getElementById("vBody");
  body.innerHTML = `<span class="hint" style="color:#fff">Chargement…</span>`;
  document.getElementById("viewer").classList.add("on");
  try {
    const u = await fileURL(f.id);
    if (vFile !== f) return;
    body.innerHTML = String(f.type).startsWith("image/")
      ? `<img src="${u}" alt="${esc(f.name)}">`
      : `<iframe src="${u}" title="${esc(f.name)}"></iframe>`;
  } catch (e) {
    body.innerHTML = `<span class="hint" style="color:#fff">Ce justificatif n'a pas pu être chargé${e.code === "not_found" ? " : il a été supprimé du Drive" : ""}.</span>`;
  }
}
document.getElementById("vClose").onclick = () => { document.getElementById("viewer").classList.remove("on"); document.getElementById("vBody").innerHTML = ""; vFile = null; };
document.getElementById("vDl").onclick = async () => {
  if (!vFile) return;
  try { const u = await fileURL(vFile.id); downloadURL(u, extFor(vFile)); }
  catch (e) { toast("Ce justificatif n'est plus disponible."); }
};
document.getElementById("vOpen").onclick = async () => {
  if (!vFile) return;
  try { const u = await fileURL(vFile.id); window.open(u, "_blank"); } catch (e) { toast("Ouverture impossible."); }
};

// ---------- Garanties ----------
function renderGaranties() {
  const items = garItems().map(x => ({ ...x, st: garStatus(x.warranty), d: daysUntil(x.warranty.end) }));
  const by = st => items.filter(x => x.st === st).sort((a, b) => st === "exp" ? b.d - a.d : a.d - b.d);
  const soon = by("soon"), ok = by("ok"), exp = by("exp");
  document.getElementById("periodLabel").textContent = "Garanties";
  document.getElementById("resCap").textContent = "Articles encore sous garantie";
  const big = document.getElementById("resBig"); big.textContent = String(soon.length + ok.length); big.className = "big num";
  document.getElementById("resPill").innerHTML = soon.length ? `<span class="pill" style="background:var(--w-soon);color:#fff">${soon.length} bientôt expirée${soon.length > 1 ? "s" : ""}</span>` : "";
  const tile = (n, lbl, col) => `<div class="tile"><div class="k"><span class="sw" style="background:${col}"></span>${lbl}</div><div class="v num">${n}</div></div>`;
  let html = banner + `<div class="tiles" style="grid-template-columns:repeat(3,1fr)">${tile(ok.length, "Sous garantie", "var(--w-ok)")}${tile(soon.length, "Bientôt", "var(--w-soon)")}${tile(exp.length, "Expirées", "var(--w-exp)")}</div>`;
  const label = { ok: "Sous garantie", soon: "Bientôt expirée", exp: "Expirée" };
  const card = x => {
    const w = x.warranty, start = new Date(x.date + "T12:00:00"), end = new Date(w.end + "T12:00:00");
    const pct = Math.max(0, Math.min(100, (Date.now() - start) / Math.max(1, end - start) * 100));
    const n = x.files ? x.files.length : 0;
    return `<div class="gar ${x.st}"><div class="top"><span class="n">${esc(w.item)}</span><span class="st">${label[x.st]}</span></div>
      <div class="s">Jusqu'au <b>${esc(frDate(w.end))}</b> · ${esc(leftTxt(x.d))}<br>
      Acheté le ${esc(frDate(x.date))} · ${esc(eur(x.amount))}${w.shop ? " · " + esc(w.shop) : ""}${w.serial ? "<br>N° de série : " + esc(w.serial) : ""}${w.info ? "<br>" + esc(w.info) : ""}</div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="acts">${n ? `<button class="btn" data-act="view" data-id="${esc(x.id)}">Voir la facture</button>` : `<span class="hint" style="color:var(--bad)">Pas de facture jointe</span>`}
        <button class="btn" data-act="edit" data-id="${esc(x.id)}">${n ? "Modifier" : "Ajouter la facture"}</button>
        <button class="btn danger" data-act="drop" data-id="${esc(x.id)}" aria-label="Supprimer la garantie de ${esc(w.item)}">Supprimer la garantie</button></div></div>`;
  };
  const section = (list, title, col, empty) => `<div class="sec-h"><span class="sw" style="background:${col}"></span>${title} <small class="hint">(${list.length})</small></div>
    ${list.length ? `<div class="gar-list">${list.map(card).join("")}</div>` : `<div class="empty">${empty}</div>`}`;
  if (!items.length) html += `<div class="card"><div class="empty">Aucun article sous garantie pour l'instant.<br>Quand tu ajoutes une dépense, coche « Cet achat est sous garantie ».</div></div>`;
  else {
    html += section(soon, `Expirent dans moins de ${warnDays()} jours`, "var(--w-soon)", "Aucune garantie n'expire bientôt.");
    html += section(ok, "Sous garantie", "var(--w-ok)", "Aucune.");
    html += section(exp, "Expirées", "var(--w-exp)", "Aucune.");
  }
  html += `<p class="hint" style="text-align:center;margin:4px 0 0">Les garanties qui arrivent à terme s'affichent aussi en tête de l'onglet Mois. Délai d'alerte réglable dans Réglages.</p>`;
  view.innerHTML = html;
  view.querySelectorAll("[data-act]").forEach(b => b.onclick = () => {
    const x = items.find(i => i.id === b.dataset.id); if (!x) return;
    if (b.dataset.act === "drop") {   // retire la garantie, garde la dépense et sa facture
      if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = "Confirmer ?"; toast("La dépense et sa facture sont conservées."); setTimeout(() => { if (b.isConnected) { b.dataset.c = ""; b.textContent = "Supprimer la garantie"; } }, 4000); return; }
      const t = months[x.key] && months[x.key].items[x.id]; if (t) { delete t.warranty; saveMonth(x.key); render(); saveNow(); toast("Garantie supprimée"); }
      return;
    }
    if (b.dataset.act === "view") openViewer(x.files[0]);
    else { const { key, st, d, ...tx } = x; openSheet(tx); }
  });
}

// ---------- Formulaire générique (abonnements, dettes) ----------
let form2 = null;
function openForm(html, onSave, onDelete) {
  const f = document.getElementById("sheet2");
  f.innerHTML = `<div class="grab"></div>${html}<div class="actions">
    ${onDelete ? `<button type="button" class="btn danger" id="f2Del">Supprimer</button>` : ""}
    <button type="button" class="btn" id="f2Cancel">Annuler</button><button type="submit" class="btn primary">Enregistrer</button></div>`;
  form2 = { onSave };
  document.getElementById("sheet2Root").classList.add("open");
  document.getElementById("f2Cancel").onclick = closeForm;
  const del = document.getElementById("f2Del");
  if (del) del.onclick = () => {
    if (del.dataset.c !== "1") { del.dataset.c = "1"; del.textContent = "Confirmer ?"; setTimeout(() => { del.dataset.c = ""; del.textContent = "Supprimer"; }, 3000); return; }
    onDelete(); closeForm();
  };
  const first = f.querySelector("input"); if (first) setTimeout(() => first.focus(), 60);
  return f;
}
function closeForm() { document.getElementById("sheet2Root").classList.remove("open"); form2 = null; }
document.getElementById("s2bg").onclick = closeForm;
document.getElementById("sheet2").onsubmit = e => { e.preventDefault(); if (form2 && form2.onSave() !== false) closeForm(); };
const val = id => (document.getElementById(id)?.value || "").trim();
const fld = (id, label, attrs = "") => `<label class="lbl" for="${id}">${label}</label><input class="field" id="${id}" ${attrs}>`;
function chipsPick(containerId, options, current, onPick) {
  const el = document.getElementById(containerId);
  const draw = cur => {
    el.innerHTML = options.map(([v, l]) => `<button type="button" class="chip" aria-pressed="${v === cur}" data-v="${esc(v)}">${esc(l)}</button>`).join("");
    el.querySelectorAll(".chip").forEach(b => b.onclick = () => { onPick(b.dataset.v); draw(b.dataset.v); });
  };
  draw(current);
}
function addDays(iso, n) { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function addTx(tx) {
  const key = tx.date.slice(0, 7);
  months[key] = months[key] || { items: {} };
  months[key].items[newId()] = { ...tx, created: Date.now() };
  saveMonth(key);
}

// ---------- Abonnements ----------
const FREQS = [["semaine", "Chaque semaine"], ["mois", "Chaque mois"], ["trimestre", "Chaque trimestre"], ["semestre", "Chaque semestre"], ["an", "Chaque année"]];
const FREQ_M = { semaine: 12 / 52, mois: 1, trimestre: 3, semestre: 6, an: 12 };
const FREQ_SHORT = { semaine: "/ sem.", mois: "/ mois", trimestre: "/ trim.", semestre: "/ sem.", an: "/ an" };
function advance(iso, freq) { return freq === "semaine" ? addDays(iso, 7) : addMonths(iso, FREQ_M[freq] || 1); }
function nextOcc(sub) {
  let d = sub.next; if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return "";
  for (let k = 0; k < 800 && daysUntil(d) < 0; k++) d = advance(d, sub.freq);
  return d;
}
function monthlyCost(sub) { return (Number(sub.amount) || 0) / (FREQ_M[sub.freq] || 1); }
function subStatus(sub) {
  if (sub.status === "resilie") return { st: "off", label: "Résilié", why: sub.endedOn ? `Résilié le ${frDate(sub.endedOn)}` : "Résilié" };
  const nx = nextOcc(sub);
  if (sub.engEnd) {
    const dE = daysUntil(sub.engEnd);
    if (dE >= 0 && dE <= warnDays()) {
      const lim = sub.preavis ? addDays(sub.engEnd, -Number(sub.preavis)) : "";
      return { st: "soon", label: "Fin d'engagement", why: `Engagement jusqu'au ${frDate(sub.engEnd)}${lim ? ` · à résilier avant le ${frDate(lim)}` : ""}` };
    }
  }
  if (nx && (sub.freq === "an" || sub.freq === "semestre") && daysUntil(nx) <= 30)
    return { st: "soon", label: "Renouvellement", why: `Se renouvelle le ${frDate(nx)} (${leftTxt(daysUntil(nx))})` };
  return { st: "ok", label: "Actif", why: sub.engEnd && daysUntil(sub.engEnd) >= 0 ? `Engagé jusqu'au ${frDate(sub.engEnd)}` : "Sans engagement" };
}
function renderAbos() {
  const list = Object.entries(subs).map(([id, x]) => ({ ...x, id, s: subStatus(x), nx: nextOcc(x) }));
  const active = list.filter(x => x.s.st !== "off");
  const perMonth = active.reduce((a, x) => a + monthlyCost(x), 0);
  document.getElementById("periodLabel").textContent = "Abonnements";
  document.getElementById("resCap").textContent = "Coût de tes abonnements par mois";
  const big = document.getElementById("resBig"); big.textContent = eur(perMonth); big.className = "big num";
  document.getElementById("resPill").innerHTML = `<span class="pill" style="background:rgba(255,255,255,.15);color:#fff">${esc(eur(perMonth * 12, true))} par an</span>`;
  const soon = list.filter(x => x.s.st === "soon"), ok = list.filter(x => x.s.st === "ok"), off = list.filter(x => x.s.st === "off");
  const byNext = (a, b) => (a.nx || "9").localeCompare(b.nx || "9");
  soon.sort(byNext); ok.sort(byNext);
  const tile = (n, lbl, col) => `<div class="tile"><div class="k"><span class="sw" style="background:${col}"></span>${lbl}</div><div class="v num">${n}</div></div>`;
  let html = banner + `<div class="tiles" style="grid-template-columns:repeat(3,1fr)">${tile(ok.length + soon.length, "Actifs", "var(--w-ok)")}${tile(soon.length, "À surveiller", "var(--w-soon)")}${tile(off.length, "Résiliés", "var(--muted)")}</div>`;
  const card = x => {
    const c = catById(x.cat), cls = x.s.st === "off" ? "off" : x.s.st;
    return `<div class="gar ${cls}"><div class="top"><span class="n">${esc(x.name)}</span><span class="st">${esc(x.s.label)}</span></div>
      <div class="top"><span class="amt num">${esc(eur(x.amount))} <small class="hint">${FREQ_SHORT[x.freq] || ""}</small></span>${x.freq !== "mois" ? `<span class="hint num">≈ ${esc(eur(monthlyCost(x)))} / mois</span>` : ""}</div>
      <div class="s">${x.s.st !== "off" && x.nx ? `Prochain prélèvement le <b>${esc(frDate(x.nx))}</b> · ` : ""}${esc(x.s.why)}<br>${esc(c.name)}${x.preavis ? ` · préavis ${esc(x.preavis)} jours` : ""}${x.note ? "<br>" + esc(x.note) : ""}</div>
      <div class="acts">${x.s.st !== "off" ? `<button class="btn primary" data-a="pay" data-id="${esc(x.id)}">Ajouter le prélèvement</button>` : ""}
        <button class="btn" data-a="edit" data-id="${esc(x.id)}">Modifier</button>
        <button class="btn" data-a="toggle" data-id="${esc(x.id)}">${x.s.st === "off" ? "Réactiver" : "Marquer résilié"}</button></div></div>`;
  };
  const section = (l, title, col, empty) => `<div class="sec-h"><span class="sw" style="background:${col}"></span>${title} <small class="hint">(${l.length})</small></div>
    ${l.length ? `<div class="gar-list">${l.map(card).join("")}</div>` : `<div class="empty">${empty}</div>`}`;
  if (!list.length) html += `<div class="card"><div class="empty">Aucun abonnement enregistré.<br>Appuie sur + pour ajouter Netflix, ton forfait mobile, la salle de sport…</div></div>`;
  else {
    html += section(soon, "À surveiller", "var(--w-soon)", "Rien à surveiller pour l'instant.");
    html += section(ok, "Actifs", "var(--w-ok)", "Aucun.");
    if (off.length) html += section(off, "Résiliés", "var(--muted)", "");
  }
  html += `<p class="hint" style="text-align:center;margin:4px 0 0">En orange : fin d'engagement dans moins de ${warnDays()} jours, ou renouvellement annuel dans moins de 30 jours.</p>`;
  view.innerHTML = html;
  view.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
    const x = list.find(i => i.id === b.dataset.id); if (!x) return;
    if (b.dataset.a === "edit") editSub(x.id);
    else if (b.dataset.a === "toggle") {
      if (x.s.st === "off") { subs[x.id].status = "actif"; delete subs[x.id].endedOn; }
      else { subs[x.id].status = "resilie"; subs[x.id].endedOn = todayISO(); }
      saveSubs(); render();
    } else if (b.dataset.a === "pay") {
      const d = x.nx || todayISO();
      addTx({ type: "depense", amount: Number(x.amount), cat: x.cat, date: d, note: x.name, fixe: true });
      subs[x.id].next = advance(d, x.freq); saveSubs(); render();
      toast(`Prélèvement du ${frDate(d)} ajouté aux dépenses`);
    }
  });
}
function editSub(id) {
  const x = id ? clone(subs[id]) : { name: "", cat: "telecom", amount: "", freq: "mois", next: todayISO(), engEnd: "", preavis: "", status: "actif", note: "" };
  let freq = x.freq, cat = x.cat;
  openForm(`<div class="f2"><h3>${id ? "Modifier l'abonnement" : "Nouvel abonnement"}</h3>
    ${fld("sName", "Nom", `placeholder="ex. Netflix, Free Mobile, Basic-Fit" value="${esc(x.name)}"`)}
    <div class="two"><div>${fld("sAmount", `Montant (${esc(curSym())})`, `inputmode="decimal" placeholder="0,00" value="${x.amount === "" ? "" : esc(String(x.amount).replace(".", ","))}"`)}</div>
      <div>${fld("sNext", "Prochain prélèvement", `type="date" value="${esc(x.next || "")}"`)}</div></div>
    <span class="lbl">Fréquence</span><div class="chips" id="sFreq"></div>
    <span class="lbl">Catégorie de dépense</span><div class="chips" id="sCat"></div>
    <div class="two"><div>${fld("sEng", "Fin d'engagement (si engagé)", `type="date" value="${esc(x.engEnd || "")}"`)}</div>
      <div>${fld("sPre", "Préavis de résiliation (jours)", `inputmode="numeric" placeholder="ex. 30" value="${esc(x.preavis || "")}"`)}</div></div>
    ${fld("sNote", "Infos", `placeholder="Identifiant client, comment résilier…" value="${esc(x.note || "")}"`)}</div>`,
    () => {
      const amount = parseAmount(val("sAmount")), name = val("sName"), next = val("sNext");
      if (!name) { toast("Indique le nom de l'abonnement"); return false; }
      if (!(amount > 0)) { toast("Indique un montant supérieur à 0"); return false; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) { toast("Indique la date du prochain prélèvement"); return false; }
      const pre = parseInt(val("sPre"), 10);
      subs[id || newId()] = { ...x, name: name.slice(0, 60), amount, next, freq, cat, engEnd: val("sEng"), preavis: pre > 0 ? pre : "", note: val("sNote").slice(0, 200), created: x.created || Date.now() };
      saveSubs(); render(); toast(id ? "Abonnement modifié" : "Abonnement ajouté");
    },
    id ? () => { delete subs[id]; saveSubs(); render(); toast("Abonnement supprimé"); } : null);
  chipsPick("sFreq", FREQS, freq, v => freq = v);
  chipsPick("sCat", settings.cats.map(c => [c.id, c.name]), cat, v => cat = v);
}

// ---------- Dettes ----------
const DEBT_KINDS = [["credit", "Crédit / prêt"], ["dois", "Je dois à quelqu'un"], ["medoit", "On me doit"]];
function debtCalc(x) {
  const amount = Number(x.amount) || 0, paid = (x.payments || []).reduce((a, p) => a + (Number(p.amount) || 0), 0);
  let remaining, end = "", nPaid = 0;
  if (x.kind === "credit" && Number(x.monthly) > 0 && Number(x.months) > 0 && x.start) {
    const n = Number(x.months), m = Number(x.monthly), r = (Number(x.rate) || 0) / 100 / 12;
    const s0 = new Date(x.start + "T12:00:00"), t = new Date();
    nPaid = Math.max(0, Math.min(n, (t.getFullYear() - s0.getFullYear()) * 12 + t.getMonth() - s0.getMonth() + (t.getDate() >= s0.getDate() ? 1 : 0)));
    const k = n - nPaid;
    remaining = k <= 0 ? 0 : r > 0 ? m * (1 - Math.pow(1 + r, -k)) / r : amount - amount / n * nPaid;
    remaining = Math.max(0, Math.min(amount, remaining) - paid);
    end = addMonths(x.start, n - 1);
  } else remaining = Math.max(0, amount - paid);
  remaining = Math.round(remaining * 100) / 100;
  const done = x.closed || remaining <= 0.005;
  return { remaining: done ? 0 : remaining, paid, end, nPaid, done, pct: amount ? Math.min(100, (1 - (done ? 0 : remaining) / amount) * 100) : 0 };
}
function renderDettes() {
  const list = Object.entries(debts).map(([id, x]) => ({ ...x, id, c: debtCalc(x) }));
  const open = list.filter(x => !x.c.done);
  const iOwe = open.filter(x => x.kind !== "medoit").reduce((a, x) => a + x.c.remaining, 0);
  const owed = open.filter(x => x.kind === "medoit").reduce((a, x) => a + x.c.remaining, 0);
  const monthly = open.filter(x => x.kind === "credit").reduce((a, x) => a + (Number(x.monthly) || 0), 0);
  document.getElementById("periodLabel").textContent = "Dettes";
  document.getElementById("resCap").textContent = "Ce qu'il te reste à rembourser";
  const big = document.getElementById("resBig"); big.textContent = eur(iOwe); big.className = "big num";
  document.getElementById("resPill").innerHTML = owed ? `<span class="pill" style="background:rgba(255,255,255,.15);color:#fff">On te doit ${esc(eur(owed))}</span>` : "";
  let html = banner + `<div class="tiles" style="grid-template-columns:repeat(3,1fr)">
    <div class="tile"><div class="k"><span class="sw" style="background:var(--bad)"></span>Je dois</div><div class="v num">${eur(iOwe, true)}</div></div>
    <div class="tile"><div class="k"><span class="sw" style="background:#2f6fb0"></span>On me doit</div><div class="v num">${eur(owed, true)}</div></div>
    <div class="tile"><div class="k"><span class="sw" style="background:var(--accent)"></span>Mensualités</div><div class="v num">${eur(monthly, true)}</div></div></div>`;
  const card = x => {
    const c = x.c, cls = c.done ? "done" : x.kind === "medoit" ? "owed" : "debt";
    const lab = c.done ? "Soldée" : DEBT_KINDS.find(k => k[0] === x.kind)[1];
    const pays = (x.payments || []).slice().sort((a, b) => b.date.localeCompare(a.date));
    return `<div class="gar ${cls}"><div class="top"><span class="n">${esc(x.name)}</span><span class="st">${esc(lab)}</span></div>
      <div class="top"><span class="amt num">${c.done ? "Remboursée" : "Reste " + esc(eur(c.remaining))}</span><span class="hint num">sur ${esc(eur(x.amount))}</span></div>
      <div class="bar"><i style="width:${c.pct}%"></i></div>
      <div class="s">${x.who ? esc(x.who) + " · " : ""}${Math.round(c.pct)} % remboursé${x.kind === "credit" && x.monthly ? `<br>Mensualité ${esc(eur(x.monthly))}${x.rate ? ` · taux ${esc(String(x.rate).replace(".", ","))} %` : ""}${c.end ? ` · dernière échéance le ${esc(frDate(c.end))}` : ""}${x.months ? ` · ${c.nPaid}/${esc(x.months)} échéances passées` : ""}` : ""}${x.due ? `<br>À rembourser avant le ${esc(frDate(x.due))}${!c.done && daysUntil(x.due) < 0 ? ` <b style="color:var(--bad)">(en retard)</b>` : ""}` : ""}${x.note ? "<br>" + esc(x.note) : ""}</div>
      ${pays.slice(0, 3).map(p => `<div class="pay"><span>${esc(frDate(p.date))}</span><span class="num">${x.kind === "medoit" ? "reçu" : "versé"} ${esc(eur(p.amount))}</span></div>`).join("")}${pays.length > 3 ? `<div class="pay"><span>+ ${pays.length - 3} autres remboursements</span><span></span></div>` : ""}
      <div class="acts">${!c.done ? `<button class="btn primary" data-a="pay" data-id="${esc(x.id)}">${x.kind === "medoit" ? "J'ai reçu un remboursement" : x.kind === "credit" ? "Remboursement anticipé" : "J'ai remboursé"}</button>` : ""}
        <button class="btn" data-a="edit" data-id="${esc(x.id)}">Modifier</button>
        <button class="btn" data-a="close" data-id="${esc(x.id)}">${x.closed ? "Rouvrir" : "Marquer soldée"}</button></div></div>`;
  };
  const section = (l, title, col) => l.length ? `<div class="sec-h"><span class="sw" style="background:${col}"></span>${title} <small class="hint">(${l.length})</small></div><div class="gar-list">${l.map(card).join("")}</div>` : "";
  if (!list.length) html += `<div class="card"><div class="empty">Aucune dette enregistrée.<br>Appuie sur + pour ajouter un crédit, de l'argent que tu dois ou qu'on te doit.</div></div>`;
  else {
    html += section(open.filter(x => x.kind === "credit"), "Crédits et prêts", "var(--bad)");
    html += section(open.filter(x => x.kind === "dois"), "Je dois", "var(--bad)");
    html += section(open.filter(x => x.kind === "medoit"), "On me doit", "#2f6fb0");
    html += section(list.filter(x => x.c.done), "Soldées", "var(--good)");
  }
  html += `<p class="hint" style="text-align:center;margin:4px 0 0">Pour un crédit, le reste dû est estimé à partir de la mensualité, du taux et des échéances passées. Le tableau d'amortissement de ta banque fait foi.</p>`;
  view.innerHTML = html;
  view.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
    const x = list.find(i => i.id === b.dataset.id); if (!x) return;
    if (b.dataset.a === "edit") editDebt(x.id);
    else if (b.dataset.a === "close") { debts[x.id].closed = !x.closed; saveDebts(); render(); }
    else addPayment(x);
  });
}
function editDebt(id) {
  const x = id ? clone(debts[id]) : { kind: "credit", name: "", who: "", amount: "", rate: "", monthly: "", start: "", months: "", due: "", note: "", payments: [] };
  let kind = x.kind;
  const f = openForm(`<div class="f2"><h3>${id ? "Modifier la dette" : "Nouvelle dette"}</h3>
    <span class="lbl">Type</span><div class="chips" id="dKind"></div>
    ${fld("dName", "Nom", `placeholder="ex. Prêt auto, Avance de Paul" value="${esc(x.name)}"`)}
    <div class="two"><div>${fld("dWho", "Organisme ou personne", `value="${esc(x.who || "")}"`)}</div>
      <div>${fld("dAmount", `Montant emprunté / prêté (${esc(curSym())})`, `inputmode="decimal" value="${x.amount === "" ? "" : esc(String(x.amount).replace(".", ","))}"`)}</div></div>
    <div id="dCredit"><div class="two"><div>${fld("dMonthly", `Mensualité (${esc(curSym())})`, `inputmode="decimal" value="${x.monthly ? esc(String(x.monthly).replace(".", ",")) : ""}"`)}</div>
      <div>${fld("dRate", "Taux annuel (%)", `inputmode="decimal" placeholder="ex. 4,5" value="${x.rate ? esc(String(x.rate).replace(".", ",")) : ""}"`)}</div></div>
      <div class="two"><div>${fld("dStart", "1re échéance", `type="date" value="${esc(x.start || "")}"`)}</div>
      <div>${fld("dMonths", "Nombre de mensualités", `inputmode="numeric" value="${esc(x.months || "")}"`)}</div></div></div>
    <div id="dPerso">${fld("dDue", "À rembourser avant le (facultatif)", `type="date" value="${esc(x.due || "")}"`)}</div>
    ${fld("dNote", "Infos", `placeholder="N° de contrat, conditions…" value="${esc(x.note || "")}"`)}</div>`,
    () => {
      const name = val("dName"), amount = parseAmount(val("dAmount"));
      if (!name) { toast("Indique un nom"); return false; }
      if (!(amount > 0)) { toast("Indique le montant"); return false; }
      const o = { ...x, kind, name: name.slice(0, 60), who: val("dWho").slice(0, 60), amount, note: val("dNote").slice(0, 200), created: x.created || Date.now() };
      if (kind === "credit") { o.monthly = parseAmount(val("dMonthly")) || ""; o.rate = parseAmount(val("dRate")) || ""; o.start = val("dStart"); o.months = parseInt(val("dMonths"), 10) || ""; o.due = ""; }
      else { o.due = val("dDue"); o.monthly = ""; o.rate = ""; o.start = ""; o.months = ""; }
      debts[id || newId()] = o; saveDebts(); render(); toast(id ? "Dette modifiée" : "Dette ajoutée");
    },
    id ? () => { delete debts[id]; saveDebts(); render(); toast("Dette supprimée"); } : null);
  const sync = () => { f.querySelector("#dCredit").hidden = kind !== "credit"; f.querySelector("#dPerso").hidden = kind === "credit"; };
  chipsPick("dKind", DEBT_KINDS, kind, v => { kind = v; sync(); });
  sync();
}
function addPayment(x) {
  const out = x.kind !== "medoit";
  openForm(`<div class="f2"><h3>${x.kind === "medoit" ? "Remboursement reçu" : "Remboursement"} · ${esc(x.name)}</h3>
    <div class="two"><div>${fld("pAmount", `Montant (${esc(curSym())})`, `inputmode="decimal" placeholder="0,00"`)}</div><div>${fld("pDate", "Date", `type="date" value="${todayISO()}"`)}</div></div>
    <label class="toggle" for="pAlso" style="margin-top:12px"><span>${out ? "L'ajouter aussi à mes dépenses (Crédits)" : "L'ajouter aussi à mes rentrées"}</span><input type="checkbox" id="pAlso" ${x.kind === "credit" ? "" : "checked"}></label></div>`,
    () => {
      const amount = parseAmount(val("pAmount")), date = val("pDate");
      if (!(amount > 0)) { toast("Indique le montant"); return false; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast("Choisis une date"); return false; }
      const d = debts[x.id]; d.payments = (d.payments || []).concat([{ date, amount }]);
      saveDebts();
      if (document.getElementById("pAlso").checked)
        addTx(out ? { type: "depense", amount, cat: "credits", date, note: x.name, fixe: false } : { type: "rentree", amount, cat: "Remboursement", date, note: x.name });
      render(); toast("Remboursement enregistré");
    }, null);
}

// ---------- Opérations automatiques ----------
const REPEAT = [["", "Non"], ["mois", "Chaque mois"], ["trimestre", "Chaque trimestre"], ["an", "Chaque année"]];
const TYPE_LABEL = { depense: "Dépense", rentree: "Rentrée", epargne: "Épargne", invest: "Investissement" };
function recName(r) { return r.note || (r.type === "depense" ? catById(r.cat).name : r.cat) || "Opération"; }
// Ajoute les opérations automatiques arrivées à échéance. Les identifiants sont fixes (r-<id>-<date>) :
// relancer cette fonction, ou l'ouvrir sur deux appareils, ne crée jamais de doublon.
function applyRecurring() {
  const today = todayISO(); let added = 0, changed = false;
  for (const [rid, r] of Object.entries(recs)) {
    if (r.active === false || !/^\d{4}-\d{2}-\d{2}$/.test(r.next || "")) continue;
    for (let g = 0; g < 120 && r.next <= today; g++) {
      if (r.until && r.next > r.until) { r.active = false; changed = true; break; }
      const key = r.next.slice(0, 7), tid = "r-" + rid + "-" + r.next;
      months[key] = months[key] || { items: {} };
      if (!months[key].items[tid]) {
        months[key].items[tid] = { type: r.type, amount: Number(r.amount), cat: r.cat, date: r.next, note: r.note || "", fixe: r.type === "depense", rec: rid, created: Date.now() };
        added++; saveMonth(key);
      }
      r.next = advance(r.next, r.freq); changed = true;
    }
  }
  added += applyTontines();
  if (changed) saveRecs();
  if (added) toast(`${added} opération${added > 1 ? "s" : ""} automatique${added > 1 ? "s" : ""} ajoutée${added > 1 ? "s" : ""}`);
  return added;
}
function drawRep() {
  const wrap = document.getElementById("repWrap"), box = document.getElementById("fRep"), hint = document.getElementById("repHint");
  if (form.rec) {
    const r = recs[form.rec];
    wrap.hidden = false; box.innerHTML = "";
    hint.textContent = r ? `Opération automatique (${REPEAT.find(x => x[0] === r.freq)?.[1].toLowerCase() || r.freq}). Pour la modifier ou l'arrêter : Réglages › Opérations automatiques.` : "Ajoutée automatiquement.";
    return;
  }
  wrap.hidden = !!form.oldKey || (form.type === "depense" && form.ndf);
  hint.textContent = form.repeat ? `Elle sera ajoutée toute seule, ${REPEAT.find(x => x[0] === form.repeat)[1].toLowerCase()}, à la même date.` : "";
  box.innerHTML = REPEAT.map(([v, l]) => `<button type="button" class="chip" aria-pressed="${v === (form.repeat || "")}" data-v="${v}">${l}</button>`).join("");
  box.querySelectorAll(".chip").forEach(b => b.onclick = () => { form.repeat = b.dataset.v; drawRep(); });
}
function recsCardHTML() {
  const list = Object.entries(recs).map(([id, r]) => ({ ...r, id })).sort((a, b) => (a.active === false) - (b.active === false) || (a.next || "").localeCompare(b.next || ""));
  return `<div class="card"><h2>Opérations automatiques<small>${list.filter(r => r.active !== false).length} active${list.length > 1 ? "s" : ""}</small></h2>
    <p class="hint" style="margin-top:0">Salaire, loyer, mensualités… ajoutés tout seuls à la bonne date. Tu peux aussi en créer une en cochant « Répéter » quand tu ajoutes une opération.</p>
    ${list.map(r => `<div class="ndf-item"><div><div class="n">${esc(recName(r))}${r.active === false ? ` <span class="badge" style="background:var(--line);color:var(--muted)">Arrêtée</span>` : ""}</div>
      <div class="s">${esc(TYPE_LABEL[r.type] || "")} · ${esc(REPEAT.find(x => x[0] === r.freq)?.[1] || r.freq)}${r.active !== false ? ` · prochaine le ${esc(frDate(r.next))}` : ""}</div></div>
      <div class="num" style="font-weight:700">${r.type === "rentree" ? "+" : "−"} ${esc(eur(r.amount))}</div>
      <div class="acts"><button class="btn" data-rec="${esc(r.id)}">Modifier</button></div></div>`).join("")}
    <button class="btn" id="addRec" style="margin-top:8px">+ Ajouter une opération automatique</button></div>`;
}
function bindRecsCard() {
  view.querySelectorAll("[data-rec]").forEach(b => b.onclick = () => editRec(b.dataset.rec));
  const a = document.getElementById("addRec"); if (a) a.onclick = () => editRec(null);
}
function editRec(id) {
  const r = id ? clone(recs[id]) : { type: "depense", amount: "", cat: "logement", note: "", freq: "mois", next: todayISO(), until: "", active: true };
  let type = r.type, cat = r.cat, freq = r.freq;
  const catOpts = () => type === "depense" ? settings.cats.map(c => [c.id, c.name]) : settings[type].map(s => [s, s]);
  openForm(`<div class="f2"><h3>${id ? "Modifier l'opération automatique" : "Nouvelle opération automatique"}</h3>
    <span class="lbl">Type</span><div class="chips" id="rType"></div>
    ${fld("rNote", "Nom", `placeholder="ex. Loyer, Salaire, Prêt auto" value="${esc(r.note || "")}"`)}
    <div class="two"><div>${fld("rAmount", `Montant (${esc(curSym())})`, `inputmode="decimal" value="${r.amount === "" ? "" : esc(String(r.amount).replace(".", ","))}"`)}</div>
      <div>${fld("rNext", "Prochaine fois le", `type="date" value="${esc(r.next || "")}"`)}</div></div>
    <span class="lbl">Fréquence</span><div class="chips" id="rFreq"></div>
    <span class="lbl" id="rCatLbl">Catégorie</span><div class="chips" id="rCat"></div>
    ${fld("rUntil", "Jusqu'au (facultatif)", `type="date" value="${esc(r.until || "")}"`)}
    ${id ? `<label class="toggle" for="rActive" style="margin-top:12px"><span>Active</span><input type="checkbox" id="rActive" ${r.active !== false ? "checked" : ""}></label>` : ""}</div>`,
    () => {
      const amount = parseAmount(val("rAmount")), next = val("rNext");
      if (!(amount > 0)) { toast("Indique un montant supérieur à 0"); return false; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) { toast("Indique la date de la prochaine fois"); return false; }
      const act = document.getElementById("rActive");
      recs[id || newId()] = { ...r, type, cat, freq, amount, next, note: val("rNote").slice(0, 60), until: val("rUntil"), active: act ? act.checked : true, created: r.created || Date.now() };
      saveRecs(); applyRecurring(); render(); toast(id ? "Opération automatique modifiée" : "Opération automatique créée");
    },
    id ? () => { delete recs[id]; saveRecs(); render(); toast("Opération automatique supprimée (les opérations déjà ajoutées restent)"); } : null);
  const drawCats = () => { document.getElementById("rCatLbl").textContent = type === "depense" ? "Catégorie" : type === "rentree" ? "Source" : "Compte / support"; chipsPick("rCat", catOpts(), cat, v => cat = v); };
  chipsPick("rType", Object.entries(TYPE_LABEL), type, v => { type = v; cat = catOpts()[0][0]; drawCats(); });
  chipsPick("rFreq", REPEAT.slice(1), freq, v => freq = v);
  drawCats();
}

// ---------- Prévision de fin de mois ----------
// Croise : opérations automatiques, abonnements, mensualités de crédit, dettes à rembourser,
// soldes des groupes partagés, notes de frais et objectifs d'épargne.
function upcomingThisMonth() {
  const today = todayISO(), key = ym(cur.y, cur.m), dim = new Date(cur.y, cur.m, 0).getDate(), eom = `${key}-${String(dim).padStart(2, "0")}`;
  const up = [];
  for (const r of Object.values(recs)) {
    if (r.active === false) continue;
    let d = r.next;
    for (let g = 0; g < 60 && d && d <= eom; g++) { if (d > today && (!r.until || d <= r.until)) up.push({ date: d, name: recName(r), amount: Number(r.amount), type: r.type, src: "Automatique" }); d = advance(d, r.freq); }
  }
  for (const s of Object.values(subs)) {
    if (s.status === "resilie") continue;
    let d = nextOcc(s);
    for (let g = 0; g < 60 && d && d <= eom; g++) { if (d > today) up.push({ date: d, name: s.name, amount: Number(s.amount), type: "depense", src: "Abonnement" }); d = advance(d, s.freq); }
  }
  // Mensualités de crédit pas encore saisies ce mois-ci (ni couvertes par une opération automatique)
  const monthItems = itemsOf(cur.y, cur.m);
  for (const [id, x] of Object.entries(debts)) {
    if (x.kind !== "credit" || x.closed || !(Number(x.monthly) > 0) || !x.start || !(Number(x.months) > 0)) continue;
    const c = debtCalc(x); if (c.done) continue;
    const day = Math.min(Number(x.start.slice(8, 10)), dim), due = `${key}-${String(day).padStart(2, "0")}`;
    if (due < x.start || due > addMonths(x.start, Number(x.months) - 1)) continue;
    const n = norm(x.name), m = Number(x.monthly);
    const covered = Object.values(recs).some(r => r.active !== false && r.type === "depense" && (r.debt === id || norm(r.note) === n || (r.cat === "credits" && Math.abs(Number(r.amount) - m) < 0.01)));
    const paid = monthItems.some(t => t.type === "depense" && (t.debt === id || (n && norm(t.note).includes(n)) || (t.cat === "credits" && Math.abs(Number(t.amount) - m) < 0.01)));
    if (!covered && !paid) up.push({ date: due, name: x.name, amount: m, type: "depense", src: due <= today ? "Crédit · pas encore saisi" : "Crédit" });
  }
  // Dettes personnelles à rembourser avant la fin du mois (ou en retard)
  for (const x of Object.values(debts)) {
    if (x.kind !== "dois" || x.closed || !x.due || x.due > eom) continue;
    const c = debtCalc(x); if (c.done) continue;
    up.push({ date: x.due, name: `${x.name}${x.who ? " (" + x.who + ")" : ""}`, amount: c.remaining, type: "depense", src: x.due < today ? "Dette en retard" : "Dette" });
  }
  // Ce que je dois dans mes groupes partagés
  for (const g of Object.values(groups)) {
    const b = groupBalances(g)[g.me] || 0;
    if (b < -0.004) up.push({ date: "", name: `Partage « ${g.name} »`, amount: -b, type: "depense", src: "À rembourser" });
  }
  up.push(...tontineUpcoming(today, key, eom));
  return up.sort((a, b) => (a.date || "9").localeCompare(b.date || "9"));
}
function forecastExtras() {
  // Argent qu'on te doit : notes de frais, prêts, groupes (pas compté dans la prévision principale)
  const ndf = allItems().filter(x => x.type === "depense" && x.ndf && x.ndfStatus !== "rembourse").reduce((a, x) => a + Number(x.amount), 0);
  const owed = Object.values(debts).filter(x => x.kind === "medoit" && !x.closed).reduce((a, x) => a + debtCalc(x).remaining, 0);
  const grp = Object.values(groups).reduce((a, g) => a + Math.max(0, groupBalances(g)[g.me] || 0), 0);
  const noDue = Object.values(debts).filter(x => x.kind === "dois" && !x.closed && !x.due).reduce((a, x) => a + debtCalc(x).remaining, 0);
  // Objectifs : ce qu'il faudrait encore verser ce mois-ci pour rester dans les temps
  const key = ym(cur.y, cur.m);
  let goalsNeed = 0;
  for (const [gid, gl] of Object.entries(goals)) {
    if (!gl.deadline) continue;
    const left = gl.target - goalSaved(gid); if (left <= 0) continue;
    const m = Math.max(1, monthsBetween(`${key}-01`, gl.deadline) + 1);
    const thisMonth = itemsOf(cur.y, cur.m).filter(x => x.goal === gid).reduce((a, x) => a + Number(x.amount), 0);
    goalsNeed += Math.max(0, (left + thisMonth) / m - thisMonth);
  }
  return { ndf, owed, grp, noDue, goalsNeed };
}
function forecastHTML(t) {
  if (!(cur.y === now.getFullYear() && cur.m === now.getMonth() + 1)) return "";
  const up = upcomingThisMonth(), ex = forecastExtras();
  const s = ty => up.filter(u => u.type === ty).reduce((a, u) => a + u.amount, 0);
  const reste = t.reste + s("rentree") - s("depense") - s("epargne") - s("invest");
  const day = new Date().getDate(), dim = new Date(cur.y, cur.m, 0).getDate();
  const hist = prevMonths(cur.y, cur.m, 3).map(q => totals(itemsOf(q.y, q.m))).filter(x => x.depense > 0);
  const avgVar = hist.length ? hist.reduce((a, x) => a + x.variable, 0) / hist.length : 0;
  const rythme = avgVar > 0 ? Math.max(0, avgVar - t.variable) : day >= 10 && t.variable > 0 ? t.variable / day * (dim - day) : 0;
  const color = v => v < 0 ? "var(--bad)" : "var(--good)";
  const row = (label, v, sign) => `<div class="fc-row"><span>${label}</span><b class="num" style="color:${color(v)}">${sign && v > 0 ? "+" : ""}${esc(eur(v))}</b></div>`;
  const due = ex.ndf + ex.owed + ex.grp;
  let after = reste - rythme;
  let html = `<div class="card fc"><h2>Prévision au ${dim} ${MOIS[cur.m - 1]}<small>${up.length ? up.length + " à prévoir" : ""}</small></h2>
    <div class="fc-big num" style="color:${color(reste)}">${reste > 0 ? "+" : ""}${esc(eur(reste))}</div>
    <div class="hint">Ce qu'il te restera après les prélèvements, mensualités, dettes à rembourser et rentrées prévus ce mois-ci.</div>`;
  if (rythme) html += row(`${avgVar > 0 ? "Si tes dépenses variables restent dans ta moyenne" : "Si tes dépenses variables continuent au même rythme"} (≈ ${esc(eur(rythme, true))} de plus)`, after, true);
  if (ex.goalsNeed > 0.5) { after -= ex.goalsNeed; html += row(`Et si tu verses ce qu'il faut pour tes objectifs (≈ ${esc(eur(ex.goalsNeed, true))})`, after, true); }
  if (due > 0.004) html += `<div class="fc-row"><span>On te doit aussi ${[ex.ndf && "notes de frais", ex.owed && "prêts", ex.grp && "partage"].filter(Boolean).join(", ")} : non compté, en attente</span><b class="num" style="color:#2f6fb0">+ ${esc(eur(due))}</b></div>`;
  if (ex.noDue > 0.004) html += `<div class="fc-row"><span>Dettes sans date de remboursement (non comptées)</span><b class="num" style="color:var(--bad)">− ${esc(eur(ex.noDue))}</b></div>`;
  html += up.length ? `<div class="fc-list">${up.slice(0, 8).map(u => `<div class="fc-it"><span class="num">${u.date ? esc(frDate(u.date).slice(0, 5)) : "—"}</span><span>${esc(u.name)} <small class="hint" style="${/retard|pas encore/.test(u.src) ? "color:var(--bad)" : ""}">· ${esc(u.src)}</small></span><b class="num ${u.type === "rentree" ? "a in" : ""}">${u.type === "rentree" ? "+" : "−"} ${esc(eur(u.amount))}</b></div>`).join("")}${up.length > 8 ? `<div class="hint">+ ${up.length - 8} autres</div>` : ""}</div>`
    : `<p class="hint" style="margin-bottom:0">Ajoute ton salaire, ton loyer et tes mensualités en opérations automatiques (Réglages) pour une prévision plus juste.</p>`;
  return html + `</div>`;
}

// ---------- Recherche ----------
const Q = { text: "", type: "", cat: "", period: "all", facture: false, ndf: false, gar: false };
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function searchItems() {
  const today = todayISO(), y = String(now.getFullYear());
  const from = { all: "", mois: ym(now.getFullYear(), now.getMonth() + 1) + "-01", "3m": addDays(today, -90), annee: y + "-01-01", anprec: (y - 1) + "-01-01" }[Q.period];
  const to = Q.period === "anprec" ? (y - 1) + "-12-31" : "9999";
  const words = norm(Q.text).split(/\s+/).filter(Boolean);
  const numQ = parseAmount(Q.text);
  return allItems().filter(x => {
    if (Q.type && x.type !== Q.type) return false;
    if (Q.cat && x.cat !== Q.cat) return false;
    if (from && x.date < from) return false;
    if (x.date > to) return false;
    if (Q.facture && !(x.files && x.files.length)) return false;
    if (Q.ndf && !x.ndf) return false;
    if (Q.gar && !x.warranty) return false;
    if (!words.length) return true;
    if (isFinite(numQ) && Math.abs(Number(x.amount) - numQ) < 0.005) return true;
    const hay = norm([x.note, x.type === "depense" ? catById(x.cat).name : x.cat, TYPE_LABEL[x.type], x.warranty && x.warranty.item, x.warranty && x.warranty.shop,
      String(x.amount).replace(".", ","), frDate(x.date), x.ndf ? "note de frais" : ""].join(" "));
    return words.every(w => hay.includes(w));
  }).sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0));
}
function renderRecherche() {
  document.getElementById("periodLabel").textContent = "Recherche";
  const cats = [...settings.cats.map(c => [c.id, c.name]), ...settings.rentree.map(s => [s, s + " (rentrée)"]), ...settings.epargne.map(s => [s, s + " (épargne)"]), ...settings.invest.map(s => [s, s + " (invest.)"])];
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`;
  view.innerHTML = banner + `<div class="card"><input class="field" id="qText" type="search" placeholder="Carrefour, loyer, 42,50, garantie…" value="${esc(Q.text)}" aria-label="Rechercher" autocomplete="off">
    <div class="two" style="margin-top:8px">
      <select class="field" id="qType" aria-label="Type">${[["", "Tous les types"], ...Object.entries(TYPE_LABEL)].map(([v, l]) => opt(v, l, Q.type)).join("")}</select>
      <select class="field" id="qPeriod" aria-label="Période">${[["all", "Toutes les dates"], ["mois", "Ce mois-ci"], ["3m", "3 derniers mois"], ["annee", "Cette année"], ["anprec", "L'an dernier"]].map(([v, l]) => opt(v, l, Q.period)).join("")}</select></div>
    <select class="field" id="qCat" style="margin-top:8px" aria-label="Catégorie">${[["", "Toutes les catégories"], ...cats].map(([v, l]) => opt(v, l, Q.cat)).join("")}</select>
    <div class="chips" style="margin-top:8px">${[["facture", "Avec facture"], ["ndf", "Notes de frais"], ["gar", "Sous garantie"]].map(([k, l]) => `<button type="button" class="chip" data-q="${k}" aria-pressed="${!!Q[k]}">${l}</button>`).join("")}</div>
  </div><div id="qRes" style="display:flex;flex-direction:column;gap:14px"></div>`;
  const t = document.getElementById("qText");
  t.oninput = () => { Q.text = t.value; drawResults(); };
  for (const [id, k] of [["qType", "type"], ["qPeriod", "period"], ["qCat", "cat"]]) document.getElementById(id).onchange = e => { Q[k] = e.target.value; drawResults(); };
  view.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { Q[b.dataset.q] = !Q[b.dataset.q]; b.setAttribute("aria-pressed", String(Q[b.dataset.q])); drawResults(); });
  drawResults();
}
function drawResults() {
  const res = searchItems();
  const tot = ty => res.filter(x => x.type === ty && !(ty === "depense" && x.ndf)).reduce((a, x) => a + Number(x.amount), 0);
  const dep = tot("depense"), ren = tot("rentree");
  document.getElementById("resCap").textContent = `${res.length} opération${res.length > 1 ? "s" : ""} trouvée${res.length > 1 ? "s" : ""} · total des dépenses`;
  const big = document.getElementById("resBig"); big.textContent = eur(dep); big.className = "big num";
  document.getElementById("resPill").innerHTML = ren ? `<span class="pill" style="background:rgba(255,255,255,.15);color:#fff">Rentrées : ${esc(eur(ren))}</span>` : "";
  const shown = res.slice(0, 200);
  document.getElementById("qRes").innerHTML = res.length
    ? `<div class="card"><h2>Résultats<small>${res.length > 200 ? "200 premiers sur " + res.length : res.length}</small></h2>${txListHTML(shown, true)}</div>`
    : `<div class="card"><div class="empty">Aucune opération ne correspond.</div></div>`;
  document.querySelectorAll("#qRes .tx").forEach(b => b.onclick = () => { const x = shown.find(i => i.id === b.dataset.id); if (x) { const { key, ...tx } = x; openSheet(tx); } });
}

// ---------- Objectifs d'épargne ----------
const GOAL_COLORS = ["#2e8b57", "#2f6fb0", "#e67e22", "#7d3c98", "#c0392b", "#16a085"];
function goalSaved(gid) {
  const g = goals[gid]; if (!g) return 0;
  return (Number(g.initial) || 0) + allItems().filter(x => x.goal === gid && (x.type === "epargne" || x.type === "invest")).reduce((a, x) => a + Number(x.amount), 0);
}
function monthsBetween(fromIso, toIso) {
  const a = new Date(fromIso + "T12:00:00"), b = new Date(toIso + "T12:00:00");
  return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + (b.getDate() >= a.getDate() ? 0 : -1);
}
function renderObjectifs() {
  const list = Object.entries(goals).map(([id, g]) => ({ ...g, id, saved: goalSaved(id) }));
  const total = list.reduce((a, g) => a + g.saved, 0);
  document.getElementById("periodLabel").textContent = "Objectifs";
  document.getElementById("resCap").textContent = "Mis de côté pour tes objectifs";
  const big = document.getElementById("resBig"); big.textContent = eur(total); big.className = "big num";
  document.getElementById("resPill").innerHTML = "";
  let html = banner;
  if (!list.length) html += `<div class="card"><div class="empty">Aucun objectif pour l'instant.<br>Appuie sur + pour en créer un : vacances, voiture, épargne de précaution…</div></div>`;
  const today = todayISO();
  for (const g of list.sort((a, b) => (a.saved >= a.target) - (b.saved >= b.target) || (a.deadline || "9").localeCompare(b.deadline || "9"))) {
    const pct = g.target ? Math.min(100, g.saved / g.target * 100) : 0, left = Math.max(0, g.target - g.saved), done = left <= 0;
    let plan = "";
    if (!done && g.deadline) {
      const m = monthsBetween(today, g.deadline);
      plan = m >= 1 ? `≈ <b>${esc(eur(left / m, true))} par mois</b> pendant ${m} mois pour y arriver le ${esc(frDate(g.deadline))}` : daysUntil(g.deadline) >= 0 ? `Plus que ${esc(eur(left))} à mettre de côté avant le ${esc(frDate(g.deadline))}` : `Échéance du ${esc(frDate(g.deadline))} dépassée`;
    } else if (!done) {
      const last3 = allItems().filter(x => x.goal === g.id && x.date >= addDays(today, -92)).reduce((a, x) => a + Number(x.amount), 0) / 3;
      plan = last3 > 0 ? `À ton rythme actuel (≈ ${esc(eur(last3, true))}/mois), objectif atteint dans environ ${Math.ceil(left / last3)} mois` : "Ajoute une date pour savoir combien mettre de côté chaque mois.";
    }
    html += `<div class="gar ${done ? "done" : ""}" style="border-left-color:${done ? "var(--good)" : esc(g.color || GOAL_COLORS[0])}">
      <div class="top"><span class="n">${esc(g.name)}</span>${done ? `<span class="st">Atteint</span>` : `<span class="hint num">${Math.round(pct)} %</span>`}</div>
      <div class="top"><span class="amt num">${esc(eur(g.saved))}</span><span class="hint num">sur ${esc(eur(g.target))}</span></div>
      <div class="bar"><i style="width:${pct}%;background:${done ? "var(--good)" : esc(g.color || GOAL_COLORS[0])}"></i></div>
      <div class="s">${done ? "Bravo, objectif atteint !" : `Reste ${esc(eur(left))}${plan ? "<br>" + plan : ""}`}</div>
      <div class="acts">${!done ? `<button class="btn primary" data-g="add" data-id="${esc(g.id)}">Ajouter un versement</button>` : ""}<button class="btn" data-g="edit" data-id="${esc(g.id)}">Modifier</button></div></div>`;
  }
  html += `<p class="hint" style="text-align:center;margin:4px 0 0">Chaque versement est une opération « Épargne » rattachée à l'objectif : elle apparaît aussi dans ton budget du mois.</p>`;
  view.innerHTML = html;
  view.querySelectorAll("[data-g]").forEach(b => b.onclick = () => {
    if (b.dataset.g === "edit") return editGoal(b.dataset.id);
    openSheet(null); form.type = "epargne"; form.cat = settings.epargne[0]; form.goal = b.dataset.id; drawForm();
  });
}
function editGoal(id) {
  const g = id ? clone(goals[id]) : { name: "", target: "", deadline: "", initial: "", color: GOAL_COLORS[Object.keys(goals).length % GOAL_COLORS.length] };
  let color = g.color;
  openForm(`<div class="f2"><h3>${id ? "Modifier l'objectif" : "Nouvel objectif"}</h3>
    ${fld("gName", "Nom", `placeholder="ex. Vacances en Grèce, Voiture, Épargne de précaution" value="${esc(g.name)}"`)}
    <div class="two"><div>${fld("gTarget", `Montant à atteindre (${esc(curSym())})`, `inputmode="decimal" value="${g.target === "" ? "" : esc(String(g.target).replace(".", ","))}"`)}</div>
      <div>${fld("gDeadline", "Pour le (facultatif)", `type="date" value="${esc(g.deadline || "")}"`)}</div></div>
    ${fld("gInitial", `Déjà mis de côté (${esc(curSym())})`, `inputmode="decimal" placeholder="0" value="${g.initial ? esc(String(g.initial).replace(".", ",")) : ""}"`)}
    <span class="lbl">Couleur</span><div class="chips" id="gColor"></div></div>`,
    () => {
      const name = val("gName"), target = parseAmount(val("gTarget"));
      if (!name) { toast("Donne un nom à l'objectif"); return false; }
      if (!(target > 0)) { toast("Indique le montant à atteindre"); return false; }
      goals[id || newId()] = { ...g, name: name.slice(0, 60), target, deadline: val("gDeadline"), initial: parseAmount(val("gInitial")) || 0, color, created: g.created || Date.now() };
      saveGoals(); render(); toast(id ? "Objectif modifié" : "Objectif créé");
    },
    id ? () => {
      for (const x of allItems()) if (x.goal === id) { delete months[x.key].items[x.id].goal; saveMonth(x.key); }
      delete goals[id]; saveGoals(); render(); toast("Objectif supprimé (les versements restent dans ton budget)");
    } : null);
  const el = document.getElementById("gColor");
  const draw = () => {
    el.innerHTML = GOAL_COLORS.map(c => `<button type="button" class="chip" aria-pressed="${c === color}" data-c="${c}" aria-label="Couleur"><span class="sw" style="background:${c};width:16px;height:16px"></span></button>`).join("");
    el.querySelectorAll(".chip").forEach(b => b.onclick = () => { color = b.dataset.c; draw(); });
  };
  draw();
}
function drawGoalPick() {
  const wrap = document.getElementById("goalWrap"), box = document.getElementById("fGoal");
  const list = Object.entries(goals);
  wrap.hidden = !(form.type === "epargne" || form.type === "invest") || !list.length;
  if (wrap.hidden) return;
  box.innerHTML = [["", "Aucun"], ...list.map(([id, g]) => [id, g.name])].map(([v, l]) => `<button type="button" class="chip" aria-pressed="${v === (form.goal || "")}" data-v="${esc(v)}">${esc(l)}</button>`).join("");
  box.querySelectorAll(".chip").forEach(b => b.onclick = () => { form.goal = b.dataset.v; drawGoalPick(); });
}

// ---------- Comparaisons, alertes et bilan ----------
function depByCat(list) { const o = {}; let tot = 0; for (const x of list) if (x.type === "depense" && !x.ndf) { o[x.cat] = (o[x.cat] || 0) + Number(x.amount); tot += Number(x.amount); } return { o, tot }; }
function prevMonths(y, m, n) { const out = []; for (let k = 1; k <= n; k++) { let mm = m - k, yy = y; while (mm < 1) { mm += 12; yy--; } out.push({ y: yy, m: mm }); } return out; }
function compareHTML() {
  const isCur = cur.y === now.getFullYear() && cur.m === now.getMonth() + 1;
  const dayLimit = isCur ? now.getDate() : 31;
  const prev = prevMonths(cur.y, cur.m, 3).map(p => itemsOf(p.y, p.m)).filter(l => l.some(x => x.type === "depense"));
  if (!prev.length) return `<div class="card"><h2>Comparé à d'habitude</h2><p class="hint" style="margin:0">La comparaison avec tes mois précédents apparaîtra après un premier mois complet.</p></div>`;
  const cut = l => l.filter(x => Number(x.date.slice(8, 10)) <= dayLimit);
  const curD = depByCat(cut(itemsOf(cur.y, cur.m)));
  const avg = { o: {}, tot: 0 };
  for (const l of prev) { const d = depByCat(cut(l)); avg.tot += d.tot / prev.length; for (const [k, v] of Object.entries(d.o)) avg.o[k] = (avg.o[k] || 0) + v / prev.length; }
  const pct = (a, b) => b ? Math.round((a - b) / b * 100) : null;
  const tp = pct(curD.tot, avg.tot);
  const cats = new Set([...Object.keys(curD.o), ...Object.keys(avg.o)]);
  const alerts = [...cats].map(c => ({ c, now: curD.o[c] || 0, usual: avg.o[c] || 0 }))
    .map(a => ({ ...a, diff: a.now - a.usual, p: pct(a.now, a.usual) }))
    .filter(a => Math.abs(a.diff) >= 20 && (a.p === null || Math.abs(a.p) >= 25))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 4);
  const arrow = d => d > 0 ? `<span style="color:var(--bad)">▲</span>` : `<span style="color:var(--good)">▼</span>`;
  return `<div class="card"><h2>Comparé à d'habitude<small>moyenne des ${prev.length} mois précédents${isCur ? ", à la même date" : ""}</small></h2>
    <div class="fc-row" style="border-top:0;margin-top:0;padding-top:0"><span>Dépenses ${isCur ? "à ce jour" : "du mois"} : <b class="num" style="color:var(--ink)">${esc(eur(curD.tot, true))}</b> au lieu de ${esc(eur(avg.tot, true))}</span>
      ${tp !== null ? `<b class="num" style="color:${tp > 0 ? "var(--bad)" : "var(--good)"}">${tp > 0 ? "+" : ""}${tp} %</b>` : ""}</div>
    ${alerts.length ? `<div class="fc-list">${alerts.map(a => `<div class="fc-it" style="grid-template-columns:18px 1fr auto"><span>${arrow(a.diff)}</span><span>${esc(catById(a.c).name)} <small class="hint">· ${esc(eur(a.now, true))} au lieu de ${esc(eur(a.usual, true))}</small></span><b class="num" style="color:${a.diff > 0 ? "var(--bad)" : "var(--good)"}">${a.p === null ? "nouveau" : (a.p > 0 ? "+" : "") + a.p + " %"}</b></div>`).join("")}</div>`
      : `<p class="hint" style="margin:8px 0 0">Rien d'inhabituel : tes dépenses sont dans tes habitudes.</p>`}</div>`;
}
function bilanHTML() {
  if (!(cur.y === now.getFullYear() && cur.m === now.getMonth() + 1) || now.getDate() > 10) return "";
  const p = prevMonths(cur.y, cur.m, 1)[0], l = itemsOf(p.y, p.m);
  if (!l.length) return "";
  const t = totals(l), top = Object.entries(t.byCat).sort((a, b) => b[1] - a[1])[0];
  const prev3 = prevMonths(p.y, p.m, 3).map(q => totals(itemsOf(q.y, q.m))).filter(x => x.depense > 0);
  const avgDep = prev3.length ? prev3.reduce((a, x) => a + x.depense, 0) / prev3.length : 0;
  const d = avgDep ? Math.round((t.depense - avgDep) / avgDep * 100) : null;
  return `<div class="card" style="border-left:6px solid var(--accent)"><h2>Bilan ${/^[aeiouyâàéèêô]/i.test(MOIS[p.m - 1]) ? "d'" : "de "}${MOIS[p.m - 1]}</h2>
    <div class="fc-it" style="grid-template-columns:1fr auto"><span>Résultat (rentrées − dépenses)</span><b class="num" style="color:${t.result >= 0 ? "var(--good)" : "var(--bad)"}">${t.result > 0 ? "+" : ""}${esc(eur(t.result))}</b></div>
    <div class="fc-it" style="grid-template-columns:1fr auto"><span>Mis de côté (épargne + invest.)</span><b class="num">${esc(eur(t.epargne + t.invest))}</b></div>
    ${top ? `<div class="fc-it" style="grid-template-columns:1fr auto"><span>Plus gros poste : ${esc(catById(top[0]).name)}</span><b class="num">${esc(eur(top[1]))}</b></div>` : ""}
    ${d !== null ? `<div class="fc-it" style="grid-template-columns:1fr auto"><span>Dépenses par rapport à ta moyenne</span><b class="num" style="color:${d > 0 ? "var(--bad)" : "var(--good)"}">${d > 0 ? "+" : ""}${d} %</b></div>` : ""}</div>`;
}

// ---------- Dépenses partagées (groupes) ----------
let openGroup = null;
function groupBalances(g) {
  const bal = {}; for (const m of g.members) bal[m.id] = 0;
  for (const e of Object.values(g.expenses || {})) {
    const amt = Number(e.amount) || 0;
    if (e.kind === "transfer") { bal[e.from] = (bal[e.from] || 0) + amt; bal[e.to] = (bal[e.to] || 0) - amt; continue; }
    const split = (e.split || []).filter(id => id in bal); if (!split.length) continue;
    bal[e.paidBy] = (bal[e.paidBy] || 0) + amt;
    for (const id of split) bal[id] -= amt / split.length;
  }
  for (const k in bal) bal[k] = Math.round(bal[k] * 100) / 100;
  return bal;
}
function settle(bal) {
  const deb = Object.entries(bal).filter(([, v]) => v < -0.004).map(([id, v]) => ({ id, v: -v })).sort((a, b) => b.v - a.v);
  const cre = Object.entries(bal).filter(([, v]) => v > 0.004).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v);
  const out = []; let i = 0, j = 0;
  while (i < deb.length && j < cre.length) {
    const x = Math.min(deb[i].v, cre[j].v);
    out.push({ from: deb[i].id, to: cre[j].id, amount: Math.round(x * 100) / 100 });
    deb[i].v -= x; cre[j].v -= x;
    if (deb[i].v < 0.005) i++; if (cre[j].v < 0.005) j++;
  }
  return out;
}
const mName = (g, id) => (g.members.find(m => m.id === id) || { name: "?" }).name + (id === g.me ? " (moi)" : "");
function renderPartage() {
  if (openGroup && !groups[openGroup]) openGroup = null;
  if (openGroup) return renderGroup(openGroup);
  const list = Object.entries(groups).map(([id, g]) => ({ ...g, id, bal: groupBalances(g) }));
  const mine = list.reduce((a, g) => a + (g.bal[g.me] || 0), 0);
  document.getElementById("periodLabel").textContent = "Dépenses partagées";
  document.getElementById("resCap").textContent = mine >= 0 ? "Au total, on te doit" : "Au total, tu dois";
  const big = document.getElementById("resBig"); big.textContent = eur(Math.abs(mine)); big.className = "big num " + (mine > 0.004 ? "good" : mine < -0.004 ? "bad" : "");
  document.getElementById("resPill").innerHTML = "";
  let html = banner;
  if (!list.length) html += `<div class="card"><div class="empty">Aucun groupe.<br>Appuie sur + pour créer un groupe (couple, colocation, vacances entre amis…) et savoir qui doit combien à qui.</div></div>`;
  for (const g of list) {
    const b = g.bal[g.me] || 0;
    html += `<button class="gar ${b > 0.004 ? "owed" : b < -0.004 ? "debt" : "done"}" data-open="${esc(g.id)}" style="text-align:left;width:100%;cursor:pointer;font:inherit;color:inherit">
      <div class="top"><span class="n">${esc(g.name)}</span><span class="st">${b > 0.004 ? "On te doit" : b < -0.004 ? "Tu dois" : "Équilibré"}</span></div>
      <div class="top"><span class="amt num">${esc(eur(Math.abs(b)))}</span><span class="hint">${g.members.length} personnes · ${Object.values(g.expenses || {}).filter(e => e.kind !== "transfer").length} dépenses</span></div></button>`;
  }
  html += `<p class="hint" style="text-align:center;margin:4px 0 0">Le groupe est tenu dans ton app : partage le récap (bouton dans le groupe) pour que chacun sache où il en est.</p>`;
  view.innerHTML = html;
  view.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { openGroup = b.dataset.open; render(); window.scrollTo(0, 0); });
}
function groupRecapText(g) {
  const bal = groupBalances(g), st = settle(bal);
  const total = Object.values(g.expenses || {}).filter(e => e.kind !== "transfer").reduce((a, e) => a + Number(e.amount), 0);
  return [`${g.name} — récap Bourselle`, `Dépenses du groupe : ${eur(total)}`, "",
    ...g.members.map(m => `${m.name} : ${bal[m.id] >= 0 ? "+" : ""}${eur(bal[m.id])}`), "",
    st.length ? "Pour équilibrer :" : "Tout est équilibré.",
    ...st.map(s => `• ${(g.members.find(m => m.id === s.from) || {}).name} doit ${eur(s.amount)} à ${(g.members.find(m => m.id === s.to) || {}).name}`)].join("\n");
}
function renderGroup(gid) {
  const g = groups[gid], bal = groupBalances(g), st = settle(bal), me = bal[g.me] || 0;
  document.getElementById("periodLabel").textContent = g.name;
  document.getElementById("resCap").textContent = me >= 0 ? "Dans ce groupe, on te doit" : "Dans ce groupe, tu dois";
  const big = document.getElementById("resBig"); big.textContent = eur(Math.abs(me)); big.className = "big num " + (me > 0.004 ? "good" : me < -0.004 ? "bad" : "");
  const total = Object.values(g.expenses || {}).filter(e => e.kind !== "transfer").reduce((a, e) => a + Number(e.amount), 0);
  document.getElementById("resPill").innerHTML = `<span class="pill" style="background:rgba(255,255,255,.15);color:#fff">Total du groupe ${esc(eur(total, true))}</span>`;
  const exps = Object.entries(g.expenses || {}).map(([id, e]) => ({ ...e, id })).sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0));
  let html = banner + `<button class="btn" id="gBack" style="align-self:flex-start">‹ Tous les groupes</button>
    <div class="card"><h2>Soldes</h2>${g.members.map(m => `<div class="fc-it" style="grid-template-columns:1fr auto"><span>${esc(mName(g, m.id))}</span><b class="num" style="color:${bal[m.id] > 0.004 ? "var(--good)" : bal[m.id] < -0.004 ? "var(--bad)" : "var(--muted)"}">${bal[m.id] > 0 ? "+" : ""}${esc(eur(bal[m.id]))}</b></div>`).join("")}</div>
    <div class="card"><h2>Qui doit à qui</h2>${st.length ? st.map((s, i) => `<div class="ndf-item"><div><div class="n">${esc(mName(g, s.from))} → ${esc(mName(g, s.to))}</div></div><div class="num" style="font-weight:700">${esc(eur(s.amount))}</div>
        <div class="acts"><button class="btn primary" data-settle="${i}">Marquer comme remboursé</button></div></div>`).join("") : `<div class="empty">Tout le monde est quitte.</div>`}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" id="gShare">Copier le récap</button><button class="btn" id="gEdit">Modifier le groupe</button></div></div>
    <div class="card"><h2>Dépenses<small>${exps.length}</small></h2>${exps.length ? exps.map(e => e.kind === "transfer"
      ? `<div class="pay" style="padding:8px 0"><span>${esc(frDate(e.date))} · ${esc(mName(g, e.from))} a remboursé ${esc(mName(g, e.to))}</span><span class="num">${esc(eur(e.amount))} <button class="btn" data-del="${esc(e.id)}" style="padding:2px 8px;font-size:.72rem">✕</button></span></div>`
      : `<button class="tx" data-exp="${esc(e.id)}"><span class="ic" style="background:#2f6fb0">${esc((e.label || "?").slice(0, 2))}</span><span><div class="n">${esc(e.label)}</div><div class="s">${esc(frDate(e.date))} · payé par ${esc(mName(g, e.paidBy))} · pour ${e.split.length === g.members.length ? "tout le monde" : esc(e.split.map(id => mName(g, id)).join(", "))}</div></span><span class="a num out">${esc(eur(e.amount))}</span></button>`).join("")
      : `<div class="empty">Aucune dépense. Appuie sur + pour en ajouter une.</div>`}</div>`;
  view.innerHTML = html;
  document.getElementById("gBack").onclick = () => { openGroup = null; render(); };
  document.getElementById("gEdit").onclick = () => editGroup(gid);
  document.getElementById("gShare").onclick = async () => {
    const txt = groupRecapText(g);
    try { await navigator.clipboard.writeText(txt); toast("Récap copié : colle-le dans un message"); } catch (e) { toast("Copie impossible ici"); }
  };
  view.querySelectorAll("[data-settle]").forEach(b => b.onclick = () => {
    const s = st[Number(b.dataset.settle)];
    g.expenses = g.expenses || {}; g.expenses[newId()] = { kind: "transfer", from: s.from, to: s.to, amount: s.amount, date: todayISO(), created: Date.now() };
    saveGroups(); render(); toast("Remboursement enregistré");
  });
  view.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { delete g.expenses[b.dataset.del]; saveGroups(); render(); });
  view.querySelectorAll("[data-exp]").forEach(b => b.onclick = () => editGroupExpense(gid, b.dataset.exp));
}
function editGroup(id) {
  const g = id ? clone(groups[id]) : { name: "", members: [], me: "", expenses: {} };
  openForm(`<div class="f2"><h3>${id ? "Modifier le groupe" : "Nouveau groupe"}</h3>
    ${fld("grName", "Nom du groupe", `placeholder="ex. Maison, Vacances Bretagne, Coloc" value="${esc(g.name)}"`)}
    ${fld("grMe", "Ton prénom", `placeholder="ex. Marie" value="${esc(id ? (g.members.find(m => m.id === g.me) || {}).name || "" : "")}"`)}
    ${fld("grOthers", "Les autres membres (séparés par des virgules)", `placeholder="ex. Paul, Léa, Hugo" value="${esc(id ? g.members.filter(m => m.id !== g.me).map(m => m.name).join(", ") : "")}"`)}</div>`,
    () => {
      const name = val("grName"), meName = val("grMe");
      const others = val("grOthers").split(",").map(s => s.trim()).filter(Boolean);
      if (!name) { toast("Donne un nom au groupe"); return false; }
      if (!meName || !others.length) { toast("Indique ton prénom et au moins un autre membre"); return false; }
      const old = g.members; const members = [];
      const reuse = n => (old.find(m => m.name.toLowerCase() === n.toLowerCase() && !members.includes(m)) || { id: "m" + Math.random().toString(36).slice(2, 8), name: n });
      const meM = g.me && old.find(m => m.id === g.me) ? { ...old.find(m => m.id === g.me), name: meName } : reuse(meName);
      members.push(meM); for (const n of others) { const m = reuse(n); m.name = n; if (!members.some(x => x.id === m.id)) members.push(m); }
      const used = new Set(Object.values(g.expenses || {}).flatMap(e => e.kind === "transfer" ? [e.from, e.to] : [e.paidBy, ...(e.split || [])]));
      const lost = old.filter(m => used.has(m.id) && !members.some(x => x.id === m.id));
      if (lost.length) { toast(`${lost.map(m => m.name).join(", ")} a des dépenses dans le groupe : garde ce nom.`); return false; }
      const nid = id || newId();
      groups[nid] = { ...g, name: name.slice(0, 60), members, me: meM.id, created: g.created || Date.now() };
      saveGroups(); openGroup = nid; render(); toast(id ? "Groupe modifié" : "Groupe créé");
    },
    id ? () => { delete groups[id]; openGroup = null; saveGroups(); render(); toast("Groupe supprimé"); } : null);
}
function editGroupExpense(gid, eid) {
  const g = groups[gid], e = eid ? clone(g.expenses[eid]) : { label: "", amount: "", date: todayISO(), paidBy: g.me, split: g.members.map(m => m.id) };
  let paidBy = e.paidBy, split = new Set(e.split), cat = "loisirs";
  openForm(`<div class="f2"><h3>${eid ? "Modifier la dépense" : "Dépense du groupe"} · ${esc(g.name)}</h3>
    ${fld("geLabel", "Quoi ?", `placeholder="ex. Courses, Location, Restaurant" value="${esc(e.label)}"`)}
    <div class="two"><div>${fld("geAmount", `Montant (${esc(curSym())})`, `inputmode="decimal" value="${e.amount === "" ? "" : esc(String(e.amount).replace(".", ","))}"`)}</div><div>${fld("geDate", "Date", `type="date" value="${esc(e.date)}"`)}</div></div>
    <span class="lbl">Payé par</span><div class="chips" id="gePaid"></div>
    <span class="lbl">Pour qui (partagé à parts égales)</span><div class="chips" id="geSplit"></div>
    <p class="hint" id="geShare" style="margin:6px 0 0"></p>
    ${eid ? "" : `<label class="toggle" for="geMine" style="margin-top:12px"><span>Ajouter ma part à mes dépenses</span><input type="checkbox" id="geMine" checked></label>
    <div id="geCatWrap"><span class="lbl">Catégorie de ma part</span><div class="chips" id="geCat"></div></div>`}</div>`,
    () => {
      const amount = parseAmount(val("geAmount")), label = val("geLabel"), date = val("geDate");
      if (!label) { toast("Indique ce qui a été payé"); return false; }
      if (!(amount > 0)) { toast("Indique le montant"); return false; }
      if (!split.size) { toast("Choisis au moins une personne"); return false; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast("Choisis une date"); return false; }
      g.expenses = g.expenses || {};
      const order = g.members.map(m => m.id).filter(id => split.has(id));
      g.expenses[eid || newId()] = { ...e, label: label.slice(0, 60), amount, date, paidBy, split: order, created: e.created || Date.now() };
      const mine = document.getElementById("geMine");
      if (mine && mine.checked && split.has(g.me)) addTx({ type: "depense", amount: Math.round(amount / split.size * 100) / 100, cat, date, note: `${g.name} : ${label}`.slice(0, 80), fixe: false });
      saveGroups(); render(); toast(eid ? "Dépense modifiée" : "Dépense ajoutée au groupe");
    },
    eid ? () => { delete g.expenses[eid]; saveGroups(); render(); toast("Dépense supprimée"); } : null);
  const share = () => { const a = parseAmount(val("geAmount")); document.getElementById("geShare").textContent = a > 0 && split.size ? `Soit ${eur(a / split.size)} par personne.` : ""; };
  chipsPick("gePaid", g.members.map(m => [m.id, mName(g, m.id)]), paidBy, v => paidBy = v);
  const el = document.getElementById("geSplit");
  const draw = () => {
    el.innerHTML = g.members.map(m => `<button type="button" class="chip" aria-pressed="${split.has(m.id)}" data-v="${esc(m.id)}">${esc(mName(g, m.id))}</button>`).join("");
    el.querySelectorAll(".chip").forEach(b => b.onclick = () => { split.has(b.dataset.v) ? split.delete(b.dataset.v) : split.add(b.dataset.v); draw(); share(); });
  };
  draw(); share();
  document.getElementById("geAmount").addEventListener("input", share);
  if (!eid) {
    chipsPick("geCat", settings.cats.map(c => [c.id, c.name]), cat, v => cat = v);
    const mine = document.getElementById("geMine");
    mine.onchange = () => document.getElementById("geCatWrap").hidden = !mine.checked;
  }
}

// ---------- Scan de ticket ----------
// Lit le texte d'un ticket (OCR) et en tire montant total, date, magasin et catégorie probable.
function parseReceipt(text) {
  const lines = String(text || "").split(/\r?\n/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const nums = s => (s.match(/\d{1,3}(?:[ . ]\d{3})*[.,]\d{2}(?!\d)|\d+[.,]\d{2}(?!\d)/g) || [])
    .map(v => parseFloat(v.replace(/[ . ](?=\d{3}(?:[.,]|$))/g, "").replace(",", "."))).filter(v => v > 0 && v < 100000);
  const pick = (re, not) => {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!re.test(l) || (not && not.test(l))) continue;
      const n = nums(l);
      if (n.length) return n[n.length - 1];
      const nx = lines[i + 1] && nums(lines[i + 1]);
      if (nx && nx.length) return nx[nx.length - 1];
    }
    return null;
  };
  const excl = /sous[ -]?total|total\s*h\.?t|\bht\b|tva|remise|economi|fidélit|fidelit|rendu|monnaie|points?/i;
  let amount = pick(/net\s*[àa]\s*payer|total\s*(ttc|[àa]\s*payer)|montant\s*(ttc|d[uû]|[àa]\s*payer)|[àa]\s*payer/i, excl)
    ?? pick(/\btotal\b/i, excl)
    ?? pick(/carte\s*bancaire|\bcb\b|paiement|montant|esp[eè]ces/i, excl);
  if (amount == null) { const all = lines.flatMap(nums); amount = all.length ? Math.max(...all) : null; }
  let date = null;
  for (const l of lines) {
    const m = l.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})\b/);
    if (!m) continue;
    let [, d, mo, y] = m; d = +d; mo = +mo; y = +y; if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 2000 && y <= 2100) { date = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`; break; }
  }
  const skip = /ticket|facture|bienvenue|merci|t[eé]l|siret|siren|www|http|caisse|client|n°|tva|date|heure|^\d/i;
  const shopLine = lines.slice(0, 8).find(l => /[a-zà-ü]{3,}/i.test(l) && !skip.test(l)) || "";
  const shop = shopLine.replace(/[^\p{L}\p{N}&' .-]/gu, "").trim().toLowerCase().replace(/(^|[\s-])\p{L}/gu, s => s.toUpperCase()).slice(0, 40);
  const hay = (shop + " " + lines.slice(0, 12).join(" ")).toLowerCase();
  const rules = [
    ["courses", /carrefour|leclerc|auchan|lidl|intermarch|monoprix|casino|franprix|super ?u\b|hyper ?u\b|aldi|netto|picard|biocoop|grand frais|boulangerie|boucherie|march[eé]/],
    ["transport", /total ?energies|esso|\bbp\b|shell|avia|station|carburant|gazole|sp ?95|sncf|ratp|uber|p[eé]age|parking|autoroute/],
    ["sante", /pharmacie|parapharmacie|m[eé]decin|docteur|dentiste|opticien|laboratoire/],
    ["loisirs", /restaurant|brasserie|caf[eé]|bistro|mcdonald|mc do|burger|kfc|pizza|sushi|cin[eé]ma|bowling|th[eé][aâ]tre|bar /],
    ["maison", /leroy merlin|castorama|bricorama|brico|ikea|conforama|but\b|maisons du monde|jardiland/],
    ["shopping", /fnac|darty|boulanger|decathlon|zara|h ?& ?m|kiabi|primark|uniqlo|sephora|amazon|action\b|gifi/],
    ["telecom", /orange|sfr|bouygues|free mobile|\bfree\b/],
  ];
  const r = rules.find(([, re]) => re.test(hay));
  return { amount: amount != null ? Math.round(amount * 100) / 100 : null, date, shop, cat: r ? r[0] : null };
}
async function runScan(file) {
  const btn = document.getElementById("scanBtn"), f0 = form, label = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Lecture du ticket…`;
  try {
    const r = await scanReceipt(file);
    if (form !== f0) return;
    form.type = "depense";
    if (r.amount) document.getElementById("fAmount").value = String(r.amount.toFixed(2)).replace(".", ",");
    if (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) document.getElementById("fDate").value = r.date;
    if (r.shop && !document.getElementById("fNote").value) document.getElementById("fNote").value = r.shop.slice(0, 80);
    if (r.cat && settings.cats.some(c => c.id === r.cat)) { form.cat = r.cat; form.fixe = !!catById(r.cat).fixe; }
    drawForm();
    if (assets) uploadPicked([file]);
    const found = [r.amount && "montant", r.date && "date", r.shop && "magasin"].filter(Boolean);
    toast(found.length ? `Ticket lu (${found.join(", ")}) : vérifie avant d'enregistrer.` : "Je n'ai pas réussi à lire ce ticket : complète à la main.");
  } catch (e) {
    toast(e && e.message ? e.message : "Lecture impossible : complète à la main.");
  } finally { btn.disabled = false; btn.innerHTML = label; }
}
document.getElementById("scanBtn").onclick = () => document.getElementById("scanInput").click();
document.getElementById("scanInput").onchange = e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f && form) runScan(f); };

// App autonome : reconnaissance du texte sur le téléphone (Tesseract.js, chargé à la première utilisation).
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Lecture de ticket indisponible : vérifie ta connexion internet.")); document.head.appendChild(s); });
}
async function scanReceipt(file) {
  if (!window.Tesseract) await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js");
  const { data } = await window.Tesseract.recognize(file, "fra");
  return parseReceipt(data && data.text);
}

// ---------- Tontines ----------
// Chaque membre verse la même cotisation à chaque tour ; à chaque tour, un membre reçoit tout le pot.
const TON_FREQ = [["semaine", "Chaque semaine"], ["mois", "Chaque mois"], ["an", "Chaque année"]];
const TON_UNIT = { semaine: "semaine", mois: "mois", an: "an" };
let tonOpen = {};
function tonRounds(t) {
  const out = []; let d = t.start;
  for (let k = 0; k < t.order.length; k++) { out.push({ k, date: d, who: t.order[k] }); d = advance(d, t.freq); }
  return out;
}
function tonPot(t) { return (Number(t.amount) || 0) * t.members.length; }
function tonPaid(id, k) { return allItems().some(x => x.tontine === id && x.round === k && x.type === "epargne"); }
function tonReceived(id, k) { return allItems().some(x => x.tontine === id && x.round === k && x.type === "rentree"); }
function tonMember(t, mid) { return (t.members.find(m => m.id === mid) || { name: "?" }).name; }
function tonAddTx(id, t, r, kind) {
  const date = r.date, key = date.slice(0, 7), tid = (kind === "pay" ? "tn-" : "tp-") + id + "-" + r.k;
  months[key] = months[key] || { items: {} };
  if (months[key].items[tid]) return false;
  months[key].items[tid] = kind === "pay"
    ? { type: "epargne", amount: Number(t.amount), cat: "Tontine", date, note: `Tontine ${t.name} – cotisation tour ${r.k + 1}`, tontine: id, round: r.k, created: Date.now() }
    : { type: "rentree", amount: tonPot(t), cat: "Tontine", date, note: `Tontine ${t.name} – pot reçu (tour ${r.k + 1})`, tontine: id, round: r.k, created: Date.now() };
  saveMonth(key); return true;
}
function tonRemoveTx(id, k, type) {
  for (const x of allItems()) if (x.tontine === id && x.round === k && x.type === type) { delete months[x.key].items[x.id]; saveMonth(x.key); }
}
// Avec l'option automatique : cotisations et pot ajoutés tout seuls à leur date (identifiants fixes : jamais de doublon).
function applyTontines() {
  let n = 0; const today = todayISO();
  for (const [id, t] of Object.entries(tontines)) {
    if (!t.auto || t.closed) continue;
    for (const r of tonRounds(t)) {
      if (r.date > today) break;
      if (!tonPaid(id, r.k) && !(t.skipped || []).includes(r.k)) n += tonAddTx(id, t, r, "pay") ? 1 : 0;
      if (r.who === t.me && !tonReceived(id, r.k)) n += tonAddTx(id, t, r, "pot") ? 1 : 0;
    }
  }
  return n;
}
function tonState(id, t) {
  const today = todayISO(), rounds = tonRounds(t);
  const cur = rounds.find(r => r.date >= today) || null;            // prochain tour (ou aujourd'hui)
  const last = rounds[rounds.length - 1];
  const done = t.closed || (last && last.date < today && rounds.every(r => tonPaid(id, r.k)));
  const unpaid = rounds.filter(r => r.date <= today && !tonPaid(id, r.k));
  const mine = rounds.find(r => r.who === t.me);
  const paidN = rounds.filter(r => tonPaid(id, r.k)).length;
  const received = mine && tonReceived(id, mine.k) ? tonPot(t) : 0;
  return { rounds, cur, done, unpaid, mine, paidN, contributed: paidN * Number(t.amount), received };
}
function tontineAlerts() {
  let n = 0;
  for (const [id, t] of Object.entries(tontines)) { if (t.closed) continue; const s = tonState(id, t); if (s.unpaid.length || (s.mine && !s.received && daysUntil(s.mine.date) <= 7 && daysUntil(s.mine.date) >= -30)) n++; }
  return n;
}
function renderTontines() {
  const list = Object.entries(tontines).map(([id, t]) => ({ id, t, s: tonState(id, t) }));
  const next = list.filter(x => !x.t.closed && x.s.mine && !x.s.received && x.s.mine.date >= todayISO()).sort((a, b) => a.s.mine.date.localeCompare(b.s.mine.date))[0];
  document.getElementById("periodLabel").textContent = "Tontines";
  document.getElementById("resCap").textContent = next ? `Ton prochain pot · ${next.t.name}` : "Tontines en cours";
  const big = document.getElementById("resBig"); big.className = "big num";
  big.textContent = next ? eur(tonPot(next.t)) : String(list.filter(x => !x.s.done).length);
  document.getElementById("resPill").innerHTML = next ? `<span class="pill" style="background:rgba(255,255,255,.15);color:#fff">le ${esc(frDate(next.s.mine.date))} · ${esc(leftTxt(daysUntil(next.s.mine.date)))}</span>` : "";
  let html = banner;
  if (!list.length) html += `<div class="card"><div class="empty">Aucune tontine.<br>Appuie sur + pour suivre une tontine (aussi appelée Drewo ou Hagbad) : cotisations, ordre des tours et date à laquelle tu reçois le pot.</div></div>`;
  for (const { id, t, s } of list.sort((a, b) => a.s.done - b.s.done)) {
    const pot = tonPot(t), N = t.order.length;
    const cls = s.done ? "off" : s.unpaid.length ? "soon" : "";
    const curR = s.cur, mineR = s.mine;
    const bal = s.received - s.contributed;
    html += `<div class="gar ${cls}" style="${cls ? "" : "border-left-color:#2f6fb0"}">
      <div class="top"><span class="n">${esc(t.name)}</span><span class="st" style="${cls ? "" : "background:#2f6fb0"}">${s.done ? "Terminée" : s.unpaid.length ? "Cotisation à payer" : "En cours"}</span></div>
      <div class="top"><span class="amt num">${esc(eur(t.amount))} <small class="hint">/ ${TON_UNIT[t.freq]}</small></span><span class="hint num">pot de ${esc(eur(pot))}</span></div>
      <div class="bar"><i style="width:${s.paidN / N * 100}%;background:#2f6fb0"></i></div>
      <div class="s">${N} membres · ${s.paidN}/${N} cotisations versées
        ${curR && !s.done ? `<br>Prochain tour (${curR.k + 1}/${N}) : <b>${esc(tonMember(t, curR.who))}${curR.who === t.me ? " (toi)" : ""}</b> reçoit le pot le ${esc(frDate(curR.date))}` : ""}
        ${mineR ? `<br>${s.received ? `Tu as reçu le pot (${esc(eur(pot))}) le ${esc(frDate(mineR.date))}` : `<b>Ton tour : n°${mineR.k + 1}, le ${esc(frDate(mineR.date))}</b> (${esc(leftTxt(daysUntil(mineR.date)))})`}` : ""}
        <br>Versé ${esc(eur(s.contributed))} · reçu ${esc(eur(s.received))} → ${bal > 0.004 ? `tu as reçu ${esc(eur(bal))} d'avance, à rembourser par tes prochaines cotisations` : bal < -0.004 ? `${esc(eur(-bal))} t'attendent dans le pot` : "équilibré"}
        ${s.unpaid.length ? `<br><b style="color:var(--bad)">${s.unpaid.length} cotisation${s.unpaid.length > 1 ? "s" : ""} en retard</b>` : ""}</div>
      <div class="acts">
        ${!s.done && (s.unpaid[0] || (curR && !tonPaid(id, curR.k))) ? `<button class="btn primary" data-ta="pay" data-id="${esc(id)}">Payer ma cotisation</button>` : ""}
        ${mineR && !s.received && daysUntil(mineR.date) <= 7 ? `<button class="btn primary" data-ta="pot" data-id="${esc(id)}">J'ai reçu le pot</button>` : ""}
        <button class="btn" data-ta="cal" data-id="${esc(id)}">${tonOpen[id] ? "Masquer le calendrier" : "Calendrier"}</button>
        <button class="btn" data-ta="edit" data-id="${esc(id)}">Modifier</button></div>
      ${tonOpen[id] ? `<div class="fc-list">${s.rounds.map(r => `<div class="fc-it" style="grid-template-columns:22px 86px 1fr auto"><span>${r.k + 1}</span><span class="num">${esc(frDate(r.date))}</span>
        <span style="${r.who === t.me ? "font-weight:700" : ""}">${esc(tonMember(t, r.who))}${r.who === t.me ? " (toi)" : ""}${r.who === t.me && tonReceived(id, r.k) ? " ✓ reçu" : ""}</span>
        <button class="chip" data-tp="${esc(id)}:${r.k}" aria-pressed="${tonPaid(id, r.k)}" style="padding:4px 9px;font-size:.74rem">${tonPaid(id, r.k) ? "Cotisé ✓" : r.date <= todayISO() ? "À payer" : "À venir"}</button></div>`).join("")}</div>` : ""}
    </div>`;
  }
  html += `<p class="hint" style="text-align:center;margin:4px 0 0">Tes cotisations comptent comme de l'épargne et le pot reçu comme une rentrée : la tontine apparaît dans ton budget et dans ta prévision de fin de mois.</p>`;
  view.innerHTML = html;
  view.querySelectorAll("[data-ta]").forEach(b => b.onclick = () => {
    const id = b.dataset.id, t = tontines[id], s = tonState(id, t), a = b.dataset.ta;
    if (a === "edit") return editTontine(id);
    if (a === "cal") { tonOpen[id] = !tonOpen[id]; return render(); }
    if (a === "pay") { const r = s.unpaid[0] || s.cur; tonAddTx(id, t, r, "pay"); render(); toast(`Cotisation du tour ${r.k + 1} enregistrée (${eur(t.amount)})`); }
    if (a === "pot") { tonAddTx(id, t, s.mine, "pot"); render(); toast(`Pot de ${eur(tonPot(t))} ajouté à tes rentrées`); }
  });
  view.querySelectorAll("[data-tp]").forEach(b => b.onclick = () => {
    const [id, ks] = b.dataset.tp.split(":"), k = Number(ks), t = tontines[id], r = tonRounds(t)[k];
    if (tonPaid(id, k)) { tonRemoveTx(id, k, "epargne"); t.skipped = Array.from(new Set([...(t.skipped || []), k])); saveTontines(); }
    else { tonAddTx(id, t, r, "pay"); t.skipped = (t.skipped || []).filter(x => x !== k); saveTontines(); }
    render();
  });
}
function editTontine(id) {
  const t = id ? clone(tontines[id]) : { name: "", amount: "", freq: "mois", start: todayISO(), members: [], me: "", order: [], auto: true };
  let freq = t.freq, order = t.order.map(mid => tonMember(t, mid));
  const meName0 = id ? tonMember(t, t.me) : "";
  openForm(`<div class="f2"><h3>${id ? "Modifier la tontine" : "Nouvelle tontine"}</h3>
    ${fld("tnName", "Nom", `placeholder="ex. Tontine famille, Drewo du quartier" value="${esc(t.name)}"`)}
    <div class="two"><div>${fld("tnAmount", `Cotisation par personne (${esc(curSym())})`, `inputmode="decimal" value="${t.amount === "" ? "" : esc(String(t.amount).replace(".", ","))}"`)}</div>
      <div>${fld("tnStart", "Date du 1er tour", `type="date" value="${esc(t.start)}"`)}</div></div>
    <span class="lbl">Versement</span><div class="chips" id="tnFreq"></div>
    ${fld("tnMe", "Ton prénom", `placeholder="ex. Awa" value="${esc(meName0)}"`)}
    ${fld("tnOthers", "Les autres membres, dans l'ordre des tours (séparés par des virgules)", `placeholder="ex. Fatou, Moussa, Aïcha" value="${esc(order.filter(n => n !== meName0).join(", "))}"`)}
    <span class="lbl">Ordre des tours (qui reçoit le pot, et quand)</span>
    <div id="tnOrder" class="fc-list" style="margin-top:0"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="btn" id="tnDraw">Tirer au sort</button><button type="button" class="btn" id="tnReset">Ordre de la liste</button></div>
    <p class="hint" id="tnPot" style="margin:8px 0 0"></p>
    <label class="toggle" for="tnAuto" style="margin-top:12px"><span>Ajouter tout seul mes cotisations et mon pot dans mon budget, à leur date</span><input type="checkbox" id="tnAuto" ${t.auto ? "checked" : ""}></label>
    ${id ? `<label class="toggle" for="tnClosed" style="margin-top:8px"><span>Tontine terminée</span><input type="checkbox" id="tnClosed" ${t.closed ? "checked" : ""}></label>` : ""}</div>`,
    () => {
      const name = val("tnName"), amount = parseAmount(val("tnAmount")), start = val("tnStart"), me = val("tnMe");
      const names = currentNames();
      if (!name) { toast("Donne un nom à la tontine"); return false; }
      if (!(amount > 0)) { toast("Indique le montant de la cotisation"); return false; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) { toast("Indique la date du premier tour"); return false; }
      if (!me || names.length < 2) { toast("Indique ton prénom et au moins un autre membre"); return false; }
      if (new Set(names.map(n => n.toLowerCase())).size !== names.length) { toast("Deux membres ont le même prénom : ajoute une initiale"); return false; }
      const seq = order.length === names.length && order.every(n => names.includes(n)) ? order : names;
      const members = seq.map(n => t.members.find(m => m.name.toLowerCase() === n.toLowerCase()) || { id: "m" + Math.random().toString(36).slice(2, 8), name: n });
      members.forEach((m, i) => m.name = seq[i]);
      const meM = members.find(m => m.name.toLowerCase() === me.toLowerCase());
      const nid = id || newId(), closed = document.getElementById("tnClosed");
      tontines[nid] = { ...t, name: name.slice(0, 60), amount, start, freq, members, me: meM.id, order: members.map(m => m.id),
        auto: document.getElementById("tnAuto").checked, closed: closed ? closed.checked : false, created: t.created || Date.now() };
      saveTontines(); applyRecurring(); render(); toast(id ? "Tontine modifiée" : "Tontine créée");
    },
    id ? () => {
      for (const x of allItems()) if (x.tontine === id) { delete months[x.key].items[x.id].tontine; delete months[x.key].items[x.id].round; saveMonth(x.key); }
      delete tontines[id]; saveTontines(); render(); toast("Tontine supprimée (les opérations déjà enregistrées restent dans ton budget)");
    } : null);
  function currentNames() {
    const me = val("tnMe"), others = val("tnOthers").split(",").map(x => x.trim()).filter(Boolean);
    return me ? [me, ...others.filter(n => n.toLowerCase() !== me.toLowerCase())] : others;
  }
  function draw() {
    const names = currentNames();
    if (!(order.length === names.length && order.every(n => names.includes(n)))) {
      // par défaut : l'ordre de la liste des autres membres, et toi à la place choisie précédemment ou en premier
      order = names;
    }
    let d = val("tnStart") || todayISO(); const me = val("tnMe").toLowerCase();
    document.getElementById("tnOrder").innerHTML = order.length ? order.map((n, i) => { const row = `<div class="fc-it" style="grid-template-columns:22px 80px 1fr auto"><span>${i + 1}</span><span class="num">${esc(frDate(d))}</span><span style="${n.toLowerCase() === me ? "font-weight:700" : ""}">${esc(n)}${n.toLowerCase() === me ? " (toi)" : ""}</span>
      <span>${i > 0 ? `<button type="button" class="chip" data-up="${i}" style="padding:2px 8px" aria-label="Monter">↑</button>` : ""}</span></div>`; d = advance(d, freq); return row; }).join("") : `<p class="hint">Indique les membres pour voir l'ordre des tours.</p>`;
    document.querySelectorAll("#tnOrder [data-up]").forEach(b => b.onclick = () => { const i = Number(b.dataset.up); [order[i - 1], order[i]] = [order[i], order[i - 1]]; draw(); });
    const a = parseAmount(val("tnAmount"));
    document.getElementById("tnPot").textContent = a > 0 && names.length > 1 ? `Pot à chaque tour : ${eur(a * names.length)} (${names.length} × ${eur(a)}). Durée : ${names.length} tours.` : "";
  }
  chipsPick("tnFreq", TON_FREQ, freq, v => { freq = v; draw(); });
  for (const fid of ["tnMe", "tnOthers", "tnAmount", "tnStart"]) document.getElementById(fid).addEventListener("input", draw);
  document.getElementById("tnDraw").onclick = () => { const a = currentNames().slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } order = a; draw(); toast("Ordre tiré au sort"); };
  document.getElementById("tnReset").onclick = () => { order = currentNames(); draw(); };
  draw();
}
function tontineUpcoming(today, key, eom) {
  const up = [];
  for (const [id, t] of Object.entries(tontines)) {
    if (t.closed) continue;
    for (const r of tonRounds(t)) {
      if (r.date.slice(0, 7) !== key) continue;
      if (!tonPaid(id, r.k) && !(t.skipped || []).includes(r.k)) up.push({ date: r.date, name: `Tontine ${t.name}`, amount: Number(t.amount), type: "epargne", src: r.date <= today ? "Cotisation à payer" : "Cotisation" });
      if (r.who === t.me && !tonReceived(id, r.k)) up.push({ date: r.date, name: `Pot de la tontine ${t.name}`, amount: tonPot(t), type: "rentree", src: "Ton tour" });
    }
  }
  return up;
}
function tontineMoisHTML() {
  const items = [];
  for (const [id, t] of Object.entries(tontines)) {
    if (t.closed) continue; const s = tonState(id, t);
    if (s.unpaid.length) items.push(`${esc(t.name)} : ${s.unpaid.length} cotisation${s.unpaid.length > 1 ? "s" : ""} à payer`);
    if (s.mine && !s.received && daysUntil(s.mine.date) >= -30 && daysUntil(s.mine.date) <= warnDays()) items.push(`${esc(t.name)} : tu reçois le pot de ${esc(eur(tonPot(t)))} le ${esc(frDate(s.mine.date))}`);
  }
  return items.length ? `<button class="card" id="goTon" style="text-align:left;width:100%;cursor:pointer;border-left:6px solid #2f6fb0"><h2>Tontines<small>${items.length}</small></h2><div class="hint">${items.slice(0, 3).join("<br>")}</div></button>` : "";
}

// ---------- Import du relevé bancaire (CSV ou OFX) ----------
function decodeBank(buf) {
  let txt = new TextDecoder("utf-8").decode(buf);
  if (txt.includes("\uFFFD")) { try { txt = new TextDecoder("windows-1252").decode(buf); } catch (e) {} }
  return txt.replace(/^\uFEFF/, "");
}
function bankNum(s) {
  let v = String(s == null ? "" : s).replace(/[\s\u00a0\u202f€]|EUR/gi, "").replace(/[−–]/g, "-");
  if (!v || !/\d/.test(v)) return null;
  let neg = false;
  if (/^\(.*\)$/.test(v)) { neg = true; v = v.slice(1, -1); }
  if (v.endsWith("-")) { neg = true; v = v.slice(0, -1); }
  if (v.startsWith("+")) v = v.slice(1);
  if (v.startsWith("-")) { neg = !neg; v = v.slice(1); }
  const lc = v.lastIndexOf(","), ld = v.lastIndexOf(".");
  if (lc > ld) v = v.replace(/\./g, "").replace(",", ".");          // 1.234,56
  else if (ld > lc && lc >= 0) v = v.replace(/,/g, "");             // 1,234.56
  else if (lc >= 0 && ld < 0) v = v.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  const n = parseFloat(v);
  return isFinite(n) ? (neg ? -n : n) : null;
}
function bankDate(s) {
  s = String(s || "").trim();
  let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})\b/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; const d = +m[1], mo = +m[2]; if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
  m = s.match(/^(\d{4})[\/.\-]?(\d{2})[\/.\-]?(\d{2})/);
  if (m && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}
function splitCSV(text, sep) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(x => x.trim())).filter(r => r.some(x => x));
}
function parseOFX(text) {
  const out = [];
  for (const blk of text.split(/<STMTTRN>/i).slice(1)) {
    const g = tag => { const m = blk.match(new RegExp("<" + tag + ">([^<\\r\\n]*)", "i")); return m ? m[1].trim() : ""; };
    const date = bankDate(g("DTPOSTED").slice(0, 8)), amount = bankNum(g("TRNAMT").replace(".", ","));
    const label = [g("NAME"), g("MEMO")].filter(Boolean).join(" ");
    if (date && amount) out.push({ date, label, amount });
  }
  return out;
}
function parseBankFile(text) {
  if (/<OFX>|<STMTTRN>/i.test(text)) return { rows: parseOFX(text), format: "OFX" };
  const lines = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 40);
  const sep = [";", ",", "\t", "|"].map(s => [s, lines.reduce((a, l) => a + (l.split(s).length - 1), 0)]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = splitCSV(text, sep);
  const nrm = x => norm(x).replace(/[^a-z]/g, "");
  // Ligne d'en-tête : la première qui nomme une date et un montant (ou débit/crédit)
  let hi = rows.findIndex(r => r.some(c => /date/.test(nrm(c))) && r.some(c => /montant|amount|debit|credit|somme|valeur/.test(nrm(c))));
  let col = {};
  if (hi >= 0) {
    const h = rows[hi].map(nrm);
    const find = (re, not) => h.findIndex(x => re.test(x) && !(not && not.test(x)));
    col.date = find(/^dateop|dateoperation|^date$|^dateope|^datedecomptabilisation|^datecompta/);
    if (col.date < 0) col.date = find(/date/, /valeur/);
    if (col.date < 0) col.date = find(/date/);
    col.label = find(/libelle|label|description|intitule|detail|nature|operation|beneficiaire|tiers/, /date|montant|categorie|category/);
    col.label2 = h.findIndex((x, i) => i !== col.label && /detail|complement|comment|memo|reference/.test(x));
    col.debit = find(/debit/); col.credit = find(/credit/);
    col.amount = find(/montant|amount|somme/, /solde|balance/);
  } else {
    // Pas d'en-tête : on devine les colonnes à partir des valeurs
    const sample = rows.filter(r => r.some(c => bankDate(c))).slice(0, 10); if (!sample.length) return { rows: [], format: "CSV" };
    const n = Math.max(...sample.map(r => r.length));
    const score = f => [...Array(n).keys()].map(i => sample.filter(r => f(r[i])).length);
    const ds = score(bankDate), ns = score(c => bankNum(c) !== null && !bankDate(c)), ts = score(c => c && /[a-z]{3}/i.test(c) && !bankDate(c));
    col.date = ds.indexOf(Math.max(...ds)); col.amount = ns.lastIndexOf(Math.max(...ns)); col.label = ts.indexOf(Math.max(...ts)); hi = -1;
  }
  const out = [];
  for (const r of rows.slice(hi + 1)) {
    const date = bankDate(r[col.date]); if (!date) continue;
    let amount = null;
    if (col.debit >= 0 || col.credit >= 0) {
      const d = col.debit >= 0 ? bankNum(r[col.debit]) : null, c = col.credit >= 0 ? bankNum(r[col.credit]) : null;
      if (d) amount = -Math.abs(d); else if (c) amount = Math.abs(c);
    }
    if (amount === null && col.amount >= 0) amount = bankNum(r[col.amount]);
    if (!amount) continue;
    const label = [r[col.label], col.label2 >= 0 ? r[col.label2] : ""].filter(Boolean).join(" ").trim();
    out.push({ date, label, amount: Math.round(amount * 100) / 100 });
  }
  return { rows: out, format: "CSV" };
}
function cleanBankLabel(s) {
  let t = String(s || "").replace(/\s+/g, " ").trim();
  t = t.replace(/^(paiement par carte|paiement carte|carte|cb|achat cb|prlv sepa|prelevement sepa|prlv|prelevement|vir sepa recu|vir sepa emis|vir sepa|virement sepa recu|virement sepa emis|virement recu|virement emis|virement de|virement a|virement|vir inst re|vir inst|vir|retrait dab|retrait|avoir|remise)\b[\s:/-]*/i, "");
  t = t.replace(/\b(en votre faveur|de votre part|vir permanent vers|vir permanent|permanent vers|virement permanent)\b/gi, " ").replace(/\/(frm|motif|lib|de|to|bnf|ref)\b\s*/gi, " ").replace(/\bcb\s*\*?\d*\b/gi, " ").replace(/^\s*(frm|de|bnf)\b\s*/i, "");
  t = t.replace(/\bX\d{3,4}\b/gi, "").replace(/\b\d{2}[\/.]\d{2}([\/.]\d{2,4})?\b/g, "").replace(/\b(fact|facture|ref|refe?rence|mandat|ics|rum|id|n°|no)\b[\s:]*[\w-]*/gi, "")
    .replace(/\b\d{5,}\b/g, "").replace(/[*#]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return t.toLowerCase().replace(/(^|[\s-])\p{L}/gu, x => x.toUpperCase()).slice(0, 60) || String(s || "").slice(0, 60);
}
function merchantKey(label) { return norm(cleanBankLabel(label)).replace(/[^a-z0-9 ]/g, "").split(" ").filter(w => w.length > 1).slice(0, 2).join(" "); }
const BANK_RULES = [
  ["rentree:Salaire", /salaire|paie\b|remuneration|traitement/],
  ["rentree:Allocations / aides", /\bcaf\b|allocation|pole emploi|france travail|prime activite|apl\b/],
  ["rentree:Remboursement", /remb|cpam|ameli|mutuelle.*remb|avoir/],
  ["epargne:Livret A", /livret a\b/], ["epargne:LDDS", /ldds|ldd\b/], ["epargne:LEP", /\blep\b/], ["epargne:PEL", /\bpel\b/],
  ["depense:logement", /loyer|syndic|charges copro|foncia|nexity|bailleur/],
  ["depense:energie", /\bedf\b|engie|total ?energies elec|veolia|eau de|suez|gaz|ekwateur|enercoop/],
  ["depense:telecom", /orange|sfr|bouygues|free mobile|free telecom|\bfree\b|netflix|spotify|deezer|disney|canal|amazon prime|youtube|apple\.com|icloud/],
  ["depense:assurances", /assurance|maif|macif|matmut|axa|allianz|groupama|gmf|mma\b|mutuelle|alan\b/],
  ["depense:credits", /echeance pret|pret immo|remboursement pret|credit|cofidis|cetelem|sofinco|franfinance/],
  ["depense:impots", /dgfip|impot|tresor public|taxe|amende/],
  ["depense:courses", /carrefour|leclerc|auchan|lidl|intermarch|monoprix|casino|franprix|super u|hyper u|\bu express|aldi|netto|picard|biocoop|grand frais|boulang|boucherie|naturalia/],
  ["depense:transport", /total|esso|\bbp\b|shell|avia|station|sncf|ratp|navigo|uber|bolt|blablacar|peage|sanef|aprr|vinci autoroute|parking|indigo|essence/],
  ["depense:sante", /pharmacie|medecin|docteur|dentiste|opticien|laboratoire|hopital|clinique|doctolib/],
  ["depense:loisirs", /restaurant|brasserie|cafe|bistro|mcdonald|burger|kfc|pizza|sushi|deliveroo|uber eats|just eat|cinema|ugc|pathe|fnac spectacles|bar\b/],
  ["depense:maison", /leroy merlin|castorama|brico|ikea|conforama|maisons du monde|jardiland|but\b/],
  ["depense:shopping", /fnac|darty|boulanger|decathlon|zara|h ?& ?m|kiabi|primark|uniqlo|sephora|amazon|cdiscount|action\b|gifi|vinted|zalando/],
  ["depense:cadeaux", /don\b|unicef|croix rouge|secours|restos du coeur|cagnotte|leetchi|lydia/],
];
function guessBank(label, amount) {
  const key = merchantKey(label), rules = settings.importRules || {};
  if (key && rules[key]) return rules[key];
  // Ce que tu as déjà saisi : même commerçant → même catégorie
  if (key) for (const x of allItems()) if (x.note && merchantKey(x.note) === key && (amount < 0) === (x.type !== "rentree")) return `${x.type}:${x.cat}`;
  const hay = norm(label);
  for (const [v, re] of BANK_RULES) {
    const [ty] = v.split(":");
    if ((ty === "rentree") !== (amount > 0)) continue;
    if (re.test(hay)) return v;
  }
  return amount > 0 ? "rentree:Autre" : "depense:divers";
}
function bankId(r, i) {
  let h = 0; const s = `${r.date}|${r.amount}|${norm(r.label)}|${i}`;
  for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) | 0;
  return "b" + (h >>> 0).toString(36) + r.date.replace(/-/g, "");
}
function isDuplicate(r, id) {
  if (months[r.date.slice(0, 7)]?.items?.[id]) return "déjà importée";
  const a = Math.abs(r.amount), type = r.amount > 0 ? "rentree" : null;
  const near = allItems().find(x => Math.abs(Number(x.amount) - a) < 0.005 && Math.abs(daysUntil(x.date) - daysUntil(r.date)) <= 3 && (type ? x.type === "rentree" : x.type !== "rentree"));
  return near ? `déjà saisie (${near.note || catById(near.cat).name}, ${frDate(near.date)})` : "";
}
function startImport() {
  let inp = document.getElementById("bankFile");
  if (!inp) { inp = Object.assign(document.createElement("input"), { type: "file", id: "bankFile", accept: ".csv,.txt,.ofx,.qfx,text/csv", hidden: true }); document.body.appendChild(inp); }
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; inp.value = ""; if (!f) return;
    try {
      const { rows, format } = parseBankFile(decodeBank(await f.arrayBuffer()));
      if (!rows.length) { toast("Aucune opération reconnue dans ce fichier. Exporte le relevé au format CSV ou OFX depuis ta banque."); return; }
      reviewImport(rows, format, f.name);
    } catch (e) { toast("Ce fichier n'a pas pu être lu."); }
  };
  inp.click();
}
function reviewImport(rows, format, fname) {
  const seen = {};
  const items = rows.map(r => { const k = `${r.date}|${r.amount}|${norm(r.label)}`; seen[k] = (seen[k] || 0) + 1; const id = bankId(r, seen[k]); const dup = isDuplicate(r, id); return { ...r, id, dup, on: !dup, pick: guessBank(r.label, r.amount), name: cleanBankLabel(r.label) }; })
    .sort((a, b) => b.date.localeCompare(a.date));
  const opts = (sign) => {
    const g = (label, list) => `<optgroup label="${label}">${list.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</optgroup>`;
    return sign > 0 ? g("Rentrées", settings.rentree.map(s => ["rentree:" + s, s])) + g("Épargne (retrait)", settings.epargne.map(s => ["rentree:" + s, s]))
      : g("Dépenses", settings.cats.map(c => ["depense:" + c.id, c.name])) + g("Épargne", settings.epargne.map(s => ["epargne:" + s, s])) + g("Investissement", settings.invest.map(s => ["invest:" + s, s]));
  };
  const nNew = items.filter(x => x.on).length, nDup = items.length - nNew;
  const f = openForm(`<div class="f2"><h3>Relevé bancaire · ${esc(fname)}</h3>
    <p class="hint" style="margin:0">${items.length} opérations lues (${format}). ${nDup ? `${nDup} semblent déjà présentes : décochées.` : ""} Vérifie les catégories proposées, décoche ce que tu ne veux pas importer.</p>
    <div class="imp-list">${items.map((x, i) => `<div class="imp-row ${x.dup ? "dup" : ""}">
      <input type="checkbox" data-i="${i}" ${x.on ? "checked" : ""} aria-label="Importer ${esc(x.name)}">
      <div class="imp-main"><div class="imp-top"><span class="imp-name">${esc(x.name)}</span><b class="num ${x.amount > 0 ? "a in" : ""}">${x.amount > 0 ? "+" : "−"} ${esc(eur(Math.abs(x.amount)))}</b></div>
        <div class="imp-sub"><span class="num">${esc(frDate(x.date))}</span><select class="field" data-s="${i}" aria-label="Catégorie">${opts(x.amount)}</select></div>
        ${x.dup ? `<div class="hint" style="color:var(--w-soon)">${esc(x.dup)}</div>` : ""}</div></div>`).join("")}</div>
    <p class="hint" id="impSum" style="margin:8px 0 0"></p></div>`,
    () => {
      const chosen = items.filter(x => x.on);
      if (!chosen.length) { toast("Aucune opération cochée"); return false; }
      const learned = settings.importRules || {};
      const touched = new Set();
      for (const x of chosen) {
        const [type, cat] = x.pick.split(/:(.*)/s), key = x.date.slice(0, 7);
        months[key] = months[key] || { items: {} };
        months[key].items[x.id] = { type, amount: Math.abs(x.amount), cat, date: x.date, note: x.name, fixe: type === "depense" && !!catById(cat).fixe, bank: true, created: Date.now() };
        touched.add(key);
        if (x.changed) { const mk = merchantKey(x.label); if (mk) learned[mk] = x.pick; }
      }
      settings.importRules = learned; saveSettings();
      touched.forEach(k => saveMonth(k));
      render(); toast(`${chosen.length} opération${chosen.length > 1 ? "s" : ""} importée${chosen.length > 1 ? "s" : ""}`);
    }, null);
  f.querySelector('button[type="submit"]').textContent = "Importer";
  f.querySelectorAll("select[data-s]").forEach(s => { const x = items[Number(s.dataset.s)]; s.value = x.pick; if (s.value !== x.pick) { s.selectedIndex = 0; x.pick = s.value; } s.onchange = () => { x.pick = s.value; x.changed = true; sum(); }; });
  f.querySelectorAll("input[data-i]").forEach(c => c.onchange = () => { items[Number(c.dataset.i)].on = c.checked; sum(); });
  const sum = () => {
    const on = items.filter(x => x.on), dep = on.filter(x => x.amount < 0).reduce((a, x) => a - x.amount, 0), ren = on.filter(x => x.amount > 0).reduce((a, x) => a + x.amount, 0);
    document.getElementById("impSum").textContent = `${on.length} à importer · dépenses ${eur(dep)} · rentrées ${eur(ren)}. Les catégories que tu corriges seront retenues pour les prochains imports.`;
  };
  sum();
}
function importCardHTML() {
  return `<div class="card"><h2>Importer un relevé bancaire</h2>
    <p class="hint" style="margin-top:0">Télécharge le relevé depuis l'espace client de ta banque (format CSV ou OFX), puis importe-le ici. Les catégories sont proposées automatiquement, les doublons sont repérés.</p>
    <button class="btn primary" id="impBtn2">Choisir le fichier du relevé</button></div>`;
}

// ---------- Notes de frais ----------
function renderFrais() {
  const all = allItems().filter(x => x.type === "depense" && x.ndf);
  const todo = all.filter(x => x.ndfStatus !== "rembourse").sort((a, b) => a.date.localeCompare(b.date));
  const done = all.filter(x => x.ndfStatus === "rembourse" && (x.ndfPaidOn || x.date).startsWith(String(cur.y))).sort((a, b) => (b.ndfPaidOn || b.date).localeCompare(a.ndfPaidOn || a.date));
  const sum = l => l.reduce((s, x) => s + Number(x.amount), 0);
  const noFile = todo.filter(x => !(x.files && x.files.length)).length;
  setHeader("Notes de frais", "Total à te faire rembourser", sum(todo), true);
  document.getElementById("periodLabel").textContent = `Notes de frais · ${cur.y}`;
  let html = banner + `<div class="tiles">
    <div class="tile"><div class="k"><span class="sw" style="background:var(--accent)"></span>À rembourser</div><div class="v num">${eur(sum(todo))}</div></div>
    <div class="tile"><div class="k"><span class="sw" style="background:var(--good)"></span>Remboursé en ${cur.y}</div><div class="v num">${eur(sum(done))}</div></div>
  </div>`;
  if (noFile) html += `<div class="banner">${noFile} note${noFile > 1 ? "s" : ""} de frais sans justificatif : ajoute la facture pour la faire rembourser.</div>`;
  const item = (x, isTodo) => {
    const c = catById(x.cat), n = x.files ? x.files.length : 0;
    return `<div class="ndf-item"><div><div class="n">${esc(x.note || c.name)}</div>
      <div class="s">${esc(new Date(x.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }))} · ${esc(c.name)}${!isTodo && x.ndfPaidOn ? " · remboursée le " + esc(x.ndfPaidOn.split("-").reverse().join("/")) : ""}${n ? `<span class="clip">${CLIP}${n}</span>` : ` · <span style="color:var(--bad)">sans facture</span>`}</div></div>
      <div class="num" style="font-weight:700">${esc(eur(x.amount))}</div>
      <div class="acts">
        ${isTodo ? `<button class="btn primary" data-act="paid" data-id="${esc(x.id)}">Marquer remboursée</button>` : `<button class="btn" data-act="unpaid" data-id="${esc(x.id)}">Remettre à rembourser</button>`}
        ${n ? `<button class="btn" data-act="view" data-id="${esc(x.id)}">Voir la facture${n > 1 ? "s" : ""}</button>` : ""}
        <button class="btn" data-act="edit" data-id="${esc(x.id)}">${n ? "Modifier" : "Ajouter la facture"}</button>
      </div></div>`;
  };
  html += `<div class="card"><h2>À rembourser<small>${todo.length}</small></h2>${todo.length ? todo.map(x => item(x, true)).join("") : `<div class="empty">Aucune note de frais en attente. Appuie sur + pour en ajouter une.</div>`}</div>`;
  html += `<div class="card"><h2>Remboursées en ${cur.y}<small>${done.length}</small></h2>${done.length ? done.map(x => item(x, false)).join("") : `<div class="empty">Rien de remboursé en ${cur.y}.</div>`}</div>`;
  html += `<div class="card"><h2>Exporter</h2><p class="hint" style="margin-top:0">Liste des notes de frais (CSV), par exemple pour ton employeur.</p>
    <button class="btn" id="ndfCsv">Télécharger les notes de frais</button></div>
    <p class="hint" style="text-align:center;margin:0">Les notes de frais ne sont pas comptées dans tes dépenses personnelles.</p>`;
  view.innerHTML = html;
  const byId = id => all.find(x => x.id === id);
  view.querySelectorAll("[data-act]").forEach(b => b.onclick = () => {
    const x = byId(b.dataset.id); if (!x) return;
    const a = b.dataset.act;
    if (a === "paid") { setItem(x, { ndfStatus: "rembourse", ndfPaidOn: todayISO() }); toast("Marquée remboursée"); }
    else if (a === "unpaid") { setItem(x, { ndfStatus: "a_rembourser", ndfPaidOn: null }); }
    else if (a === "view") openViewer(x.files[0]);
    else if (a === "edit") { const { key, ...tx } = x; openSheet(tx); }
  });
  document.getElementById("ndfCsv").onclick = () => saveFile(`notes-de-frais-${todayISO()}.csv`, buildCSV(t => t.type === "depense" && t.ndf));
}

// ---------- Connexion ----------
const CFG = window.APP_CONFIG || {};
function makeStore(id) {
  if (id === "google") return MBStorage.GoogleStore(CFG.googleClientId);
  if (id === "microsoft") return MBStorage.MicrosoftStore(CFG.microsoftClientId);
  return MBStorage.LocalStore();
}
function showLogin(msg) {
  document.getElementById("login").hidden = false;
  document.getElementById("app").hidden = true;
  document.getElementById("fab").hidden = true;
  document.querySelector("nav.tabs").hidden = true;
  const hint = localStorage.getItem("mb-google-hint"), last = localStorage.getItem("mb-provider");
  const g = document.getElementById("loginGoogle"), m = document.getElementById("loginMicrosoft");
  g.disabled = !CFG.googleClientId; m.disabled = !CFG.microsoftClientId;
  g.querySelector("small").textContent = !CFG.googleClientId ? "Pas encore configuré (voir le guide)" : last === "google" && hint ? "Continuer en tant que " + hint : "Gmail, Google Workspace";
  m.querySelector("small").textContent = !CFG.microsoftClientId ? "Pas encore configuré (voir le guide)" : "Hotmail, Outlook, Live, compte pro";
  document.getElementById("loginMsg").textContent = msg || "";
}
function hideLogin() {
  document.getElementById("login").hidden = true;
  document.getElementById("app").hidden = false;
  document.getElementById("fab").hidden = false;
  document.querySelector("nav.tabs").hidden = false;
}
// Mode essai → compte Google / Microsoft : les données d'essai sont transférées dans le cloud.
const MIGRATE_KEY = "bourselle-migrate", DEMO_KEY = "bourselle-demo";
async function linkAccount(id) {
  if (dirty) { clearTimeout(saveTimer); await flush(); }
  localStorage.setItem(MIGRATE_KEY, "1");
  connect(id, id === "google" ? "choose" : true);   // Microsoft : la page part vers la connexion puis revient
}
function demoToMigrate() {
  if (!localStorage.getItem(MIGRATE_KEY)) return null;
  try { const d = JSON.parse(localStorage.getItem(DEMO_KEY) || "null"); return d && typeof d === "object" ? d : null; } catch (e) { return null; }
}
async function connect(id, interactive, existing) {
  const msg = document.getElementById("loginMsg"), prev = store;
  msg.textContent = "Connexion…";
  try {
    const st = existing || makeStore(id);
    await st.signIn(interactive);
    store = st; assets = st.canFiles ? st : null;
    localStorage.setItem("mb-provider", id);
    banner = id === "local" ? `<div class="banner">Mode démo : tes données restent dans ce navigateur. Connecte-toi avec Google ou Microsoft (Réglages › Mon compte) pour les garder dans ton Drive : elles y seront transférées.</div>` : "";
    setSync("", "Chargement…");
    const r = await st.load();
    version = r.version;
    const demo = id !== "local" ? demoToMigrate() : null;
    applyData(r.data);
    let moved = -1;
    if (demo) {
      moved = importData(demo);
      for (const k of ["importRules", "remindDays", "notif"]) if (demo.settings && demo.settings[k] != null && settings[k] == null) settings[k] = demo.settings[k];
      localStorage.setItem(DEMO_KEY + "-sauvegarde", localStorage.getItem(DEMO_KEY));
      localStorage.removeItem(DEMO_KEY); localStorage.removeItem(MIGRATE_KEY);
    }
    hideLogin(); applyRecurring(); render();
    if (moved >= 0) toast(moved ? `Tes données d'essai (${moved} élément${moved > 1 ? "s" : ""}) sont maintenant dans ton ${st.label}.` : `Connecté à ton ${st.label}.`);
    if ((!r.data || moved > 0) && id !== "local") { dirty = true; flush(); }
    else setSync("ok", id === "local" ? "Sur cet appareil" : "Enregistré · " + st.label);
  } catch (e) {
    if (prev && prev.id === "local" && id !== "local") {   // échec depuis le mode essai : on y reste
      store = prev; assets = null; localStorage.setItem("mb-provider", "local");
      if (e.code !== "cancelled") toast((e.message || "Connexion impossible") + ". Tes données d'essai sont intactes.");
      return;
    }
    store = null;
    if (e.code === "cancelled") msg.textContent = "";
    else msg.textContent = (e.message || "Connexion impossible") + (e.code === "auth" || e.code === "script" ? "" : " Réessaie.");
  }
}
function signOut() {
  const s0 = store; store = null; assets = null;
  localStorage.removeItem("mb-provider");
  applyData(null); blobCache.clear(); version = null;
  if (s0) s0.signOut();
  showLogin("Tu es déconnecté.");
}
document.getElementById("loginGoogle").onclick = () => connect("google", localStorage.getItem("mb-provider") === "google" ? true : "choose");
document.getElementById("loginMicrosoft").onclick = () => connect("microsoft", true);
document.getElementById("loginDemo").onclick = () => connect("local", true);

async function boot() {
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  const last = localStorage.getItem("mb-provider");
  // Retour de la page de connexion Microsoft, ou session Microsoft déjà ouverte : on reprend sans clic.
  if (CFG.microsoftClientId && (last === "microsoft" || /[#&?](code|error)=/.test(location.hash + location.search))) {
    try {
      const ms = makeStore("microsoft");
      if (await ms.resume()) { history.replaceState(null, "", location.pathname); localStorage.setItem("mb-provider", "microsoft"); showLogin(""); return connect("microsoft", false, ms); }
    } catch (e) {}
  }
  if (last === "local") return connect("local", true);
  showLogin("");   // Google demande un clic pour ouvrir sa fenêtre de connexion
}
boot();
// Langue changée dans Réglages ou sur l'écran de connexion : on redessine sans recharger (la session reste ouverte).
window.addEventListener("bourselle-lang", () => { try { if (typeof applyCurrency === "function") applyCurrency(); if (typeof store !== "undefined" && store) render(); } catch (e) {} });
