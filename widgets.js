/* Bourselle — Accueil personnalisable : des widgets que chacun choisit, range et dimensionne.
 * La disposition est gardée dans les réglages (donc dans le compte, sur tous les appareils) : settings.widgets = [{ k, w }]
 * k : le widget, w : 1 (demi-largeur) ou 2 (toute la largeur). Chaque widget mène à la rubrique concernée. */
const WG_SERVICES = [["budget", "💶 Budget"], ["proches", "🤝 Entre proches"], ["suivis", "📋 Suivis"], ["bons", "🎁 Bons plans"]];
const WG_DEFAULT = [["reste", 2], ["owed", 1], ["owe", 1], ["msgs", 2], ["prelev", 1], ["objectif", 1], ["deal", 2], ["saved", 1], ["mois", 1]];
let wgEdit = false;
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
  reste: { s: "budget", ic: "💶", t: "Reste à dépenser", d: "Budget du mois", w: 2, go: () => switchTab("mois"), html: () => { const r = wgReste();
    return r.budget ? `<div class="wg-hero"><small>Il te reste à dépenser ce mois-ci</small><b class="num">${esc(wgMoney(r.left))}</b><i>${r.left > 0 ? `soit ${esc(wgMoney(r.left / r.days, true))} par jour · ${r.days} jour${r.days > 1 ? "s" : ""} restants` : "Budget du mois dépassé"}</i><div class="wg-bar"><i style="width:${r.pct}%"></i></div></div>`
      : `<div class="wg-hero"><small>Reste à dépenser</small><b style="font-size:1.1rem">Fixe ton budget du mois</b><i>pour savoir ce qu'il te reste chaque jour ›</i></div>`; } },
  mois: { s: "budget", ic: "📊", t: "Ce mois-ci", d: "Rentrées et dépenses", w: 1, go: () => switchTab("mois"), html: () => { const t = wgMonth(); return `<small>Ce mois-ci</small><b class="num" style="font-size:1.15rem">−${esc(wgMoney(t.depense, true))}</b><i>rentrées +${esc(wgMoney(t.rentree, true))}</i>`; } },
  cats: { s: "budget", ic: "🍩", t: "Dépenses par catégorie", d: "Les 3 plus grosses du mois", w: 2, go: () => switchTab("mois"), html: () => { const t = wgMonth(), parts = catParts(t.byCat).slice(0, 3), mx = parts.length ? parts[0].v : 1;
    return `<small>Dépenses par catégorie</small>${parts.length ? parts.map(p => `<div class="wg-cat"><span>${esc(p.name)}</span><span class="wg-cb"><i style="width:${Math.round(p.v / mx * 100)}%;background:${p.color}"></i></span><b class="num">${esc(wgMoney(p.v, true))}</b></div>`).join("") : `<i>Aucune dépense ce mois-ci</i>`}`; } },
  comptes: { s: "budget", ic: "🏦", t: "Solde de mes comptes", d: "Tous comptes confondus", w: 1, go: () => switchTab("mois"), html: () => typeof accHasBalance === "function" && accHasBalance() ? `<small>Mes comptes</small><b class="num">${esc(wgMoney(accTotalAt(accRefDay()), true))}</b><i>aujourd'hui</i>` : `<small>Mes comptes</small><b style="font-size:1rem">Indique ton solde</b><i>pour le suivre au jour le jour</i>` },
  ajout: { s: "budget", ic: "➕", t: "Ajouter vite", d: "Dépense, ticket, relevé", w: 2, html: () => `<small>Ajouter</small><div class="wg-acts"><button type="button" data-wa="tx">➕ Dépense</button><button type="button" data-wa="scan">📷 Ticket</button><button type="button" data-wa="imp">📄 Relevé</button></div>` },
  owed: { s: "proches", ic: "🤝", t: "On te doit", d: "Entre proches", w: 1, go: () => switchTab("partage"), html: () => { const d = wgDues(); return `<small>On te doit</small><b class="num ${d.owed > 0.004 ? "good" : ""}">${esc(wgMoney(d.owed, true))}</b><i>${d.inn.length ? esc(d.inn.slice(0, 3).map(p => favFirst(p.name)).join(", ")) : "personne"}</i>`; } },
  owe: { s: "proches", ic: "💸", t: "Tu dois", d: "Entre proches", w: 1, go: () => switchTab("partage"), html: () => { const d = wgDues(); return `<small>Tu dois</small><b class="num ${d.owe > 0.004 ? "bad" : ""}">${esc(wgMoney(d.owe, true))}</b><i>${d.out.length ? esc(d.out.slice(0, 3).map(p => favFirst(p.name)).join(", ")) : "rien à régler"}</i>`; } },
  msgs: { s: "proches", ic: "💬", t: "Messages", d: "Dernière discussion", w: 2, go: () => { epSub = "discussions"; switchTab("partage"); }, html: () => {
    const t = typeof DMS !== "undefined" ? DMS.slice().sort((a, b) => (b.unread || 0) - (a.unread || 0) || b.at - a.at)[0] : null;
    if (!t) return `<small>Messages</small><i>Écris à un proche, propose une sortie…</i>`;
    const n = DMS.reduce((a, x) => a + (x.unread || 0), 0);
    return `<small>Messages${n ? ` · <b class="wg-badge">${n}</b>` : ""}</small><div class="wg-msg"><span class="ep-av${t.gid ? " g" : ""}" style="width:36px;height:36px;font-size:.9rem;background:${t.gid ? "#1f6b4b" : favColor("@" + t.tag)}">${t.gid ? "👥" : esc(favFirst(chatTitle(t)).charAt(0).toUpperCase())}</span><span><b>${esc(chatTitle(t))}</b><small>${esc(typeof ensSnip === "function" ? ensSnip(t) : "")}</small></span></div>`; } },
  projet: { s: "proches", ic: "📅", t: "Prochain projet", d: "Sortie, cadeau, voyage", w: 1, go: () => { epSub = "projets"; switchTab("partage"); }, html: () => { const a = (typeof ACTS !== "undefined" ? ACTS : []).filter(x => x.status === "open").sort((x, y) => (x.when || "9").localeCompare(y.when || "9"))[0];
    return a ? `<small>Prochain projet</small><b style="font-size:1.02rem">${esc(a.emoji || "📅")} ${esc(a.title)}</b><i>${a.when ? esc(frDate(a.when)) : "date à fixer"}${a.place ? " · " + esc(a.place) : ""}</i>` : `<small>Prochain projet</small><i>Une sortie, un cadeau ? Lance-le ici ›</i>`; } },
  raccourcis: { s: "proches", ic: "⚡", t: "Payer, demander, partager", d: "Les actions d'Entre proches", w: 2, html: () => `<small>Entre proches</small><div class="wg-acts"><button type="button" data-wa="pay">💸 Payer</button><button type="button" data-wa="ask">🙋 Me faire payer</button><button type="button" data-wa="note">🧾 Partager une note</button></div>` },
  dettes: { s: "suivis", ic: "📉", t: "Mes dettes", d: "Ce qu'il me reste à rembourser", w: 1, go: () => switchTab("dettes"), html: () => { let left = 0; for (const x of Object.values(debts || {})) { if (x.kind === "medoit" || x.closed) continue; const c = debtCalc(x); if (!c.done) left += typeof debtBase === "function" ? debtBase(x, c.remaining) : c.remaining; }
    return `<small>Reste à rembourser</small><b class="num ${left > 0.004 ? "bad" : ""}">${esc(wgMoney(left, true))}</b><i>dettes et crédits</i>`; } },
  epargne: { s: "suivis", ic: "🌱", t: "Mis de côté ce mois", d: "Épargne et économies", w: 1, go: () => switchTab("economies"), html: () => { const t = wgMonth(); return `<small>Mis de côté ce mois</small><b class="num good">${esc(wgMoney((t.epargne || 0) + (t.invest || 0), true))}</b><i>épargne et placements</i>`; } },
  objectif: { s: "suivis", ic: "🎯", t: "Objectif", d: "Ton objectif principal", w: 1, go: () => switchTab("objectifs"), html: () => { const g = Object.entries(goals || {}).map(([id, x]) => ({ ...x, id, s: goalSaved(id) })).filter(x => x.target > 0).sort((a, b) => b.s / b.target - a.s / a.target)[0];
    return g ? `<small>Objectif ${esc(g.name)}</small><b class="num">${Math.min(100, Math.round(g.s / g.target * 100))} %</b><div class="wg-bar sm"><i style="width:${Math.min(100, Math.round(g.s / g.target * 100))}%"></i></div>` : `<small>Objectif</small><i>Vacances, voiture… fixe-toi un objectif ›</i>`; } },
  prelev: { s: "suivis", ic: "🔁", t: "Prochain prélèvement", d: "Abonnements", w: 1, go: () => switchTab("abos"), html: () => { const l = Object.values(subs || {}).filter(x => x.status !== "resilie").map(x => ({ x, n: nextOcc(x) })).filter(o => o.n).sort((a, b) => a.n.localeCompare(b.n))[0];
    return l ? `<small>Prochain prélèvement</small><b style="font-size:1.02rem">${esc(l.x.name)}</b><i class="${daysUntil(l.n) <= 3 ? "warn" : ""}">${esc(wgMoney(Number(l.x.amount) || 0))} · ${esc(leftTxt(daysUntil(l.n)))}</i>` : `<small>Abonnements</small><i>Ajoute tes abonnements pour ne plus être surpris ›</i>`; } },
  garantie: { s: "suivis", ic: "🛡️", t: "Garantie qui expire", d: "Garanties", w: 1, go: () => switchTab("garanties"), html: () => { const g = garItems().filter(x => garStatus(x.warranty) !== "exp").sort((a, b) => a.warranty.end.localeCompare(b.warranty.end))[0];
    return g ? `<small>Garantie</small><b style="font-size:1.02rem">${esc(g.warranty.item || g.note || "Achat")}</b><i class="${garStatus(g.warranty) === "soon" ? "warn" : ""}">${esc(leftTxt(daysUntil(g.warranty.end)))}</i>` : `<small>Garanties</small><i>Aucun article sous garantie</i>`; } },
  deal: { s: "bons", ic: "🎁", t: "Bon plan du moment", d: "Près de chez toi", w: 2, go: () => switchTab("bons"), html: () => { const L = (typeof BPLANS !== "undefined" ? BPLANS : []).filter(o => o.status !== "off" && !(typeof offOnline === "function" && offOnline(o)) && offVisible(o));
    const o = L.find(x => offTimed(x) && offNow(x)) || L[0];
    return o ? `<div class="wg-deal"><small>Bon plan ${offTimed(o) && offNow(o) ? "en ce moment" : "près de toi"}</small><b>${esc(typeof offPctTxt === "function" ? offPctTxt(o) : "")} · ${esc(o.partner)}</b><i>${esc(o.title)}${o.city ? " · 📍 " + esc(o.city) : ""}</i></div>` : `<div class="wg-deal"><small>Bons plans</small><b>Des réductions près de chez toi</b><i>pour faire des économies ›</i></div>`; } },
  promo: { s: "bons", ic: "🛒", t: "Code promo en ligne", d: "Valable partout", w: 1, go: () => { offState.mode = "online"; switchTab("bons"); }, html: () => { const o = (typeof BPLANS !== "undefined" ? BPLANS : []).find(x => x.status !== "off" && typeof offOnline === "function" && offOnline(x));
    return o ? `<small>Code promo · ${esc(o.partner)}</small><b style="font-size:1.02rem;font-family:ui-monospace,Menlo,monospace">${esc(o.code || "")}</b><i>${esc(o.title)}</i>` : `<small>Codes promo</small><i>Bientôt des codes en ligne ›</i>`; } },
  saved: { s: "bons", ic: "💰", t: "Économisé grâce à Bourselle", d: "Avec les bons plans", w: 1, go: () => savedOpen(), html: () => `<small>Économisé</small><b class="num good">${esc(wgMoney(savedTotal(), true))}</b><i>grâce à Bourselle</i>` },
};
function wgList() {
  if (!Array.isArray(settings.widgets)) settings.widgets = WG_DEFAULT.map(([k, w]) => ({ k, w }));
  return settings.widgets.filter(x => WG[x.k]);
}
function renderHome() {
  document.getElementById("periodLabel").textContent = "Accueil";
  const L = wgList();
  let html = banner + `<div class="wg-top"><b>Mon accueil</b><button type="button" class="ep-btn ${wgEdit ? "on" : "good"}" id="wgEdit">${wgEdit ? "✓ Terminé" : "✏️ Personnaliser"}</button></div>`;
  if (wgEdit) html += `<p class="wg-tip">✋ Fais glisser un widget pour le déplacer · ✕ pour le retirer · ⤢ pour changer sa taille</p>`;
  html += `<div class="wg-grid${wgEdit ? " edit" : ""}" id="wgGrid">${L.map((x, i) => { const W = WG[x.k];
    return `<div class="wg wg-${x.k}${x.w === 2 ? " full" : ""}" data-wg="${x.k}" data-i="${i}" role="button" tabindex="0"><span class="wg-ic" aria-hidden="true">${W.ic}</span>${W.html()}
      ${wgEdit ? `<button type="button" class="wg-x" data-wx="${i}" aria-label="Retirer">✕</button><button type="button" class="wg-sz" data-wsz="${i}" aria-label="Changer la taille">${x.w === 2 ? "⤡" : "⤢"}</button>` : ""}</div>`; }).join("")}
    <button type="button" class="wg-add" id="wgAdd">＋ Ajouter un widget</button></div>`;
  view.innerHTML = html;
  const save = () => { saveSettings(); render(); };
  view.querySelector("#wgEdit").onclick = () => { wgEdit = !wgEdit; if (!wgEdit) saveSettings(); render(); };
  view.querySelector("#wgAdd").onclick = () => wgCatalog();
  view.querySelectorAll("[data-wx]").forEach(b => b.onclick = e => { e.stopPropagation(); settings.widgets.splice(+b.dataset.wx, 1); save(); });
  view.querySelectorAll("[data-wsz]").forEach(b => b.onclick = e => { e.stopPropagation(); const x = settings.widgets[+b.dataset.wsz]; x.w = x.w === 2 ? 1 : 2; save(); });
  view.querySelectorAll("[data-wa]").forEach(b => b.onclick = e => { e.stopPropagation(); if (wgEdit) return;
    ({ tx: () => openSheet(null), scan: () => { openSheet(null); setTimeout(() => { const s = document.getElementById("scanBtn"); if (s && !s.hidden) s.click(); }, 300); }, imp: () => startImport(),
      pay: () => editProject(), ask: () => editPay(), note: () => noteShare() })[b.dataset.wa](); });
  view.querySelectorAll("[data-wg]").forEach(el => el.addEventListener("click", e => { if (wgEdit || el.dataset.dragged) return; const W = WG[el.dataset.wg]; if (W && W.go) W.go(); }));
  // Appui long : mode édition
  view.querySelectorAll("[data-wg]").forEach(el => { let t = null; el.addEventListener("pointerdown", () => { if (wgEdit) return; t = setTimeout(() => { wgEdit = true; render(); try { navigator.vibrate && navigator.vibrate(15); } catch (e) {} }, 550); });
    ["pointerup", "pointerleave", "pointercancel", "pointermove"].forEach(n => el.addEventListener(n, ev => { if (n === "pointermove" && t && Math.abs(ev.movementY) + Math.abs(ev.movementX) < 3) return; clearTimeout(t); t = null; })); });
  if (wgEdit) wgDrag(view.querySelector("#wgGrid"));
}
// Glisser-déposer des widgets (doigt ou souris)
function wgDrag(grid) {
  grid.querySelectorAll("[data-wg]").forEach(el => {
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", e => {
      if (e.target.closest("[data-wx],[data-wsz]")) return;
      e.preventDefault();
      const r0 = el.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY; let moved = false;
      try { el.setPointerCapture(e.pointerId); } catch (er) {}
      const move = ev => {
        const dx = ev.clientX - x0, dy = ev.clientY - y0; if (!moved && Math.abs(dx) + Math.abs(dy) < 6) return;
        if (!moved) { moved = true; el.classList.add("drag"); }
        el.style.transform = `translate(${dx}px, ${dy}px) rotate(-1.5deg) scale(1.03)`;
        el.style.pointerEvents = "none"; const under = document.elementFromPoint(ev.clientX, ev.clientY); el.style.pointerEvents = "";
        const tgt = under && under.closest("[data-wg]"); if (!tgt || tgt === el || tgt.parentNode !== grid) return;
        const rr = tgt.getBoundingClientRect(), before = ev.clientY < rr.top + rr.height / 2 || (ev.clientY < rr.bottom && ev.clientX < rr.left + rr.width / 2);
        grid.insertBefore(el, before ? tgt : tgt.nextSibling);
        el.style.transform = ""; const nw = el.getBoundingClientRect();   // garder le widget sous le doigt après le déplacement dans la grille
        el.style.transform = `translate(${dx - (nw.left - r0.left)}px, ${dy - (nw.top - r0.top)}px) rotate(-1.5deg) scale(1.03)`;
      };
      const up = () => {
        window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
        el.classList.remove("drag"); el.style.transform = "";
        if (!moved) return;
        const order = [...grid.querySelectorAll("[data-wg]")].map(n => settings.widgets[+n.dataset.i]);
        settings.widgets = order; saveSettings(); render();
      };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    });
  });
}
// Le catalogue : tous les services proposés, par rubrique
function wgCatalog() {
  const on = new Set(wgList().map(x => x.k));
  const f = openForm(`<div class="f2 wg-cat-sheet"><h3>＋ Ajouter un widget</h3><p class="hint" style="margin:0 0 6px">Choisis ce que tu veux voir sur ton accueil. Tu pourras ensuite les déplacer et changer leur taille.</p>
    ${WG_SERVICES.map(([s, l]) => `<div class="pmx-cap">${l}</div><div class="pmx-sec">${Object.entries(WG).filter(([, W]) => W.s === s).map(([k, W]) => `<button type="button" class="pmx-r" data-wk="${k}" role="switch" aria-checked="${on.has(k)}"><span class="pmx-sq" style="background:var(--bg);font-size:1.1rem">${W.ic}</span><b>${esc(W.t)}<small>${esc(W.d)}</small></b><span class="pmx-sw" aria-hidden="true"></span></button>`).join("")}</div>`).join("")}
    <button type="button" class="linkbtn" id="wgReset" style="display:block;margin:14px auto 0">Revenir à l'accueil par défaut</button></div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Terminé";
  f.querySelectorAll("[data-wk]").forEach(b => b.onclick = () => {
    const k = b.dataset.wk, L = wgList(), i = L.findIndex(x => x.k === k);
    if (i >= 0) settings.widgets = L.filter(x => x.k !== k); else settings.widgets = L.concat([{ k, w: WG[k].w }]);
    b.setAttribute("aria-checked", String(i < 0)); saveSettings(); render();
  });
  f.querySelector("#wgReset").onclick = () => { settings.widgets = WG_DEFAULT.map(([k, w]) => ({ k, w })); saveSettings(); closeForm(); render(); toast("Accueil par défaut"); };
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
      + svCard("Le plus proche", nx ? `${esc(nx.emoji || "🎯")} ${Math.round(nx.s / nx.target * 100)} %` : "—", "", nx ? esc(nx.name) : "aucun objectif en cours", svBtn("svB", "", "🎯 Nouvel objectif")); }
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
