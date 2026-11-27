/* Bourselle — premier lancement : 4 écrans pour partir avec un budget qui te ressemble.
 * 1. Ton prénom et ta devise.
 * 2. Tes revenus du mois et tes grosses charges fixes : on en déduit un budget par catégorie (au lieu d'un budget type).
 * 3. Comment on te paie (Mobile Money, IBAN, Wero, PayPal…) : pour que tes proches puissent te rembourser en un geste.
 * 4. Inviter un premier proche.
 * On peut passer chaque écran ; tout se modifie ensuite dans Paramètres. Ne s'affiche qu'une fois, et seulement à un compte vide. */
let OB = null;
function obIsEmpty() {
  try {
    if (allItems().length) return false;
    for (const o of [subs, debts, goals, recs, groups]) if (o && Object.keys(o).length) return false;
  } catch (e) { return false; }
  return true;
}
function obMaybe() {
  if (!settings || settings.obDone) return;
  let test = false; try { test = navigator.webdriver && localStorage.getItem("bourselle-test-ob") !== "1"; } catch (e) {}
  if (test) return;
  if (!obIsEmpty()) { settings.obDone = 1; return; }   // compte déjà utilisé : rien à proposer
  obOpen();
}
const obNum = v => { const n = parseFloat(String(v || "").replace(/\s/g, "").replace(",", ".")); return isFinite(n) && n > 0 ? n : 0; };
// Budget à partir des revenus : les fixes déclarés, puis ce qui reste (moins 15 % d'épargne) réparti comme un foyer type.
function obBudget(inc, loyer, credits, factures) {
  const step = inc >= 100000 ? 500 : inc >= 10000 ? 50 : 5, r = v => Math.max(0, Math.round(v / step) * step);
  const fix = loyer + credits + factures, free = Math.max(0, inc - fix), epargne = r(free * 0.15), vivre = Math.max(0, free - epargne);
  const vars = DEFAULT_SETTINGS.cats.filter(c => !c.fixe), W = vars.reduce((a, c) => a + c.budget, 0);
  const out = { logement: r(loyer), credits: r(credits), energie: r(factures * 120 / 260), telecom: r(factures * 60 / 260), assurances: r(factures * 80 / 260), impots: 0 };
  for (const c of vars) out[c.id] = inc ? r(vivre * c.budget / W) : 0;
  return { cats: out, fix, free, epargne, vivre };
}
function obOpen() {
  const u = store && store.user ? store.user() : {}, nm = store && store.id === "local" ? "" : String((u && u.name) || "").trim().split(/[\s@]/)[0];
  OB = { step: 0, name: settings.firstName || (nm ? nm.charAt(0).toUpperCase() + nm.slice(1) : ""), cur: settings.currency || regionCurrency(), inc: "", loyer: "", credits: "", factures: "" };
  let el = document.getElementById("obRoot");
  if (!el) { el = document.createElement("div"); el.id = "obRoot"; el.className = "ob"; document.body.appendChild(el); }
  el.hidden = false; document.documentElement.classList.add("ob-on");
  if (typeof statHit === "function") setTimeout(() => statHit("nouveau"), 2500);
  obDraw();
}
function obSteps() { return typeof socOn === "function" && socOn() ? ["me", "money", "pay", "invite"] : ["me", "money"]; }
function obSaveStep() {
  const el = document.getElementById("obRoot"), v = id => { const i = el.querySelector("#" + id); return i ? i.value : ""; };
  const k = obSteps()[OB.step];
  if (k === "me") { OB.name = v("obName").trim(); OB.cur = v("obCur") || OB.cur; }
  if (k === "money") for (const f of ["inc", "loyer", "credits", "factures"]) OB[f] = v("ob_" + f);
}
function obApplyMoney() {
  settings.firstName = OB.name.slice(0, 30);
  if (OB.cur && OB.cur !== settings.currency) { settings.currency = OB.cur; applyCurrency(); }
  const inc = obNum(OB.inc), b = obBudget(inc, obNum(OB.loyer), obNum(OB.credits), obNum(OB.factures));
  for (const c of settings.cats) if (c.id in b.cats) c.budget = b.cats[c.id];
  if (inc) settings.income = inc;
}
function obPreview() {
  const inc = obNum(OB.inc); if (!inc) return `<p class="hint ob-prev">Sans revenus indiqués, on part de zéro : tu fixeras tes budgets toi-même.</p>`;
  const b = obBudget(inc, obNum(OB.loyer), obNum(OB.credits), obNum(OB.factures));
  if (b.fix >= inc) return `<p class="hint ob-prev warn">Tes charges fixes dépassent tes revenus : on ne prévoit pas de budget pour le reste.</p>`;
  return `<div class="ob-prev"><div><small>Charges fixes</small><b class="num">${esc(fmtCur(b.fix, OB.cur))}</b></div><div><small>Pour vivre</small><b class="num">${esc(fmtCur(b.vivre, OB.cur))}</b></div><div><small>À mettre de côté</small><b class="num">${esc(fmtCur(b.epargne, OB.cur))}</b></div></div>`;
}
function obDraw() {
  const el = document.getElementById("obRoot"), S = obSteps(), k = S[OB.step], last = OB.step === S.length - 1;
  const dots = S.map((_, i) => `<i class="${i === OB.step ? "on" : i < OB.step ? "done" : ""}"></i>`).join("");
  const money = (id, lb, ph) => `<label class="lbl" for="ob_${id}">${esc(lb)}</label><div class="ob-amt"><input class="field num" id="ob_${id}" inputmode="decimal" placeholder="${esc(ph)}" value="${esc(OB[id])}" autocomplete="off"><span>${esc(curSymOf(OB.cur))}</span></div>`;
  let body = "";
  if (k === "me") body = `<div class="ob-ic">👋</div><h2>Bienvenue sur Bourselle</h2><p class="ob-sub">Ton argent et celui que tu partages avec tes proches, au même endroit. On commence par faire connaissance.</p>
    <label class="lbl" for="obName">Ton prénom</label><input class="field" id="obName" value="${esc(OB.name)}" maxlength="30" autocomplete="given-name" placeholder="Prénom">
    <label class="lbl" for="obCur">Ta devise</label><select class="field" id="obCur">${APP_CURRENCIES.map(([c, l]) => `<option value="${c}"${c === OB.cur ? " selected" : ""}>${esc(c)} · ${esc(l)}</option>`).join("")}</select>`;
  if (k === "money") body = `<div class="ob-ic">💶</div><h2>Ton mois en 4 chiffres</h2><p class="ob-sub">À peu près, ça suffit. On en déduit un budget pour chaque catégorie, que tu pourras ajuster.</p>
    ${money("inc", "Ce que tu gagnes par mois (net)", "ex. 1 800")}${money("loyer", "Loyer ou crédit immobilier", "0")}${money("credits", "Autres crédits", "0")}${money("factures", "Factures fixes (énergie, téléphone, assurances)", "0")}
    <div id="obPrev">${obPreview()}</div>`;
  if (k === "pay") { const p = (typeof SOC !== "undefined" && SOC.pay) || {};
    body = `<div class="ob-ic">📲</div><h2>Comment on te paie ?</h2><p class="ob-sub">Quand un proche te doit de l'argent, il voit tout de suite comment te rembourser. Choisis un ou plusieurs moyens.</p>
    <div class="pm-tiles ob-pm">${(typeof PM_DEFS !== "undefined" ? PM_DEFS : []).map(d => `<button type="button" class="pm-tile${d.has(p) ? " on" : ""}" data-obpm="${d.id}"><span class="pm-ti">${d.ic}</span><b>${esc(d.label)}</b>${d.has(p) ? `<small>✓ ${esc(d.sum(p))}</small>` : ""}</button>`).join("")}</div>
    <p class="hint">Tes coordonnées ne sont montrées qu'aux personnes qui te doivent de l'argent.</p>`; }
  if (k === "invite") { const tag = (typeof SOC !== "undefined" && SOC.tag) || "";
    body = `<div class="ob-ic">🤝</div><h2>Invite un premier proche</h2><p class="ob-sub">Bourselle prend tout son sens à plusieurs : dépenses partagées, cagnottes, tontines, remboursements.</p>
    ${tag ? `<div class="ob-tag"><small>Ton tag</small><b>@${esc(tag)}</b></div>` : ""}
    <button type="button" class="btn primary ob-wide" id="obShare">Envoyer une invitation</button>
    <button type="button" class="btn ob-wide" id="obAdd">Ajouter par son @tag</button>`; }
  el.innerHTML = `<div class="ob-brand"><img src="icons/icon-192.png" alt=""><b>Bourselle</b><small>${OB.step + 1} / ${S.length}</small></div><div class="ob-card"><div class="ob-top"><div class="ob-dots">${dots}</div>${last ? "" : `<button type="button" class="linkbtn" id="obSkip">Passer</button>`}</div>
    <div class="ob-body">${body}</div>
    <div class="ob-nav">${OB.step ? `<button type="button" class="btn" id="obBack">Retour</button>` : "<span></span>"}<button type="button" class="btn primary" id="obNext">${last ? "C'est parti !" : "Suivant"}</button></div></div>`;
  const q = s => el.querySelector(s);
  if (k === "money") el.querySelectorAll(".ob-amt input").forEach(i => i.oninput = () => { obSaveStep(); q("#obPrev").innerHTML = obPreview(); });
  if (k === "me") q("#obCur").onchange = () => { OB.cur = q("#obCur").value; };
  el.querySelectorAll("[data-obpm]").forEach(b => b.onclick = () => payMethodEdit(b.dataset.obpm, () => obDraw()));
  if (q("#obShare")) q("#obShare").onclick = () => {
    const tag = (typeof SOC !== "undefined" && SOC.tag) || "", msg = `Rejoins-moi sur Bourselle pour partager nos dépenses simplement${tag ? ` : mon tag est @${tag}` : ""}.\n${appBase()}`;
    if (navigator.share) navigator.share({ text: msg }).catch(() => {}); else navigator.clipboard?.writeText(msg).then(() => toast("Invitation copiée")).catch(() => toast(msg));
  };
  if (q("#obAdd")) q("#obAdd").onclick = () => typeof favAddContact === "function" && favAddContact();
  if (q("#obBack")) q("#obBack").onclick = () => { obSaveStep(); OB.step--; obDraw(); };
  q("#obNext").onclick = () => { obSaveStep(); if (k === "money") obApplyMoney(); if (last) return obClose(true); OB.step++; obDraw(); };
  if (q("#obSkip")) q("#obSkip").onclick = () => { if (last) return; obSaveStep(); if (k === "me" || k === "money") obApplyMoney(); OB.step++; obDraw(); };
  const f = el.querySelector("input,select"); if (f && k === "me" && !OB.name) setTimeout(() => f.focus(), 50);
}
function obClose(done) {
  const el = document.getElementById("obRoot"); if (el) { el.hidden = true; el.innerHTML = ""; }
  document.documentElement.classList.remove("ob-on");
  if (done) { settings.obDone = 1; if (typeof statHit === "function") statHit("ob"); saveSettings(); render(); if (typeof funConfetti === "function") funConfetti(); toast(settings.firstName ? `C'est parti, ${settings.firstName} !` : "C'est parti !"); }
}
