/* Bourselle — Accueil personnalisable : des widgets que chacun choisit, range et dimensionne.
 * La disposition est gardée dans les réglages (donc dans le compte, sur tous les appareils) : settings.widgets = [{ k, w }]
 * k : le widget, w : 1 (demi-largeur) ou 2 (toute la largeur). Chaque widget mène à la rubrique concernée. */
const WG_SERVICES = [["budget", "Budget"], ["proches", "Entre proches"], ["suivis", "Suivis"], ["bons", "Bons plans"]];
const WG_DEFAULT = [["reste", 2], ["meteo", 0], ["serie", 0], ["objectif", 0], ["prelev", 1], ["saved", 1], ["deal", 2], ["jour", 0], ["epargne", 0], ["bilan", 0], ["owed", 0], ["owe", 0], ["anniv", 0], ["msgs", 2], ["projet", 2]];
let wgEdit = false;
// Couleurs au choix pour chaque widget (🎨 en mode Personnaliser) : fond, texte, texte secondaire
const WG_COLORS = {
  vert: ["linear-gradient(135deg,#1f6b4b,#123d2c)", "#fff", "rgba(255,255,255,.8)", "Vert"],
  or: ["linear-gradient(135deg,#f6e7b8,#e9cf86)", "#2a1f00", "#5a4710", "Or"],
  menthe: ["#d8efe3", "#123d2c", "#3f6b57", "Menthe"],
  peche: ["#fbe0d2", "#4a2412", "#8a5238", "Pêche"],
  lavande: ["#e6ddf6", "#2c1f4a", "#5f5285", "Lavande"],
  ciel: ["#d9e8fb", "#10304f", "#48627f", "Ciel"],
  corail: ["linear-gradient(135deg,#e9846b,#c8553d)", "#fff", "rgba(255,255,255,.85)", "Corail"],
  nuit: ["linear-gradient(135deg,#2e3a59,#1b2238)", "#fff", "rgba(255,255,255,.78)", "Nuit"],
};
const wgStyle = c => { const C = WG_COLORS[c]; return C ? ` data-c="${c}" style="--wg-bg:${C[0]};--wg-ink:${C[1]};--wg-mut:${C[2]}"` : ""; };
const wgMoney = (v, s) => eur(v, s);
function wgMonth() { const n = new Date(); return totals(itemsOf(n.getFullYear(), n.getMonth() + 1)); }
function wgReste() {
  const t = wgMonth(), now = new Date(), last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), days = last - now.getDate() + 1;
  const budget = (settings.cats || []).reduce((a, c) => a + (Number(c.budget) || 0), 0);
  const spent = (settings.cats || []).filter(c => (Number(c.budget) || 0) > 0).reduce((a, c) => a + (t.byCat[c.id] || 0), 0);
  return { budget, left: Math.round((budget - spent) * 100) / 100, days, pct: budget ? Math.min(100, Math.round(spent / budget * 100)) : 0 };
}
function wgDues() {
  const pl = typeof prochesList === "function" ? prochesList() : [];
  const inn = pl.filter(p => p.owe - p.due > 0.004), out = pl.filter(p => p.due - p.owe > 0.004);
  return { inn, out, owed: inn.reduce((a, p) => a + p.owe - p.due, 0), owe: out.reduce((a, p) => a + p.due - p.owe, 0) };
}
// Le catalogue : tous les services de Bourselle, rangés par rubrique
const WG = {
  reste: { s: "budget", ic: "wallet", t: "Reste à dépenser", d: "Budget du mois", w: 2, go: () => switchTab("mois"), html: () => { const r = wgReste();
    return r.budget ? `<div class="wg-hero"><small>Il te reste à dépenser ce mois-ci</small><b class="num">${esc(wgMoney(r.left))}</b><i>${r.left > 0 ? `soit ${esc(wgMoney(r.left / r.days, true))} par jour · ${r.days} jour${r.days > 1 ? "s" : ""} restants` : "Budget du mois dépassé"}</i><div class="wg-bar"><i style="width:${r.pct}%"></i></div></div>`
      : `<div class="wg-hero"><small>Reste à dépenser</small><b style="font-size:1.1rem">Fixe ton budget du mois</b><i>pour savoir ce qu'il te reste chaque jour ›</i></div>`; } },
  mois: { s: "budget", ic: "chart", t: "Ce mois-ci", d: "Rentrées et dépenses", w: 1, go: () => switchTab("mois"), html: () => { const t = wgMonth(); return `<small>Ce mois-ci</small><b class="num" style="font-size:1.15rem">−${esc(wgMoney(t.depense, true))}</b><i>rentrées +${esc(wgMoney(t.rentree, true))}</i>`; } },
  cats: { s: "budget", ic: "pie", t: "Dépenses par catégorie", d: "Les 3 plus grosses du mois", w: 2, go: () => switchTab("mois"), html: () => { const t = wgMonth(), parts = catParts(t.byCat).slice(0, 3), mx = parts.length ? parts[0].v : 1;
    return `<small>Dépenses par catégorie</small>${parts.length ? parts.map(p => `<div class="wg-cat"><span>${esc(p.name)}</span><span class="wg-cb"><i style="width:${Math.round(p.v / mx * 100)}%;background:${p.color}"></i></span><b class="num">${esc(wgMoney(p.v, true))}</b></div>`).join("") : `<i>Aucune dépense ce mois-ci</i>`}`; } },
  comptes: { s: "budget", ic: "bank", t: "Solde de mes comptes", d: "Tous comptes confondus", w: 1, go: () => switchTab("mois"), html: () => typeof accHasBalance === "function" && accHasBalance() ? `<small>Mes comptes</small><b class="num">${esc(wgMoney(accTotalAt(accRefDay()), true))}</b><i>aujourd'hui</i>` : `<small>Mes comptes</small><b style="font-size:1rem">Indique ton solde</b><i>pour le suivre au jour le jour</i>` },
  ajout: { s: "budget", ic: "plus", t: "Ajouter vite", d: "Dépense, ticket, relevé", w: 2, html: () => `<small>Ajouter</small><div class="wg-acts"><button type="button" data-wa="tx">➕ Dépense</button><button type="button" data-wa="scan">📷 Ticket</button><button type="button" data-wa="imp">📄 Relevé</button></div>` },
  owed: { s: "proches", ic: "in", t: "On te doit", d: "Entre proches", w: 1, go: () => switchTab("partage"), html: () => { const d = wgDues(); return `<small>On te doit</small><b class="num ${d.owed > 0.004 ? "good" : ""}">${esc(wgMoney(d.owed, true))}</b><i>${d.inn.length ? esc(d.inn.slice(0, 3).map(p => favFirst(p.name)).join(", ")) : "personne"}</i>${d.owed > 0.004 ? `<div class="wg-acts"><button type="button" data-wa="remind">🔔 Relancer</button></div>` : ""}`; } },
  owe: { s: "proches", ic: "out", t: "Tu dois", d: "Entre proches", w: 1, go: () => switchTab("partage"), html: () => { const d = wgDues(); return `<small>Tu dois</small><b class="num ${d.owe > 0.004 ? "bad" : ""}">${esc(wgMoney(d.owe, true))}</b><i>${d.out.length ? esc(d.out.slice(0, 3).map(p => favFirst(p.name)).join(", ")) : "rien à régler"}</i>${d.owe > 0.004 ? `<div class="wg-acts"><button type="button" data-wa="settle">💸 Régler</button></div>` : ""}`; } },
  msgs: { s: "proches", ic: "chat", t: "Messages", d: "Dernière discussion", w: 2, go: () => { epSub = "discussions"; switchTab("partage"); }, html: () => {
    const t = typeof DMS !== "undefined" ? DMS.slice().sort((a, b) => (b.unread || 0) - (a.unread || 0) || b.at - a.at)[0] : null;
    if (!t) return `<small>Messages</small><i>Écris à un proche, propose une sortie…</i>`;
    const n = DMS.reduce((a, x) => a + (x.unread || 0), 0);
    return `<small>Messages${n ? ` · <b class="wg-badge">${n}</b>` : ""}</small><div class="wg-msg"><span class="ep-av${t.gid ? " g" : ""}"${t.gid ? "" : ` data-avtag="${esc(t.tag)}"`} style="width:36px;height:36px;font-size:.9rem;background:${t.gid ? "#1f6b4b" : favColor("@" + t.tag)}">${t.gid ? "👥" : esc(favFirst(chatTitle(t)).charAt(0).toUpperCase())}</span><span><b>${esc(chatTitle(t))}</b><small>${esc(typeof ensSnip === "function" ? ensSnip(t) : "")}</small></span></div>`; } },
  projet: { s: "proches", ic: "cal", t: "Prochain projet", d: "Sortie, cadeau, voyage", w: 1, go: () => { epSub = "projets"; switchTab("partage"); }, html: () => { const a = (typeof ACTS !== "undefined" ? ACTS : []).filter(x => x.status === "open").sort((x, y) => (x.when || "9").localeCompare(y.when || "9"))[0];
    return a ? `<small>Prochain projet</small><b style="font-size:1.02rem">${esc(a.emoji || "📅")} ${esc(a.title)}</b><i>${a.when ? esc(frDate(a.when)) : "date à fixer"}${a.place ? " · " + esc(a.place) : ""}</i>` : `<small>Prochain projet</small><i>Une sortie, un cadeau ? Lance-le ici ›</i>`; } },
  raccourcis: { s: "proches", ic: "bolt", t: "Payer, demander, partager", d: "Les actions d'Entre proches", w: 2, html: () => `<small>Entre proches</small><div class="wg-acts"><button type="button" data-wa="pay">💸 Payer</button><button type="button" data-wa="ask">🙋 Me faire payer</button><button type="button" data-wa="note">🧾 Partager une note</button></div>` },
  dettes: { s: "suivis", ic: "trend", t: "Mes dettes", d: "Ce qu'il me reste à rembourser", w: 1, go: () => switchTab("dettes"), html: () => { let left = 0; for (const x of Object.values(debts || {})) { if (x.kind === "medoit" || x.closed) continue; const c = debtCalc(x); if (!c.done) left += typeof debtBase === "function" ? debtBase(x, c.remaining) : c.remaining; }
    return `<small>Reste à rembourser</small><b class="num ${left > 0.004 ? "bad" : ""}">${esc(wgMoney(left, true))}</b><i>dettes et crédits</i>`; } },
  epargne: { s: "suivis", ic: "sprout", t: "Mis de côté ce mois", d: "Épargne et économies", w: 1, go: () => switchTab("economies"), html: () => { const t = wgMonth(); return `<small>Mis de côté ce mois</small><b class="num good">${esc(wgMoney((t.epargne || 0) + (t.invest || 0), true))}</b><i>épargne et placements</i>`; } },
  objectif: { s: "suivis", ic: "target", t: "Objectif", d: "Ton objectif principal", w: 1, go: () => switchTab("objectifs"), html: () => { const g = Object.entries(goals || {}).map(([id, x]) => ({ ...x, id, s: goalSaved(id) })).filter(x => x.target > 0).sort((a, b) => b.s / b.target - a.s / a.target)[0];
    return g ? `<small>Objectif ${esc(g.name)}</small><b class="num">${Math.min(100, Math.round(g.s / g.target * 100))} %</b><div class="wg-bar sm"><i style="width:${Math.min(100, Math.round(g.s / g.target * 100))}%"></i></div>` : `<small>Objectif</small><i>Vacances, voiture… fixe-toi un objectif ›</i>`; } },
  prelev: { s: "suivis", ic: "repeat", t: "Prochain prélèvement", d: "Abonnements", w: 1, go: () => switchTab("abos"), html: () => { const l = Object.entries(subs || {}).filter(([, x]) => x.status !== "resilie").map(([id, x]) => ({ id, x, n: nextOcc(x) })).filter(o => o.n).sort((a, b) => a.n.localeCompare(b.n))[0];
    return l ? `<small>Prochain prélèvement</small><b style="font-size:1.02rem">${esc(l.x.name)}</b><i class="${daysUntil(l.n) <= 3 ? "warn" : ""}">${esc(wgMoney(Number(l.x.amount) || 0))} · ${esc(leftTxt(daysUntil(l.n)))}</i>${daysUntil(l.n) <= 3 ? `<div class="wg-acts"><button type="button" data-wa="prel:${esc(l.id)}">✓ Payé</button></div>` : ""}` : `<small>Abonnements</small><i>Ajoute tes abonnements pour ne plus être surpris ›</i>`; } },
  garantie: { s: "suivis", ic: "shield", t: "Garantie qui expire", d: "Garanties", w: 1, go: () => switchTab("garanties"), html: () => { const g = garItems().filter(x => garStatus(x.warranty) !== "exp").sort((a, b) => a.warranty.end.localeCompare(b.warranty.end))[0];
    return g ? `<small>Garantie</small><b style="font-size:1.02rem">${esc(g.warranty.item || g.note || "Achat")}</b><i class="${garStatus(g.warranty) === "soon" ? "warn" : ""}">${esc(leftTxt(daysUntil(g.warranty.end)))}</i>` : `<small>Garanties</small><i>Aucun article sous garantie</i>`; } },
  deal: { s: "bons", ic: "gift", t: "Bon plan du moment", d: "Près de chez toi", w: 2, go: () => switchTab("bons"), html: () => { const L = (typeof BPLANS !== "undefined" ? BPLANS : []).filter(o => o.status !== "off" && !(typeof offOnline === "function" && offOnline(o)) && offVisible(o));
    const o = L.find(x => offTimed(x) && offNow(x)) || L[0];
    return o ? `<div class="wg-dealc"><small>Bon plan ${offTimed(o) && offNow(o) ? "en ce moment" : "près de toi"}</small><b>${esc(typeof offPctTxt === "function" ? offPctTxt(o) : "")} · ${esc(o.partner)}</b><i>${esc(o.title)}${o.city ? " · 📍 " + esc(o.city) : ""}</i></div>` : `<div class="wg-dealc"><small>Bons plans</small><b>Des réductions près de chez toi</b><i>pour faire des économies ›</i></div>`; } },
  promo: { s: "bons", ic: "tag", t: "Code promo en ligne", d: "Valable partout", w: 1, go: () => { offState.mode = "online"; switchTab("bons"); }, html: () => { const o = (typeof BPLANS !== "undefined" ? BPLANS : []).find(x => x.status !== "off" && typeof offOnline === "function" && offOnline(x));
    return o ? `<small>Code promo · ${esc(o.partner)}</small><b style="font-size:1.02rem;font-family:ui-monospace,Menlo,monospace">${esc(o.code || "")}</b><i>${esc(o.title)}</i>` : `<small>Codes promo</small><i>Bientôt des codes en ligne ›</i>`; } },
  saved: { s: "bons", ic: "piggy", t: "Économisé grâce à Bourselle", d: "Avec les bons plans", w: 1, go: () => savedOpen(), html: () => `<small>Économisé</small><b class="num good">${esc(wgMoney(savedTotal(), true))}</b><i>grâce à Bourselle</i>` },
};
// Couleurs de départ (une seule fois : ensuite chacun choisit avec 🎨)
const WG_DEF_COL = { owed: "menthe", owe: "peche", msgs: "lavande", prelev: "ciel", objectif: "or", garantie: "ciel", projet: "lavande", epargne: "menthe", promo: "corail", meteo: "ciel", serie: "peche", anniv: "or", jour: "menthe", bilan: "nuit" };
// Format rond : l'essentiel (icône + un chiffre) et un nom dessous ; 3 ronds par ligne
const wgShort = v => { const a = Math.abs(v); return (v < 0 ? "−" : "") + (a >= 10000 ? Math.round(a / 1000) + " k" : String(Math.round(a)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")) + " " + curSym(); };
const WG_RD = {
  reste: () => [wgShort(wgReste().left), "Reste"], mois: () => [wgShort(-wgMonth().depense), "Ce mois"],
  cats: () => { const p = catParts(wgMonth().byCat)[0]; return p ? [wgShort(p.v), p.name] : ["—", "Catégories"]; },
  comptes: () => [typeof accHasBalance === "function" && accHasBalance() ? wgShort(accTotalAt(accRefDay())) : "—", "Comptes"],
  ajout: () => ["", "Ajouter"], raccourcis: () => ["", "Payer"],
  owed: () => [wgShort(wgDues().owed), "On te doit"], owe: () => [wgShort(wgDues().owe), "Tu dois"],
  msgs: () => [String(typeof DMS !== "undefined" ? DMS.reduce((a, x) => a + (x.unread || 0), 0) : 0), "Messages"],
  projet: () => { const a = (typeof ACTS !== "undefined" ? ACTS : []).filter(x => x.status === "open").sort((x, y) => (x.when || "9").localeCompare(y.when || "9"))[0]; return a ? [a.when ? Math.max(0, daysUntil(a.when)) + " j" : "—", a.title] : ["—", "Projet"]; },
  dettes: () => { let left = 0; for (const x of Object.values(debts || {})) { if (x.kind === "medoit" || x.closed) continue; const c = debtCalc(x); if (!c.done) left += typeof debtBase === "function" ? debtBase(x, c.remaining) : c.remaining; } return [wgShort(left), "Dettes"]; },
  epargne: () => { const t = wgMonth(); return [wgShort((t.epargne || 0) + (t.invest || 0)), "Mis de côté"]; },
  objectif: () => { const g = Object.entries(goals || {}).map(([id, x]) => ({ ...x, s: goalSaved(id) })).filter(x => x.target > 0).sort((a, b) => b.s / b.target - a.s / a.target)[0]; return g ? [Math.min(100, Math.round(g.s / g.target * 100)) + " %", g.name, Math.min(100, g.s / g.target * 100)] : ["—", "Objectif"]; },
  prelev: () => { const l = Object.values(subs || {}).filter(x => x.status !== "resilie").map(x => ({ x, n: nextOcc(x) })).filter(o => o.n).sort((a, b) => a.n.localeCompare(b.n))[0]; return l ? [Math.max(0, daysUntil(l.n)) + " j", l.x.name] : ["—", "Abonnements"]; },
  garantie: () => { const g = garItems().filter(x => garStatus(x.warranty) !== "exp").sort((a, b) => a.warranty.end.localeCompare(b.warranty.end))[0]; return g ? [daysUntil(g.warranty.end) + " j", g.warranty.item || "Garantie"] : ["—", "Garanties"]; },
  deal: () => { const o = (typeof BPLANS !== "undefined" ? BPLANS : []).find(x => x.status !== "off" && !(typeof offOnline === "function" && offOnline(x))); return o ? [offPctTxt(o).replace("🎁 ", ""), o.partner] : ["—", "Bons plans"]; },
  promo: () => { const o = (typeof BPLANS !== "undefined" ? BPLANS : []).find(x => x.status !== "off" && typeof offOnline === "function" && offOnline(x)); return o ? [offPctTxt(o).replace("🎁 ", ""), o.partner] : ["—", "Codes promo"]; },
  saved: () => [wgShort(savedTotal()), "Économisé"],
};
function wgList() {
  if (!Array.isArray(settings.widgets)) settings.widgets = WG_DEFAULT.map(([k, w]) => ({ k, w }));
  if (!settings.wgPg0) { settings.wgPg0 = 1; for (const x of settings.widgets) if (WG[x.k] && WG[x.k].s === "proches" && x.p === undefined) x.p = 1; }
  if (!settings.wgCol0) { settings.wgCol0 = 1; for (const x of settings.widgets) if (!x.c && WG_DEF_COL[x.k]) x.c = WG_DEF_COL[x.k]; }
  return settings.widgets.filter(x => WG[x.k]);
}
const WG_PAGES = ["Mon argent", "Mes proches"];
let wgPage = 0;
function wgCard(x, i) { const W = WG[x.k], ed = wgEdit ? `<button type="button" class="wg-x" data-wx="${i}" aria-label="Retirer">✕</button><button type="button" class="wg-sz" data-wsz="${i}" aria-label="Changer la forme">⤢</button><button type="button" class="wg-col" data-wcol="${i}" aria-label="Couleur et page">🎨</button>` : "";
  if (x.w === 0) {   // rond
    let r = ["", W.t]; try { r = (WG_RD[x.k] || (() => ["", W.t]))(); } catch (e) {}
    const v = String(r[0] || ""), fs = v.length > 7 ? .86 : v.length > 5 ? 1 : 1.15;
    const ring = r[2] != null ? `<svg class="rd-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="rgba(0,0,0,.08)" stroke-width="6"/><circle cx="50" cy="50" r="46" fill="none" stroke="var(--green)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(r[2] * 2.89).toFixed(1)} 289" transform="rotate(-90 50 50)"/></svg>` : "";
    return `<div class="wg rd wg-${x.k}" data-wg="${x.k}" data-i="${i}"${wgStyle(x.c)} role="button" tabindex="0" aria-label="${esc(W.t)}"><div class="c">${ring}${icChip(r[3] || W.ic, 34)}${v ? `<b style="font-size:${fs}rem">${esc(v)}</b>` : ""}${ed}</div><small>${esc(r[1] || W.t)}</small></div>`;
  }
  return `<div class="wg wg-${x.k}${x.w === 2 ? " full" : ""}" data-wg="${x.k}" data-i="${i}"${wgStyle(x.c)} role="button" tabindex="0"><span class="wg-ic" aria-hidden="true">${icChip(W.ic, 30)}</span>${W.html()}${ed}</div>`; }
function renderHome() {
  document.getElementById("periodLabel").textContent = "Accueil";
  const L = wgList();
  let html = banner + `<div class="wg-top"><b>Mon accueil</b><span class="wg-tb">${wgEdit ? `<button type="button" class="ep-btn" id="wgBg">🖼 Fond</button>` : ""}<button type="button" class="ep-btn ${wgEdit ? "on" : "good"}" id="wgEdit">${wgEdit ? "✓ Terminé" : "✏️ Personnaliser"}</button></span></div>`;
  if (wgEdit) html += `<p class="wg-tip">✋ Appuie longuement sur un widget puis fais-le glisser pour le déplacer · ✕ pour le retirer · ⤢ rond, demi ou large · 🎨 sa couleur ou sa page</p>`;
  else if (typeof funTip === "function") html += `<p class="wg-hint">${esc(funTip())}</p>`;
  html += `<div class="wg-pt" role="tablist">${WG_PAGES.map((t, p) => `<button type="button" role="tab" data-wpg="${p}" aria-selected="${p === wgPage}">${t}</button>`).join("")}</div>
    <div class="wg-pages" id="wgPages">${WG_PAGES.map((t, p) => `<div class="wg-grid${wgEdit ? " edit" : ""}" data-p="${p}">${L.map((x, i) => [x, i]).filter(([x]) => (x.p || 0) === p).map(([x, i]) => wgCard(x, i)).join("")}
      ${L.some(x => (x.p || 0) === p) ? "" : `<p class="wg-empty">Page vide : ajoute des widgets ici.</p>`}<button type="button" class="wg-add" data-wadd="${p}">＋ Ajouter un widget</button></div>`).join("")}</div>`;
  view.innerHTML = html;
  const pages = view.querySelector("#wgPages");
  const setPg = (p, smooth) => { wgPage = p; view.querySelectorAll("[data-wpg]").forEach(b => b.setAttribute("aria-selected", String(+b.dataset.wpg === p))); pages.scrollTo({ left: p * pages.clientWidth, behavior: smooth ? "smooth" : "auto" }); };
  requestAnimationFrame(() => setPg(wgPage, false));
  pages.addEventListener("scroll", () => { const p = Math.round(pages.scrollLeft / Math.max(1, pages.clientWidth)); if (p !== wgPage) { wgPage = p; view.querySelectorAll("[data-wpg]").forEach(b => b.setAttribute("aria-selected", String(+b.dataset.wpg === p))); } }, { passive: true });
  view.querySelectorAll("[data-wpg]").forEach(b => b.onclick = () => setPg(+b.dataset.wpg, true));
  const save = () => { saveSettings(); render(); };
  view.querySelector("#wgEdit").onclick = () => { wgEdit = !wgEdit; if (!wgEdit) saveSettings(); render(); };
  const bg = view.querySelector("#wgBg"); if (bg) bg.onclick = () => funBgOpen();
  view.querySelectorAll("[data-wadd]").forEach(b => b.onclick = () => { wgPage = +b.dataset.wadd; wgCatalog(); });
  view.querySelectorAll("[data-wx]").forEach(b => b.onclick = e => { e.stopPropagation(); settings.widgets.splice(+b.dataset.wx, 1); save(); });
  view.querySelectorAll("[data-wsz]").forEach(b => b.onclick = e => { e.stopPropagation(); const x = settings.widgets[+b.dataset.wsz]; x.w = x.w === 0 ? 1 : x.w === 1 ? 2 : 0; save(); toast(x.w === 0 ? "Format rond" : x.w === 1 ? "Format demi" : "Format large", 1400); });
  view.querySelectorAll("[data-wcol]").forEach(b => b.onclick = e => { e.stopPropagation(); wgColor(+b.dataset.wcol); });
  view.querySelectorAll("[data-wa]").forEach(b => b.onclick = e => { e.stopPropagation(); if (wgEdit) return; const a = b.dataset.wa;
    if (a.startsWith("prel:")) { const id = a.slice(5), x = subs[id]; if (!x) return; const d = nextOcc(x) || todayISO();
      addTx({ type: "depense", amount: Number(x.amount), cat: x.cat, date: d, note: x.name, fixe: true }); subs[id].next = advance(d, x.freq); saveSubs(); render(); toast(`${x.name} : prélèvement ajouté aux dépenses ✓`); return; }
    ({ tx: () => openSheet(null), scan: () => { openSheet(null); setTimeout(() => { const s = document.getElementById("scanBtn"); if (s && !s.hidden) s.click(); }, 300); }, imp: () => startImport(),
      pay: () => editProject(), ask: () => editPay(), note: () => noteShare(),
      remind: () => typeof epWho === "function" ? epWho("in") : switchTab("partage"), settle: () => typeof epWho === "function" ? epWho("out") : switchTab("partage") })[a](); });
  const RD_GO = { ajout: () => openSheet(null), raccourcis: () => editProject(), jour: () => openSheet(null) };
  view.querySelectorAll("[data-wg]").forEach(el => el.addEventListener("click", e => { if (wgEdit || el.dataset.dragged) return; const W = WG[el.dataset.wg]; if (W && W.go) W.go(); else if (el.classList.contains("rd") && RD_GO[el.dataset.wg]) RD_GO[el.dataset.wg](); }));
  // Appui long : mode édition
  view.querySelectorAll("[data-wg]").forEach(el => { let t = null; el.addEventListener("pointerdown", () => { if (wgEdit) return; t = setTimeout(() => { wgEdit = true; render(); try { navigator.vibrate && navigator.vibrate(15); } catch (e) {} }, 550); });
    ["pointerup", "pointerleave", "pointercancel", "pointermove"].forEach(n => el.addEventListener(n, ev => { if (n === "pointermove" && t && Math.abs(ev.movementY) + Math.abs(ev.movementX) < 3) return; clearTimeout(t); t = null; })); });
  if (wgEdit) view.querySelectorAll(".wg-grid").forEach(g => wgDrag(g));
}
// Glisser-déposer des widgets : seulement après un appui long (≈ 0,4 s sans bouger).
// Un geste rapide fait défiler la page normalement, rien ne bouge par erreur.
function wgDrag(grid) {
  grid.querySelectorAll("[data-wg]").forEach(el => {
    let armed = false;
    el.addEventListener("touchmove", e => { if (armed) e.preventDefault(); }, { passive: false });   // iPhone : pas de défilement pendant le déplacement
    el.addEventListener("pointerdown", e => {
      if (e.target.closest("[data-wx],[data-wsz],[data-wcol]") || (e.pointerType === "mouse" && e.button !== 0)) return;
      const x0 = e.clientX, y0 = e.clientY; let r0 = null, moved = false;
      const hold = setTimeout(() => { armed = true; r0 = el.getBoundingClientRect(); el.classList.add("drag"); el.style.transform = "scale(1.04)"; try { navigator.vibrate && navigator.vibrate(12); } catch (er) {} }, 400);
      const move = ev => {
        const dx = ev.clientX - x0, dy = ev.clientY - y0;
        if (!armed) { if (Math.abs(dx) + Math.abs(dy) > 8) end(); return; }   // bougé trop tôt : c'est un défilement
        ev.preventDefault(); moved = true;
        el.style.transform = `translate(${dx}px, ${dy}px) rotate(-1.5deg) scale(1.04)`;
        el.style.pointerEvents = "none"; const under = document.elementFromPoint(ev.clientX, ev.clientY); el.style.pointerEvents = "";
        const tgt = under && under.closest("[data-wg]"); if (!tgt || tgt === el || tgt.parentNode !== grid) return;
        const rr = tgt.getBoundingClientRect(), before = ev.clientY < rr.top + rr.height / 2 || (ev.clientY < rr.bottom && ev.clientX < rr.left + rr.width / 2);
        grid.insertBefore(el, before ? tgt : tgt.nextSibling);
        el.style.transform = ""; const nw = el.getBoundingClientRect();   // garder le widget sous le doigt
        el.style.transform = `translate(${dx - (nw.left - r0.left)}px, ${dy - (nw.top - r0.top)}px) rotate(-1.5deg) scale(1.04)`;
      };
      const end = () => {
        clearTimeout(hold);
        window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end);
        const was = armed; armed = false; el.classList.remove("drag"); el.style.transform = "";
        if (!was || !moved) return;
        settings.widgets = [...document.querySelectorAll("#wgPages [data-wg]")].map(n => settings.widgets[+n.dataset.i]); saveSettings(); render();
      };
      window.addEventListener("pointermove", move, { passive: false }); window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
    });
  });
}
// Le catalogue : tous les services proposés, par rubrique
function wgCatalog() {
  const on = new Set(wgList().map(x => x.k));
  const f = openForm(`<div class="f2 wg-cat-sheet"><h3>＋ Ajouter un widget</h3><p class="hint" style="margin:0 0 6px">Choisis ce que tu veux voir sur ton accueil. Tu pourras ensuite les déplacer et changer leur taille.</p>
    ${WG_SERVICES.map(([s, l]) => `<div class="pmx-cap">${l}</div><div class="pmx-sec">${Object.entries(WG).filter(([, W]) => W.s === s).map(([k, W]) => `<button type="button" class="pmx-r" data-wk="${k}" role="switch" aria-checked="${on.has(k)}"><span class="pmx-sq" style="background:none">${icChip(W.ic, 32)}</span><b>${esc(W.t)}<small>${esc(W.d)}</small></b><span class="pmx-sw" aria-hidden="true"></span></button>`).join("")}</div>`).join("")}
    <button type="button" class="linkbtn" id="wgReset" style="display:block;margin:14px auto 0">Revenir à l'accueil par défaut</button></div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Terminé";
  f.querySelectorAll("[data-wk]").forEach(b => b.onclick = () => {
    const k = b.dataset.wk, L = wgList(), i = L.findIndex(x => x.k === k);
    if (i >= 0) settings.widgets = L.filter(x => x.k !== k); else settings.widgets = L.concat([{ k, w: WG[k].w, p: wgPage, ...(WG_DEF_COL[k] ? { c: WG_DEF_COL[k] } : {}) }]);
    b.setAttribute("aria-checked", String(i < 0)); saveSettings(); render();
  });
  f.querySelector("#wgReset").onclick = () => { settings.widgets = WG_DEFAULT.map(([k, w]) => ({ k, w, ...(WG_DEF_COL[k] ? { c: WG_DEF_COL[k] } : {}), ...(WG[k].s === "proches" ? { p: 1 } : {}) })); saveSettings(); closeForm(); render(); toast("Accueil par défaut"); };
}

// ---------- Suivis : l'en-tête à deux cartes (comme Entre proches), une par rubrique ----------
const SV_HEAD = ["dettes", "economies", "objectifs", "abos", "garanties"];
let svDet = { iOwe: 0, owed: 0, monthly: 0 };
function svCard(cap, val, cls, sub, btn) {
  return `<div class="ep-card"><small>${cap}</small><b class="num ${cls || ""}">${val}</b>${sub ? `<span class="sv-sub">${sub}</span>` : ""}${btn || ""}</div>`;
}
const svBtn = (id, cls, t) => `<button type="button" class="ep-btn ${cls}" id="${id}">${t}</button>`;
function svHeadHTML(k) {
  const m = (v, s) => esc(eur(v, s));
  if (k === "dettes") { const d = svDet;
    return svCard("Je dois", m(d.iOwe), d.iOwe > 0.004 ? "bad" : "", d.monthly ? `${m(d.monthly, true)} de mensualités / mois` : "", d.iOwe > 0.004 ? svBtn("svA", "bad", "💸 Rembourser") : `<span class="ep-none">Rien à rembourser</span>`)
      + svCard("On me doit", m(d.owed), d.owed > 0.004 ? "good" : "", "", d.owed > 0.004 ? svBtn("svB", "good", "🔔 Relancer") : `<span class="ep-none">Personne</span>`); }
  if (k === "economies") { const t = wgMonth(), st = typeof ecoState === "function" ? ecoState() : {}, tg = Number(st.target) || 0;
    const all = allItems().filter(x => x.type === "epargne" || x.type === "invest").reduce((a, x) => a + (Number(x.amount) || 0), 0);
    return svCard("Mis de côté ce mois", m((t.epargne || 0) + (t.invest || 0), true), "good", tg ? `sur ${m(tg, true)} prévus` : "", svBtn("svA", "good", "🌱 Mettre de côté"))
      + svCard("Depuis le début", m(all, true), "", "épargne et placements", svBtn("svB", "", "📋 Mon plan")); }
  if (k === "objectifs") { const L = Object.entries(goals || {}).map(([id, g]) => ({ ...g, id, s: goalSaved(id) }));
    const sv = L.reduce((a, g) => a + g.s, 0), tg = L.reduce((a, g) => a + (Number(g.target) || 0), 0);
    const nx = L.filter(g => g.target > 0 && g.s < g.target).sort((a, b) => b.s / b.target - a.s / a.target)[0];
    return svCard("Épargné", m(sv, true), "good", tg ? `sur ${m(tg, true)}` : "", L.length ? svBtn("svA", "good", "＋ Verser") : "")
      + svCard("Le plus proche", nx ? `${Math.round(nx.s / nx.target * 100)} %` : "—", "", nx ? esc(nx.name) : "aucun objectif en cours", svBtn("svB", "", "＋ Nouvel objectif")); }
  if (k === "abos") { const L = Object.values(subs || {}).map(x => ({ x, s: subStatus(x) })), act = L.filter(o => o.s.st !== "off"), soon = L.filter(o => o.s.st === "soon");
    const pm = act.reduce((a, o) => a + monthlyCost(o.x), 0);
    return svCard("Par mois", m(pm, true), "", `${act.length} actif${act.length > 1 ? "s" : ""} · ${m(pm * 12, true)} / an`, svBtn("svA", "good", "＋ Ajouter"))
      + svCard("À surveiller", String(soon.length), soon.length ? "warn" : "", soon.length ? esc(soon[0].x.name) : "rien à signaler", soon.length ? svBtn("svB", "", "👀 Voir") : ""); }
  if (k === "garanties") { const L = garItems().map(x => ({ x, st: garStatus(x.warranty) })), on = L.filter(o => o.st !== "exp"), soon = L.filter(o => o.st === "soon").sort((a, b) => a.x.warranty.end.localeCompare(b.x.warranty.end));
    return svCard("Sous garantie", String(on.length), "good", on.length ? "articles protégés" : "", svBtn("svA", "good", "＋ Ajouter"))
      + svCard("Expire bientôt", String(soon.length), soon.length ? "warn" : "", soon.length ? `${esc(soon[0].x.warranty.item || soon[0].x.note || "Achat")}, ${esc(leftTxt(daysUntil(soon[0].x.warranty.end)))}` : "rien ne presse", soon.length ? svBtn("svB", "", "👀 Voir") : ""); }
  return "";
}
function svScroll(sel) { const el = view.querySelector(sel); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }
function svApply(k) {
  if (!SV_HEAD.includes(k)) return;
  const h = document.createElement("div"); h.className = "ep-sum sv-sum"; h.innerHTML = svHeadHTML(k);
  const tiles = view.querySelector(":scope > .tiles");
  if (tiles) tiles.replaceWith(h);
  else { let ref = view.firstElementChild; while (ref && ref.classList.contains("banner")) ref = ref.nextElementSibling; view.insertBefore(h, ref); }
  const A = h.querySelector("#svA"), B = h.querySelector("#svB");
  const act = {
    dettes: [() => svScroll(".gar.debt"), () => typeof epWho === "function" ? epWho("in") : switchTab("partage")],
    economies: [() => { openSheet(null); form.type = "epargne"; form.cat = settings.epargne[0]; drawForm(); }, () => svScroll(".eco-list, #ecoTarget")],
    objectifs: [() => { const b = view.querySelector('[data-g="add"]'); if (b) b.click(); }, () => editGoal(null)],
    abos: [() => editSub(null), () => svScroll(".gar.soon")],
    garanties: [() => { openSheet(null); toast("Coche « Cet achat est sous garantie »", 3500); }, () => svScroll(".gar.soon")],
  }[k];
  if (A) A.onclick = act[0]; if (B) B.onclick = act[1];
}

// Choisir la couleur d'un widget
function wgColor(i) {
  const x = settings.widgets[i]; if (!x) return; const W = WG[x.k];
  const f = openForm(`<div class="f2"><h3>🎨 Couleur · ${esc(W.t)}</h3>
    <div class="wg-pal"><button type="button" data-pc="" aria-pressed="${!x.c}"><span class="wg-sw" style="background:var(--surface)"></span>Normal</button>
    ${Object.entries(WG_COLORS).map(([k, C]) => `<button type="button" data-pc="${k}" aria-pressed="${x.c === k}"><span class="wg-sw" style="background:${C[0]}"></span>${C[3]}</button>`).join("")}</div>
    <button type="button" class="linkbtn" id="wgAll" style="display:block;margin:12px auto 0">Appliquer à tous les widgets</button>
    <button type="button" class="btn" id="wgMove" style="display:block;margin:12px auto 0">↔ Déplacer vers « ${esc(WG_PAGES[1 - (x.p || 0)])} »</button></div>`, () => true);
  f.querySelector("#wgMove").onclick = () => { x.p = 1 - (x.p || 0); const it = settings.widgets.splice(i, 1)[0]; settings.widgets.push(it); wgPage = x.p; saveSettings(); closeForm(); render(); toast(`Widget déplacé vers « ${WG_PAGES[x.p]} »`); };
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Terminé";
  let pick = x.c || "";
  f.querySelectorAll("[data-pc]").forEach(b => b.onclick = () => { pick = b.dataset.pc; if (pick) x.c = pick; else delete x.c;
    f.querySelectorAll("[data-pc]").forEach(y => y.setAttribute("aria-pressed", String(y === b))); saveSettings(); render(); });
  f.querySelector("#wgAll").onclick = () => { for (const y of settings.widgets) { if (pick) y.c = pick; else delete y.c; } saveSettings(); closeForm(); render(); toast("Couleur appliquée à tous les widgets"); };
}
