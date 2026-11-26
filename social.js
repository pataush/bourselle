/* Bourselle — tags et réclamations de dettes entre utilisateurs.
 * Chaque utilisateur a un tag (@marie-7k2q) qu'il peut partager. Un utilisateur Plus peut réclamer une dette
 * à un tag : elle arrive dans l'app de l'autre, qui l'accepte ou la refuse, et les remboursements se suivent des deux côtés.
 * Passe par le serveur PLUS_CFG.api ; sans serveur configuré, rien de tout cela n'apparaît. */
const SOC = { tag: "", in: [], out: [], loaded: false, err: "", sig: "", reminders: [] };
const socOn = () => !!(typeof PLUS_CFG !== "undefined" && PLUS_CFG.api) && !!store && store.id !== "local" && typeof store.accessToken === "function";
async function socApi(path, opts = {}) {
  const t = await store.accessToken();
  const r = await fetch(PLUS_CFG.api.replace(/\/$/, "") + path, { ...opts, headers: { "content-type": "application/json", authorization: "Bearer " + t, "x-provider": store.id, ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || "Erreur " + r.status); e.status = r.status; throw e; }
  return j;
}
const socFind = cid => Object.entries(debts).find(([, d]) => d.claim === cid) || [];
const socMoney = (c) => (c.cur && c.cur !== baseCurrency() ? `${String(c.amount).replace(".", window.LANG === "en" ? "." : ",")} ${c.cur}` : eur(c.amount));

// Met les dettes liées à jour avec ce que l'autre a enregistré (remboursements, refus, annulation).
function socMerge() {
  let changed = false;
  const sync = (c, mine) => {
    const [id, d] = socFind(c.id); if (!d) return;
    if (d.claimStatus !== c.status) { d.claimStatus = c.status; changed = true; }
    for (const p of c.payments || []) {
      if (p.by === mine || p.pend || (d.payments || []).some(q => q.pid === p.id)) continue;   // « J'ai payé » pas encore confirmé : pas compté
      const amt = d.ccur && Number(d.xr) > 0 ? Math.round(p.amount / Number(d.xr) * 100) / 100 : p.amount;   // dette convertie dans ma devise
      d.payments = (d.payments || []).concat([{ date: p.date, amount: amt, pid: p.id }]); changed = true;
      toast(`@${mine === "from" ? c.to : c.from} : remboursement de ${socMoney({ ...c, amount: p.amount })} enregistré`);
    }
  };
  for (const c of SOC.out) sync(c, "from");
  for (const c of SOC.in) sync(c, "to");
  if (changed) saveDebts();
  return changed;
}
let socBusy = false, socSeen = new Set(JSON.parse(localStorage.getItem("bourselle-soc-seen") || "[]"));
// Rappels reçus (relances d'un groupe ou d'une cagnotte) : affichés dans la cloche, supprimables définitivement
async function socLoadReminders() {
  try {
    const j = await socApi("/me/reminders"); SOC.reminders = j.reminders || [];
    if (typeof alertsPrune === "function") alertsPrune();                       // réglés : effacés tout seuls
    // Nouveau rappel reçu : on le montre tout de suite (en plus de la notification sur le téléphone)
    let seen = []; try { seen = JSON.parse(localStorage.getItem("bourselle-rem-seen") || "[]"); } catch (e) {}
    const fresh = SOC.reminders.filter(r => !seen.includes(r.id) && !(typeof remResolved === "function" && remResolved(r)));
    if (fresh.length) {
      const r = fresh[0]; toast(fresh.length === 1 ? `🔔 ${r.from || "Rappel"} : ${r.msg || "merci de régler " + (typeof fmtCur === "function" ? fmtCur(r.amt, r.cur) : r.amt)}` : `🔔 ${fresh.length} nouveaux rappels : ouvre la cloche`);
      try { localStorage.setItem("bourselle-rem-seen", JSON.stringify(seen.concat(fresh.map(x => x.id)).slice(-200))); } catch (e) {}
    }
    if (typeof refreshBell === "function") refreshBell();
  } catch (e) {}
}
async function socDelReminder(id) {
  SOC.reminders = (SOC.reminders || []).filter(x => x.id !== id);
  try { const j = await socApi("/me/reminders", { method: "POST", body: JSON.stringify({ id }) }); SOC.reminders = j.reminders || []; } catch (e) {}
}
async function socRefresh() {
  if (!socOn() || socBusy) return; socBusy = true;
  try {
    const j = await socApi("/claims");
    SOC.tag = j.tag || SOC.tag; SOC.in = j.in || []; SOC.out = j.out || []; SOC.loaded = true; SOC.err = ""; SOC.quota = j.quota || SOC.quota;
    if (typeof driveRootName === "function") driveRootName(SOC.tag);
    const changed = socMerge();
    try { await socPullGroups(); await socPushGroups(); } catch (e) {}
    socLoadPay(); socLoadReminders();
    if (!SOC.addChecked) { SOC.addChecked = true; socPendingAdd(); if (typeof reqTakeFromUrl === "function") reqTakeFromUrl(); }
    socOpenPending(); pushResync(); if (typeof dealsRefresh === "function") dealsRefresh(); if (typeof projRefresh === "function") projRefresh();
    { const paid = (SOC.out || []).flatMap(c => (c.payments || []).filter(p => p.pend && !socSeen.has("pd:" + p.id)).map(p => ({ c, p })));
      if (paid.length) {
        const { c, p } = paid[0], who = c.to ? "@" + c.to : c.guest || "Quelqu'un";
        setTimeout(() => toast(paid.length === 1 ? `💸 ${who} dit t'avoir payé ${socMoney({ ...c, amount: p.amount })} : confirme dans la cloche` : `💸 ${paid.length} paiements à confirmer : ouvre la cloche`), 900);
        paid.forEach(x => socSeen.add("pd:" + x.p.id)); try { localStorage.setItem("bourselle-soc-seen", JSON.stringify([...socSeen].slice(-200))); } catch (e) {}
      } }
    const fresh = SOC.in.filter(c => c.status === "pending" && !socSeen.has(c.id));
    if (fresh.length) {
      toast(fresh.length === 1 ? `@${fresh[0].from} te réclame ${socMoney(fresh[0])}` : `${fresh.length} nouvelles réclamations de dettes`);
      fresh.forEach(c => socSeen.add(c.id)); try { localStorage.setItem("bourselle-soc-seen", JSON.stringify([...socSeen].slice(-200))); } catch (e) {}
    }
    const sig = JSON.stringify([SOC.tag, SOC.in.map(c => c.id + c.status), SOC.out.map(c => c.id + c.status)]);
    if (changed || sig !== SOC.sig) { SOC.sig = sig; if (tab === "dettes" || tab === "reglages") render(); }
  } catch (e) { SOC.err = e.message; } finally { socBusy = false; }
}
setInterval(() => { if (document.visibilityState === "visible") socRefresh(); }, 5 * 60 * 1000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") socRefresh(); });
{ const _applyData = applyData; applyData = function (d) { _applyData(d); SOC.in = []; SOC.out = []; SOC.tag = ""; SOC.loaded = false; setTimeout(socRefresh, 800); }; }

// ---------- Réglages : mon tag (dans « Mon compte ») et mes contacts ----------
function socTagInlineHTML() {
  if (!socOn()) return "";
  return `<div class="soc-tag-row"><span class="hint">Tag Bourselle</span> ${SOC.tag ? `<b class="num">@${esc(SOC.tag)}</b>` : `<span class="hint">${SOC.err ? esc(SOC.err) : "Chargement…"}</span>`}
    ${SOC.tag ? `<span class="soc-tag-btns"><button class="linkbtn" id="socCopy">Copier</button>${navigator.share ? `<button class="linkbtn" id="socShare">Partager</button>` : ""}<button class="linkbtn" id="socEdit">Changer</button><button class="linkbtn" id="socQr">QR code</button></span>` : ""}</div>`;
}
// QR code personnel : le scanner avec l'appareil photo ouvre Bourselle et propose d'ajouter ce tag aux contacts.
const socAddUrl = tag => location.origin + location.pathname.replace(/[^/]*$/, "") + "?add=" + encodeURIComponent(tag);
function socShowQr() {
  if (!SOC.tag || typeof QR === "undefined") return;
  const url = socAddUrl(SOC.tag);
  const f = openForm(`<div class="f2 soc-qr"><h3>Mon QR code Bourselle</h3>
    <div class="soc-qr-img">${QR.svg(url, { px: 7 })}</div>
    <div class="soc-qr-tag num">@${esc(SOC.tag)}</div>
    <p class="hint" style="text-align:center;margin:0">Fais scanner ce code avec l'appareil photo d'un téléphone : la personne t'ajoute à ses contacts Bourselle.</p>
    ${navigator.share ? `<button type="button" class="btn" id="socQrShare" style="align-self:center">Partager le lien</button>` : ""}</div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Fermer";
  const sh = f.querySelector("#socQrShare"); if (sh) sh.onclick = () => navigator.share({ title: "Bourselle", text: `Ajoute-moi sur Bourselle : @${SOC.tag}`, url }).catch(() => {});
}
// Scanner le QR code d'un proche (navigateurs qui savent lire les QR codes : Chrome sur Android, notamment)
function socScanQr() {
  const f = openForm(`<div class="f2"><h3>Scanner un QR code</h3><video id="socVid" playsinline muted style="width:100%;border-radius:14px;background:#000;aspect-ratio:1;object-fit:cover"></video>
    <p class="hint" id="socScanMsg" style="margin:6px 0 0">Vise le QR code Bourselle de la personne.</p></div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true;
  let stream = null, alive = true;
  const stop = () => { alive = false; if (stream) stream.getTracks().forEach(t => t.stop()); };
  f.querySelector("#f2Cancel").addEventListener("click", stop);
  document.getElementById("s2bg")?.addEventListener("click", stop, { once: true });
  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const v = document.getElementById("socVid"); v.srcObject = stream; await v.play();
      const det = new BarcodeDetector({ formats: ["qr_code"] });
      while (alive) {
        const codes = await det.detect(v).catch(() => []);
        const tag = codes.map(c => socTagFromText(c.rawValue)).find(Boolean);
        if (tag) { stop(); closeForm(); socOfferAdd(tag); return; }
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (e) { const m = document.getElementById("socScanMsg"); if (m) m.textContent = "Caméra indisponible. Scanne le code avec l'appareil photo de ton téléphone."; }
  })();
}
function socTagFromText(t) {
  try { const u = new URL(t); const a = u.searchParams.get("add"); if (a && /^[a-z0-9][a-z0-9_-]{2,23}$/.test(a)) return a; } catch (e) {}
  const m = /^@?([a-z0-9][a-z0-9_-]{2,23})$/.exec(String(t || "").trim().toLowerCase()); return m ? m[1] : "";
}
// Proposer d'ajouter un tag (après un scan, ou en ouvrant un lien « ?add= »)
async function socOfferAdd(tag) {
  if (!socOn()) return;
  if (tag === SOC.tag) { toast("C'est ton propre tag"); return; }
  if (socContacts().some(c => c.tag === tag)) { toast(`@${tag} est déjà dans tes contacts`); return; }
  let found = null;
  try { const j = await socApi("/search?q=" + encodeURIComponent(tag)); found = (j.users || []).find(u => u.tag === tag); } catch (e) {}
  if (!found) { toast(`Aucun utilisateur @${tag}`); return; }
  const f = openForm(`<div class="f2"><h3>Ajouter un contact</h3><p style="margin:0"><b>@${esc(tag)}</b>${found.name ? ` <span class="hint">${esc(found.name)}</span>` : ""}</p>
    <p class="hint">Tu pourras lui réclamer une dette directement dans l'app.</p></div>`, () => {
    settings.contacts = socContacts().concat([{ tag, name: found.name || "", added: todayISO() }]);
    saveSettings(); render(); toast(`@${tag} ajouté à tes contacts`);
  });
  f.querySelector("button[type=submit]").textContent = "Ajouter";
}
// Lien « ?add=tag » : on le garde jusqu'à la connexion
{
  const a = new URLSearchParams(location.search).get("add");
  if (a) { try { sessionStorage.setItem("bourselle-add", a.toLowerCase()); } catch (e) {} history.replaceState(null, "", location.pathname); }
}
function socPendingAdd() {
  let a = ""; try { a = sessionStorage.getItem("bourselle-add") || ""; sessionStorage.removeItem("bourselle-add"); } catch (e) {}
  if (a) setTimeout(() => socOfferAdd(a), 300);
}
const socContacts = () => (settings.contacts || []).filter(c => c && c.tag);
function socContactsDatalist() { return `<datalist id="socContactsList">${socContacts().map(c => `<option value="@${esc(c.tag)}">${esc(c.name || "")}</option>`).join("")}</datalist>`; }
function socContactsCardHTML() {
  if (!socOn()) return "";
  const list = socContacts();
  return `<div class="card"><h2>Mes contacts Bourselle${list.length ? `<small>${list.length}</small>` : ""}</h2>
    <label class="lbl" for="socSearch">Rechercher un utilisateur par son tag</label>
    <input class="field" id="socSearch" placeholder="@paul…" autocapitalize="off" spellcheck="false" autocomplete="off">
    <div id="socResults"></div>
    ${"BarcodeDetector" in window ? `<button class="btn" id="socScan" style="margin-top:8px">Scanner un QR code</button>`
      : `<p class="hint" style="margin:8px 0 0">Tu peux aussi scanner le QR code d'un proche avec l'appareil photo de ton téléphone.</p>`}
    ${list.length ? `<div class="soc-contacts">${list.map(c => `<div class="soc-contact"><div><b>@${esc(c.tag)}</b>${c.name ? ` <span class="hint">${esc(c.name)}</span>` : ""}</div>
      <div class="acts"><button class="btn" data-socclaim="${esc(c.tag)}">Réclamer une dette</button><button class="hbtn cat-del" data-socdel="${esc(c.tag)}" aria-label="Retirer @${esc(c.tag)}" title="Retirer">✕</button></div></div>`).join("")}</div>`
      : `<p class="hint" style="margin:8px 0 0">Ajoute tes proches pour leur réclamer une dette en deux clics.</p>`}</div>`;
}
function socBindTagCard() {
  const msg = () => `Mon tag Bourselle : @${SOC.tag}\n${appBase()}`;
  const cp = document.getElementById("socCopy"); if (cp) cp.onclick = () => { navigator.clipboard?.writeText("@" + SOC.tag).then(() => toast("Tag copié")).catch(() => toast("@" + SOC.tag)); };
  const sh = document.getElementById("socShare"); if (sh) sh.onclick = () => navigator.share({ text: msg() }).catch(() => {});
  const qb = document.getElementById("socQr"); if (qb) qb.onclick = socShowQr;
  const sc = document.getElementById("socScan"); if (sc) sc.onclick = socScanQr;
  const ed = document.getElementById("socEdit"); if (ed) ed.onclick = () => {
    openForm(`<div class="f2"><h3>Changer mon tag</h3>${fld("socNew", "Nouveau tag", `value="${esc(SOC.tag)}" autocapitalize="off" spellcheck="false"`)}
      <p class="hint">3 à 24 caractères : lettres minuscules, chiffres, - ou _. L'ancien tag est libéré.</p></div>`, () => {
      const t = val("socNew").trim().toLowerCase().replace(/^@/, "");
      socApi("/me/tag", { method: "POST", body: JSON.stringify({ tag: t }) }).then(j => { SOC.tag = j.tag; if (typeof driveRootName === "function") driveRootName(j.tag); closeForm(); render(); toast(`Ton tag : @${j.tag}`); }).catch(e => toast(e.message));
      return false;
    });
  };
  // Recherche (attend une courte pause dans la frappe, 3 caractères minimum)
  const inp = document.getElementById("socSearch"), out = document.getElementById("socResults");
  let tm = null, last = "";
  if (inp) inp.oninput = () => {
    clearTimeout(tm);
    const q = inp.value.trim().toLowerCase().replace(/^@/, "");
    if (q.length < 3) { out.innerHTML = q ? `<p class="hint">Tape au moins 3 caractères.</p>` : ""; return; }
    tm = setTimeout(async () => {
      if (q === last) return; last = q;
      out.innerHTML = `<p class="hint">Recherche…</p>`;
      try {
        const j = await socApi("/search?q=" + encodeURIComponent(q));
        if (inp.value.trim().toLowerCase().replace(/^@/, "") !== q) return;
        const have = new Set(socContacts().map(c => c.tag));
        out.innerHTML = j.users.length ? `<div class="soc-contacts">${j.users.map(u => `<div class="soc-contact"><div><b>@${esc(u.tag)}</b>${u.name ? ` <span class="hint">${esc(u.name)}</span>` : ""}</div>
          ${have.has(u.tag) ? `<span class="hint">Déjà ajouté</span>` : `<button class="btn primary" data-socadd="${esc(u.tag)}" data-name="${esc(u.name || "")}">Ajouter</button>`}</div>`).join("")}</div>`
          : `<p class="hint">Aucun utilisateur trouvé.</p>`;
        out.querySelectorAll("[data-socadd]").forEach(b => b.onclick = () => {
          settings.contacts = socContacts().concat([{ tag: b.dataset.socadd, name: b.dataset.name || "", added: todayISO() }]);
          saveSettings(); render(); toast(`@${b.dataset.socadd} ajouté à tes contacts`);
        });
      } catch (e) { out.innerHTML = `<p class="hint">${esc(e.message)}</p>`; }
    }, 450);
  };
  document.querySelectorAll("[data-socdel]").forEach(b => b.onclick = () => {
    settings.contacts = socContacts().filter(c => c.tag !== b.dataset.socdel); saveSettings(); render();
  });
  document.querySelectorAll("[data-socclaim]").forEach(b => b.onclick = () => {
    const c = socContacts().find(x => x.tag === b.dataset.socclaim) || {};
    editDebt(null, { kind: "medoit", claimTo: c.tag, who: c.name || "@" + c.tag });
  });
}

// ---------- Dettes : réclamations reçues ----------
function socInboxHTML() {
  if (!socOn()) return "";
  const pend = SOC.in.filter(c => c.status === "pending" && c.kind !== "req");   // les demandes de paiement ont leur propre carte
  if (!pend.length) return typeof reqInHTML === "function" ? reqInHTML() : "";
  return `<div class="card soc-in"><h2>À accepter<small>${pend.length}</small></h2>${pend.map(c => `<div class="soc-claim">
    <div><b>@${esc(c.from)}</b>${c.fromName ? ` <span class="hint">(${esc(c.fromName)})</span>` : ""} <span>${c.bill ? "a partagé un paiement : ta part est de" : "te réclame"}</span> <b class="num">${esc(socMoney(c))}</b></div>
    <div class="hint">${esc(c.name || "Dette")}${c.bill && c.billTotal ? ` · <span>total ${esc(socMoney({ ...c, amount: c.billTotal }))}${c.billN > 1 ? ` · ${c.billN} personnes invitées` : ""}</span>` : ""}${c.note ? " · " + esc(c.note) : ""}${c.due ? ` · <span>avant le ${esc(frDate(c.due))}</span>` : ""}</div>
    <div class="acts"><button class="btn primary" data-soc="accept" data-cid="${esc(c.id)}">Accepter</button><button class="btn" data-soc="decline" data-cid="${esc(c.id)}">Refuser</button></div></div>`).join("")}</div>` + (typeof reqInHTML === "function" ? reqInHTML() : "");
}
// Relancer une réclamation refusée : une nouvelle réclamation part vers la même personne
function socRelaunch(id) {
  const d = debts[id]; if (!d || !d.claimTo) return;
  delete d.claim; d.claimStatus = ""; saveDebts();
  socSendClaim(id);
}
function socBindRefused() {
  document.querySelectorAll("[data-socpay]").forEach(b => b.onclick = () => {
    const d = debts[b.dataset.socpay], c = d && SOC.in.find(y => y.id === d.claim); if (!c || !c.pay) return;
    const left = debtCalc(d).remaining;
    showPay(c.pay, left, d.name, "@" + c.from, () => setTimeout(() => { addPayment({ ...d, id: b.dataset.socpay }); const a = document.getElementById("pAmount"); if (a) a.value = String(left).replace(".", ","); }, 250));
  });
  document.querySelectorAll("[data-socsend]").forEach(b => b.onclick = () => { b.disabled = true; socSendClaim(b.dataset.socsend); });
  document.querySelectorAll("[data-socre]").forEach(b => b.onclick = () => { b.disabled = true; socRelaunch(b.dataset.socre); });
  document.querySelectorAll("[data-socrm]").forEach(b => b.onclick = () => {
    if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = "Confirmer ?"; setTimeout(() => { b.dataset.c = ""; b.textContent = "Supprimer"; }, 3000); return; }
    delete debts[b.dataset.socrm]; saveDebts(); render(); toast("Dette supprimée");
  });
}
function socBindInbox() {
  socBindRefused();
  if (typeof reqInBind === "function") reqInBind(document.getElementById("view"));
  document.querySelectorAll("[data-rqok]").forEach(b => b.onclick = () => reqAct(b.dataset.rqok, { action: "received", pid: b.dataset.pid }, "Réception confirmée ✓"));
  const answer = async (c, action, b, fx) => {
    if (b) b.disabled = true;
    try {
      const r = await socApi("/claims/" + c.id, { method: "POST", body: JSON.stringify({ action }) });
      Object.assign(c, r);
      if (r.status === "accepted" && !socFind(c.id)[0]) {
        const foreign = c.cur && c.cur !== baseCurrency();
        const d = { kind: "dois", name: (c.name || "Dette").slice(0, 60), who: "@" + c.from, amount: c.amount, due: c.due || "", note: String(c.note || "").slice(0, 200),
          payments: [], created: Date.now(), claim: c.id, claimStatus: "accepted", rate: "", monthly: "", start: "", months: "" };
        if (foreign && fx && fx.rate > 0) {
          d.xr = fx.rate;
          if (fx.keep) d.cur = c.cur;                                                            // gardée dans sa devise
          else { d.ccur = c.cur; d.amount = Math.round(c.amount / fx.rate * 100) / 100; }      // convertie dans la mienne
        } else if (foreign) d.note = [d.note, `Montant en ${c.cur}`].filter(Boolean).join(" · ").slice(0, 200);
        debts[newId()] = d; saveDebts(); toast(`Dette envers @${c.from} ajoutée`);
      } else if (r.status === "declined") toast("Réclamation refusée");
      render();
    } catch (e) { if (b) b.disabled = false; toast(e.message); }
  };
  document.querySelectorAll("[data-soc]").forEach(b => b.onclick = async () => {
    const c = SOC.in.find(x => x.id === b.dataset.cid); if (!c) return;
    if (b.dataset.soc === "accept" && c.cur && c.cur !== baseCurrency()) return socPickCur(c, fx => answer(c, "accept", null, fx));
    answer(c, b.dataset.soc, b);
  });
}
// Réclamation dans une autre devise : convertir dans la mienne (taux du jour) ou garder la devise de celui qui réclame
async function socPickCur(c, done) {
  const base = baseCurrency(), fmt = (v, cur) => { try { return new Intl.NumberFormat(appLocale(), { style: "currency", currency: cur }).format(v); } catch (e) { return v + " " + cur; } };
  let fx = null; try { fx = await fxRate(c.cur); } catch (e) {}
  const rate = fx && fx.rate > 0 ? fx.rate : 0, conv = rate ? Math.round(c.amount / rate * 100) / 100 : 0;
  let keep = !rate;
  const f = openForm(`<div class="f2"><h3>Dans quelle devise ?</h3>
    <p class="hint" style="margin:0 0 10px">@${esc(c.from)} te réclame <b>${esc(fmt(c.amount, c.cur))}</b>. Ton budget est en ${esc(base)}.</p>
    <div class="cur-pick">
      <button type="button" class="cur-opt" data-k="0" ${rate ? "" : "disabled"}><b>Convertir en ${esc(base)}</b><span class="num">${rate ? "≈ " + esc(fmt(conv, base)) : "taux indisponible hors ligne"}</span><small>${rate ? `1 ${esc(base)} = ${esc(numStr(fxRound(rate)))} ${esc(c.cur)}${fx.src === "fixe" ? " (parité fixe)" : " · taux du jour"}. Tes remboursements seront convertis pour @${esc(c.from)} au même taux.` : ""}</small></button>
      <button type="button" class="cur-opt" data-k="1"><b>Garder en ${esc(c.cur)}</b><span class="num">${esc(fmt(c.amount, c.cur))}</span><small>Tu rembourses dans sa devise${rate ? ` ; tes totaux l'affichent aussi en ${esc(base)} (≈ ${esc(fmt(conv, base))})` : ""}.</small></button>
    </div></div>`, () => { done({ rate: rate || 0, keep }); });
  const sync = () => f.querySelectorAll(".cur-opt").forEach(o => o.setAttribute("aria-pressed", String((o.dataset.k === "1") === keep)));
  f.querySelectorAll(".cur-opt").forEach(o => o.onclick = () => { keep = o.dataset.k === "1"; sync(); });
  f.querySelector("button[type=submit]").textContent = "Accepter";
  sync();
}
// Ligne d'état sous une dette liée à une réclamation
const SOC_ST = { pending: "en attente de réponse", accepted: "acceptée", declined: "refusée", cancelled: "annulée", settled: "soldée des deux côtés" };
function socDebtLine(x) {
  if (!x.claim && x.claimTo && x.kind === "medoit" && socOn())
    return `<div class="soc-st"><span>Pas encore envoyée à</span> <b>@${esc(x.claimTo)}</b> <button class="linkbtn" data-socsend="${esc(x.id)}">Envoyer</button></div>`;
  if (!x.claim) return "";
  const who = x.kind === "medoit" ? x.claimTo : (x.who || "").replace(/^@/, "");
  if (x.kind === "medoit" && x.claimStatus === "declined")
    return `<div class="soc-refused"><b>Dette refusée</b> <span>par</span> <b>@${esc(who || "")}</b>
      <div class="acts"><button class="btn primary" data-socre="${esc(x.id)}">Relancer</button><button class="btn danger" data-socrm="${esc(x.id)}">Supprimer</button></div></div>`;
  const co = x.kind === "medoit" ? SOC.out.find(y => y.id === x.claim) : null, pd = co && (co.payments || []).find(p => p.pend);
  if (pd) return `<div class="soc-st"><b>@${esc(co.to || "")}</b> <span>dit t'avoir payé</span> <b class="num">${esc(socMoney({ ...co, amount: pd.amount }))}</b> <button class="btn primary" data-rqok="${esc(co.id)}" data-pid="${esc(pd.id)}">J'ai bien reçu</button></div>`;
  const c = x.kind !== "medoit" ? SOC.in.find(y => y.id === x.claim) : null, canPay = c && c.pay && c.status === "accepted" && x.c && !x.c.done;
  return `<div class="soc-st"><span>${x.kind === "medoit" ? "Réclamée à" : "Réclamée par"}</span> <b>@${esc(who || "")}</b> · <span>${esc(SOC_ST[x.claimStatus] || "envoyée")}</span>${canPay ? ` <button class="linkbtn" data-socpay="${esc(x.id)}">Payer</button>` : ""}</div>`;
}
// Envoyer la réclamation d'une dette « On me doit »
async function socSendClaim(id) {
  const d = debts[id]; if (!d || d.claim || !d.claimTo) return;
  try {
    const r = await socApi("/claims", { method: "POST", body: JSON.stringify({ kind: "req", to: d.claimTo, amount: d.amount, cur: baseCurrency(), name: d.name, note: d.note, due: d.due, plus: settings.licence || "" }) });
    d.claim = r.id; d.claimStatus = r.status; saveDebts(); SOC.out.unshift(r); render();
    toast(`Demande envoyée à @${d.claimTo}`); if (!isPlus() && SOC.quota) SOC.quota.used++;
  } catch (e) { toast(e.message); if (e.status === 402) showPlus("claim"); }
}
// Partage : quand je paie une dépense du groupe, la part des membres qui ont un tag leur est envoyée (elle arrive dans leurs dettes)
function socSendShares(gid, label, amount, order, date, owed) {
  const g = groups[gid]; if (!g || !socOn()) return;
  const shareOf = id => owed && owed[id] != null ? owed[id] : Math.round(amount / order.length * 100) / 100;
  const targets = g.members.filter(m => m.tag && m.id !== g.me && order.includes(m.id) && shareOf(m.id) > 0);
  if (!targets.length) return;
  if (!isPlus()) return;   // sans Plus : le groupe partagé suffit, les parts ne partent pas en dettes
  for (const m of targets) {
    const key = newId();
    debts[key] = { kind: "medoit", name: `${g.name} : ${label}`.slice(0, 60), who: m.name, amount: shareOf(m.id), due: "", note: `Partage « ${g.name} »`, payments: [], created: Date.now(),
      claimTo: m.tag, group: gid, rate: "", monthly: "", start: "", months: "" };
    socSendClaim(key);
  }
  saveDebts();
  toast(targets.length === 1 ? `Part envoyée à @${targets[0].tag}` : `Parts envoyées à ${targets.length} membres`);
}
// ---------- Groupes partagés ----------
// Un groupe qui a des membres avec un tag est envoyé au serveur : ces membres le retrouvent dans leur onglet Partage
// et peuvent y ajouter des dépenses. Seul le créateur change le nom et les membres.
const socSig = g => JSON.stringify([g.name, g.members, g.expenses, g.comments || {}, g.reacts || {}]);
const socIsShared = g => !!g && (g.shared || (g.members || []).some(m => m.tag));
const socIOwn = g => !g.owner || g.owner === SOC.tag;
let socGTimer = null;
function socGroupsChanged() { if (!socOn()) return; clearTimeout(socGTimer); socGTimer = setTimeout(socPushGroups, 800); }
function socMergeGroup(id, r) {
  const local = groups[id];
  const me = socIOwn({ owner: r.owner }) && local ? local.me : ((r.members || []).find(m => m.tag && m.tag === SOC.tag) || {}).id;
  if (!me) return false;
  const exp = { ...(local ? local.expenses || {} : {}) };
  for (const [eid, e] of Object.entries(r.expenses || {})) { const o = exp[eid]; if (!o || (Number(e.updated) || 0) >= (Number(o.updated) || 0)) exp[eid] = e; }
  const com = { ...(local ? local.comments || {} : {}) };
  for (const [cid, c] of Object.entries(r.comments || {})) if (!com[cid] || (c.deleted && !com[cid].deleted)) com[cid] = c;
  const rx = { ...(local ? local.reacts || {} : {}) };
  for (const [k, x] of Object.entries(r.reacts || {})) if (!rx[k] || (Number(x.at) || 0) > (Number(rx[k].at) || 0)) rx[k] = x;
  const next = { ...(local || {}), name: r.name, members: r.members, me, expenses: exp, comments: com, reacts: rx, shared: true, owner: r.owner, rev: r.rev, link: r.link || "", pays: r.pays || {}, created: (local && local.created) || r.updated || Date.now() };
  const changed = JSON.stringify(local || null) !== JSON.stringify(next);
  if (local) { for (const k of Object.keys(local)) delete local[k]; Object.assign(local, next); } else groups[id] = next;   // même objet : un formulaire ouvert garde la bonne référence
  return changed;
}
async function socPushGroups() {
  if (!socOn()) return;
  let changed = false;
  for (const [id, g] of Object.entries(groups)) {
    if (!socIsShared(g)) continue;
    const sig = socSig(g);
    if (g._sent === sig) continue;
    try {
      const r = await socApi("/groups/" + id, { method: "POST", body: JSON.stringify({ group: { name: g.name, me: g.me, cur: baseCurrency(), members: (g.members || []).map(m => ({ id: m.id, name: m.name, tag: m.tag || "" })), expenses: g.expenses || {}, comments: g.comments || {}, reacts: g.reacts || {} } }) });
      if (r.deleted) { delete groups[id]; changed = true; continue; }
      changed = socMergeGroup(id, r) || changed;
      groups[id]._sent = socSig(groups[id]);
    } catch (e) { if (e.status === 403) { delete groups[id]; changed = true; } }
  }
  if (changed) { scheduleSave(); if (tab === "partage") render(); }
}
async function socPullGroups() {
  const j = await socApi("/groups");
  const seen = new Set(); let changed = false;
  for (const r of j.groups || []) {
    seen.add(r.id);
    if (r.deleted) { if (groups[r.id]) { toast(`Le groupe « ${groups[r.id].name} » a été supprimé par @${r.owner}`); delete groups[r.id]; changed = true; } continue; }
    const isNew = !groups[r.id];
    if (socMergeGroup(r.id, r)) { changed = true; groups[r.id]._sent = socSig(groups[r.id]); if (isNew) toast(`@${r.owner} t'a ajouté au groupe « ${r.name} »`); }
  }
  for (const [id, g] of Object.entries(groups)) if (g.shared && !socIOwn(g) && !seen.has(id)) { toast(`Tu ne fais plus partie du groupe « ${g.name} »`); delete groups[id]; changed = true; }
  if (changed) { scheduleSave(); if (tab === "partage") render(); }
}
function socDeleteGroup(id, g) {
  if (!socOn() || !socIsShared(g) || !socIOwn(g)) return;
  socApi("/groups/" + id, { method: "POST", body: JSON.stringify({ deleted: true, group: { name: g.name, members: (g.members || []).map(m => ({ id: m.id, name: m.name, tag: m.tag || "" })) } }) }).catch(() => {});
}
async function socPay(id, p) {
  const d = debts[id]; if (!d || !d.claim || !socOn()) return;
  const st = (SOC.in.concat(SOC.out).find(c => c.id === d.claim) || {}).status || d.claimStatus;
  if (st !== "accepted") return;
  const isReq = ((SOC.in || []).find(c => c.id === d.claim) || (SOC.out || []).find(c => c.id === d.claim) || {}).kind === "req";
  try { await socApi("/claims/" + d.claim, { method: "POST", body: JSON.stringify({ action: isReq && d.kind !== "medoit" ? "paid" : isReq ? "received" : "pay", amount: d.ccur && Number(d.xr) > 0 ? Math.round(p.amount * Number(d.xr) * 100) / 100 : p.amount, date: p.date, pid: p.pid }) }); socRefresh(); }
  catch (e) { toast("Remboursement non transmis : " + e.message); }
}
async function socCancel(d) {
  if (!d || !d.claim || d.kind !== "medoit" || !socOn() || ["declined", "cancelled", "settled"].includes(d.claimStatus)) return;
  try { await socApi("/claims/" + d.claim, { method: "POST", body: JSON.stringify({ action: "cancel" }) }); } catch (e) {}
}

// ---------- Me faire payer / payer quelqu'un ----------
// L'utilisateur peut indiquer son IBAN (QR code de virement), son PayPal.me ou un autre lien de paiement.
// Ils sont montrés aux membres de ses groupes et sur son lien de paiement ; l'argent ne passe jamais par Bourselle.
const appBase = () => location.origin + location.pathname.replace(/[^/]*$/, "");
const groupLinkUrl = link => appBase() + "g.html#g=" + link;
const payLinkUrl = (amount, note) => SOC.payToken ? appBase() + "g.html#p=" + SOC.payToken + (amount > 0 ? "&a=" + (Math.round(amount * 100) / 100) + "&c=" + baseCurrency() : "") + (note ? "&n=" + encodeURIComponent(note.slice(0, 50)) : "") : "";
async function socLoadPay(force) {
  if (!socOn() || (SOC.payLoaded && !force)) return;
  try { const j = await socApi("/me/pay"); const was = SOC.payLoaded; SOC.pay = j.pay; SOC.payToken = j.token || ""; SOC.payLoaded = true; if (!was && tab === "reglages" && document.getElementById("app") && !document.getElementById("sheet2Root").classList.contains("open")) render(); } catch (e) {}
}
async function shareText(text, url, okMsg) {
  if (window.T) text = window.T(text);
  if (navigator.share) { try { await navigator.share({ text, url }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(url ? text + "\n" + url : text); toast(okMsg || "Lien copié : colle-le dans un message"); } catch (e) { toast(url || text); }
}
async function editPay() {
  if (!socOn()) { toast("Connecte-toi avec Google ou Microsoft pour te faire payer"); return; }
  await socLoadPay(true);
  const p = SOC.pay || {};
  let qrState = p.momo && p.momo.qr ? "keep" : "";
  const f = openForm(`<div class="f2"><h3>Me faire payer</h3>
    <p class="hint" style="margin:0 0 8px">Ceux qui te doivent de l'argent (membres de tes groupes, ton lien de paiement) verront ces informations pour te payer directement. Rien ne passe par Bourselle.</p>
    ${fld("pyName", "Ton nom", `placeholder="ex. Anne Martin" value="${esc(p.name || "")}"`)}
    <div class="py-sec"><b>⚡ Paiement rapide</b><small>Le plus simple pour ceux qui te paient : un geste depuis leur appli.</small></div>
    ${fld("pyRev", "Revolut (ton @identifiant revolut.me)", `placeholder="ex. annemartin" autocapitalize="off" value="${esc(p.revolut || "")}"`)}
    ${fld("pyWero", "Wero (ton numéro de téléphone ou ton e-mail)", `placeholder="ex. +33 6 12 34 56 78" autocapitalize="off" value="${esc(p.wero || "")}"`)}
    ${fld("pyPaypal", "PayPal.me", `placeholder="ex. annemartin" autocapitalize="off" value="${esc(p.paypal || "")}"`)}
    ${fld("pyLink", "Autre lien de paiement", `placeholder="https://… (Lydia, Sumeria, Paylib…)" value="${esc(p.link || "")}"`)}
    <div class="py-sec"><b>🏦 Virement bancaire (RIB)</b><small>Bourselle affiche un QR code de virement déjà rempli (montant et motif).</small></div>
    ${fld("pyIban", "IBAN", `placeholder="FR76 …" autocapitalize="characters" value="${esc(p.iban ? PAY.ibanFmt(p.iban) : "")}"`)}
    <div class="py-sec"><b>📱 Mobile Money</b><small>MTN MoMo, Orange Money, Wave…</small></div>
    <div class="two"><div><select class="field" id="pyMoOp">${["MTN MoMo", "Orange Money", "Wave", "Moov Money", "Airtel Money", "M-Pesa", "Free Money", "Autre"].map(o => `<option ${p.momo && p.momo.op === o ? "selected" : ""}>${o}</option>`).join("")}</select></div>
      <div><input class="field" id="pyMoNum" inputmode="tel" placeholder="+229 97 00 00 00" value="${esc(p.momo ? p.momo.num : "")}"></div></div>
    <div class="py-qr"><div id="pyQrPrev" class="py-qrprev"></div><div><label class="btn" style="cursor:pointer;display:inline-block">${p.momo && p.momo.qr ? "Remplacer" : "Ajouter"} mon QR code<input type="file" accept="image/*" id="pyQrIn" hidden></label>
      <button type="button" class="linkbtn danger" id="pyQrDel" ${p.momo && p.momo.qr ? "" : "hidden"}>Retirer</button>
      <p class="hint" style="margin:4px 0 0">Ouvre ton appli Mobile Money (MoMo, Orange Money, Wave…), affiche « Mon QR code », fais une capture d'écran et choisis-la ici.</p></div></div>
    ${SOC.payToken ? `<button type="button" class="btn" id="pyShare" style="margin-top:12px;width:100%">Partager mon lien de paiement</button>` : ""}</div>`, () => {
    const iban = PAY.clean(val("pyIban")), name = val("pyName").trim(), paypal = val("pyPaypal").trim(), link = val("pyLink").trim();
    const revolut = val("pyRev").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?revolut\.me\//i, "").replace(/[/?#].*$/, ""), wero = val("pyWero").trim();
    if (revolut && !/^[A-Za-z0-9._-]{2,40}$/.test(revolut)) { toast("Identifiant Revolut invalide (ex. annemartin)"); return false; }
    if (wero && !(/^\+?[0-9]{8,15}$/.test(wero.replace(/[\s.-]/g, "")) || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(wero))) { toast("Wero : indique ton numéro de téléphone ou ton e-mail"); return false; }
    const moNum = val("pyMoNum").replace(/[\s.-]/g, ""), momo = moNum || (qrState && qrState !== "") ? { op: val("pyMoOp"), num: moNum, qr: qrState } : { op: val("pyMoOp"), num: "", qr: "" };
    if (moNum && !/^\+?[0-9]{8,15}$/.test(moNum)) { toast("Numéro Mobile Money invalide (ex. +229 97 00 00 00)"); return false; }
    if (iban && !PAY.ibanOk(iban)) { toast("IBAN invalide : vérifie-le"); return false; }
    if (iban && !name) { toast("Indique le nom du titulaire du compte"); return false; }
    if (link && !/^https:\/\/\S{4,}$/.test(link)) { toast("Le lien doit commencer par https://"); return false; }
    (async () => {
      try {
        const j = await socApi("/me/pay", { method: "POST", body: JSON.stringify({ name, iban, paypal, link, revolut, wero, momo }) });
        SOC.pay = j.pay; SOC.payToken = j.token || ""; SOC.payLoaded = true;
        toast(j.pay ? "Moyens de paiement enregistrés" : "Moyens de paiement retirés"); render();
        socPullGroups().catch(() => {});
      } catch (e) { toast(e.message); }
    })();
  });
  const sh = f.querySelector("#pyShare"); if (sh) sh.onclick = () => shareText("Pour me payer :", payLinkUrl(0, ""));
  // QR code Mobile Money : aperçu, ajout, retrait
  const prev = f.querySelector("#pyQrPrev"), qin = f.querySelector("#pyQrIn"), qdel = f.querySelector("#pyQrDel");
  const showPrev = src => { prev.innerHTML = src ? `<img alt="QR">` : ""; if (src) prev.firstChild.src = src; prev.hidden = !src; };
  showPrev(""); if (p.momo && p.momo.qr) PAY.momoQr(p.momo.qr).then(showPrev).catch(() => {});
  qin.onchange = async () => { const file = qin.files && qin.files[0]; if (!file) return; try { const d = await prepMomoQr(file, x => window.T ? window.T(x) : x); qrState = d; showPrev(d); qdel.hidden = false; toast("QR code prêt : enregistre pour le garder"); } catch (e) { toast(e.message); } qin.value = ""; };
  qdel.onclick = () => { qrState = ""; showPrev(""); qdel.hidden = true; };
}
// Fenêtre « Payer » : IBAN + QR code, PayPal, lien ; « J'ai payé » enregistre le remboursement
function showPay(p, amount, note, who, onPaid) {
  const f = openForm(`<div class="f2"><h3>Payer ${esc(who)}</h3>${PAY.html(p, amount, baseCurrency(), note, x => x, v => eur(v))}
    <p class="hint" style="margin:8px 0 0">Une fois le paiement fait, appuie sur « J'ai payé » pour l'enregistrer.</p></div>`, () => { onPaid && onPaid(); });
  f.querySelector("button[type=submit]").textContent = "J'ai payé";
  PAY.bind(f, toast);
}
// Lien d'invitation d'un groupe (créé à la demande par le créateur du groupe)
async function socGroupLink(gid, off) {
  const g = groups[gid]; if (!g) return;
  if (!socOn()) { toast("Connecte-toi avec Google ou Microsoft pour inviter par lien"); return; }
  if (!socIOwn(g)) { if (g.link) return shareText(`Rejoins le groupe « ${g.name} » sur Bourselle :`, groupLinkUrl(g.link)); toast(`Demande le lien à @${g.owner}`); return; }
  try {
    g.shared = true;
    const r = await socApi("/groups/" + gid, { method: "POST", body: JSON.stringify({ link: !off, group: { name: g.name, me: g.me, cur: baseCurrency(), members: (g.members || []).map(m => ({ id: m.id, name: m.name, tag: m.tag || "" })), expenses: g.expenses || {}, comments: g.comments || {}, reacts: g.reacts || {} } }) });
    socMergeGroup(gid, r); groups[gid]._sent = socSig(groups[gid]);
    saveGroups(); render();
    if (off) { toast("Lien d'invitation désactivé"); return; }
    if (r.link) shareText(`Rejoins le groupe « ${g.name} » sur Bourselle : tu verras les dépenses et qui doit quoi, sans créer de compte.`, groupLinkUrl(r.link));
  } catch (e) { toast(e.message); }
}

// ---------- Tickets photo des dépenses de groupe ----------
const socPhotoCache = {};
async function socPhotoUpload(gid, data) {
  const g = groups[gid]; if (!g) throw new Error("Groupe introuvable");
  if (!socOn()) throw new Error("Connecte-toi avec Google ou Microsoft pour joindre un ticket");
  if (!g._sent) {   // le groupe doit exister sur le serveur pour y ranger la photo
    g.shared = true;
    const r = await socApi("/groups/" + gid, { method: "POST", body: JSON.stringify({ group: { name: g.name, me: g.me, cur: baseCurrency(), members: (g.members || []).map(m => ({ id: m.id, name: m.name, tag: m.tag || "" })), expenses: g.expenses || {}, comments: g.comments || {}, reacts: g.reacts || {} } }) });
    socMergeGroup(gid, r); groups[gid]._sent = socSig(groups[gid]);
  }
  const j = await socApi("/groups/" + gid + "/photo", { method: "POST", body: JSON.stringify({ data }) });
  socPhotoCache[gid + ":" + j.pid] = data; return j.pid;
}
async function socPhotoGet(gid, pid) {
  const k = gid + ":" + pid; if (socPhotoCache[k]) return socPhotoCache[k];
  const j = await socApi("/groups/" + gid + "/photo/" + pid); socPhotoCache[k] = j.data; return j.data;
}

// ---------- Notifications en direct (Web Push) ----------
// Un appareil s'abonne une fois ; le serveur prévient les membres quand une dépense est ajoutée, modifiée, supprimée ou commentée,
// et pour les réclamations de dettes. Rien d'autre n'est envoyé.
const PUSH_KEY = "bourselle-push";
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
const pushOn = () => { try { return localStorage.getItem(PUSH_KEY) === "1" && Notification.permission === "granted"; } catch (e) { return false; } };
async function pushSub(create) {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub && create) {
    const r = await fetch((PLUS_CFG.api || "") + "/p/key"), j = await r.json();
    if (!j.key) throw new Error("Notifications indisponibles pour l'instant");
    const raw = Uint8Array.from(atob(j.key.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((j.key.length + 3) % 4)), c => c.charCodeAt(0));
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw });
  }
  return sub;
}
async function enablePush() {
  if (!socOn()) { toast("Connecte-toi avec Google ou Microsoft pour recevoir les notifications"); return; }
  if (isIOS() && !isStandalone()) { toast("Sur iPhone, ajoute d'abord Bourselle à l'écran d'accueil (Partager › Sur l'écran d'accueil), puis ouvre-le depuis l'icône"); return; }
  if (!pushSupported()) { toast("Ce navigateur ne permet pas les notifications"); return; }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { toast("Notifications refusées : tu peux les autoriser dans les réglages du navigateur"); return; }
  try {
    const sub = await pushSub(true);
    await socApi("/me/push", { method: "POST", body: JSON.stringify({ sub: sub.toJSON(), lang: window.LANG === "en" ? "en" : "fr", test: true }) });
    localStorage.setItem(PUSH_KEY, "1"); toast("Notifications activées"); render();
  } catch (e) { toast(e.message || "Activation impossible"); }
}
async function disablePush() {
  try {
    const sub = pushSupported() ? await pushSub(false) : null;
    if (sub) { if (socOn()) await socApi("/me/push", { method: "POST", body: JSON.stringify({ off: true, sub: { endpoint: sub.endpoint } }) }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
  } catch (e) {}
  try { localStorage.removeItem(PUSH_KEY); } catch (e) {}
  toast("Notifications désactivées"); render();
}
// À chaque connexion : l'abonnement de cet appareil est rattaché au compte connecté (et à la langue choisie)
async function pushResync() {
  if (!pushOn() || !socOn() || !pushSupported() || SOC.pushSynced) return;
  SOC.pushSynced = true;
  try { const sub = await pushSub(true); await socApi("/me/push", { method: "POST", body: JSON.stringify({ sub: sub.toJSON(), lang: window.LANG === "en" ? "en" : "fr" }) }); } catch (e) {}
}
function pushCardHTML() {
  if (!socOn()) return "";
  const on = pushOn();
  return `<div class="card"><h2>Notifications en direct</h2><p class="hint" style="margin:0 0 10px">${on ? "Activées sur cet appareil : tu es prévenu quand quelqu'un ajoute, modifie, supprime ou commente une dépense de tes groupes, et pour tes dettes." : "Sois prévenu dès que quelqu'un ajoute, modifie, supprime ou commente une dépense de tes groupes, et quand on te réclame une dette."}${!on && isIOS() && !isStandalone() ? " Sur iPhone, ajoute d'abord Bourselle à l'écran d'accueil." : ""}</p>
    <button class="btn ${on ? "" : "primary"}" id="pushTgl">${on ? "Désactiver sur cet appareil" : "Activer les notifications"}</button></div>`;
}
function pushBind() { const b = document.getElementById("pushTgl"); if (b) b.onclick = () => (pushOn() ? disablePush() : enablePush()); }
// Ouvrir ce que la notification montre : un groupe (?g=…) ou les dettes (?tab=dettes)
function openFromUrl(u) {
  let p; try { p = new URL(u, location.href).searchParams; } catch (e) { return; }
  const g = p.get("g"), t = p.get("tab"), dl = p.get("d"), pj = p.get("pj");
  if (dl && typeof showDeal === "function") { showDeal(dl); return; }
  if (pj && typeof showProject === "function") { showProject(pj); return; }
  if (g) { if (groups[g]) { openGroup = g; switchTab("partage"); window.scrollTo(0, 0); } else SOC.openLater = g; }
  else if (t === "dettes") switchTab("dettes");
}
{
  const q = new URLSearchParams(location.search);
  if (q.get("g") || q.get("tab") || q.get("d") || q.get("pj")) { try { sessionStorage.setItem("bourselle-open", location.search); } catch (e) {} history.replaceState(null, "", location.pathname + location.hash); }
}
function socOpenPending() {
  let s = ""; try { s = sessionStorage.getItem("bourselle-open") || ""; sessionStorage.removeItem("bourselle-open"); } catch (e) {}
  if (s) openFromUrl(s);
  else if (SOC.openLater && groups[SOC.openLater]) { const g = SOC.openLater; SOC.openLater = ""; openFromUrl("?g=" + g); }
}
if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", ev => {
  const d = ev.data || {};
  if (d.type === "bourselle-push") { socRefresh(); if (typeof projRefresh === "function") projRefresh(); if (typeof openDeal !== "undefined" && openDeal && tab === "accueil") showDeal(openDeal); if (document.visibilityState === "visible" && d.data && d.data.body) toast(d.data.body.split("\n")[0]); }
  if (d.type === "bourselle-open") { socRefresh(); openFromUrl(d.url); }
});
