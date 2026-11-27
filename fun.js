/* Bourselle — petits plus pour l'expérience : salutation selon l'heure, conseil du jour, météo du budget, série d'économies,
 * dépense du jour, anniversaires, célébrations (confettis), badges, bilan du mois en « story », thèmes de couleur et fond d'accueil.
 * Tout ce qui est gardé l'est dans les réglages (donc dans le compte, sur tous les appareils). */

// ---------- Outils ----------
const funYM = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
const funDays = (y, m) => new Date(y, m, 0).getDate();
function funVarBudgetDay() {   // budget des dépenses courantes (catégories non fixes) par jour
  const n = new Date(), b = (settings.cats || []).filter(c => !c.fixe).reduce((a, c) => a + (Number(c.budget) || 0), 0);
  return b / funDays(n.getFullYear(), n.getMonth() + 1);
}
function funSpentByDay() {
  const m = {}, fixed = new Set((settings.cats || []).filter(c => c.fixe).map(c => c.id));
  for (const x of allItems()) if (x.type === "depense" && !x.ndf && !x.fixe && !fixed.has(x.cat)) m[x.date] = (m[x.date] || 0) + (Number(x.amount) || 0);
  return m;
}
// Série : jours d'affilée (en partant d'hier, plus aujourd'hui s'il est déjà sous le budget) sous le budget du jour
function funStreak() {
  const lim = funVarBudgetDay(); if (!(lim > 0)) return 0;
  const by = funSpentByDay(), first = Object.keys(by).sort()[0]; if (!first) return 0;
  let n = 0, d = todayISO();
  if ((by[d] || 0) <= lim) n++;
  for (let i = 0; i < 400; i++) { d = addDays(d, -1); if (d < first) break; if ((by[d] || 0) > lim) break; n++; }
  if (n > (settings.bestStreak || 0)) { settings.bestStreak = n; }
  return n;
}
// Météo du budget : ce qui est dépensé comparé à la part du mois écoulée
function funMeteo() {
  const r = wgReste(), n = new Date(), D = funDays(n.getFullYear(), n.getMonth() + 1);
  if (!r.budget) return { ic: "🌤️", k: "cloud", t: "Fixe ton budget", s: "pour avoir ta météo" };
  const spentPct = (r.budget - r.left) / r.budget, timePct = n.getDate() / D, k = timePct ? spentPct / timePct : 0;
  if (r.left < 0) return { ic: "🌧️", k: "rain", t: "Budget dépassé", s: `de ${eur(-r.left, true)}`, lvl: 2 };
  if (k > 1.15) return { ic: "⛅", k: "cloud", t: "Attention", s: "tu dépenses un peu vite", lvl: 1 };
  return { ic: "☀️", k: "sun", t: "Beau fixe", s: "ton budget tient bien", lvl: 0 };
}
const funToday = () => allItems().filter(x => x.date === todayISO() && x.type === "depense" && !x.ndf).reduce((a, x) => a + (Number(x.amount) || 0), 0);
function funNextBday() {
  const L = (settings.bdays || []).map(b => { const t = todayISO(), y = Number(t.slice(0, 4)); let d = `${y}-${b.d}`; if (d < t) d = `${y + 1}-${b.d}`; return { ...b, next: d, in: daysUntil(d) }; });
  return L.sort((a, b) => a.in - b.in)[0] || null;
}

