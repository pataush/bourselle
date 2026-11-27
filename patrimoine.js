/* Bourselle — patrimoine.
 * Patrimoine net = ce que tu possèdes (soldes des comptes, biens, ce qu'on te doit) − ce que tu dois (crédits, dettes).
 * Les biens (logement, voiture, placements, objets de valeur…) gardent l'historique de leur valeur ;
 * le patrimoine net de chaque mois est noté pour suivre son évolution. */
const ASSET_TYPES = [["immobilier", "Immobilier"], ["vehicule", "Véhicule"], ["placements", "Placements"], ["objets", "Objets de valeur"], ["autre", "Autre"]];
const ASSET_COLORS = { immobilier: "#1f6b4b", vehicule: "#3f8f68", placements: "#a8873a", objets: "#8a6d3b", autre: "#6f7b74", comptes: "#d9b765", creances: "#9cc7b0" };
const ASSET_ICONS = {
  immobilier: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  vehicule: '<path d="M5 17h14M3 13l2-5c.4-1 1.2-1.5 2.2-1.5h9.6c1 0 1.8.5 2.2 1.5l2 5v4H3z"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/>',
  placements: '<path d="M4 19h16"/><path d="M6 15l4-4 3 3 5-6"/><path d="M15 8h3v3"/>',
  objets: '<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3l3 18M15 3l-3 18"/>',
  autre: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/>',
  credit: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
};
const assetIcon = t => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ASSET_ICONS[t] || ASSET_ICONS.autre}</svg>`;
const VEH_DECOTE = 0.15;   // perte de valeur par an d'un véhicule (estimation)

function ensurePatri() {
  if (!patri || typeof patri !== "object") patri = {};
  if (!patri.items || typeof patri.items !== "object") patri.items = {};
  if (!patri.hist || typeof patri.hist !== "object") patri.hist = {};
}
// Valeur d'un bien à une date (la dernière valeur indiquée ; décote annuelle pour un véhicule si demandée)
function assetValue(a, day) {
  day = day || todayISO();
  const h = (a.hist || []).filter(p => p.d <= day).sort((x, y) => x.d.localeCompare(y.d));
  const last = h.length ? h[h.length - 1] : (a.hist || [])[0];
  if (!last) return 0;
  let v = Number(last.v) || 0;
  if (a.type === "vehicule" && a.decote) {
    const yrs = Math.max(0, (new Date(day + "T12:00:00") - new Date(last.d + "T12:00:00")) / 31557600000);
    v = v * Math.pow(1 - VEH_DECOTE, yrs);
  }
  return Math.round(v * 100) / 100;
}
const assetList = () => { ensurePatri(); return Object.entries(patri.items).map(([id, a]) => ({ ...a, id })).filter(a => !a.sold).sort((a, b) => assetValue(b) - assetValue(a)); };

// Bilan complet à aujourd'hui
function patriCalc() {
  ensurePatri();
  const day = todayISO();
  const accs = (typeof accList === "function" ? accList() : []).map(a => ({ ...a, bal: accBalanceAt(a.id, day) })).filter(a => a.bal != null);
  const items = assetList().map(a => ({ ...a, val: assetValue(a, day) }));
  const dl = Object.entries(debts).map(([id, x]) => ({ ...x, id, c: debtCalc(x) })).filter(x => !x.c.done && x.c.remaining > 0);
  const creances = dl.filter(x => x.kind === "medoit");
  const passifs = dl.filter(x => x.kind !== "medoit");
  const byType = { comptes: accs.reduce((s, a) => s + a.bal, 0), creances: creances.reduce((s, x) => s + x.c.remaining, 0) };
  for (const a of items) byType[a.type] = (byType[a.type] || 0) + a.val;
  const actif = Object.values(byType).reduce((s, v) => s + v, 0);
  const passif = passifs.reduce((s, x) => s + x.c.remaining, 0);
  const r = v => Math.round(v * 100) / 100;
  return { accs, items, creances, passifs, byType, actif: r(actif), passif: r(passif), net: r(actif - passif) };
}
const patriHasData = () => { ensurePatri(); return accHasBalance() || assetList().length > 0 || Object.values(debts).some(x => !debtCalc(x).done); };

// Note le patrimoine net du mois en cours (une valeur par mois, la dernière connue)
function patriRecord(net) {
  ensurePatri();
  const k = todayISO().slice(0, 7);
  if (patri.hist[k] === net) return;
  patri.hist[k] = net; scheduleSave();
}

// Petite courbe d'évolution (12 derniers mois notés)
function patriChart() {
  const pts = Object.entries(patri.hist).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  if (pts.length < 2) return `<p class="hint" style="margin:0">La courbe apparaîtra dès le mois prochain : Bourselle note ton patrimoine net chaque mois.</p>`;
  const W = 320, H = 110, P = 8, vs = pts.map(p => p[1]), mn = Math.min(...vs, 0), mx = Math.max(...vs), span = mx - mn || 1;
  const x = i => P + i * (W - 2 * P) / (pts.length - 1), y = v => H - 18 - (v - mn) / span * (H - 30);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
  const area = line + `L${x(pts.length - 1).toFixed(1)},${H - 18}L${x(0).toFixed(1)},${H - 18}Z`;
  const mlab = k => { const [yy, mm] = k.split("-").map(Number); return new Date(yy, mm - 1, 1).toLocaleDateString(window.LANG === "en" ? "en-GB" : "fr-FR", { month: "short" }); };
  const d = vs[vs.length - 1] - vs[0];
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Évolution du patrimoine net" style="display:block">
    <path d="${area}" fill="color-mix(in srgb, var(--accent) 14%, transparent)"/>
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p[1]).toFixed(1)}" r="2.6" fill="var(--accent)"/>`).join("")}
    <text x="${x(0)}" y="${H - 3}" font-size="10" fill="var(--muted)">${esc(mlab(pts[0][0]))}</text>
    <text x="${x(pts.length - 1)}" y="${H - 3}" font-size="10" fill="var(--muted)" text-anchor="end">${esc(mlab(pts[pts.length - 1][0]))}</text></svg>
    <p class="hint" style="margin:6px 0 0">${d >= 0 ? "+" : "−"}${esc(eur(Math.abs(d)))} depuis ${esc(mlab(pts[0][0]))}</p>`;
}

const PATRI_LABELS = { comptes: "Comptes", creances: "On me doit" };
const patriLabel = k => PATRI_LABELS[k] || (ASSET_TYPES.find(t => t[0] === k) || [, "Autre"])[1];

function renderPatrimoine() {
  const p = patriCalc();
  patriRecord(p.net);
  document.getElementById("periodLabel").textContent = "Patrimoine";
  document.getElementById("resCap").textContent = "Ton patrimoine net";
  const big = document.getElementById("resBig"); big.textContent = eur(p.net); big.className = "big num";
  document.getElementById("resPill").innerHTML = `<span class="pill" style="background:rgba(255,255,255,.15);color:#fff">Tu possèdes ${esc(eur(p.actif, true))} · tu dois ${esc(eur(p.passif, true))}</span>`;
  let html = banner + `<div class="tiles" style="grid-template-columns:repeat(3,1fr)">
    <div class="tile"><div class="k"><span class="sw" style="background:${ASSET_COLORS.comptes}"></span>Comptes</div><div class="v num">${eur(p.byType.comptes, true)}</div></div>
    <div class="tile"><div class="k"><span class="sw" style="background:var(--gold)"></span>Biens</div><div class="v num">${eur(p.items.reduce((s, a) => s + a.val, 0), true)}</div></div>
    <div class="tile"><div class="k"><span class="sw" style="background:var(--bad)"></span>Dettes</div><div class="v num">${eur(p.passif, true)}</div></div></div>`;

  // Répartition de ce que tu possèdes
  const parts = Object.entries(p.byType).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const pos = parts.reduce((s, [, v]) => s + v, 0);
  if (pos > 0) html += `<div class="card"><h2>Répartition</h2>
    <div class="pa-bar">${parts.map(([k, v]) => `<i style="width:${(v / pos * 100).toFixed(2)}%;background:${ASSET_COLORS[k] || ASSET_COLORS.autre}" title="${esc(patriLabel(k))}"></i>`).join("")}</div>
    <div class="pa-leg">${parts.map(([k, v]) => `<span><span class="sw" style="background:${ASSET_COLORS[k] || ASSET_COLORS.autre}"></span>${esc(patriLabel(k))} <b class="num">${Math.round(v / pos * 100)} %</b></span>`).join("")}</div></div>`;

  html += `<div class="card"><h2>Évolution</h2>${patriChart()}</div>`;

  // Ce que tu possèdes
  const row = (attr, color, icon, title, sub, v, neg) => `<button class="acc-row" ${attr}><span class="acc-ic" style="color:${color};background:color-mix(in srgb, ${color} 14%, transparent)">${icon}</span>
    <span class="acc-t"><b>${esc(title)}</b>${sub ? `<small>${sub}</small>` : ""}</span><span class="num acc-v" style="color:${neg ? "var(--bad)" : "inherit"}">${esc(eur(v))}</span></button>`;
  html += `<div class="card"><h2>Ce que tu possèdes<button class="linkbtn" id="paAdd">+ Ajouter un bien</button></h2>`;
  if (!p.accs.length && !p.items.length && !p.creances.length) html += `<div class="empty">Rien pour l'instant.<br>Indique le solde de tes comptes et ajoute tes biens : logement, voiture, placements…</div>`;
  for (const a of p.accs) html += row(`data-pacc="${esc(a.id)}"`, ACC_COLORS[a.type] || ACC_COLORS.autre, accIcon(a.type), a.name, esc((ACC_TYPES.find(x => x[0] === a.type) || [, ""])[1]), a.bal, a.bal < 0);
  for (const a of p.items) {
    const loan = a.loan && debts[a.loan] ? debtCalc(debts[a.loan]) : null;
    const sub = [esc(patriLabel(a.type)), a.type === "vehicule" && a.decote ? "décote auto" : "", loan && !loan.done ? `net de crédit ${esc(eur(a.val - loan.remaining, true))}` : ""].filter(Boolean).join(" · ");
    html += row(`data-asset="${esc(a.id)}"`, ASSET_COLORS[a.type] || ASSET_COLORS.autre, assetIcon(a.type), a.name, sub, a.val);
  }
  for (const x of p.creances) html += row(`data-pdebt="1"`, ASSET_COLORS.creances, accIcon("joint"), x.name || x.who || "On me doit", "On me doit" + (x.who ? " · " + esc(x.who) : ""), x.c.remaining);
  html += `<div class="acc-total"><span>Total</span><b class="num">${esc(eur(p.actif))}</b></div>`;
  if (!accHasBalance()) html += `<button class="btn" id="paAcc" style="margin-top:10px;width:100%">Indiquer le solde de mon compte</button>`;
  html += `</div>`;

  // Ce que tu dois
  html += `<div class="card"><h2>Ce que tu dois<button class="linkbtn" id="paDebt">+ Ajouter</button></h2>`;
  if (!p.passifs.length) html += `<div class="empty">Aucune dette en cours. Bravo !</div>`;
  for (const x of p.passifs) html += row(`data-pdebt="1"`, "var(--bad)", assetIcon(x.kind === "credit" ? "credit" : "autre"), x.name || x.who || "Dette", x.kind === "credit" ? "Crédit" + (x.monthly ? ` · ${esc(eur(x.monthly))}/mois` : "") : "Je dois" + (x.who ? " · " + esc(x.who) : ""), x.c.remaining, true);
  if (p.passifs.length) html += `<div class="acc-total"><span>Total</span><b class="num" style="color:var(--bad)">${esc(eur(p.passif))}</b></div>`;
  html += `</div><p class="hint" style="text-align:center;margin:4px 0 0">Le patrimoine net, c'est ce que tu possèdes moins ce que tu dois. Mets à jour la valeur de tes biens de temps en temps (une estimation suffit).</p>`;

  view.innerHTML = html;
  const on = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
  on("paAdd", () => editAsset(null));
  on("paDebt", () => editDebt(null));
  on("paAcc", () => editAccount(settings.defaultAcc || (ensureAccounts(), settings.defaultAcc)));
  view.querySelectorAll("[data-asset]").forEach(b => b.onclick = () => editAsset(b.dataset.asset));
  view.querySelectorAll("[data-pacc]").forEach(b => b.onclick = () => editAccount(b.dataset.pacc));
  view.querySelectorAll("[data-pdebt]").forEach(b => b.onclick = () => switchTab("dettes"));
}

