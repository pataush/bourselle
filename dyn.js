/* Bourselle — accueil vivant : ton avatar qui te salue, widgets en cascade, chiffres qui défilent, barres et anneaux
 * qui se remplissent, soleil qui tourne, flamme qui vacille, changements en direct (« +20 € ») et ciel qui suit l'heure.
 * Les animations d'entrée ne se jouent qu'en arrivant sur l'accueil (pas à chaque mise à jour) ; tout est coupé si le
 * téléphone demande de limiter les mouvements. */
const dynCalm = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const dynDark = () => { const t = document.documentElement.getAttribute("data-theme"); return t === "dark" || (!t && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches); };
// Le ciel du moment : matin (6 h – 10 h), journée, soir (18 h – 21 h), nuit ; rien en mode sombre
function dynSkyNow() { if (dynDark()) return ""; const h = new Date().getHours(); return h >= 6 && h < 10 ? "matin" : h >= 10 && h < 18 ? "jour" : h >= 18 && h < 21 ? "soir" : "nuit"; }

// ---------- Widget « Mon avatar te salue » ----------
function dynHello() {
  const nm = (document.getElementById("helloName").textContent || "").trim(), h = new Date().getHours();
  const hi = h >= 5 && h < 12 ? "Bonjour" : h >= 12 && h < 18 ? "Coucou" : "Bonsoir";
  let tip = typeof funTip === "function" ? funTip() : "";
  tip = tip.replace(/^(☀️ Bonne journée ! |🌙 Bonne soirée ! )/, "");
  return `${hi}${nm ? " " + nm : ""} ! ${tip}`;
}
WG.salut = { s: "budget", ic: "chat", t: "Mon avatar te salue", d: "Un petit mot chaque jour", w: 2, go: () => { if (!(settings.avatar && (settings.avatar.char || settings.avatar.ini || settings.avatar.img))) avPick(); },
  html: () => { const a = settings.avatar || {}, svg = typeof avSvg === "function" ? avSvg(a) : "";
    const face = svg || (a.img ? `<span class="dyn-ph" style="background-image:url('${a.img}')"></span>` : (typeof avChar === "function" ? avChar(AV_CHAR0) : ""));
    return `<div class="dyn-hi"><div class="dyn-me">${face}<i class="dyn-wave" aria-hidden="true">👋</i></div><div class="dyn-bub" data-full="${esc(dynHello())}">${esc(dynHello())}</div></div>${!svg && !a.img ? `<small class="dyn-make">Touche pour créer ton avatar ›</small>` : ""}`; } };
if (typeof WG_RD !== "undefined") WG_RD.salut = () => ["", "Salut !"];
// L'ajouter une fois en tête de l'accueil (et dans l'accueil par défaut)
if (typeof WG_DEFAULT !== "undefined" && !WG_DEFAULT.some(x => x[0] === "salut")) WG_DEFAULT.unshift(["salut", 2]);
{
  const _wl = wgList;
  wgList = function () { const L = _wl(); if (!settings.wgSalut0) { settings.wgSalut0 = 1; if (!settings.widgets.some(x => x.k === "salut")) settings.widgets.unshift({ k: "salut", w: 2, p: 0 }); return _wl(); } return L; };
}