// ---------- Salutation et conseil du jour ----------
function funHello() {
  const h = new Date().getHours();
  return h >= 5 && h < 18 ? "Bonjour," : "Bonsoir,";
}
function funTip() {
  const L = [];
  try {
    const st = funStreak(); if (st >= 2) L.push(`🔥 ${st} jours d'affilée sous ton budget, continue !`);
    const loisirs = allItems().filter(x => x.type === "depense" && x.cat === "loisirs").map(x => x.date).sort().pop();
    if (loisirs) { const d = -daysUntil(loisirs); if (d >= 3) L.push(`🎉 ${d} jours sans dépense loisirs, bravo !`); }
    const pl = Object.values(subs || {}).filter(x => x.status !== "resilie").map(x => ({ x, n: nextOcc(x) })).filter(o => o.n && daysUntil(o.n) >= 0 && daysUntil(o.n) <= 2)[0];
    if (pl) L.push(`🔁 ${pl.x.name} est prélevé ${daysUntil(pl.n) === 0 ? "aujourd'hui" : daysUntil(pl.n) === 1 ? "demain" : "dans 2 jours"} (${eur(Number(pl.x.amount) || 0)}).`);
    const d = wgDues(); if (d.inn.length) L.push(`🔔 ${favFirst(d.inn[0].name)} te doit encore ${eur(d.inn[0].owe - d.inn[0].due, true)} : pense à relancer.`);
    const b = funNextBday(); if (b && b.in <= 7) L.push(`🎂 Anniversaire de ${b.name} ${b.in === 0 ? "aujourd'hui" : b.in === 1 ? "demain" : `dans ${b.in} jours`} : une cagnotte ?`);
    const m = funMeteo(); if (m.lvl === 0 && wgReste().budget) L.push("☀️ Ton budget est au beau fixe ce mois-ci.");
    if (m.lvl === 1) L.push("⛅ Tu dépenses un peu vite ce mois-ci : lève le pied quelques jours.");
  } catch (e) {}
  const G = ["💡 Note tes dépenses le jour même : c'est 2 minutes et tout reste juste.", "💡 Un abonnement oublié ? Fais le tour dans Suivis › Abonnements.",
    "💡 Mets de côté en début de mois plutôt qu'à la fin.", "💡 Partage une note en scannant le ticket : chacun voit sa part.",
    "💡 Les bons plans près de chez toi peuvent te faire économiser chaque semaine.", "💡 Un objectif avec une date te dit combien mettre de côté par mois.",
    "💡 Choisis les couleurs de tes widgets avec ✏️ Personnaliser."];
  if (!L.length) L.push(G[Math.floor(Date.now() / 864e5) % G.length]);
  const h = new Date().getHours(), mo = h < 5 || h >= 21 ? "🌙 Bonne soirée ! " : h < 12 ? "☀️ Bonne journée ! " : "";
  return (mo && !/^☀️|^🌙/.test(L[0]) ? mo : "") + L[0];
}

