/* Bourselle — mes proches favoris (en haut de « Entre proches »).
 * Une rangée de pastilles : initiale, prénom, et ce qui compte (« te doit 25 € » en vert, « tu lui dois 12 € » en rouge).
 * Les proches viennent de mes contacts Bourselle, de mes groupes, de mes dettes et de mes demandes de paiement ;
 * ceux avec qui j'échange le plus remontent tout seuls, et je peux en épingler (⭐).
 * Toucher une pastille : une fiche avec Payer, Demander, Partager une dépense, Relancer, et ce qu'on a en commun. */
const FAV_COLORS = ["#1f6b4b", "#c9a24a", "#3f8f68", "#8a6d2b", "#2f5d73", "#a0522d", "#6b4b8a", "#4b7a1f"];
const favColor = k => FAV_COLORS[[...k].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % FAV_COLORS.length];
const favFirst = n => String(n || "?").replace(/^@/, "").split(/[\s._-]/)[0].replace(/^./, c => c.toUpperCase()).slice(0, 12);
const favPins = () => (settings.favs = Array.isArray(settings.favs) ? settings.favs : []);

function prochesList() {
  const P = new Map(), myTag = typeof SOC !== "undefined" ? SOC.tag : "";
  const get = (tag, name) => {
    tag = String(tag || "").replace(/^@/, "").toLowerCase();
    if (tag && tag === myTag) return null;
    const key = tag ? "@" + tag : "n:" + String(name || "").trim().toLowerCase(); if (key === "n:") return null;
    let p = P.get(key);
    if (!p) { p = { key, tag, name: name || (tag ? "@" + tag : ""), owe: 0, due: 0, items: [], groups: [], score: 0, last: 0 }; P.set(key, p); }
    if (name && (!p.name || p.name.startsWith("@"))) p.name = name;
    return p;
  };
  for (const c of (settings.contacts || [])) { const p = get(c.tag, c.name); if (p) p.score += 1; }
  // Groupes : membres, et qui doit quoi à moi / à qui je dois
  for (const [gid, g] of Object.entries(groups || {})) {
    const exps = Object.values(liveExp(g)), last = exps.reduce((a, e) => Math.max(a, e.updated || e.created || 0), 0);
    const tagOf = m => m.tag || (g.owner && g.ownerMid && m.id === g.ownerMid ? g.owner : "");
    for (const m of g.members || []) {
      if (m.id === g.me) continue;
      const p = get(tagOf(m), m.name); if (!p) continue;
      p.score += 2 + exps.filter(e => e.paidBy === m.id || (e.split || []).includes(m.id)).length * 0.2; p.groups.push(gid); p.last = Math.max(p.last, last);
      p.mid = p.mid || {}; p.mid[gid] = m.id;
    }
    for (const s of settle(groupBalances(typeof gCut === "function" ? gCut(g) : g))) {
      const other = s.to === g.me ? s.from : s.from === g.me ? s.to : null; if (!other) continue;
      const m = (g.members || []).find(x => x.id === other); if (!m) continue;
      const p = get(tagOf(m), m.name); if (!p) continue;
      // Groupe dans une autre devise : compté dans les totaux après conversion (au taux connu), affiché dans sa devise
      const cv = typeof gToBase === "function" ? gToBase(g, s.amount) : s.amount, cur = typeof gForeign === "function" && gForeign(g) ? gCur(g) : undefined;
      if (s.to === g.me) { p.owe += cv || 0; p.items.push({ k: "g", gid, s, dir: "in", label: g.name, amount: s.amount, cur }); }
      else { p.due += cv || 0; p.items.push({ k: "g", gid, s, dir: "out", label: g.name, amount: s.amount, cur }); }
    }
  }
  // Dettes entre personnes (pas les crédits)
  const linked = new Set();
  for (const [id, x] of Object.entries(debts || {})) {
    if (x.claim) linked.add(x.claim);
    if (x.kind === "credit" || x.closed || x.group) continue;
    const c = debtCalc(x); if (c.done) continue;
    const tag = x.claimTo || (/^@/.test(x.who || "") ? x.who.slice(1) : ""), p = get(tag, tag ? "" : x.who); if (!p) continue;
    const v = typeof debtBase === "function" ? debtBase(x, c.remaining) : c.remaining;
    if (x.kind === "medoit") { p.owe += v; p.items.push({ k: "d", id, dir: "in", label: x.name, amount: v }); }
    else { p.due += v; p.items.push({ k: "d", id, dir: "out", label: x.name, amount: v }); }
    p.score += 1; p.last = Math.max(p.last, x.created || 0);
  }
  // Demandes de paiement pas encore dans mes dettes
  if (typeof SOC !== "undefined") {
    // Une part de groupe envoyée en demande est déjà comptée dans le groupe
    const gNames = new Set(Object.values(groups || {}).map(g => `Partage « ${g.name} »`));
    const open = c => !["settled", "cancelled", "declined"].includes(c.status) && !linked.has(c.id) && !gNames.has(c.note || "") && !(settings.shareCutoff && (c.created || 0) < settings.shareCutoff);
    for (const c of SOC.in || []) if (c.kind === "req" && open(c) && !reqPend(c)) { const p = get(c.from, c.fromName); if (!p) continue; const v = reqLeft(c); if (c.cur === baseCurrency()) p.due += v; p.items.push({ k: "rin", id: c.id, dir: "out", label: c.name || "Demande de paiement", amount: v, cur: c.cur }); p.score += 1; p.last = Math.max(p.last, c.updated || 0); }
    for (const c of SOC.out || []) if (c.kind === "req" && c.to && open(c)) { const p = get(c.to, ""); if (!p) continue; const v = reqLeft(c); if (c.cur === baseCurrency()) p.owe += v; p.items.push({ k: "rout", id: c.id, dir: "in", label: c.name || "Demande de paiement", amount: v, cur: c.cur, pend: !!reqPend(c) }); p.score += 1; p.last = Math.max(p.last, c.updated || 0); }
  }
  const pins = favPins(), now = Date.now();
  const list = [...P.values()].map(p => ({ ...p, owe: Math.round(p.owe * 100) / 100, due: Math.round(p.due * 100) / 100, pinned: pins.includes(p.key),
    rank: p.score + (p.last && now - p.last < 30 * 864e5 ? 3 : 0) + (p.owe || p.due ? 2 : 0) }));
  const hid = settings.prochesHidden || [];
  return list.filter(p => !(hid.includes(p.key) && !p.owe && !p.due)).sort((a, b) => (b.pinned - a.pinned) || (a.pinned && b.pinned ? pins.indexOf(a.key) - pins.indexOf(b.key) : 0) || b.rank - a.rank || a.name.localeCompare(b.name));
}
// Les proches qui ont Bourselle (pour choisir « À qui ? »)
const prochesTagged = () => prochesList().filter(p => p.tag).map(p => ({ tag: p.tag, name: p.name.startsWith("@") ? "" : p.name }));