// ---------- Animations ----------
let dynWasHome = false, dynVals = null;
function dynCount(el, from, to, ms, fmt) {
  if (!el) return; const t0 = performance.now();
  const st = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1 && el.isConnected) requestAnimationFrame(st); };
  requestAnimationFrame(st);
}
function dynValues() {
  const v = {};
  try { v.reste = wgReste().left; } catch (e) {}
  try { const d = wgDues(); v.owed = d.owed; v.owe = d.owe; } catch (e) {}
  try { v.saved = savedTotal(); } catch (e) {}
  try { const t = wgMonth(); v.epargne = (t.epargne || 0) + (t.invest || 0); v.jour = funToday(); } catch (e) {}
  return v;
}
const dynMoney = v => eur(v);
function dynEnter() {
  const grids = view.querySelectorAll(".wg-grid"); if (!grids.length) return;
  grids.forEach(g => [...g.children].forEach((el, i) => { el.classList.add("dyn-in"); el.style.animationDelay = Math.min(i, 12) * 70 + "ms"; }));
  // Barres et anneaux : de zéro à leur valeur
  const bars = [...view.querySelectorAll(".wg-bar i")], bw = bars.map(b => b.style.width);
  const rings = [...view.querySelectorAll(".rd-ring circle + circle")], rd = rings.map(r => r.getAttribute("stroke-dasharray"));
  bars.forEach(b => { b.style.transition = "none"; b.style.width = "0%"; }); rings.forEach(r => { r.style.transition = "none"; r.setAttribute("stroke-dasharray", "0 289"); });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    bars.forEach((b, i) => { b.style.transition = ""; b.style.width = bw[i]; }); rings.forEach((r, i) => { r.style.transition = ""; r.setAttribute("stroke-dasharray", rd[i]); });
  }));
  // Le reste à dépenser défile
  const big = view.querySelector(".wg-reste .wg-hero b.num"); if (big) { try { dynCount(big, 0, wgReste().left, 1300, dynMoney); } catch (e) {} }
  // Le message de l'avatar s'écrit
  const bub = view.querySelector(".dyn-bub"); if (bub) { const full = bub.dataset.full || bub.textContent; let i = 0; bub.textContent = "";
    const tick = () => { i += 2; bub.textContent = full.slice(0, i); if (i < full.length && bub.isConnected) setTimeout(tick, 26); }; setTimeout(tick, 450); }
  const w = view.querySelector(".dyn-wave"); if (w) w.classList.add("go");
}
// Un chiffre qui change pendant qu'on regarde (remboursement reçu, dépense ajoutée…) : il défile, avec « +20 € » qui s'envole
function dynLive(prev, cur) {
  const map = { reste: ".wg-reste:not(.rd) .wg-hero b.num", owed: ".wg-owed:not(.rd) b.num", owe: ".wg-owe:not(.rd) b.num", saved: ".wg-saved:not(.rd) b.num", epargne: ".wg-epargne:not(.rd) b.num", jour: ".wg-jour:not(.rd) b.num" };
  for (const [k, sel] of Object.entries(map)) {
    const a = prev[k], b = cur[k]; if (a == null || b == null || Math.abs(a - b) < 0.009) continue;
    const el = view.querySelector(sel); if (!el) continue;
    const short = k === "reste" ? dynMoney : v => eur(v, true);
    dynCount(el, a, b, 900, short);
    const card = el.closest(".wg"); if (!card) continue;
    const d = b - a, chip = document.createElement("span"); chip.className = "dyn-fly" + (d < 0 ? " neg" : ""); chip.textContent = (d > 0 ? "+" : "−") + eur(Math.abs(d), Math.abs(d) >= 100);
    card.appendChild(chip); setTimeout(() => chip.remove(), 1900);
  }
}
{
  const _rh = renderHome;
  renderHome = function () {
    _rh.apply(this, arguments);
    const cur = dynValues(), calm = dynCalm() || wgEdit;
    document.body.classList.toggle("dyn-calm", dynCalm());
    if (!calm && !dynWasHome) dynEnter();
    else if (!calm && dynVals) dynLive(dynVals, cur);
    dynVals = cur; dynWasHome = true;
    if (view.querySelector(".wg-salut")) { const hn = view.querySelector(".wg-hint"); if (hn) hn.remove(); }
  };
  const _sw = switchTab;
  switchTab = function (t) { if (t !== "home") dynWasHome = false; return _sw.apply(this, arguments); };
  document.addEventListener("visibilitychange", () => { if (document.hidden) dynWasHome = false; });   // on rejoue l'entrée en revenant dans l'appli
}