// Ligne « Patrimoine net » sur l'accueil (version complète, dès qu'il y a quelque chose à compter)
function patriHomeHTML() {
  if (!featOn("patrimoine") || !patriHasData()) return "";
  const p = patriCalc();
  return `<button class="card pa-home" id="paHome" style="text-align:left;width:100%;cursor:pointer"><span class="hint">Patrimoine net</span><b class="num">${esc(eur(p.net))}</b><span class="pm-chev" aria-hidden="true">›</span></button>`;
}
function patriBindHome() { const b = document.getElementById("paHome"); if (b) b.onclick = () => switchTab("patrimoine"); }

// ---------- Ajouter / modifier un bien ----------
function editAsset(id) {
  ensurePatri();
  const a = id ? clone(patri.items[id]) : { name: "", type: "immobilier", hist: [] };
  let type = a.type || "immobilier";
  const cur0 = id ? assetValue(a) : null;
  const credits = Object.entries(debts).filter(([, x]) => x.kind === "credit" && !debtCalc(x).done);
  const hist = (a.hist || []).slice().sort((x, y) => y.d.localeCompare(x.d));
  const f = openForm(`<div class="f2"><h3>${id ? "Modifier le bien" : "Nouveau bien"}</h3>
    ${fld("asName", "Nom", `placeholder="ex. Appartement, Clio, Assurance-vie, Montre" value="${esc(a.name || "")}"`)}
    <span class="lbl">Type</span><div class="chips" id="asType"></div>
    ${fld("asVal", `Valeur estimée aujourd'hui (${esc(curSym())})`, `inputmode="decimal" placeholder="ex. 180 000" value="${cur0 == null ? "" : esc(String(cur0).replace(".", ","))}"`)}
    <p class="hint" style="margin:4px 0 0">Ce que tu pourrais en tirer si tu le vendais. Une estimation suffit ; tu la mettras à jour quand tu veux.</p>
    <div id="asVeh"><label class="toggle" for="asDec" style="margin-top:12px"><span>Décote automatique (≈ 15 % par an)</span><input type="checkbox" id="asDec" ${a.decote ? "checked" : ""}></label></div>
    ${credits.length ? `<label class="lbl" for="asLoan">Crédit associé</label><select id="asLoan"><option value="">— aucun —</option>${credits.map(([k, x]) => `<option value="${esc(k)}" ${a.loan === k ? "selected" : ""}>${esc(x.name || "Crédit")}</option>`).join("")}</select>
      <p class="hint" style="margin:4px 0 0">Pour voir la valeur du bien une fois le crédit déduit. Le crédit reste compté une seule fois dans tes dettes.</p>` : ""}
    ${id ? `<label class="toggle" for="asSold" style="margin-top:12px"><span>Bien vendu (le retirer du patrimoine)</span><input type="checkbox" id="asSold"></label>` : ""}
    ${hist.length > 1 ? `<span class="lbl">Historique de la valeur</span>${hist.slice(0, 5).map(p => `<div class="pay"><span>${esc(frDate(p.d))}</span><span class="num">${esc(eur(p.v))}</span></div>`).join("")}` : ""}</div>`, () => {
    const name = val("asName").trim(); if (!name) { toast("Donne un nom au bien"); return false; }
    const v = parseAmount(val("asVal").replace(/\s/g, ""));
    if (!(v != null && isFinite(v) && v >= 0)) { toast("Indique une valeur valide"); return false; }
    const key = id || "as" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const o = { ...(patri.items[key] || { created: Date.now(), hist: [] }), name: name.slice(0, 40), type };
    o.hist = (o.hist || []).slice();
    if (cur0 == null || Math.abs(v - cur0) > 0.004) { const d = todayISO(); o.hist = o.hist.filter(p => p.d !== d).concat([{ d, v: Math.round(v * 100) / 100 }]); }
    o.decote = type === "vehicule" && document.getElementById("asDec").checked;
    const ln = document.getElementById("asLoan"); if (ln) { if (ln.value) o.loan = ln.value; else delete o.loan; }
    const sold = document.getElementById("asSold"); if (sold && sold.checked) o.sold = todayISO();
    patri.items[key] = o; scheduleSave(); render(); toast(o.sold ? "Bien retiré" : id ? "Bien modifié" : "Bien ajouté");
  }, id ? () => { delete patri.items[id]; scheduleSave(); render(); toast("Bien supprimé"); } : null);
  const sync = () => { f.querySelector("#asVeh").hidden = type !== "vehicule"; };
  chipsPick("asType", ASSET_TYPES, type, v => { type = v; sync(); });
  sync();
}
