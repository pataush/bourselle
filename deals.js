/* Bourselle — l'accueil centré sur le partage, les achats groupés et les cagnottes.
 * Accueil : ce qu'on te doit / ce que tu dois, raccourcis, achats groupés et cagnottes, groupes, activité récente, aperçu du budget.
 * Les achats groupés et cagnottes vivent sur le serveur (on y participe par lien, avec ou sans compte) ; l'argent va
 * directement de banque à banque, jamais par Bourselle. */
let DEALS = (() => { try { return JSON.parse(localStorage.getItem("bourselle-deals") || "[]") || []; } catch (e) { return []; } })();
let openDeal = null, dealState = null;
const dealsSave = () => { try { localStorage.setItem("bourselle-deals", JSON.stringify(DEALS.slice(0, 60))); } catch (e) {} };
const dealLink = id => appBase() + "g.html#d=" + id;
const dealMoney = (v, cur) => !cur || cur === baseCurrency() ? eur(v) : new Intl.NumberFormat(appLocale(), { style: "currency", currency: cur }).format(v);
async function dealsRefresh() {
  if (typeof socOn !== "function" || !socOn()) return;
  try { const j = await socApi("/deals"); DEALS = j.deals || []; dealsSave(); if (tab === "accueil" && !openDeal) render(); } catch (e) {}
}
function dealPut(d) { const i = DEALS.findIndex(x => x.id === d.id); if (i >= 0) DEALS[i] = d; else DEALS.unshift(d); dealsSave(); }

