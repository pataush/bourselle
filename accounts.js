/* Bourselle — comptes et soldes.
 * Chaque opération appartient à un compte (par défaut le compte principal). L'utilisateur indique une fois le solde
 * actuel d'un compte ; ensuite chaque opération le fait bouger. Épargne et investissement peuvent aller « vers » un autre compte. */
const ACC_TYPES = [["courant", "Compte courant"], ["epargne", "Épargne"], ["especes", "Espèces"], ["joint", "Compte joint"], ["autre", "Autre"]];
const ACC_COLORS = { courant: "#1f6b4b", epargne: "#c9a24a", especes: "#8a6d3b", joint: "#3f8f68", autre: "#6f7b74" };
const ACC_ICONS = {
  courant: '<path d="M3 7h18v12H3z"/><path d="M3 11h18M7 15h3"/>',
  epargne: '<path d="M19 9c0-2-2-4-6-4H9C6 5 4 7 4 10c0 2 1 3.5 2.5 4.3V18h3v-2h4v2h3v-3c1-.6 1.8-1.5 2.2-2.6H21V10h-1.5c-.1-.4-.3-.7-.5-1z"/><path d="M8 9h.01"/>',
  especes: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  joint: '<circle cx="9" cy="8" r="3"/><circle cx="16" cy="9" r="2.5"/><path d="M3 19c.8-3 3.2-5 6-5s5.2 2 6 5M14.5 14.2c2.3.1 4.6 1.7 5.5 4.8"/>',
  autre: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/>',
};
const accIcon = t => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ACC_ICONS[t] || ACC_ICONS.autre}</svg>`;

// Le compte principal existe toujours (créé à la volée, enregistré seulement quand on le modifie)
function ensureAccounts() {
  if (!accounts || typeof accounts !== "object") accounts = {};
  if (!Object.keys(accounts).length) accounts.acc1 = { name: "Compte courant", type: "courant", created: Date.now() };
  if (!settings.defaultAcc || !accounts[settings.defaultAcc]) settings.defaultAcc = Object.keys(accounts)[0];
}
const accList = (all) => { ensureAccounts(); return Object.entries(accounts).map(([id, a]) => ({ ...a, id })).filter(a => all || !a.archived).sort((a, b) => (b.id === settings.defaultAcc) - (a.id === settings.defaultAcc) || (a.created || 0) - (b.created || 0)); };
const txAcc = t => (t.acc && accounts[t.acc]) ? t.acc : (ensureAccounts(), settings.defaultAcc);
const accHasBalance = () => accList().some(a => a.anchor);

// Effet d'une opération sur un compte
function accEffect(t, id) {
  const a = Number(t.amount) || 0; let e = 0;
  if (txAcc(t) === id) e += t.type === "rentree" ? a : -a;
  if ((t.type === "epargne" || t.type === "invest") && t.accTo === id && accounts[id]) e += a;
  return e;
}
// Solde d'un compte à la fin d'une date (les opérations du jour comptent). null si le solde n'a jamais été indiqué.
function accBalanceAt(id, day) {
  const acc = accounts[id]; if (!acc || !acc.anchor) return null;
  const an = acc.anchor; let bal = Number(an.amount) || 0;
  const after = t => t.date > an.date || (t.date === an.date && (t.created || 0) >= (an.at || 0));   // passée après l'indication du solde
  for (const t of allItems()) {
    const e = accEffect(t, id); if (!e) continue;
    if (day >= an.date) { if (after(t) && t.date <= day) bal += e; }
    else if (t.date > day && !after(t)) bal -= e;   // pour une date passée : on retire ce qui est arrivé depuis
  }
  return Math.round(bal * 100) / 100;
}
function accTotalAt(day) { let s = 0, any = false; for (const a of accList()) { const b = accBalanceAt(a.id, day); if (b != null) { s += b; any = true; } } return any ? Math.round(s * 100) / 100 : null; }
// Jour de référence pour le mois affiché : aujourd'hui pour le mois en cours, sinon le dernier jour du mois
function accRefDay() {
  const t = todayISO(), key = ym(cur.y, cur.m);
  if (t.slice(0, 7) === key) return t;
  const last = new Date(Date.UTC(cur.y, cur.m, 0)).toISOString().slice(0, 10);
  return last < t ? last : t;
}

// ---------- Carte « Mes comptes » (accueil et profil) ----------
function accCardHTML(compact) {
  const day = accRefDay(), list = accList(), total = accTotalAt(day);
  if (!accHasBalance()) return `<button class="card acc-cta" id="accSetup" style="text-align:left;width:100%;cursor:pointer">
    <h2>Combien as-tu vraiment ?</h2><p class="hint" style="margin:0">Indique le solde de ton compte : Bourselle le tiendra à jour à chaque opération.</p>
    <span class="btn primary" style="margin-top:10px;display:inline-block">Indiquer mon solde</span></button>`;
  return `<div class="card"><h2>Mes comptes<button class="linkbtn" id="accManage">${compact ? "Gérer" : "+ Ajouter un compte"}</button></h2>
    ${list.map(a => { const b = accBalanceAt(a.id, day); return `<button class="acc-row" data-acc="${esc(a.id)}"><span class="acc-ic" style="color:${ACC_COLORS[a.type] || ACC_COLORS.autre};background:color-mix(in srgb, ${ACC_COLORS[a.type] || ACC_COLORS.autre} 14%, transparent)">${accIcon(a.type)}</span>
      <span class="acc-t"><b>${esc(a.name)}</b><small>${esc((ACC_TYPES.find(x => x[0] === a.type) || [, ""])[1])}${a.id === settings.defaultAcc ? " · principal" : ""}</small></span>
      <span class="num acc-v" style="color:${b != null && b < 0 ? "var(--bad)" : "inherit"}">${b == null ? `<span class="hint">solde à indiquer</span>` : esc(eur(b))}</span></button>`; }).join("")}
    <div class="acc-total"><span>Total</span><b class="num">${esc(eur(total || 0))}</b></div></div>`;
}
function accBindCard() {
  const s = document.getElementById("accSetup"); if (s) s.onclick = () => editAccount(settings.defaultAcc || (ensureAccounts(), settings.defaultAcc));
  const m = document.getElementById("accManage"); if (m) m.onclick = () => (tab === "reglages" ? editAccount(null) : switchTab("reglages"));
  document.querySelectorAll("[data-acc]").forEach(b => b.onclick = () => editAccount(b.dataset.acc));
}

// ---------- Ajouter / modifier un compte ----------
function editAccount(id) {
  ensureAccounts();
  const a = id ? { ...accounts[id] } : { name: "", type: "epargne" }, cur0 = id ? accBalanceAt(id, todayISO()) : null;
  let type = a.type || "courant";
  const usedBy = id ? allItems().filter(t => txAcc(t) === id || t.accTo === id).length : 0;
  const f = openForm(`<div class="f2"><h3>${id ? "Modifier le compte" : "Nouveau compte"}</h3>
    ${fld("acName", "Nom", `placeholder="ex. Compte courant BNP, Livret A, Espèces" value="${esc(a.name || "")}"`)}
    <span class="lbl">Type</span><div class="chips" id="acType"></div>
    ${fld("acBal", `Solde actuel (${esc(curSym())})`, `inputmode="decimal" placeholder="ex. 1 250,00" value="${cur0 == null ? "" : esc(String(cur0).replace(".", ","))}"`)}
    <p class="hint" style="margin:4px 0 0">Ce que tu as sur ce compte aujourd'hui. Ensuite, chaque opération le met à jour ; tu peux le corriger ici à tout moment.</p>
    ${id && id !== settings.defaultAcc ? `<label class="toggle" for="acMain" style="margin-top:12px"><span>Compte principal (choisi par défaut)</span><input type="checkbox" id="acMain"></label>` : ""}
    ${id ? `<label class="toggle" for="acArch" style="margin-top:8px"><span>Compte clôturé (masqué)</span><input type="checkbox" id="acArch" ${a.archived ? "checked" : ""}></label>` : ""}
    ${usedBy ? `<p class="hint">${usedBy} opération${usedBy > 1 ? "s" : ""} sur ce compte.</p>` : ""}</div>`, () => {
    const name = val("acName").trim(); if (!name) { toast("Donne un nom au compte"); return false; }
    const raw = val("acBal").trim(), bal = raw === "" ? null : parseAmount(raw.replace(/\s/g, ""));
    if (raw !== "" && !(bal != null && isFinite(bal))) { toast("Indique un solde valide"); return false; }
    const key = id || "acc" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const o = { ...(accounts[key] || { created: Date.now() }), name: name.slice(0, 40), type };
    if (bal != null && bal !== cur0) o.anchor = { amount: bal, date: todayISO(), at: Date.now() };
    const arch = document.getElementById("acArch"); if (arch) o.archived = arch.checked && key !== settings.defaultAcc;
    accounts[key] = o;
    const mn = document.getElementById("acMain"); if (mn && mn.checked) settings.defaultAcc = key;
    saveSettings(); render(); toast(id ? "Compte modifié" : "Compte ajouté");
  }, id && Object.keys(accounts).length > 1 && id !== settings.defaultAcc ? () => {
    for (const t of allItems()) {   // les opérations repassent sur le compte principal
      if (t.acc === id || t.accTo === id) { const it = months[t.key].items[t.id]; if (it.acc === id) delete it.acc; if (it.accTo === id) delete it.accTo; saveMonth(t.key); }
    }
    delete accounts[id]; saveSettings(); render(); toast("Compte supprimé");
  } : null);
  chipsPick("acType", ACC_TYPES, type, v => type = v);
}

// ---------- Formulaire d'opération : choix du compte ----------
function accFormDraw() {
  const wrap = document.getElementById("accWrap"); if (!wrap || !form) return;
  const list = accList();
  if (form.acc && !list.some(a => a.id === form.acc) && accounts[form.acc]) list.push({ ...accounts[form.acc], id: form.acc });
  const multi = list.length > 1, toOk = form.type === "epargne" || form.type === "invest";
  wrap.hidden = !multi;
  if (!multi) return;
  const sel = document.getElementById("fAcc"), to = document.getElementById("fAccTo");
  sel.innerHTML = list.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("");
  sel.value = txAcc(form);
  document.getElementById("accLbl").textContent = form.type === "rentree" ? "Sur le compte" : "Depuis le compte";
  document.getElementById("accToWrap").hidden = !toOk;
  if (toOk) {
    to.innerHTML = `<option value="">— aucun —</option>` + list.filter(a => a.id !== sel.value).map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("");
    to.value = form.accTo && form.accTo !== sel.value ? form.accTo : "";
  }
  sel.onchange = () => { form.acc = sel.value; accFormDraw(); };
  to.onchange = () => { form.accTo = to.value; };
}
function accFormApply(tx) {
  const sel = document.getElementById("fAcc"), wrap = document.getElementById("accWrap");
  if (!wrap || wrap.hidden) { if (form.acc && accounts[form.acc]) tx.acc = form.acc; else delete tx.acc; if (form.accTo) tx.accTo = form.accTo; return; }
  if (sel.value && sel.value !== settings.defaultAcc) tx.acc = sel.value; else delete tx.acc;
  const to = document.getElementById("fAccTo");
  if ((tx.type === "epargne" || tx.type === "invest") && to && to.value && to.value !== sel.value) tx.accTo = to.value; else delete tx.accTo;
}
