/* Bourselle — tags et réclamations de dettes entre utilisateurs.
 * Chaque utilisateur a un tag (@marie-7k2q) qu'il peut partager. Un utilisateur Plus peut réclamer une dette
 * à un tag : elle arrive dans l'app de l'autre, qui l'accepte ou la refuse, et les remboursements se suivent des deux côtés.
 * Passe par le serveur PLUS_CFG.api ; sans serveur configuré, rien de tout cela n'apparaît. */
const SOC = { tag: "", in: [], out: [], loaded: false, err: "", sig: "" };
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
      if (p.by === mine || (d.payments || []).some(q => q.pid === p.id)) continue;
      d.payments = (d.payments || []).concat([{ date: p.date, amount: p.amount, pid: p.id }]); changed = true;
      toast(`@${mine === "from" ? c.to : c.from} : remboursement de ${socMoney({ ...c, amount: p.amount })} enregistré`);
    }
  };
  for (const c of SOC.out) sync(c, "from");
  for (const c of SOC.in) sync(c, "to");
  if (changed) saveDebts();
  return changed;
}
let socBusy = false, socSeen = new Set(JSON.parse(localStorage.getItem("bourselle-soc-seen") || "[]"));
async function socRefresh() {
  if (!socOn() || socBusy) return; socBusy = true;
  try {
    const j = await socApi("/claims");
    SOC.tag = j.tag || SOC.tag; SOC.in = j.in || []; SOC.out = j.out || []; SOC.loaded = true; SOC.err = "";
    const changed = socMerge();
    if (!SOC.addChecked) { SOC.addChecked = true; socPendingAdd(); }
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
  const msg = () => `Mon tag Bourselle : @${SOC.tag}\nhttps://pataush.github.io/bourselle/`;
  const cp = document.getElementById("socCopy"); if (cp) cp.onclick = () => { navigator.clipboard?.writeText("@" + SOC.tag).then(() => toast("Tag copié")).catch(() => toast("@" + SOC.tag)); };
  const sh = document.getElementById("socShare"); if (sh) sh.onclick = () => navigator.share({ text: msg() }).catch(() => {});
  const qb = document.getElementById("socQr"); if (qb) qb.onclick = socShowQr;
  const sc = document.getElementById("socScan"); if (sc) sc.onclick = socScanQr;
  const ed = document.getElementById("socEdit"); if (ed) ed.onclick = () => {
    openForm(`<div class="f2"><h3>Changer mon tag</h3>${fld("socNew", "Nouveau tag", `value="${esc(SOC.tag)}" autocapitalize="off" spellcheck="false"`)}
      <p class="hint">3 à 24 caractères : lettres minuscules, chiffres, - ou _. L'ancien tag est libéré.</p></div>`, () => {
      const t = val("socNew").trim().toLowerCase().replace(/^@/, "");
      socApi("/me/tag", { method: "POST", body: JSON.stringify({ tag: t }) }).then(j => { SOC.tag = j.tag; closeForm(); render(); toast(`Ton tag : @${j.tag}`); }).catch(e => toast(e.message));
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
    if (!isPlus()) return showPlus("claim");
    const c = socContacts().find(x => x.tag === b.dataset.socclaim) || {};
    editDebt(null, { kind: "medoit", claimTo: c.tag, who: c.name || "@" + c.tag });
  });
}

// ---------- Dettes : réclamations reçues ----------
function socInboxHTML() {
  if (!socOn()) return "";
  const pend = SOC.in.filter(c => c.status === "pending");
  if (!pend.length) return "";
  return `<div class="card soc-in"><h2>Réclamations reçues<small>${pend.length}</small></h2>${pend.map(c => `<div class="soc-claim">
    <div><b>@${esc(c.from)}</b>${c.fromName ? ` <span class="hint">(${esc(c.fromName)})</span>` : ""} <span>te réclame</span> <b class="num">${esc(socMoney(c))}</b></div>
    <div class="hint">${esc(c.name || "Dette")}${c.note ? " · " + esc(c.note) : ""}${c.due ? ` · <span>avant le ${esc(frDate(c.due))}</span>` : ""}</div>
    <div class="acts"><button class="btn primary" data-soc="accept" data-cid="${esc(c.id)}">Accepter</button><button class="btn" data-soc="decline" data-cid="${esc(c.id)}">Refuser</button></div></div>`).join("")}</div>`;
}
// Relancer une réclamation refusée : une nouvelle réclamation part vers la même personne
function socRelaunch(id) {
  const d = debts[id]; if (!d || !d.claimTo) return;
  if (!isPlus()) return showPlus("claim");
  delete d.claim; d.claimStatus = ""; saveDebts();
  socSendClaim(id);
}
function socBindRefused() {
  document.querySelectorAll("[data-socsend]").forEach(b => b.onclick = () => { b.disabled = true; socSendClaim(b.dataset.socsend); });
  document.querySelectorAll("[data-socre]").forEach(b => b.onclick = () => { b.disabled = true; socRelaunch(b.dataset.socre); });
  document.querySelectorAll("[data-socrm]").forEach(b => b.onclick = () => {
    if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = "Confirmer ?"; setTimeout(() => { b.dataset.c = ""; b.textContent = "Supprimer"; }, 3000); return; }
    delete debts[b.dataset.socrm]; saveDebts(); render(); toast("Dette supprimée");
  });
}
function socBindInbox() {
  socBindRefused();
  document.querySelectorAll("[data-soc]").forEach(b => b.onclick = async () => {
    const c = SOC.in.find(x => x.id === b.dataset.cid); if (!c) return;
    b.disabled = true;
    try {
      const r = await socApi("/claims/" + c.id, { method: "POST", body: JSON.stringify({ action: b.dataset.soc }) });
      Object.assign(c, r);
      if (r.status === "accepted" && !socFind(c.id)[0]) {
        debts[newId()] = { kind: "dois", name: (c.name || "Dette").slice(0, 60), who: "@" + c.from, amount: c.amount, due: c.due || "", note: [c.note, c.cur !== baseCurrency() ? `Montant en ${c.cur}` : ""].filter(Boolean).join(" · ").slice(0, 200),
          payments: [], created: Date.now(), claim: c.id, claimStatus: "accepted", rate: "", monthly: "", start: "", months: "" };
        saveDebts(); toast(`Dette envers @${c.from} ajoutée`);
      } else if (r.status === "declined") toast("Réclamation refusée");
      render();
    } catch (e) { b.disabled = false; toast(e.message); }
  });
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
  return `<div class="soc-st"><span>${x.kind === "medoit" ? "Réclamée à" : "Réclamée par"}</span> <b>@${esc(who || "")}</b> · <span>${esc(SOC_ST[x.claimStatus] || "envoyée")}</span></div>`;
}
// Envoyer la réclamation d'une dette « On me doit »
async function socSendClaim(id) {
  const d = debts[id]; if (!d || d.claim || !d.claimTo) return;
  if (!isPlus()) { showPlus("claim"); return; }
  try {
    const r = await socApi("/claims", { method: "POST", body: JSON.stringify({ to: d.claimTo, amount: d.amount, cur: baseCurrency(), name: d.name, note: d.note, due: d.due, plus: settings.licence || "" }) });
    d.claim = r.id; d.claimStatus = r.status; saveDebts(); SOC.out.unshift(r); render();
    toast(`Réclamation envoyée à @${d.claimTo}`);
  } catch (e) { toast(e.status === 402 ? "Réclamer une dette est réservé à Bourselle Plus" : e.message); if (e.status === 402) showPlus("claim"); }
}
// Partage : quand je paie une dépense du groupe, la part des membres qui ont un tag leur est envoyée (elle arrive dans leurs dettes)
function socSendShares(gid, label, amount, order, date, owed) {
  const g = groups[gid]; if (!g || !socOn()) return;
  const shareOf = id => owed && owed[id] != null ? owed[id] : Math.round(amount / order.length * 100) / 100;
  const targets = g.members.filter(m => m.tag && m.id !== g.me && order.includes(m.id) && shareOf(m.id) > 0);
  if (!targets.length) return;
  if (!isPlus()) { toast("Envoyer les parts via Bourselle demande Bourselle Plus"); showPlus("claim"); return; }
  for (const m of targets) {
    const key = newId();
    debts[key] = { kind: "medoit", name: `${g.name} : ${label}`.slice(0, 60), who: m.name, amount: shareOf(m.id), due: "", note: `Partage « ${g.name} »`, payments: [], created: Date.now(),
      claimTo: m.tag, group: gid, rate: "", monthly: "", start: "", months: "" };
    socSendClaim(key);
  }
  saveDebts();
  toast(targets.length === 1 ? `Part envoyée à @${targets[0].tag}` : `Parts envoyées à ${targets.length} membres`);
}
async function socPay(id, p) {
  const d = debts[id]; if (!d || !d.claim || !socOn()) return;
  const st = (SOC.in.concat(SOC.out).find(c => c.id === d.claim) || {}).status || d.claimStatus;
  if (st !== "accepted") return;
  try { await socApi("/claims/" + d.claim, { method: "POST", body: JSON.stringify({ action: "pay", amount: p.amount, date: p.date, pid: p.pid }) }); socRefresh(); }
  catch (e) { toast("Remboursement non transmis : " + e.message); }
}
async function socCancel(d) {
  if (!d || !d.claim || d.kind !== "medoit" || !socOn() || ["declined", "cancelled", "settled"].includes(d.claimStatus)) return;
  try { await socApi("/claims/" + d.claim, { method: "POST", body: JSON.stringify({ action: "cancel" }) }); } catch (e) {}
}