// ---------- Nouveaux widgets ----------
Object.assign(WG_RD, {
  meteo: () => { const m = funMeteo(); return [m.t, "Météo", undefined, m.k]; }, jour: () => [wgShort(funToday()), "Aujourd'hui"],
  serie: () => { const n = funStreak(); return [n + " j", "Série"]; }, anniv: () => { const b = funNextBday(); return b ? [b.in + " j", b.name] : ["—", "Anniversaires"]; },
  bilan: () => { const p = new Date(); p.setDate(1); p.setMonth(p.getMonth() - 1); const M = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."]; return [M[p.getMonth()], "Bilan"]; },
});
Object.assign(WG, {
  meteo: { s: "budget", ic: "sun", t: "Météo du budget", d: "Beau fixe, attention ou dépassé", w: 1, go: () => switchTab("mois"), html: () => { const m = funMeteo();
    return `<small>Météo du budget</small><b style="font-size:1rem;margin-top:4px">${esc(m.t)}</b><i>${esc(m.s)}</i>`; } },
  jour: { s: "budget", ic: "cal", t: "Dépense du jour", d: "Aujourd'hui, en un geste", w: 1, html: () => { const t = funToday(), lim = funVarBudgetDay();
    return `<small>Aujourd'hui</small><b class="num">${esc(eur(t, true))}</b><i>${lim > 0 ? `sur ${esc(eur(lim, true))} prévus par jour` : "dépensés"}</i><div class="wg-acts"><button type="button" data-wa="tx">＋ Ajouter</button></div>`; } },
  serie: { s: "budget", ic: "flame", t: "Série d'économies", d: "Jours d'affilée sous le budget", w: 1, go: () => switchTab("mois"), html: () => { const n = funStreak();
    return `<small>Série d'économies</small><b class="num">${n ? "🔥 " + n : "0"}</b><i>${n ? `jour${n > 1 ? "s" : ""} sous ton budget` : "commence aujourd'hui !"}${settings.bestStreak > n ? ` · record ${settings.bestStreak}` : ""}</i>`; } },
  anniv: { s: "proches", ic: "cake", t: "Prochain anniversaire", d: "Ne rate plus aucun anniversaire", w: 1, go: () => funBdays(), html: () => { const b = funNextBday();
    return b ? `<small>Prochain anniversaire</small><b style="font-size:1.02rem">🎂 ${esc(b.name)}</b><i class="${b.in <= 7 ? "warn" : ""}">${b.in === 0 ? "aujourd'hui !" : b.in === 1 ? "demain" : `dans ${b.in} jours`}</i>`
      : `<small>Anniversaires</small><i>Ajoute ceux de tes proches ›</i>`; } },
  bilan: { s: "budget", ic: "book", t: "Mon bilan du mois", d: "Ton mois dernier en 4 écrans", w: 1, go: () => funStory(), html: () => { const p = new Date(); p.setDate(1); p.setMonth(p.getMonth() - 1);
    return `<small>Mon bilan</small><b style="font-size:1.02rem">📖 ${esc(MOIS[p.getMonth()])}</b><i>à revoir en 4 écrans ›</i>`; } },
});

// ---------- Anniversaires ----------
function funBdays() {
  const draw = () => (settings.bdays || []).slice().sort((a, b) => a.d.localeCompare(b.d)).map(b => `<div class="bd-row"><span>🎂 <b>${esc(b.name)}</b> · ${esc(Number(b.d.slice(3)))} ${esc(MOIS[Number(b.d.slice(0, 2)) - 1])}</span><button type="button" class="hbtn" data-bdx="${esc(b.name + "|" + b.d)}" aria-label="Retirer">✕</button></div>`).join("") || `<p class="hint">Aucun anniversaire pour l'instant.</p>`;
  const f = openForm(`<div class="f2"><h3>🎂 Anniversaires</h3><div id="bdList">${draw()}</div>
    <div class="two" style="margin-top:12px"><div><label class="lbl" for="bdN">Prénom</label><input class="field" id="bdN" placeholder="ex. Léa"></div>
    <div><label class="lbl" for="bdD">Date</label><input class="field" id="bdD" type="date"></div></div>
    <button type="button" class="btn primary" id="bdAdd" style="margin-top:10px">＋ Ajouter</button></div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Terminé";
  const bind = () => f.querySelectorAll("[data-bdx]").forEach(b => b.onclick = () => { const [n, d] = b.dataset.bdx.split("|"); settings.bdays = (settings.bdays || []).filter(x => !(x.name === n && x.d === d)); saveSettings(); f.querySelector("#bdList").innerHTML = draw(); bind(); render(); });
  bind();
  f.querySelector("#bdAdd").onclick = () => { const n = f.querySelector("#bdN").value.trim(), v = f.querySelector("#bdD").value; if (!n || !v) { toast("Indique le prénom et la date."); return; }
    (settings.bdays = settings.bdays || []).push({ name: n, d: v.slice(5) }); saveSettings(); f.querySelector("#bdN").value = ""; f.querySelector("#bdD").value = ""; f.querySelector("#bdList").innerHTML = draw(); bind(); render(); };
}

// ---------- Célébrations ----------
function funConfetti() {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas"); c.className = "fun-confetti"; c.width = innerWidth * 2; c.height = innerHeight * 2; document.body.appendChild(c);
  const g = c.getContext("2d"), cols = ["#1f6b4b", "#c9a24a", "#e9846b", "#7b4fd6", "#4a7bd0", "#f2d27a"], P = [];
  for (let i = 0; i < 140; i++) P.push({ x: c.width / 2 + (Math.random() - .5) * 200, y: c.height * .35, vx: (Math.random() - .5) * 26, vy: -Math.random() * 30 - 8, r: Math.random() * 6.28, vr: (Math.random() - .5) * .4, s: 8 + Math.random() * 10, c: cols[i % cols.length] });
  const t0 = performance.now();
  const step = t => { g.clearRect(0, 0, c.width, c.height); for (const p of P) { p.vy += .9; p.x += p.vx; p.y += p.vy; p.vx *= .99; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); }
    if (t - t0 < 2600) requestAnimationFrame(step); else c.remove(); };
  requestAnimationFrame(step);
}
function funCelebrate(title, sub) {
  document.querySelectorAll(".fun-cele").forEach(x => x.remove());
  funConfetti(); try { navigator.vibrate && navigator.vibrate([20, 40, 20]); } catch (e) {}
  const el = document.createElement("div"); el.className = "fun-cele"; el.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}`; document.body.appendChild(el);
  setTimeout(() => el.classList.add("on"), 20); setTimeout(() => { el.classList.remove("on"); setTimeout(() => el.remove(), 400); }, 3600);
}
// Badges
const BADGES = [
  ["first", "🌱", "Premiers pas", "Ta 1re opération notée", () => allItems().length >= 1],
  ["ops50", "📒", "Bien tenu", "50 opérations notées", () => allItems().length >= 50],
  ["month", "🏆", "Premier mois tenu", "Un mois entier sous ton budget", () => funMonthsUnder() >= 1],
  ["save100", "💰", "100 € économisés", "Épargne et placements", () => funSaved() >= 100],
  ["save1000", "💎", "1 000 € économisés", "Épargne et placements", () => funSaved() >= 1000],
  ["goal", "🎯", "Objectif atteint", "Un objectif rempli", () => Object.keys(goals || {}).some(id => goals[id].target > 0 && goalSaved(id) >= goals[id].target)],
  ["debt", "✅", "Dette soldée", "Une dette entièrement remboursée", () => Object.values(debts || {}).some(x => x.kind !== "medoit" && debtCalc(x).done)],
  ["proches5", "🤝", "5 proches remboursés", "On t'a remboursé 5 fois", () => funRepaid() >= 5],
  ["streak7", "🔥", "7 jours sous le budget", "Une série de 7 jours", () => (settings.bestStreak || 0) >= 7],
  ["group", "👥", "En groupe", "Ton 1er groupe de partage", () => Object.keys(groups || {}).length >= 1],
];
const funSaved = () => allItems().filter(x => x.type === "epargne" || x.type === "invest").reduce((a, x) => a + (Number(x.amount) || 0), 0);
const funRepaid = () => Object.values(debts || {}).filter(x => x.kind === "medoit" && debtCalc(x).done).length + ((typeof SOC !== "undefined" && SOC.out) || []).filter(c => c.kind === "req" && c.status === "settled").length;
function funMonthsUnder() {
  const bud = (settings.cats || []).reduce((a, c) => a + (Number(c.budget) || 0), 0); if (!bud) return 0;
  const cur = funYM(new Date()); let n = 0;
  for (const k of Object.keys(months || {})) { if (k >= cur) continue; const [y, m] = k.split("-").map(Number), L = itemsOf(y, m); if (L.length < 5) continue; if (totals(L).depense <= bud) n++; }
  return n;
}
const funBadges = () => BADGES.map(([k, ic, t, d, f]) => { let on = false; try { on = !!f(); } catch (e) {} return { k, ic, t, d, on }; });
function funBadgesOpen() {
  const L = funBadges(), n = L.filter(b => b.on).length;
  const f = openForm(`<div class="f2"><h3>🏅 Mes badges <small class="hint">${n} / ${L.length}</small></h3>
    <div class="bdg-grid">${L.map(b => `<div class="bdg${b.on ? " on" : ""}"><span>${b.ic}</span><b>${esc(b.t)}</b><small>${esc(b.d)}</small></div>`).join("")}</div></div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Fermer";
}
// Vérifie à chaque affichage s'il y a quelque chose à fêter (objectif, dette soldée, mois sous le budget, badge)
function funCheck() {
  if (!store || typeof settings !== "object") return;
  const goalsDone = Object.keys(goals || {}).filter(id => goals[id].target > 0 && goalSaved(id) >= goals[id].target);
  const debtsDone = Object.keys(debts || {}).filter(id => debtCalc(debts[id]).done);
  const badges = funBadges().filter(b => b.on).map(b => b.k);
  const prev = new Date(); prev.setDate(1); prev.setMonth(prev.getMonth() - 1); const pk = funYM(prev);
  const C = settings.celeb;
  if (!C) { settings.celeb = { g: goalsDone, d: debtsDone, b: badges, m: pk }; return; }   // 1re fois : rien à fêter rétroactivement
  let msg = null;
  const ng = goalsDone.find(id => !C.g.includes(id)), nd = debtsDone.find(id => !C.d.includes(id)), nb = badges.find(k => !C.b.includes(k));
  if (ng) msg = ["🎯 Objectif atteint !", goals[ng].name];
  else if (nd) msg = [debts[nd].kind === "medoit" ? "🤝 Tu as été remboursé !" : "✅ Dette soldée !", debts[nd].name];
  else if (C.m !== pk) { const L = itemsOf(prev.getFullYear(), prev.getMonth() + 1), bud = (settings.cats || []).reduce((a, c) => a + (Number(c.budget) || 0), 0);
    if (L.length >= 5 && bud && totals(L).depense <= bud) msg = [`🏆 ${MOIS[prev.getMonth()]} tenu sous ton budget !`, `${eur(bud - totals(L).depense, true)} d'avance`]; }
  if (!msg && nb) { const b = BADGES.find(x => x[0] === nb); msg = [`${b[1]} Nouveau badge !`, b[2]]; }
  settings.celeb = { g: goalsDone, d: debtsDone, b: badges, m: pk };
  saveSettings();
  if (msg) setTimeout(() => funCelebrate(msg[0], msg[1]), 350);
}

// ---------- Bilan du mois en « story » ----------
function funStory(y, m) {
  if (!y) { const p = new Date(); p.setDate(1); p.setMonth(p.getMonth() - 1); y = p.getFullYear(); m = p.getMonth() + 1; }
  const L = itemsOf(y, m), t = totals(L), parts = catParts(t.byCat), top = parts[0], mois = MOIS[m - 1];
  const bud = (settings.cats || []).reduce((a, c) => a + (Number(c.budget) || 0), 0), saved = (t.epargne || 0) + (t.invest || 0);
  const days = new Set(L.filter(x => x.type === "depense").map(x => x.date)), D = funDays(y, m), free = D - days.size;
  const big = L.filter(x => x.type === "rentree").sort((a, b) => b.amount - a.amount)[0];
  const S = [
    ["#1f6b4b", "#123d2c", `Ton mois de ${mois}`, `<b class="st-n">${esc(eur(t.depense, true))}</b><span>dépensés en ${L.filter(x => x.type === "depense").length} opérations</span>`],
    ["#c9a24a", "#8a6d1f", "Ta plus grosse catégorie", top ? `<b class="st-n">${esc(top.name)}</b><span>${esc(eur(top.v, true))} · ${Math.round(top.v / Math.max(1, t.depense) * 100)} % de tes dépenses</span>` : `<b class="st-n">—</b><span>aucune dépense notée</span>`],
    ["#3f6fd8", "#1d3c86", "Tu as mis de côté", `<b class="st-n">${esc(eur(saved, true))}</b><span>${bud ? (t.depense <= bud ? `et tu es resté ${esc(eur(bud - t.depense, true))} sous ton budget 🎉` : `budget dépassé de ${esc(eur(t.depense - bud, true))}`) : "épargne et placements"}</span>`],
    ["#c8553d", "#7a2a3a", "Ton meilleur moment", `<b class="st-n">${free} jour${free > 1 ? "s" : ""}</b><span>sans aucune dépense${big ? ` · plus belle rentrée : ${esc(big.note || "")} ${esc(eur(big.amount, true))}` : ""}</span>
      <div class="st-acts"><button type="button" id="stShare">↗ Partager</button><button type="button" id="stClose2">Fermer</button></div>`],
  ];
  const el = document.createElement("div"); el.className = "fun-story"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Mon bilan du mois");
  el.innerHTML = `<div class="st-bars">${S.map(() => `<i><b></b></i>`).join("")}</div><button type="button" class="st-x" aria-label="Fermer">✕</button><div class="st-slide"></div><small class="st-brand">Bourselle</small>`;
  document.body.appendChild(el);
  let i = 0, tm = null;
  const close = () => { clearTimeout(tm); el.remove(); };
  const show = k => {
    i = Math.max(0, Math.min(S.length - 1, k)); clearTimeout(tm);
    const s = S[i]; el.style.background = `linear-gradient(160deg, ${s[0]}, ${s[1]})`;
    el.querySelector(".st-slide").innerHTML = `<small>${esc(s[2])}</small>${s[3]}`;
    el.querySelectorAll(".st-bars i").forEach((b, j) => b.className = j < i ? "done" : j === i ? "now" : "");
    const sh = el.querySelector("#stShare"); if (sh) sh.onclick = e => { e.stopPropagation(); const txt = `Mon mois de ${mois} avec Bourselle : ${eur(t.depense, true)} dépensés, ${eur(saved, true)} mis de côté, ${free} jours sans dépense 💪`;
      if (navigator.share) navigator.share({ text: txt, url: location.origin + location.pathname }).catch(() => {}); else { try { navigator.clipboard.writeText(txt); toast("Copié"); } catch (er) {} } };
    const c2 = el.querySelector("#stClose2"); if (c2) c2.onclick = e => { e.stopPropagation(); close(); };
    if (i < S.length - 1) tm = setTimeout(() => show(i + 1), 5000);
  };
  el.onclick = e => { if (e.target.closest(".st-x")) return close(); if (e.target.closest(".st-acts")) return; e.clientX < innerWidth / 3 ? show(i - 1) : show(i + 1); };
  show(0);
}
// Ouverture automatique en début de mois (une fois), si le mois dernier a été noté
function funStoryAuto() {
  try { if (navigator.webdriver && !localStorage.getItem("bourselle-story-test")) return; } catch (e) {}
  const n = new Date(); if (n.getDate() > 7) return;
  const p = new Date(n.getFullYear(), n.getMonth() - 1, 1), k = funYM(p);
  if (settings.storySeen === k || itemsOf(p.getFullYear(), p.getMonth() + 1).length < 5) return;
  settings.storySeen = k; saveSettings(); setTimeout(() => funStory(), 800);
}

// ---------- Thèmes (couleur de toute l'appli) et fond de l'accueil ----------
const FUN_THEMES = { vert: ["Vert Bourselle", "#1f6b4b", "#c9a24a"], ocean: ["Océan", "#1d5f86", "#e0a84a"], sunset: ["Coucher de soleil", "#c8553d", "#f2b54a"], nuit: ["Nuit", "#3b3f73", "#c9a24a"], prune: ["Prune", "#7a3b6b", "#e3b04b"] };
function funApplyTheme() { const t = (settings && settings.pal) || "vert"; if (t === "vert") document.documentElement.removeAttribute("data-pal"); else document.documentElement.setAttribute("data-pal", t); }
function funThemeOpen() {
  const cur = settings.pal || "vert";
  const f = openForm(`<div class="f2"><h3>🎨 Thème de l'appli</h3><div class="th-grid">${Object.entries(FUN_THEMES).map(([k, T]) => `<button type="button" data-pal="${k}" aria-pressed="${k === cur}"><span class="th-sw" style="background:linear-gradient(135deg,${T[1]} 0 60%,${T[2]} 60%)"></span>${esc(T[0])}</button>`).join("")}</div></div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Terminé";
  f.querySelectorAll("[data-pal]").forEach(b => b.onclick = () => { settings.pal = b.dataset.pal; if (settings.pal === "vert") delete settings.pal; saveSettings(); funApplyTheme(); f.querySelectorAll("[data-pal]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); render(); });
}
const FUN_BG = { "": "Aucun", menthe: "Menthe", peche: "Pêche", lavande: "Lavande", ciel: "Ciel", or: "Or", aurore: "Aurore" };
function funBgOpen() {
  const cur = settings.homeBg || "";
  const f = openForm(`<div class="f2"><h3>🖼 Fond d'écran</h3><div class="th-grid">${Object.entries(FUN_BG).map(([k, l]) => `<button type="button" data-hbg="${k}" aria-pressed="${k === cur}"><span class="th-sw hbg-sw" data-bgk="${k}"></span>${esc(l)}</button>`).join("")}</div>
    <div class="pmx-sec" style="margin-top:14px"><button type="button" class="pmx-r" id="hbgAll" role="switch" aria-checked="${!!settings.homeBgAll}"><b>Appliquer à tous les onglets<small>sinon seulement sur l'accueil</small></b><span class="pmx-sw" aria-hidden="true"></span></button></div></div>`, () => true);
  f.querySelector("#hbgAll").onclick = e => { settings.homeBgAll = !settings.homeBgAll; if (!settings.homeBgAll) delete settings.homeBgAll; e.currentTarget.setAttribute("aria-checked", String(!!settings.homeBgAll)); saveSettings(); render(); };
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Terminé";
  f.querySelectorAll("[data-hbg]").forEach(b => b.onclick = () => { settings.homeBg = b.dataset.hbg; if (!settings.homeBg) delete settings.homeBg; saveSettings(); f.querySelectorAll("[data-hbg]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); render(); });
}