function favStatus(p) {
  const net = Math.round((p.owe - p.due) * 100) / 100;
  if (net > 0.004) return { cls: "good", txt: `te doit ${eur(net, true)}` };
  if (net < -0.004) return { cls: "bad", txt: `tu lui dois ${eur(-net, true)}` };
  return { cls: "", txt: p.pinned ? "favori" : "quitte" };
}
function favRowHTML() {
  const list = prochesList().slice(0, 14);
  if (!list.length && !(typeof socOn === "function" && socOn())) return "";
  // Bulles : anneau vert (on te doit), rouge (tu dois), gris (quittes) ; point orange = message non lu
  // Sans titre, juste sous « On te doit / Tu dois » : un toucher ouvre directement la discussion avec ce proche
  return `<div class="fav-row bub fav-top">${list.map(p => { const net = Math.round((p.owe - p.due) * 100) / 100, cls = net > 0.004 ? "good" : net < -0.004 ? "bad" : "";
      const un = p.tag && typeof dmUnread === "function" && dmUnread(p.tag);
      return `<button type="button" class="fav" data-fav="${esc(p.key)}"><span class="fav-ring ${cls}"><span class="fav-av" data-avtag="${esc(p.tag || "")}" style="background:${favColor(p.key)}">${esc(favFirst(p.name).charAt(0))}${p.pinned ? `<i>⭐</i>` : ""}${un ? `<em class="fav-un" aria-label="${un} message(s) non lu(s)"></em>` : ""}</span></span><b>${esc(favFirst(p.name))}</b><small class="${cls}">${cls ? `${net > 0 ? "+" : "−"}${esc(eur(Math.abs(net), true))}` : "quitte"}</small></button>`; }).join("")}
      ${prochesList().length > list.length ? `<button type="button" class="fav fav-add" id="favAll"><span class="fav-ring"><span class="fav-av">⋯</span></span><b>Tous</b><small>${prochesList().length}</small></button>` : ""}
      ${typeof socOn === "function" && socOn() ? `<button type="button" class="fav fav-add" id="favAdd"><span class="fav-ring"><span class="fav-av">+</span></span><b>Ajouter</b><small>@tag, QR</small></button>` : ""}</div>`;
}
function favBind(root) {
  root.querySelectorAll("[data-fav]").forEach(b => b.onclick = () => favTap(b.dataset.fav));
  const a = root.querySelector("#favAdd"); if (a) a.onclick = () => favAddContact();
  const all = root.querySelector("#favAll"); if (all) all.onclick = () => favAllOpen();
}
// Rembourser un proche : ce que je lui dois (dette, demande reçue, part dans un groupe)
function favPayNow(p) {
  const it = p.items.find(x => x.dir === "out"); if (!it) { toast(`Tu ne dois rien à ${favFirst(p.name)} 👍`); return; }

        if (it.k === "rin") { switchTab("dettes"); return setTimeout(() => reqPay(it.id), 200); }
        if (it.k === "d") { const d = debts[it.id], c = d && d.claim && SOC.in.find(y => y.id === d.claim); if (c && c.pay) return showPay(c.pay, debtCalc(d).remaining, d.name, p.name, () => setTimeout(() => addPayment({ ...d, id: it.id }), 250)); return addPayment({ ...d, id: it.id }); }
        if (it.k === "g") { const g = groups[it.gid]; if (g.pays && g.pays[it.s.to]) return showPay(g.pays[it.s.to], it.amount, g.name, p.name, () => { g.expenses = g.expenses || {}; g.expenses[newId()] = { kind: "transfer", from: it.s.from, to: it.s.to, amount: it.amount, date: todayISO(), created: Date.now(), updated: Date.now() }; saveGroups(); render(); toast("Remboursement enregistré"); }); openGroup = it.gid; switchTab("partage"); }
}
// Toucher un proche : la discussion s'il a l'appli (avec Demander / Rembourser en haut), sinon sa fiche
function favTap(key) {
  const p = prochesList().find(x => x.key === key); if (!p) return;
  if (p.tag && typeof dmOpen === "function" && typeof socOn === "function" && socOn()) return dmOpen(p.tag, p.name);
  favOpen(key);
}
// Tous mes proches, en liste
function favAllOpen() {
  const list = prochesList();
  const f = openForm(`<div class="f2"><h3>Mes proches (${list.length})</h3><div class="pm-list">${list.map(p => { const st = favStatus(p);
    return `<button type="button" class="pm-row" data-fa2="${esc(p.key)}"><span class="fav-av" data-avtag="${esc(p.tag || "")}" style="background:${favColor(p.key)};width:38px;height:38px;font-size:1rem">${esc(favFirst(p.name).charAt(0))}</span><span class="pm-t"><b>${esc(p.name)}</b>${p.tag ? `<small>@${esc(p.tag)}</small>` : ""}</span><span class="fav-st ${st.cls}" style="font-size:.8rem;font-weight:600">${esc(st.txt)}</span></button>`; }).join("")}</div></div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Fermer";
  f.querySelectorAll("[data-fa2]").forEach(b => b.onclick = () => { closeForm(); setTimeout(() => favOpen(b.dataset.fa2), 220); });
}
// Ajouter un proche : @tag (recherche) ou scanner son QR code
function favAddContact() {
  const f = openForm(`<div class="f2"><h3>Ajouter un proche</h3><label class="lbl" for="faFind">Son @tag Bourselle</label>
    <input class="field" id="faFind" placeholder="@paul…" autocapitalize="off" spellcheck="false" autocomplete="off"><div id="faRes"></div>
    <div class="fav-btns">${"BarcodeDetector" in window ? `<button type="button" class="btn" id="faScan">📷 Scanner son QR</button>` : ""}<button type="button" class="btn" id="faMine">Montrer mon QR</button></div>
    ${"BarcodeDetector" in window ? "" : `<p class="hint" style="margin:6px 0 0">Pour scanner son QR code, utilise l'appareil photo de ton téléphone.</p>`}
    <p class="hint" style="margin:8px 0 0">Sans l'appli ? Ajoute-le simplement dans un groupe (Entre proches › + Nouveau groupe) : il apparaîtra ici.</p></div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true;
  tagPicker(f.querySelector("#faFind"), f.querySelector("#faRes"), (tag, nm) => {
    if (!socContacts().some(c => c.tag === tag)) { settings.contacts = socContacts().concat([{ tag, name: nm || "", added: todayISO() }]); socAdded(tag); }
    const pins = favPins(); if (!pins.includes("@" + tag)) pins.unshift("@" + tag);
    saveSettings(); closeForm(); render(); toast(`@${tag} ajouté à tes proches ⭐`);
  });
  const sc = f.querySelector("#faScan"); if (sc) sc.onclick = () => { closeForm(); setTimeout(socScanQr, 200); };
  f.querySelector("#faMine").onclick = () => { closeForm(); setTimeout(() => socShowQr(), 200); };
  setTimeout(() => f.querySelector("#faFind").focus(), 80);
}
// La fiche d'un proche
function favOpen(key) {
  const p = prochesList().find(x => x.key === key); if (!p) return;
  const st = favStatus(p), money = (v, c) => typeof fmtCur === "function" ? fmtCur(v, c || baseCurrency()) : eur(v);
  const groupsIn = [...new Set(p.groups)].filter(g => groups[g]);
  const f = openForm(`<div class="f2 fav-sheet"><div class="fav-head"><span class="fav-av big" data-avtag="${esc(p.tag || "")}" style="background:${favColor(p.key)}">${esc(favFirst(p.name).charAt(0))}</span>
      <div><h3 style="margin:0">${esc(p.name)}</h3><small class="hint">${p.tag ? "@" + esc(p.tag) : "sans l'appli"}</small><div class="fav-st ${st.cls}">${esc(st.txt)}</div></div></div>
    <div class="fav-acts">
      <button type="button" class="fav-act" data-fa="pay" ${p.due > 0.004 ? "" : "disabled"}><span>💸</span>Payer</button>
      <button type="button" class="fav-act" data-fa="ask"><span>🙋</span>Demander</button>
      <button type="button" class="fav-act" data-fa="share"><span>🧾</span>Partager une dépense</button>
      <button type="button" class="fav-act" data-fa="remind" ${p.owe > 0.004 ? "" : "disabled"}><span>🔔</span>Relancer</button>
    </div>
    ${p.tag && typeof dmOpen === "function" ? `<div class="fav-btns" style="margin:-4px 0 12px"><button type="button" class="btn primary" data-fa="dm">💬 Écrire à ${esc(favFirst(p.name))}${typeof dmUnread === "function" && dmUnread(p.tag) ? ` <i class="badge">${dmUnread(p.tag)}</i>` : ""}</button><button type="button" class="btn" data-fa="act">📅 Une activité ensemble</button></div>` : ""}
    ${p.items.length ? `<span class="lbl">Entre vous</span>${p.items.map((it, i) => `<button type="button" class="fav-it ${it.dir}" data-fi="${i}"><span>${esc(it.label)}<small>${esc(it.k === "g" ? "groupe" : it.k === "d" ? "dette" : it.pend ? "dit avoir payé : à confirmer" : "demande de paiement")}</small></span><b class="num">${it.dir === "in" ? "+" : "−"}${esc(money(it.amount, it.cur))}</b></button>`).join("")}` : `<p class="hint">Rien en cours entre vous.</p>`}
    ${groupsIn.length ? `<span class="lbl">Groupes en commun</span><div class="chips">${groupsIn.map(g => `<button type="button" class="chip" data-fg="${esc(g)}">${esc(groups[g].name)}</button>`).join("")}</div>` : ""}
    ${(() => { const bd = (settings.bdays || []).find(x => (p.tag && x.tag === p.tag) || norm(x.name) === norm(favFirst(p.name)) || norm(x.name) === norm(p.name)); return `<div class="fav-bd" id="favBdW"><button type="button" class="linkbtn" id="favBd">${bd ? `🎂 Anniversaire : ${Number(bd.d.slice(3))} ${MOIS[Number(bd.d.slice(0, 2)) - 1]} · modifier` : "🎂 Ajouter son anniversaire"}</button></div>`; })()}
    <button type="button" class="linkbtn" id="favPin" style="margin-top:12px">${p.pinned ? "Retirer des favoris" : "⭐ Épingler en favori"}</button>
    <button type="button" class="linkbtn" id="favDel" style="margin-top:4px;color:var(--bad)">Retirer de mes proches</button></div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Fermer";
  const go = fn => { closeForm(); setTimeout(fn, 220); };
  const openItem = it => {
    if (it.k === "g") { openGroup = it.gid; return switchTab("partage"); }
    if (it.k === "d") return switchTab("dettes");
    if (it.k === "rin") { switchTab("dettes"); return setTimeout(() => reqPay(it.id), 200); }
    if (it.k === "rout") return editPay();
  };
  f.querySelectorAll("[data-fi]").forEach(b => b.onclick = () => go(() => openItem(p.items[+b.dataset.fi])));
  f.querySelectorAll("[data-fg]").forEach(b => b.onclick = () => go(() => { openGroup = b.dataset.fg; switchTab("partage"); }));
  f.querySelector("#favDel").onclick = e => {
    const b = e.currentTarget; if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = `Retirer ${favFirst(p.name)} ? Touche encore pour confirmer`; setTimeout(() => { b.dataset.c = ""; b.textContent = "Retirer de mes proches"; }, 4000); return; }
    if (p.tag) settings.contacts = socContacts().filter(c => c.tag !== p.tag);
    const pins = favPins(), i = pins.indexOf(p.key); if (i >= 0) pins.splice(i, 1);
    settings.prochesHidden = [...new Set([...(settings.prochesHidden || []), p.key])];
    saveSettings(); closeForm(); render();
    toast(p.owe || p.due ? `${favFirst(p.name)} reste affiché tant qu'il y a de l'argent en cours entre vous` : `${favFirst(p.name)} est retiré de tes proches`);
  };
  f.querySelector("#favBd").onclick = () => {
    const w = f.querySelector("#favBdW"); w.innerHTML = `<div class="two" style="align-items:end"><div><label class="lbl" for="favBdD">Anniversaire de ${esc(favFirst(p.name))}</label><input class="field" id="favBdD" type="date"></div><button type="button" class="btn primary" id="favBdOk">OK</button></div><p class="hint" style="margin:4px 0 0">L'année ne compte pas. Bourselle te prévient une semaine avant.</p>`;
    w.querySelector("#favBdOk").onclick = () => { const v = w.querySelector("#favBdD").value; if (!v) { toast("Choisis la date"); return; }
      settings.bdays = (settings.bdays || []).filter(x => !((p.tag && x.tag === p.tag) || norm(x.name) === norm(favFirst(p.name)) || norm(x.name) === norm(p.name)));
      settings.bdays.push({ name: favFirst(p.name), d: v.slice(5), tag: p.tag || "" }); saveSettings(); closeForm(); render(); toast(`🎂 Noté : tu seras prévenu avant l'anniversaire de ${favFirst(p.name)}`); };
  };
  f.querySelector("#favPin").onclick = () => { const pins = favPins(), i = pins.indexOf(p.key); if (i >= 0) pins.splice(i, 1); else pins.unshift(p.key); saveSettings(); closeForm(); render(); toast(i >= 0 ? "Retiré des favoris" : `${favFirst(p.name)} est en favori ⭐`); };
  f.querySelectorAll("[data-fa]").forEach(b => b.onclick = () => {
    const a = b.dataset.fa;
    if (a === "dm") return go(() => dmOpen(p.tag, p.name));
    if (a === "act") return go(() => actNew({ with: [], invite: [p.tag], preInvite: p.tag }));
    if (a === "ask") return go(() => p.tag ? editPay({ to: p.tag }) : editPay());
    if (a === "share") return go(() => favShareExpense(p));
    if (a === "pay") { if (!p.items.some(x => x.dir === "out")) return; return go(() => favPayNow(p)); }
    if (a === "remind") {
      const it = p.items.find(x => x.dir === "in"); if (!it) return;
      return go(async () => {
        if (it.k === "g") return groupRemind(it.gid, [it.s]);
        const claimId = it.k === "rout" ? it.id : it.k === "d" ? (debts[it.id] || {}).claim : "";
        if (claimId && p.tag) { const msg = await remindPick(p.name, money(it.amount, it.cur), it.label); if (!msg) return; const r = await reqAct(claimId, { action: "remind", msg }); if (r) toast(r.reminded === "recent" ? "Déjà relancé il y a moins de 6 h" : `Rappel envoyé à ${favFirst(p.name)}`); return; }
        const msg = await remindPick(p.name, money(it.amount, it.cur), it.label); if (msg) shareText(`${favFirst(p.name)}, ${msg.charAt(0).toLowerCase() + msg.slice(1)}`);
      });
    }
  });
}
// Partager une dépense avec ce proche : dans un groupe en commun, sinon un petit groupe à deux
function favShareExpense(p) {
  const common = [...new Set(p.groups)].filter(g => groups[g]);
  if (common.length === 1) return editGroupExpense(common[0], null);
  if (common.length > 1) {
    const f = openForm(`<div class="f2"><h3>Dans quel groupe ?</h3><div class="pm-list">${common.map(g => `<button type="button" class="pm-row" data-g="${esc(g)}"><span class="pm-t"><b>${esc(groups[g].name)}</b><small>${groups[g].members.length} personnes</small></span><span class="pm-chev">›</span></button>`).join("")}</div></div>`, () => true);
    f.querySelector("button[type=submit]").hidden = true;
    f.querySelectorAll("[data-g]").forEach(b => b.onclick = () => { closeForm(); setTimeout(() => editGroupExpense(b.dataset.g, null), 220); });
    return;
  }
  favGroupWith([p], gid => editGroupExpense(gid, null));
}
// Trouver le groupe « moi + ces personnes », sinon le créer
function favGroupWith(people, then) {
  const want = people.map(p => p.key).sort().join("|");
  const keyOf = (g, m) => { const t = m.tag || (g.owner && g.ownerMid === m.id ? g.owner : ""); return t ? "@" + t : "n:" + String(m.name || "").trim().toLowerCase(); };
  const found = Object.entries(groups).find(([, g]) => g.members.filter(m => m.id !== g.me).map(m => keyOf(g, m)).sort().join("|") === want);
  if (found) return void setTimeout(() => then(found[0]), 250);
  const u = store && store.id !== "local" && store.user ? store.user() : {}, meName = favFirst(u.name || "Moi") || "Moi";
  const rid = () => "m" + Math.random().toString(36).slice(2, 8), gid = newId(), meId = rid();
  const others = people.map(p => ({ id: rid(), name: p.name.startsWith("@") ? favFirst(p.name) : p.name, ...(p.tag ? { tag: p.tag } : {}) }));
  const name = people.length === 1 ? `${meName} & ${favFirst(people[0].name)}` : `${meName}, ${people.map(p => favFirst(p.name)).join(", ")}`.slice(0, 60);
  groups[gid] = { name, me: meId, members: [{ id: meId, name: meName }, ...others], expenses: {}, created: Date.now() };
  saveGroups(); toast(`Groupe « ${name} » créé`);
  setTimeout(() => then(gid), 250);
}
// Depuis une dépense : « Partager avec des proches… » (un groupe, ou des proches choisis). Leur part leur est envoyée.
function shareExpenseWith(t) {
  const gl = Object.entries(groups || {}), people = prochesList(), sel = new Set();
  const f = openForm(`<div class="f2"><h3>Partager cette dépense</h3>
    <p style="margin:0 0 10px"><b>${esc(t.label)}</b> · <span class="num">${esc(eur(t.amount))}</span></p>
    ${gl.length ? `<span class="lbl">Dans un groupe</span><div class="pm-list">${gl.map(([id, g]) => `<button type="button" class="pm-row" data-sg="${esc(id)}"><span class="pm-t"><b>${esc(g.name)}</b><small>${g.members.length} personnes</small></span><span class="pm-chev">›</span></button>`).join("")}</div>` : ""}
    ${people.length ? `<span class="lbl">${gl.length ? "Ou avec" : "Avec"} des proches</span><div class="chips" id="seP">${people.slice(0, 16).map((p, i) => `<button type="button" class="chip" data-sp="${i}" aria-pressed="false">${esc(favFirst(p.name))}</button>`).join("")}</div>` : ""}
    <p class="hint" style="margin:8px 0 0">Tu choisis ensuite qui a payé et la part de chacun. Ceux qui ont Bourselle la reçoivent dans leur appli.</p></div>`, () => {
    if (!sel.size) { toast(people.length ? "Choisis au moins une personne" : "Crée d'abord un groupe"); return false; }
    favGroupWith([...sel].map(i => people[i]), gid => editGroupExpense(gid, null, t));
  });
  const sb = f.querySelector("button[type=submit]"); sb.textContent = "Partager"; sb.hidden = !people.length;
  f.querySelectorAll("[data-sp]").forEach(b => b.onclick = () => { const i = +b.dataset.sp; sel.has(i) ? sel.delete(i) : sel.add(i); b.setAttribute("aria-pressed", sel.has(i)); });
  f.querySelectorAll("[data-sg]").forEach(b => b.onclick = () => { closeForm(); setTimeout(() => editGroupExpense(b.dataset.sg, null, t), 220); });
}
// ---------- Le fil des proches : dépenses, remboursements, cagnottes, avec réactions et commentaires ----------
const FEED_EMO = ["👍", "❤️", "😂", "🙏"];
let feedMore = false;
function feedEvents() {
  const ev = [], me = typeof SOC !== "undefined" ? SOC.tag : "";
  for (const [gid, g] of Object.entries(groups || {})) {
    const nm = id => (g.members.find(m => m.id === id) || { name: "?" }).name;
    const who = (id, verb) => id === g.me ? `Tu as ${verb}` : `${nm(id)} a ${verb}`;
    const refund = e => e.from === g.me ? `Tu as remboursé ${nm(e.to)}` : e.to === g.me ? `${nm(e.from)} t'a remboursé` : `${nm(e.from)} a remboursé ${nm(e.to)}`;
    const ncom = eid => Object.values(g.comments || {}).filter(c => c && !c.deleted && c.eid === eid).length;
    for (const [eid, e] of Object.entries(liveExp(g))) {
      const at = e.updated || e.created || Date.parse(e.date) || 0;
      if (e.kind === "transfer") ev.push({ at, gid, eid, ic: "💸", t: refund(e), tr: true, amt: e.amount, s: g.name, rx: true });
      else ev.push({ at, gid, eid, ic: "🧾", t: who(e.paidBy, `payé « ${e.label} »`), amt: e.amount, s: g.name, rx: true, com: ncom(eid), photo: !!e.photo });
    }
    for (const c of Object.values(g.comments || {})) if (c && !c.deleted && c.text && !c.eid) ev.push({ at: c.at, gid, ic: "💬", t: `${c.by === g.me ? "Toi" : nm(c.by)} : ${c.text.length > 80 ? c.text.slice(0, 79) + "…" : c.text}`, s: g.name });
  }
  if (typeof DEALS !== "undefined") for (const d of DEALS) {
    const ic = d.kind === "achat" ? "🛒" : "🎁";
    for (const p of Object.values(d.parts || {})) if (p && p.at) ev.push({ at: p.at, did: d.id, ic, t: `${p.name} participe${d.kind === "achat" ? ` · ${p.qty} place${p.qty > 1 ? "s" : ""}` : ""}`, amt: d.kind === "achat" ? 0 : p.amount, cur: d.cur, s: d.title });
    if (d.status && d.status !== "open" && d.updated) ev.push({ at: d.updated, did: d.id, ic: "🏁", t: d.kind === "achat" ? "Achat groupé clôturé" : "Cagnotte clôturée", s: d.title });
  }
  if (typeof SOC !== "undefined") {
    for (const c of SOC.out || []) if (c.kind === "req" && c.to && c.status === "settled") ev.push({ at: c.updated, ic: "✅", t: `@${c.to} t'a payé`, amt: c.amount, cur: c.cur, s: c.name || "Demande de paiement" });
    for (const c of SOC.in || []) if (c.kind === "req" && c.status === "settled") ev.push({ at: c.updated, ic: "✅", t: `Tu as payé ${c.fromName || "@" + c.from}`, amt: c.amount, cur: c.cur, s: c.name || "Demande de paiement" });
  }
  const from = Math.max(Date.now() - ACT_DAYS * 864e5, Number(settings.actCleared) || 0);
  return ev.filter(x => x.at && x.at > from).sort((a, b) => b.at - a.at);
}
function feedReacts(g, eid) {
  const cnt = {}; let mine = "";
  for (const [k, r] of Object.entries(g.reacts || {})) { const [cid, who] = k.split("|"); if (cid !== eid || !r || !r.e) continue; cnt[r.e] = (cnt[r.e] || 0) + 1; if (who === g.me) mine = r.e; }
  return { cnt, mine };
}
function feedHTML() {
  const all = feedEvents(); if (!all.length) return "";
  const list = all.slice(0, feedMore ? 30 : 8), money = (v, c) => typeof fmtCur === "function" ? fmtCur(v, c || baseCurrency()) : eur(v);
  return `<div class="hub-sec"><span>Le fil des proches</span><button type="button" class="linkbtn act-clear" data-actclear>Effacer</button></div><div class="card feed">${list.map((e, i) => {
    let bar = "";
    if (e.rx && groups[e.gid]) {
      const { cnt, mine } = feedReacts(groups[e.gid], e.eid);
      bar = `<div class="feed-rx">${FEED_EMO.map(x => `<button type="button" data-frx="${i}" data-e="${x}" class="${mine === x ? "on" : ""}" aria-pressed="${mine === x}">${x}${cnt[x] ? `<small>${cnt[x]}</small>` : ""}</button>`).join("")}${!e.tr ? `<button type="button" data-fcom="${i}" class="feed-com">💬${e.com ? `<small>${e.com}</small>` : ""} Commenter</button>` : ""}</div>`;
    }
    return `<div class="feed-it"><button type="button" class="feed-main" data-fev="${i}"><span class="feed-ic">${e.ic}</span><span class="feed-tx"><span>${esc(e.t)}${e.photo ? " 📷" : ""}</span><small>${esc(e.s)} · ${esc(agoText(e.at))}</small></span>${e.amt ? `<b class="num">${esc(money(e.amt, e.cur))}</b>` : ""}</button>${bar}</div>`;
  }).join("")}${all.length > list.length ? `<button type="button" class="linkbtn feed-more" id="feedMore">Voir plus</button>` : ""}</div>`;
}
function feedBind(root) {
  const all = feedEvents(), list = all.slice(0, feedMore ? 30 : 8);
  root.querySelectorAll("[data-fev]").forEach(b => b.onclick = () => {
    const e = list[+b.dataset.fev]; if (!e) return;
    if (e.did) return showDeal(e.did);
    if (e.gid && e.eid && !e.tr) return editGroupExpense(e.gid, e.eid);
    if (e.gid) { openGroup = e.gid; render(); window.scrollTo(0, 0); return; }
    switchTab("dettes");
  });
  root.querySelectorAll("[data-frx]").forEach(b => b.onclick = () => {
    const e = list[+b.dataset.frx], g = e && groups[e.gid]; if (!g) return;
    const { mine } = feedReacts(g, e.eid), x = b.dataset.e;
    g.reacts = g.reacts || {}; g.reacts[e.eid + "|" + g.me] = { e: mine === x ? "" : x, at: Date.now() };
    saveGroups(); render();
  });
  root.querySelectorAll("[data-fcom]").forEach(b => b.onclick = () => {
    const e = list[+b.dataset.fcom]; if (!e) return; editGroupExpense(e.gid, e.eid);
    setTimeout(() => { const t = document.querySelector("#geCom textarea, #geCom input"); if (t) { t.scrollIntoView({ block: "center" }); t.focus(); } }, 350);
  });
  const m = root.querySelector("#feedMore"); if (m) m.onclick = () => { feedMore = true; render(); };
}
// ---------- Défis d'épargne entre amis ----------
// « 500 € chacun d'ici l'été » : chacun avance à son rythme. Le serveur ne reçoit que le pourcentage de chacun ;
// ce que j'ai mis de côté reste chez moi (dans mon Drive), ou vient d'un de mes objectifs d'épargne.
let CHALS = [], chalSyncT = null;
const chalMine = id => ((settings.chalMine = settings.chalMine || {})[id] = settings.chalMine[id] || { saved: 0, goal: "" });
const chalSaved = (c) => { const m = chalMine(c.id); return m.goal && typeof goals !== "undefined" && goals[m.goal] ? goalSaved(m.goal) : Number(m.saved) || 0; };
const chalPct = c => Math.max(0, Math.min(100, Math.round(chalSaved(c) / c.target * 100)));
const chalMoney = (v, c) => typeof fmtCur === "function" ? fmtCur(v, c.cur || baseCurrency()) : eur(v);
const chalDaysLeft = c => c.end ? Math.ceil((Date.parse(c.end + "T23:59:59") - Date.now()) / 864e5) : null;
async function chalRefresh() {
  if (!(typeof socOn === "function" && socOn())) return;
  try {
    const j = await socApi("/challenges"); CHALS = j.challenges || [];
    // Les défis liés à un objectif d'épargne avancent tout seuls
    for (const c of CHALS) if (c.me && chalPct(c) !== c.me.pct && chalMine(c.id).goal) chalPush(c.id);
    if (!chalRefresh.link) { chalRefresh.link = true; let id = ""; try { id = sessionStorage.getItem("bourselle-defi") || ""; sessionStorage.removeItem("bourselle-defi"); } catch (e) {} if (id) setTimeout(() => chalOpen(id), 400); }
    if (typeof tab !== "undefined" && tab === "partage" && !openGroup && !document.querySelector("#sheet2Root.open")) render();
  } catch (e) {}
}
// Lien « ?defi=… » : gardé jusqu'à la connexion
{ const d = new URLSearchParams(location.search).get("defi"); if (d && /^[a-z0-9]{12}$/.test(d)) { try { sessionStorage.setItem("bourselle-defi", d); } catch (e) {} history.replaceState(null, "", location.pathname); } }
async function chalAct(id, body) {
  try { const j = await socApi("/challenges/" + id, { method: "POST", body: JSON.stringify(body) }); if (j.challenge) { const i = CHALS.findIndex(x => x.id === id); if (i >= 0) CHALS[i] = j.challenge; else CHALS.unshift(j.challenge); } return j; }
  catch (e) { toast(e.message); return null; }
}
function chalPush(id) {
  clearTimeout(chalSyncT);
  chalSyncT = setTimeout(async () => { const c = CHALS.find(x => x.id === id); if (!c || !c.me) return; const was = c.me.pct, j = await chalAct(id, { action: "progress", pct: chalPct(c) }); if (j && j.challenge.me.pct >= 100 && was < 100) toast(`🎉 Défi réussi : ${c.title} !`); if (tab === "partage" && !openGroup) render(); }, 300);
}
function chalBars(c) {
  return `<div class="chal-bars">${c.members.slice(0, 6).map(m => { const me = m.tag === SOC.tag;
    return `<div class="chal-m${me ? " me" : ""}"><span>${esc(me ? "Toi" : favFirst(m.name || m.tag))}</span><i><b style="width:${m.pct}%"></b></i><small class="num">${m.pct >= 100 ? "🏆" : m.pct + " %"}</small></div>`; }).join("")}
    ${c.members.length > 6 ? `<small class="hint">+ ${c.members.length - 6} autres</small>` : ""}</div>`;
}
function chalHTML() {
  if (!(typeof socOn === "function" && socOn())) return "";
  const list = CHALS.slice().sort((a, b) => b.invited - a.invited || (b.updated || 0) - (a.updated || 0));
  return `<div class="hub-sec"><span>Défis d'épargne</span><button class="linkbtn" id="chalNew">+ Lancer un défi</button></div>
    ${list.length ? list.map(c => { const dl = chalDaysLeft(c);
      return `<button type="button" class="card chal" data-chal="${esc(c.id)}"><div class="chal-top"><b>🏁 ${esc(c.title)}</b><small><span>${esc(chalMoney(c.target, c))} chacun</span>${dl != null ? ` · <span>${dl > 0 ? `J-${dl}` : "terminé"}</span>` : ""}</small></div>
        ${c.invited ? `<p class="chal-inv">@${esc(c.ownerTag)} te lance le défi · ${c.members.length} participant${c.members.length > 1 ? "s" : ""}</p><span class="btn primary chal-go">Voir le défi</span>` : chalBars(c)}</button>`; }).join("")
    : `<button type="button" class="card chal chal-empty" id="chalNew2"><b>Épargnez ensemble, chacun à son rythme</b><small>« 500 € chacun d'ici l'été » : on voit qui avance, en % seulement. Personne ne voit tes montants.</small></button>`}`;
}
// Défis d'épargne mis en avant dans « Entre proches » (même sans activer la fonction) : une rangée de cartes avec ta place
function chalStripHTML() {
  if (!(typeof socOn === "function" && socOn())) return "";
  const list = CHALS.filter(c => !c.invited && !c.deleted && (chalDaysLeft(c) == null || chalDaysLeft(c) > -7)).sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 6);
  if (!list.length) return `<button type="button" class="card chs-teaser" id="chalNew3"><span class="chs-emo">🏁</span><span><b>Un défi d'épargne entre amis ?</b><small>« 500 € chacun d'ici l'été » : un classement en %, personne ne voit tes montants.</small></span><i>›</i></button>`;
  return `<div class="ep-cap"><span>🏁 Défis d'épargne</span><button class="linkbtn" id="chalNew4">+ Lancer</button></div><div class="chs-row">${list.map(c => {
    const sorted = c.members.slice().sort((a, b) => b.pct - a.pct), rank = sorted.findIndex(m => m.tag === SOC.tag) + 1, me = c.members.find(m => m.tag === SOC.tag) || { pct: 0 }, dl = chalDaysLeft(c);
    return `<button type="button" class="chs" data-chal="${esc(c.id)}"><b>${esc(c.title)}</b><span class="chs-pct num">${me.pct >= 100 ? "🏆" : me.pct + " %"}</span><i><b style="width:${Math.min(100, me.pct)}%"></b></i>
      <small>${rank ? `${rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank + "e"} sur ${c.members.length}` : ""}${dl != null ? ` · ${dl > 0 ? `J-${dl}` : "terminé"}` : ""}</small></button>`; }).join("")}</div>`;
}
function chalBind(root) {
  root.querySelectorAll("[data-chal]").forEach(b => b.onclick = () => chalOpen(b.dataset.chal));
  ["#chalNew", "#chalNew2", "#chalNew3", "#chalNew4"].forEach(s => { const b = root.querySelector(s); if (b) b.onclick = () => chalNew(); });
}
function chalNew() {
  const pick = new Set(), people = prochesTagged().slice(0, 12);
  const ideas = [["500 € d'ici l'été", 500], ["Fonds d'urgence", 1000], ["Cadeaux de Noël", 300], ["Vacances", 800]];
  const f = openForm(`<div class="f2"><h3>Lancer un défi d'épargne</h3>
    <div class="chips" id="chIdeas">${ideas.map(([t, v], i) => `<button type="button" class="chip" data-idea="${i}">${esc(t)}</button>`).join("")}</div>
    ${fld("chTitle", "Nom du défi", `placeholder="ex. 500 € d'ici l'été" maxlength="60"`)}
    <div class="two"><div>${fld("chTarget", `Objectif par personne (${esc(typeof curSym === "function" ? curSym() : "€")})`, `inputmode="decimal" placeholder="500"`)}</div><div>${fld("chEnd", "Jusqu'au", `type="date"`)}</div></div>
    <span class="lbl">Inviter</span>${people.length ? `<div class="chips" id="chPeople">${people.map(p => `<button type="button" class="chip" data-tag="${esc(p.tag)}" aria-pressed="false">${esc(p.name || "@" + p.tag)}</button>`).join("")}</div>` : ""}
    <input class="field" id="chFind" placeholder="Chercher un @tag…" autocapitalize="off" spellcheck="false" autocomplete="off" style="margin-top:8px"><div id="chRes"></div>
    <p class="hint" style="margin:8px 0 0">Chacun ne voit que le pourcentage atteint par les autres. Tu pourras aussi partager un lien.</p></div>`, () => {
    const title = f.querySelector("#chTitle").value.trim(), target = parseAmount(f.querySelector("#chTarget").value), end = f.querySelector("#chEnd").value;
    if (!title) { toast("Donne un nom au défi"); return false; }
    if (!(target > 0)) { toast("Indique l'objectif par personne"); return false; }
    (async () => {
      try {
        const u = store && store.user ? store.user() : {};
        const j = await socApi("/challenges", { method: "POST", body: JSON.stringify({ title, target, end, cur: baseCurrency(), invite: [...pick], name: favFirst(u.name || "") }) });
        CHALS.unshift(j.challenge); render(); toast(pick.size ? `Défi lancé : ${pick.size} invitation${pick.size > 1 ? "s" : ""} envoyée${pick.size > 1 ? "s" : ""}` : "Défi lancé"); setTimeout(() => chalOpen(j.challenge.id), 300);
      } catch (e) { toast(e.message); }
    })();
  });
  f.querySelector("button[type=submit]").textContent = "Lancer le défi";
  const d = new Date(); d.setMonth(d.getMonth() + 6); f.querySelector("#chEnd").value = d.toISOString().slice(0, 10);
  f.querySelectorAll("[data-idea]").forEach(b => b.onclick = () => { const [t, v] = ideas[+b.dataset.idea]; f.querySelector("#chTitle").value = t; f.querySelector("#chTarget").value = v; });
  const tog = b => { const t = b.dataset.tag; pick.has(t) ? pick.delete(t) : pick.add(t); b.setAttribute("aria-pressed", pick.has(t)); };
  f.querySelectorAll("#chPeople [data-tag]").forEach(b => b.onclick = () => tog(b));
  tagPicker(f.querySelector("#chFind"), f.querySelector("#chRes"), (tag, nm) => {
    let b = f.querySelector(`#chPeople [data-tag="${tag}"]`);
    if (!b) { let box = f.querySelector("#chPeople"); if (!box) { box = document.createElement("div"); box.className = "chips"; box.id = "chPeople"; f.querySelector("#chFind").before(box); } box.insertAdjacentHTML("beforeend", `<button type="button" class="chip" data-tag="${esc(tag)}" aria-pressed="false">${esc(nm || "@" + tag)}</button>`); b = box.lastElementChild; b.onclick = () => tog(b); }
    if (!pick.has(tag)) tog(b); f.querySelector("#chFind").value = "";
  });
}
async function chalOpen(id) {
  let c = CHALS.find(x => x.id === id);
  if (!c) { try { c = (await socApi("/challenges/" + id)).challenge; } catch (e) { toast("Ce défi n'existe plus"); return; } }
  const dl = chalDaysLeft(c), link = (typeof appBase === "function" ? appBase() : "./") + "?defi=" + c.id;
  if (!c.me) {
    const f = openForm(`<div class="f2"><h3>🏁 ${esc(c.title)}</h3><p style="margin:0 0 8px">@${esc(c.ownerTag)} te lance un défi : <b>${esc(chalMoney(c.target, c))}</b> à mettre de côté${c.end ? ` d'ici le ${esc(frDate(c.end))}` : ""}.</p>
      ${chalBars(c)}<p class="hint" style="margin:8px 0 0">Chacun avance à son rythme. Les autres ne voient que ton pourcentage, jamais tes montants.</p></div>`, () => {
      (async () => { const j = await chalAct(c.id, { action: "join", name: favFirst((store.user ? store.user() : {}).name || "") }); if (j) { render(); toast("C'est parti ! 💪"); setTimeout(() => chalOpen(c.id), 300); } })();
    });
    f.querySelector("button[type=submit]").textContent = "Relever le défi";
    if (c.invited) { const no = document.createElement("button"); no.type = "button"; no.className = "linkbtn"; no.textContent = "Non merci"; no.style.marginTop = "10px"; f.querySelector(".f2").append(no); no.onclick = async () => { await chalAct(c.id, { action: "decline" }); CHALS = CHALS.filter(x => x.id !== c.id); closeForm(); render(); }; }
    return;
  }
  const mine = chalMine(c.id), gl = typeof goals !== "undefined" ? Object.entries(goals) : [], saved = chalSaved(c), pct = chalPct(c);
  const f = openForm(`<div class="f2 chal-sheet"><h3>🏁 ${esc(c.title)}</h3>
    <p class="hint" style="margin:0 0 10px"><span>${esc(chalMoney(c.target, c))} chacun</span>${c.end ? ` · <span>jusqu'au ${esc(frDate(c.end))}</span> · <span>${dl > 0 ? `J-${dl}` : "terminé"}</span>` : ""}</p>
    <div class="chal-me"><div class="chal-ring" style="--p:${pct}"><span class="num">${pct} %</span></div>
      <div><b class="num">${esc(chalMoney(saved, c))}</b> <span class="hint">sur ${esc(chalMoney(c.target, c))}</span><small class="hint" style="display:block"><span>Visible par toi seul.</span> <span>Les autres voient ${pct} %.</span></small></div></div>
    <span class="lbl">Ce que j'ai mis de côté</span>
    ${gl.length ? `<select class="field" id="chGoal"><option value="">Je le note moi-même</option>${gl.map(([gid, g]) => `<option value="${esc(gid)}" ${mine.goal === gid ? "selected" : ""}>Suivre mon objectif « ${esc(g.name)} »</option>`).join("")}</select>` : ""}
    <div id="chManual" ${mine.goal ? "hidden" : ""}><div class="two"><input class="field" id="chSaved" inputmode="decimal" value="${mine.saved ? esc(String(mine.saved).replace(".", ",")) : ""}" placeholder="Total mis de côté"><button type="button" class="btn" id="chAdd">+ Ajouter</button></div></div>
    <span class="lbl">Le classement</span><div class="chal-board">${c.members.map(m => m.tag === SOC.tag ? { ...m, pct } : m).sort((a, b) => b.pct - a.pct).map((m, i) => { const me = m.tag === SOC.tag;
      return `<div class="chal-row${me ? " me" : ""}"><span class="chal-rk">${m.pct >= 100 ? "🏆" : i + 1}</span><span class="chal-nm">${esc(me ? "Toi" : m.name || "@" + m.tag)}</span><i><b style="width:${m.pct}%"></b></i><small class="num">${m.pct} %</small>${me ? "" : `<button type="button" class="chal-cheer" data-cheer="${esc(m.tag)}" title="Encourager">👏</button>`}</div>`; }).join("")}
      ${(c.pending || []).map(m => `<div class="chal-row pend"><span class="chal-rk">·</span><span class="chal-nm">@${esc(m.tag)}</span><small class="hint">invité</small></div>`).join("")}</div>
    <div class="fav-btns"><button type="button" class="btn" id="chInvite">+ Inviter</button><button type="button" class="btn" id="chShare">Partager le lien</button></div>
    <button type="button" class="linkbtn" id="chQuit" style="margin-top:12px;color:var(--bad)">${c.owner ? "Supprimer le défi" : "Quitter le défi"}</button></div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Fermer";
  const reopen = () => { closeForm(); setTimeout(() => chalOpen(c.id), 220); };
  const g = f.querySelector("#chGoal"); if (g) g.onchange = () => { mine.goal = g.value; saveSettings(); chalPush(c.id); reopen(); };
  const sv = f.querySelector("#chSaved"); if (sv) sv.onchange = () => { const v = parseAmount(sv.value); mine.saved = v > 0 ? v : 0; saveSettings(); chalPush(c.id); reopen(); };
  const ad = f.querySelector("#chAdd"); if (ad) ad.onclick = async () => {
    const v = await new Promise(res => { const h = openForm(`<div class="f2"><h3>J'ai mis de côté</h3>${fld("chPlus", "Montant", `inputmode="decimal" placeholder="50"`)}</div>`, () => res(parseAmount(document.getElementById("chPlus").value))); h.querySelector("#f2Cancel").addEventListener("click", () => res(null)); setTimeout(() => h.querySelector("#chPlus").focus(), 80); });
    if (v > 0) { mine.saved = Math.round(((Number(mine.saved) || 0) + v) * 100) / 100; saveSettings(); chalPush(c.id); toast(`+${chalMoney(v, c)} pour « ${c.title} » 💪`); }
    setTimeout(() => chalOpen(c.id), 250);
  };
  f.querySelectorAll("[data-cheer]").forEach(b => b.onclick = async () => { const j = await chalAct(c.id, { action: "cheer", to: b.dataset.cheer, msg: "Allez, tu vas y arriver ! 👏" }); if (j) toast(j.cheered === "recent" ? "Déjà encouragé il y a moins de 6 h" : "Encouragement envoyé 👏"); });
  f.querySelector("#chShare").onclick = () => shareText(`Je te lance un défi sur Bourselle : ${c.title} (${chalMoney(c.target, c)} chacun). On voit qui avance, en % seulement.`, link, "Lien copié");
  f.querySelector("#chInvite").onclick = () => {
    closeForm(); setTimeout(() => {
      const h = openForm(`<div class="f2"><h3>Inviter au défi</h3><input class="field" id="ciFind" placeholder="@tag…" autocapitalize="off" spellcheck="false" autocomplete="off"><div id="ciRes"></div></div>`, () => true);
      h.querySelector("button[type=submit]").hidden = true;
      tagPicker(h.querySelector("#ciFind"), h.querySelector("#ciRes"), async tag => { const j = await chalAct(c.id, { action: "invite", tags: [tag] }); if (j) { toast(j.invited ? `@${tag} invité` : `@${tag} participe déjà`); closeForm(); setTimeout(() => chalOpen(c.id), 220); } });
      setTimeout(() => h.querySelector("#ciFind").focus(), 80);
    }, 220);
  };
  f.querySelector("#chQuit").onclick = async e => {
    const q = e.currentTarget; if (!q.dataset.sure) { q.dataset.sure = "1"; q.textContent = c.owner ? "Toucher encore pour supprimer le défi pour tout le monde" : "Toucher encore pour quitter le défi"; return; }
    const j = await chalAct(c.id, { action: c.owner ? "delete" : "leave" }); if (!j) return;
    CHALS = CHALS.filter(x => x.id !== c.id); delete settings.chalMine[c.id]; saveSettings(); closeForm(); render(); toast(c.owner ? "Défi supprimé" : "Tu as quitté le défi");
  };
}