// ---------- Accueil ----------
const HUB_ICONS = {
  group: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.9 2.6 2.6 3 5.2"/>',
  achat: '<path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20.5 8H6.2"/><circle cx="10" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>',
  cagnotte: '<path d="M19 9c0-2-2-4-6-4H9C6 5 4 7 4 10c0 2 1 3.5 2.5 4.3V18h3v-2h4v2h3v-3c1-.6 1.8-1.5 2.2-2.6H21V10h-1.5c-.1-.4-.3-.7-.5-1z"/><path d="M12 3v3"/>',
  pay: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
};
const hubIcon = k => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${HUB_ICONS[k]}</svg>`;
function hubBalances() {
  let owed = 0, owe = 0;
  for (const g of Object.values(groups)) { const b = groupBalances(g)[g.me] || 0; if (b > 0) owed += b; else owe -= b; }
  for (const x of Object.values(debts)) { if (x.kind === "credit") continue; const r = debtCalc(x).remaining; if (x.kind === "medoit") owed += r; else owe += r; }
  return { owed: Math.round(owed * 100) / 100, owe: Math.round(owe * 100) / 100 };
}
function hubActivity() {
  const ev = [];
  for (const [gid, g] of Object.entries(groups)) {
    const nm = id => (g.members.find(m => m.id === id) || { name: "?" }).name;
    for (const [eid, e] of Object.entries(liveExp(g))) {
      const at = e.updated || e.created || Date.parse(e.date) || 0;
      ev.push({ at, gid, ic: "group", t: e.kind === "transfer" ? `${nm(e.from)} a remboursé ${eur(e.amount)} à ${nm(e.to)}` : `${nm(e.paidBy)} a payé « ${e.label} » · ${eur(e.amount)}`, s: g.name });
    }
    for (const c of Object.values(g.comments || {})) if (c && !c.deleted && c.text) ev.push({ at: c.at, gid, ic: "comment", t: `${nm(c.by)} : ${c.text.length > 70 ? c.text.slice(0, 69) + "…" : c.text}`, s: g.name });
  }
  for (const d of DEALS) {
    for (const p of Object.values(d.parts || {})) ev.push({ at: p.at, did: d.id, ic: d.kind, t: `${p.name} participe${d.kind === "achat" ? ` · ${p.qty} place${p.qty > 1 ? "s" : ""}` : ` · ${dealMoney(p.amount, d.cur)}`}`, s: d.title });
    for (const c of Object.values(d.comments || {})) ev.push({ at: c.at, did: d.id, ic: "comment", t: `${c.name} : ${c.text.length > 70 ? c.text.slice(0, 69) + "…" : c.text}`, s: d.title });
  }
  return ev.filter(x => x.at).sort((a, b) => b.at - a.at).slice(0, 8);
}
function agoText(at) {
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 90) return "à l'instant"; if (s < 3600) return `il y a ${Math.round(s / 60)} min`; if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400); return d === 1 ? "hier" : d < 7 ? `il y a ${d} jours` : frDate(new Date(at).toISOString().slice(0, 10));
}
function renderAccueil() {
  if (openDeal) return renderDeal();
  const { owed, owe } = hubBalances(), net = Math.round((owed - owe) * 100) / 100;
  document.getElementById("periodLabel").textContent = "Entre amis";
  document.getElementById("resCap").textContent = net > 0.004 ? "Au total, on te doit" : net < -0.004 ? "Au total, tu dois" : "Tout le monde est quitte";
  const big = document.getElementById("resBig"); big.textContent = eur(Math.abs(net)); big.className = "big num " + (net > 0.004 ? "good" : net < -0.004 ? "bad" : "");
  document.getElementById("resPill").innerHTML = owed || owe ? `<span class="pill" style="background:rgba(255,255,255,.15);color:#fff">On te doit ${esc(eur(owed, true))} · tu dois ${esc(eur(owe, true))}</span>` : "";
  const soc = typeof socOn === "function" && socOn();
  let html = banner + `<div class="hub-acts">
    <button type="button" data-hub="group">${hubIcon("group")}<span>Nouveau groupe</span></button>
    <button type="button" data-hub="achat">${hubIcon("achat")}<span>Achat groupé</span></button>
    <button type="button" data-hub="cagnotte">${hubIcon("cagnotte")}<span>Cagnotte</span></button>
    <button type="button" data-hub="pay">${hubIcon("pay")}<span>Me faire payer</span></button></div>`;
  if (!soc) html += `<div class="card hub-intro"><h2>Partager sans compte bancaire connecté</h2><p class="hint" style="margin:0">Fais les comptes entre amis, organise des achats groupés et des cagnottes, et paie-toi de banque à banque : l'argent ne passe jamais par Bourselle. Connecte-toi avec Google ou Microsoft (Profil) pour inviter tes amis par lien.</p></div>`;
  // Achats groupés et cagnottes
  const ds = DEALS.slice().sort((a, b) => (a.status !== "open") - (b.status !== "open") || (b.updated || 0) - (a.updated || 0));
  html += `<div class="hub-sec"><span>Achats groupés et cagnottes</span>${ds.length ? `<small>${ds.filter(d => d.status === "open").length} en cours</small>` : ""}</div>`;
  html += ds.length ? `<div class="hub-deals">${ds.slice(0, 6).map(d => DEALUI.card(d, dealCtxBase())).join("")}</div>`
    : `<div class="card"><div class="empty" style="padding:6px">Organise un achat groupé (une meule de fromage, des places de concert, un abonnement à plusieurs…) ou une cagnotte (un cadeau, un week-end). Tes amis rejoignent par un simple lien, sans compte.</div></div>`;
  // Groupes
  const gl = Object.entries(groups).map(([id, g]) => ({ id, g, b: groupBalances(g)[g.me] || 0, n: Object.values(liveExp(g)).length })).sort((a, b) => Math.abs(b.b) - Math.abs(a.b));
  html += `<div class="hub-sec"><span>Mes groupes</span>${gl.length ? `<button class="linkbtn" id="hubGroups">Tout voir</button>` : ""}</div>`;
  html += gl.length ? `<div class="card hub-groups">${gl.slice(0, 5).map(x => `<button type="button" class="hub-g" data-g="${esc(x.id)}"><span class="hub-gi">${esc((x.g.name || "?").slice(0, 2))}</span><span class="hub-gt"><b>${esc(x.g.name)}</b><small>${x.g.members.length} personnes · ${x.n} dépense${x.n > 1 ? "s" : ""}</small></span>
      <span class="num hub-gb ${x.b > 0.004 ? "good" : x.b < -0.004 ? "bad" : ""}">${Math.abs(x.b) < 0.005 ? "Quitte" : (x.b > 0 ? "+" : "−") + esc(eur(Math.abs(x.b)))}</span></button>`).join("")}</div>`
    : `<div class="card"><div class="empty" style="padding:6px">Crée un groupe pour une colocation, un voyage ou un couple : chacun ajoute ses dépenses, Bourselle calcule qui doit combien à qui.</div></div>`;
  // Activité
  const act = hubActivity();
  if (act.length) html += `<div class="hub-sec"><span>Activité récente</span></div><div class="card hub-act">${act.map((e, i) => `<button type="button" class="hub-ev" data-ev="${i}"><span class="hub-ei ${e.ic}">${e.ic === "comment" ? "💬" : hubIcon(e.ic === "group" ? "group" : e.ic)}</span><span><span class="hub-et">${esc(e.t)}</span><small>${esc(e.s)} · ${esc(agoText(e.at))}</small></span></button>`).join("")}</div>`;
  // Budget
  const tt = totals(itemsOf(todayISO().slice(0, 4) * 1, todayISO().slice(5, 7) * 1));
  html += `<div class="hub-sec"><span>Mon budget</span></div><button type="button" class="card hub-bud" id="hubBud"><span><small>Ce mois-ci</small><b class="num ${tt.result >= 0 ? "good" : "bad"}">${tt.result >= 0 ? "+" : ""}${esc(eur(tt.result))}</b></span><span class="hint">Rentrées ${esc(eur(tt.rentree || 0, true))} · dépenses ${esc(eur(tt.depense || 0, true))}</span><span class="pm-chev">›</span></button>`;
  view.innerHTML = html;
  view.querySelectorAll("[data-hub]").forEach(b => b.onclick = () => ({ group: () => editGroup(null), achat: () => editDeal(null, "achat"), cagnotte: () => editDeal(null, "cagnotte"), pay: () => editPay() })[b.dataset.hub]());
  view.querySelectorAll("[data-deal]").forEach(b => b.onclick = () => showDeal(b.dataset.deal));
  view.querySelectorAll("[data-g]").forEach(b => b.onclick = () => { openGroup = b.dataset.g; switchTab("partage"); });
  { const b = document.getElementById("hubGroups"); if (b) b.onclick = () => { openGroup = null; switchTab("partage"); }; }
  view.querySelectorAll("[data-ev]").forEach(b => b.onclick = () => { const e = act[Number(b.dataset.ev)]; if (e.did) showDeal(e.did); else { openGroup = e.gid; switchTab("partage"); } });
  document.getElementById("hubBud").onclick = () => switchTab("mois");
}
// Menu du bouton + sur l'accueil
function showAddMenu() {
  const gl = Object.entries(groups);
  const row = (id, icon, label, sub) => `<button type="button" class="pm-row" id="${id}"><span class="pm-ic" aria-hidden="true">${icon}</span><span class="pm-t"><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span><span class="pm-chev" aria-hidden="true">›</span></button>`;
  const f = openForm(`<div class="f2 pm"><h3>Ajouter</h3><div class="pm-list">
    ${gl.length ? row("amExp", hubIcon("group"), "Une dépense de groupe", gl.length === 1 ? gl[0][1].name : `${gl.length} groupes`) : ""}
    ${row("amGroup", hubIcon("group"), "Un nouveau groupe", "Coloc, voyage, couple…")}
    ${row("amAchat", hubIcon("achat"), "Un achat groupé", "Places, minimum, date limite")}
    ${row("amCag", hubIcon("cagnotte"), "Une cagnotte", "Cadeau, week-end, pot commun")}
    ${row("amTx", hubIcon("pay"), "Une opération de mon budget", "Dépense, rentrée, épargne")}</div></div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Fermer";
  const go = (id, fn) => { const b = f.querySelector("#" + id); if (b) b.onclick = () => { closeForm(); setTimeout(fn, 250); }; };
  go("amExp", () => { if (gl.length === 1) editGroupExpense(gl[0][0], null); else { openGroup = null; switchTab("partage"); } });
  go("amGroup", () => editGroup(null)); go("amAchat", () => editDeal(null, "achat")); go("amCag", () => editDeal(null, "cagnotte")); go("amTx", () => openSheet(null));
}

// ---------- Un achat groupé / une cagnotte ----------
function dealCtxBase() {
  return { t: dealT(window.LANG === "en" ? "en" : "fr"), money: dealMoney, fdate: frDate, toast };
}
async function showDeal(id) {
  openDeal = id; dealState = { deal: DEALS.find(d => d.id === id) || null, pay: null };
  if (tab !== "accueil") switchTab("accueil"); else render();
  window.scrollTo(0, 0);
  try { const j = await socApi("/d/" + id); dealState = { deal: j.deal, pay: j.pay }; if (j.deal.you && j.deal.you.role !== "guest") dealPut(j.deal); if (openDeal === id) render(); }
  catch (e) { toast(e.message); if (!dealState.deal) { openDeal = null; render(); } }
}
function renderDeal() {
  const S = dealState || {}, d = S.deal;
  document.getElementById("periodLabel").textContent = d ? (d.kind === "achat" ? "Achat groupé" : "Cagnotte") : "…";
  document.getElementById("resCap").textContent = d ? d.title : "";
  const big = document.getElementById("resBig"); big.className = "big num";
  big.textContent = d ? (d.kind === "achat" ? `${d.stats.qty} / ${d.min}` : dealMoney(d.stats.sum, d.cur)) : "";
  document.getElementById("resPill").innerHTML = d ? `<span class="pill" style="background:rgba(255,255,255,.15);color:#fff">${esc(d.kind === "achat" ? "places réservées / minimum" : d.target ? "sur " + dealMoney(d.target, d.cur) : d.stats.n + " participants")}</span>` : "";
  view.innerHTML = banner + `<button class="btn" id="dBack" style="align-self:flex-start">‹ Accueil</button><div id="dealRoot">${d ? "" : `<div class="card"><div class="empty">Chargement…</div></div>`}</div>`;
  document.getElementById("dBack").onclick = () => { openDeal = null; dealState = null; render(); window.scrollTo(0, 0); };
  if (!d) return;
  const id = d.id, ctx = { ...dealCtxBase(),
    url: dealLink(id), share: (text, url) => shareText(text, url),
    call: (sub, body) => socApi("/d/" + id + "/" + sub, { method: "POST", body: JSON.stringify(body) }),
    getPhoto: pid => socApi("/d/" + id + "/photo?p=" + pid).then(j => j.data),
    onUpdate: r => { dealState = { deal: r.deal, pay: r.pay }; if (r.deal.you && r.deal.you.role !== "guest") dealPut(r.deal); else { DEALS = DEALS.filter(x => x.id !== id); dealsSave(); } render(); },
    edit: dd => editDeal(dd.id),
    needName: false,
  };
  DEALUI.render(document.getElementById("dealRoot"), S, ctx);
}
// Créer ou modifier
function editDeal(id, kind) {
  if (typeof socOn !== "function" || !socOn()) { toast("Connecte-toi avec Google ou Microsoft pour créer un achat groupé ou une cagnotte"); return; }
  const d = id ? (dealState && dealState.deal && dealState.deal.id === id ? dealState.deal : DEALS.find(x => x.id === id)) : null;
  kind = d ? d.kind : kind || "achat";
  let file = null;
  const num = v => v == null || v === "" || v === 0 ? "" : esc(String(v).replace(".", ","));
  const f = openForm(`<div class="f2"><h3>${d ? "Modifier" : kind === "achat" ? "Nouvel achat groupé" : "Nouvelle cagnotte"}</h3>
    ${fld("dlTitle", "Titre", `maxlength="80" placeholder="${kind === "achat" ? "ex. Meule de comté direct producteur" : "ex. Cadeau d'anniversaire de Léa"}" value="${esc(d ? d.title : "")}"`)}
    <label class="lbl" for="dlDesc">Description (facultatif)</label><textarea class="field" id="dlDesc" rows="3" maxlength="800" placeholder="${kind === "achat" ? "Ce qu'on achète, où, comment on récupère…" : "Pour qui, pourquoi, ce qu'on va offrir…"}">${esc(d ? d.desc : "")}</textarea>
    ${kind === "achat" ? `<div class="two"><div>${fld("dlPrice", `Prix par place (${esc(curSym())})`, `inputmode="decimal" placeholder="ex. 25" value="${num(d && d.price)}"`)}</div><div>${fld("dlMin", "Minimum de places", `inputmode="numeric" placeholder="ex. 4" value="${d ? d.min : ""}"`)}</div></div>
      ${fld("dlPlaces", "Nombre de places maximum (facultatif)", `inputmode="numeric" placeholder="illimité" value="${d && d.places ? d.places : ""}"`)}
      <p class="hint" style="margin:4px 0 0">Personne ne paie tant que le minimum n'est pas atteint. Ensuite, chacun te paie directement.</p>`
    : `<div class="two"><div>${fld("dlTarget", `Objectif (${esc(curSym())}, facultatif)`, `inputmode="decimal" placeholder="ex. 150" value="${num(d && d.target)}"`)}</div><div>${fld("dlSug", "Montant proposé (facultatif)", `inputmode="decimal" placeholder="ex. 20" value="${num(d && d.suggested)}"`)}</div></div>`}
    ${fld("dlDate", "Date limite (facultatif)", `type="date" value="${esc(d ? d.deadline || "" : "")}"`)}
    ${!d ? `<span class="lbl">Photo (facultatif)</span><label class="btn" style="display:inline-flex;gap:6px;align-items:center;cursor:pointer">📷 <span id="dlPhL">Ajouter une photo</span><input type="file" accept="image/*" id="dlPh" hidden></label>` : ""}
    ${!SOC.pay ? `<p class="hint" style="margin:10px 0 0">Pense à indiquer ton IBAN ou ton lien de paiement (Profil › Me faire payer) : les participants pourront te payer en un geste.</p>` : ""}</div>`, () => {
    const title = val("dlTitle").trim(); if (!title) { toast("Donne un titre"); return false; }
    const body = { title, desc: val("dlDesc"), deadline: val("dlDate") || "", cur: baseCurrency() };
    if (kind === "achat") {
      body.price = parseAmount(val("dlPrice")); body.min = parseInt(val("dlMin"), 10) || 1; body.places = parseInt(val("dlPlaces"), 10) || 0;
      if (!(body.price > 0)) { toast("Indique le prix par place"); return false; }
      if (body.places && body.min > body.places) { toast("Le minimum dépasse le nombre de places"); return false; }
    } else { body.target = parseAmount(val("dlTarget")) || 0; body.suggested = parseAmount(val("dlSug")) || 0; }
    (async () => {
      try {
        let r;
        if (d) r = await socApi("/d/" + d.id + "/owner", { method: "POST", body: JSON.stringify({ action: "edit", ...body }) });
        else {
          const u = store && store.user ? store.user() : {};
          r = await socApi("/deals", { method: "POST", body: JSON.stringify({ kind, ...body, ownerName: String(u.name || "").trim().split(/[\s@]/)[0] }) });
          if (file) { try { const data = await shrinkPhoto(file); r = await socApi("/d/" + r.deal.id + "/photo", { method: "POST", body: JSON.stringify({ data }) }); } catch (e) { toast(e.message); } }
        }
        dealPut(r.deal); openDeal = r.deal.id; dealState = { deal: r.deal, pay: r.pay || SOC.pay || null };
        if (tab !== "accueil") switchTab("accueil"); else render();
        toast(d ? "Modifié" : kind === "achat" ? "Achat groupé créé : invite tes amis !" : "Cagnotte créée : invite tes amis !");
        if (!d) showDeal(r.deal.id);
      } catch (e) { toast(e.message); }
    })();
  });
  const ph = f.querySelector("#dlPh"); if (ph) ph.onchange = () => { file = ph.files && ph.files[0]; if (file) f.querySelector("#dlPhL").textContent = file.name.slice(0, 24); };
}
