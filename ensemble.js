/* Bourselle — ensemble : écrire à un proche, et monter des activités qu'on finance ensemble.
 * Messagerie : une conversation par proche (qui a Bourselle). On peut y proposer « On finance ensemble ? » :
 * chacun dit s'il est partant, puis on crée l'activité d'un geste.
 * Activité : un budget, des participants (avec ou sans l'appli), chacun verse sa part à l'organisateur.
 * C'est l'organisateur, qui reçoit l'argent, qui confirme. Chaque activité a sa discussion. */
let ACTS = [], DMS = [], dmPoll = null, dmSeen = new Set();
try { dmSeen = new Set(JSON.parse(localStorage.getItem("bourselle-dm-seen") || "[]")); } catch (e) {}
const ensMoney = (v, c) => typeof fmtCur === "function" ? fmtCur(v, c || baseCurrency()) : eur(v);
const ensName = () => favFirst((store && store.user ? store.user() : {}).name || "");
const dmUnread = tag => (DMS.find(t => !t.gid && t.tag === tag) || {}).unread || 0;
const dmTime = at => { const d = new Date(at), t = d.toTimeString().slice(0, 5); return Date.now() - at < 864e5 && d.getDate() === new Date().getDate() ? t : `${frDate(d.toISOString().slice(0, 10)).slice(0, 5)} ${t}`; };
const linkify = s => esc(s).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);

async function ensRefresh() {
  if (!(typeof socOn === "function" && socOn())) return;
  try {
    const [d, a] = await Promise.all([socApi("/dm"), socApi("/acts")]);
    DMS = d.threads || []; ACTS = a.acts || [];
    // Nouveaux messages : un petit mot tout de suite (en plus de la notification sur le téléphone)
    const fresh = DMS.filter(t => t.unread && !dmSeen.has(chatKey(t) + ":" + t.last.id) && !document.querySelector(`.dm-sheet[data-chat="${chatKey(t)}"]`));
    if (fresh.length) {
      const t = fresh[0]; toast(fresh.length === 1 ? `💬 ${chatTitle(t)} : ${t.last.kind === "idea" ? "💡 " + t.last.idea.title : (t.last.text || "").slice(0, 80)}` : `💬 ${fresh.length} nouveaux messages`);
      fresh.forEach(x => dmSeen.add(chatKey(x) + ":" + x.last.id)); try { localStorage.setItem("bourselle-dm-seen", JSON.stringify([...dmSeen].slice(-300))); } catch (e) {}
    }
    if (!ensRefresh.link) {
      ensRefresh.link = true; let dm = "", act = "", gc = "";
      try { dm = sessionStorage.getItem("bourselle-dm") || ""; act = sessionStorage.getItem("bourselle-act") || ""; gc = sessionStorage.getItem("bourselle-gc") || ""; ["dm", "act", "gc"].forEach(k => sessionStorage.removeItem("bourselle-" + k)); } catch (e) {}
      if (dm) setTimeout(() => dmOpen(dm), 400); else if (gc) setTimeout(() => gcOpen(gc), 400); else if (act) setTimeout(() => actOpen(act), 400);
    }
    if (typeof refreshBell === "function") refreshBell(); chatBtnSync();
    if (typeof tab !== "undefined" && tab === "partage" && !openGroup && !document.querySelector("#sheet2Root.open")) render();
  } catch (e) {}
}
// Liens des notifications : « ?dm=tag » et « ?act=id », gardés jusqu'à la connexion
{
  const q = new URLSearchParams(location.search), dm = q.get("dm"), act = q.get("act"), gc = q.get("gc");
  if ((dm && /^[a-z0-9][a-z0-9_-]{2,23}$/.test(dm)) || (act && /^[a-z0-9]{12}$/.test(act)) || (gc && /^[a-z0-9]{12}$/.test(gc))) {
    try { if (dm) sessionStorage.setItem("bourselle-dm", dm); if (act) sessionStorage.setItem("bourselle-act", act); if (gc) sessionStorage.setItem("bourselle-gc", gc); } catch (e) {}
    history.replaceState(null, "", location.pathname);
  }
}

// ---------- Entre proches : onglets « Discussions » et « Projets » ----------
function ensThreadsHTML() {
  if (!(typeof socOn === "function" && socOn())) return `<div class="card"><p class="hint" style="margin:0">Connecte-toi avec Google ou Microsoft pour écrire à tes proches et décider ensemble de ce que vous financez.</p></div>`;
  const threads = DMS.slice().sort((a, b) => b.at - a.at);
  return `<button type="button" class="btn primary" id="dmNew" style="width:100%">✏️ Nouvelle discussion</button>` + (threads.length ? `<div class="card dm-list">${threads.map(t => `<button type="button" class="dm-th${t.unread ? " unread" : ""}" ${t.gid ? `data-gc="${esc(t.gid)}"` : `data-dm="${esc(t.tag)}"`}>${t.gid ? `<span class="fav-av grp">👥</span>` : `<span class="fav-av" style="background:${favColor("@" + t.tag)}">${esc(favFirst(t.name || t.tag).charAt(0))}</span>`}
      <span class="dm-tx"><b>${esc(chatTitle(t))}</b><small>${t.last.from === "sys" ? "" : t.last.mine ? "Toi : " : t.gid ? esc(favFirst(t.last.name || t.last.from)) + " : " : ""}${esc(t.last.kind === "idea" ? "💡 " + t.last.idea.title : t.last.kind === "act" ? "📅 " + (t.last.text || "Projet") : t.last.kind === "place" ? "📍 " + t.last.place.name : t.last.kind === "dates" ? "📅 Dates proposées" : t.last.del ? "Message supprimé" : t.last.text || "")}</small></span>
      <span class="dm-meta"><small>${esc(agoText(t.at))}</small>${t.unread ? `<i>${t.unread}</i>` : ""}</span></button>`).join("")}</div>`
    : `<div class="card"><p class="hint" style="margin:0">Écris à un proche, propose un lieu ou une date, et décidez ensemble de ce que vous financez.</p></div>`);
}
// Une carte de projet en une phrase : « On cotise 300 € à 4 · il manque 100 € », et à droite ta part
function ensActCard(a) {
  const me = a.members.find(m => m.id === a.me), miss = Math.max(0, Math.round((a.budget - a.got) * 100) / 100), n = a.members.length;
  const right = a.invited ? `<span class="act-chip warn">Invitation</span>`
    : a.owner ? (a.members.some(m => m.st === "sent") ? `<span class="act-chip warn">À confirmer</span>` : `<span class="act-chip">Tu organises</span>`)
    : me && me.st === "ok" ? `<span class="act-chip ok">Ta part payée ✓</span>` : me && me.st === "sent" ? `<span class="act-chip">Versée, à confirmer</span>`
    : me ? `<span class="btn primary act-pay" data-actpay="${esc(a.id)}">Verser ${esc(ensMoney(me.share, a.cur))}</span>` : "";
  return `<div class="card act-card" data-act="${esc(a.id)}" role="button" tabindex="0"><div class="act-top"><span class="act-emo">${esc(a.emoji || "📅")}</span><span class="act-tt"><b>${esc(a.title)}</b><small>${[a.when ? frDate(a.when) : "", a.place].filter(Boolean).map(esc).join(" · ")}</small></span></div>
    <div class="act-line"><span>On cotise <b class="num">${esc(ensMoney(a.budget, a.cur))}</b> à ${n} · ${miss > 0 ? `il manque <b class="num">${esc(ensMoney(miss, a.cur))}</b>` : "tout est réuni 🎉"}</span>${right}</div>
    <div class="act-bar"><i style="width:${Math.min(100, Math.round(a.got / a.budget * 100))}%"></i></div></div>`;
}
function ensActsHTML() {
  if (!(typeof socOn === "function" && socOn())) return "";
  const acts = ACTS.filter(a => a.status === "open").sort((a, b) => b.invited - a.invited || (a.when || "9").localeCompare(b.when || "9"));
  return `<button type="button" class="btn primary" id="actNew" style="width:100%">+ Nouveau projet</button>` + (acts.length ? acts.map(ensActCard).join("")
    : `<button type="button" class="card act-card act-empty" id="actNew2"><b>Une sortie, un week-end, un cadeau ?</b><small>Fixez un budget, chacun verse sa part à l'organisateur, de banque à banque. Vous en discutez dans le projet.</small></button>`);
}
function ensHTML() { return ensThreadsHTML() + ensActsHTML(); }
function ensBind(root) {
  root.querySelectorAll("[data-dm]").forEach(b => b.onclick = () => dmOpen(b.dataset.dm));
  root.querySelectorAll("[data-gc]").forEach(b => b.onclick = () => gcOpen(b.dataset.gc));
  root.querySelectorAll("[data-act]").forEach(b => b.onclick = e => { if (e.target.closest("[data-actpay]")) return; actOpen(b.dataset.act); });
  root.querySelectorAll("[data-actpay]").forEach(b => b.onclick = async e => { e.stopPropagation(); const a = ACTS.find(x => x.id === b.dataset.actpay); if (a) actPay(a); });
  ["#actNew", "#actNew2"].forEach(s => { const b = root.querySelector(s); if (b) b.onclick = () => actNew(); });
  const dn = root.querySelector("#dmNew"); if (dn) dn.onclick = () => chatNew();
}
// Nouvelle discussion : choisir un ou plusieurs proches
function chatNew() {
  const pick = new Set(), people = prochesTagged().slice(0, 16);
  const f = openForm(`<div class="f2"><h3>Nouvelle discussion</h3>${people.length ? `<div class="chips" id="cnPeople">${people.map(p => `<button type="button" class="chip" data-tag="${esc(p.tag)}" aria-pressed="false">${esc(p.name || "@" + p.tag)}</button>`).join("")}</div>` : ""}
    <input class="field" id="cnFind" placeholder="Chercher un @tag…" autocapitalize="off" spellcheck="false" autocomplete="off" style="margin-top:8px"><div id="cnRes"></div>
    <p class="hint" style="margin:8px 0 0">Une personne : conversation à deux. Plusieurs : discussion de groupe. Pour ceux qui n'ont pas l'appli, tu pourras envoyer un lien d'invitation.</p></div>`, () => {
    if (!pick.size) { toast("Choisis au moins une personne"); return false; }
    const tags = [...pick];
    if (tags.length === 1) { setTimeout(() => dmOpen(tags[0]), 250); return; }
    (async () => { try { const r = await socApi("/gc", { method: "POST", body: JSON.stringify({ name: ensName(), tags }) }); ensRefresh(); setTimeout(() => gcOpen(r.gc.id), 250); } catch (e) { toast(e.message); } })();
  });
  f.querySelector("button[type=submit]").textContent = "Écrire";
  const tog = b => { const t = b.dataset.tag; pick.has(t) ? pick.delete(t) : pick.add(t); b.setAttribute("aria-pressed", pick.has(t)); };
  f.querySelectorAll("#cnPeople [data-tag]").forEach(b => b.onclick = () => tog(b));
  tagPicker(f.querySelector("#cnFind"), f.querySelector("#cnRes"), (tag, nm) => {
    let b = f.querySelector(`#cnPeople [data-tag="${tag}"]`);
    if (!b) { let c = f.querySelector("#cnPeople"); if (!c) { c = document.createElement("div"); c.className = "chips"; c.id = "cnPeople"; f.querySelector("#cnFind").before(c); } c.insertAdjacentHTML("beforeend", `<button type="button" class="chip" data-tag="${esc(tag)}" aria-pressed="false">${esc(nm || "@" + tag)}</button>`); b = c.lastElementChild; b.onclick = () => tog(b); }
    if (!pick.has(tag)) tog(b); f.querySelector("#cnFind").value = "";
  });
}
// Icône 💬 en haut : la messagerie, avec le nombre de non-lus
function chatBtnSync() {
  const b = document.getElementById("chatBtn"), d = document.getElementById("chatDot"); if (!b) return;
  b.hidden = !(typeof socOn === "function" && socOn());
  const n = DMS.reduce((a, t) => a + (t.unread || 0), 0); if (d) { d.hidden = !n; d.textContent = n > 9 ? "9+" : n || ""; }
  b.onclick = () => { epSub = "discussions"; try { localStorage.setItem("bourselle-ep", "discussions"); } catch (e) {} if (typeof openGroup !== "undefined") openGroup = null; switchTab("partage"); };
}
// ---------- Messagerie (à deux, ou à plusieurs) ----------
// ref = { tag } pour une conversation à deux, { gid } pour une discussion à plusieurs
const chatKey = t => t.gid ? "g:" + t.gid : t.tag;
const chatPath = ref => ref.gid ? "/gc/" + ref.gid : "/dm/" + encodeURIComponent(ref.tag);
const chatTitle = t => t.gid ? (t.title || t.members.map(m => favFirst(m.name || m.tag)).join(", ")) : (t.name || "@" + t.tag);
const chatNorm = (ref, j) => ref.gid ? { msgs: j.gc.msgs, title: j.gc.title, members: j.gc.members } : { msgs: j.msgs, peer: j.peer };
const dmOpen = (tag, nameHint) => chatOpen({ tag, nameHint });
const gcOpen = gid => chatOpen({ gid });
async function chatOpen(ref) {
  if (!(typeof socOn === "function" && socOn())) { toast("Connecte-toi avec Google ou Microsoft pour écrire à tes proches"); return; }
  let d; try { d = chatNorm(ref, await socApi(chatPath(ref))); } catch (e) { toast(e.message); return; }
  const th = DMS.find(t => chatKey(t) === chatKey(ref)); if (th) th.unread = 0;
  const group = !!ref.gid, others = group ? d.members.filter(m => !m.me) : [];
  const name = group ? (d.title || others.map(m => favFirst(m.name || m.tag)).join(", ")) : d.peer.name || ref.nameHint || "@" + ref.tag;
  const av = group ? `<span class="fav-av grp">👥</span>` : `<span class="fav-av" style="background:${favColor("@" + ref.tag)}">${esc(favFirst(name).charAt(0))}</span>`;
  const f = openForm(`<div class="f2 dm-sheet" data-chat="${esc(chatKey(ref))}"><div class="dm-head">${av}<div class="dm-hd"><h3 style="margin:0">${esc(name)}</h3><small class="hint">${group ? `${d.members.length} personnes` : "@" + esc(ref.tag)}</small></div>
      <button type="button" class="btn dm-add" id="dmAdd" title="Ajouter des personnes">👥 +</button></div>
    <div class="dm-box" id="dmBox"></div>
    <button type="button" class="dm-idea-btn" id="dmIdea">💡 Proposer de financer quelque chose ensemble</button>
    <div class="dm-in"><textarea class="field" id="dmText" rows="1" maxlength="1000" placeholder="Écris un message…"></textarea><button type="button" class="btn primary" id="dmSend" aria-label="Envoyer">➤</button></div>
    ${group ? `<button type="button" class="linkbtn" id="dmLeave" style="margin-top:10px;color:var(--bad)">Quitter la discussion</button>` : ""}</div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Fermer";
  let last = "";
  const ctx = { ref, group, d, name };
  const draw = () => {
    const box = f.querySelector("#dmBox"); if (!box) return;
    const sig = JSON.stringify(ctx.d.msgs); if (sig === last) return; last = sig;
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    box.innerHTML = ctx.d.msgs.some(m => m.from !== "sys") ? ctx.d.msgs.map(m => chatMsgHTML(m, ctx)).join("") : (ctx.d.msgs.map(m => chatMsgHTML(m, ctx)).join("") + `<p class="hint" style="text-align:center;margin:30px 0">${group ? "Dites-vous bonjour 👋" : `Dis bonjour à ${esc(favFirst(name))} 👋`}<br>Vous pouvez aussi décider ici de financer quelque chose ensemble.</p>`);
    chatMsgBind(box, ctx, upd);
    if (atBottom || !draw.once) { box.scrollTop = box.scrollHeight; draw.once = true; }
  };
  const upd = j => { ctx.d = chatNorm(ref, j); draw(); };
  const post = async body => upd(await socApi(chatPath(ref), { method: "POST", body: JSON.stringify({ name: ensName(), ...body }) }));
  ctx.post = post;
  draw();
  const send = async () => {
    const ta = f.querySelector("#dmText"), text = ta.value.trim(); if (!text) return;
    ta.value = ""; ta.style.height = "";
    try { await post({ text }); const b = f.querySelector("#dmBox"); b.scrollTop = b.scrollHeight; } catch (e) { ta.value = text; toast(e.message); }
  };
  f.querySelector("#dmSend").onclick = send;
  const ta = f.querySelector("#dmText");
  ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !/Mobi/.test(navigator.userAgent)) { e.preventDefault(); send(); } });
  ta.addEventListener("input", () => { ta.style.height = ""; ta.style.height = Math.min(120, ta.scrollHeight) + "px"; });
  f.querySelector("#dmIdea").onclick = () => chatIdea(f, post);
  f.querySelector("#dmAdd").onclick = () => chatAddPeople(f, ctx);
  const lv = f.querySelector("#dmLeave"); if (lv) lv.onclick = async e => { const q = e.currentTarget; if (!q.dataset.sure) { q.dataset.sure = "1"; q.textContent = "Toucher encore pour quitter la discussion"; return; } try { await socApi(chatPath(ref), { method: "POST", body: JSON.stringify({ action: "leave" }) }); DMS = DMS.filter(t => chatKey(t) !== chatKey(ref)); closeForm(); render(); toast("Tu as quitté la discussion"); } catch (err) { toast(err.message); } };
  // Les nouveaux messages arrivent pendant que la conversation est ouverte
  clearInterval(dmPoll);
  dmPoll = setInterval(async () => {
    if (!document.querySelector(`.dm-sheet[data-chat="${chatKey(ref)}"]`)) { clearInterval(dmPoll); ensRefresh(); return; }
    if (document.hidden) return;
    try { upd(await socApi(chatPath(ref))); } catch (e) {}
  }, 4000);
}
// Ajouter des personnes : une conversation à deux devient une discussion à plusieurs (l'idée en cours suit, avec ses votes)
function chatAddPeople(f, ctx) {
  const box = f.querySelector(".dm-sheet"); if (box.querySelector(".dm-addform")) return;
  const inChat = new Set(ctx.group ? ctx.d.members.map(m => m.tag) : [ctx.ref.tag, SOC.tag]), pick = new Set();
  const people = prochesTagged().filter(p => !inChat.has(p.tag)).slice(0, 14);
  const w = document.createElement("div"); w.className = "dm-addform card";
  w.innerHTML = `<b>👥 Ajouter des personnes</b><small class="hint">${ctx.group ? "Elles verront toute la discussion." : `Une discussion à plusieurs s'ouvre avec ${esc(favFirst(ctx.name))} ; votre idée en cours suit.`}</small>
    ${people.length ? `<div class="chips" id="daPeople">${people.map(p => `<button type="button" class="chip" data-tag="${esc(p.tag)}" aria-pressed="false">${esc(p.name || "@" + p.tag)}</button>`).join("")}</div>` : ""}
    <input class="field" id="daFind" placeholder="Chercher un @tag…" autocapitalize="off" spellcheck="false" autocomplete="off"><div id="daRes"></div>
    <div class="dm-cta"><button type="button" class="btn primary" id="daGo">Ajouter</button><button type="button" class="btn" id="daNo">Annuler</button></div>`;
  box.querySelector(".dm-box").before(w);
  const tog = b => { const t = b.dataset.tag; pick.has(t) ? pick.delete(t) : pick.add(t); b.setAttribute("aria-pressed", pick.has(t)); };
  w.querySelectorAll("#daPeople [data-tag]").forEach(b => b.onclick = () => tog(b));
  tagPicker(w.querySelector("#daFind"), w.querySelector("#daRes"), (tag, nm) => {
    if (inChat.has(tag)) { toast(`@${tag} est déjà dans la discussion`); return; }
    let b = w.querySelector(`#daPeople [data-tag="${tag}"]`);
    if (!b) { let c = w.querySelector("#daPeople"); if (!c) { c = document.createElement("div"); c.className = "chips"; c.id = "daPeople"; w.querySelector("#daFind").before(c); } c.insertAdjacentHTML("beforeend", `<button type="button" class="chip" data-tag="${esc(tag)}" aria-pressed="false">${esc(nm || "@" + tag)}</button>`); b = c.lastElementChild; b.onclick = () => tog(b); }
    if (!pick.has(tag)) tog(b); w.querySelector("#daFind").value = "";
  });
  w.querySelector("#daNo").onclick = () => w.remove();
  w.querySelector("#daGo").onclick = async () => {
    if (!pick.size) { toast("Choisis au moins une personne"); return; }
    try {
      if (ctx.group) { await ctx.post({ action: "add", tags: [...pick] }); w.remove(); toast(pick.size > 1 ? `${pick.size} personnes ajoutées` : "Personne ajoutée"); return; }
      const idea = ctx.d.msgs.filter(m => m.kind === "idea").pop();
      const r = await socApi("/gc", { method: "POST", body: JSON.stringify({ name: ensName(), tags: [ctx.ref.tag, ...pick], from: ctx.ref.tag, mid: idea ? idea.id : "" }) });
      closeForm(); toast("Discussion à plusieurs créée 👥"); ensRefresh(); setTimeout(() => gcOpen(r.gc.id), 250);
    } catch (e) { toast(e.message); }
  };
  setTimeout(() => w.scrollIntoView({ block: "nearest" }), 50);
}
function chatMsgHTML(m, ctx) {
  if (m.from === "sys") return `<div class="dm-sys">${esc(m.text)}</div>`;
  const nameOf = tg => { if (tg === SOC.tag) return "Toi"; if (!ctx.group) return favFirst(ctx.name); const x = ctx.d.members.find(y => y.tag === tg); return favFirst(x ? x.name || x.tag : m.name || tg); };
  const who = m.mine ? "Toi" : nameOf(m.from), whoTag = !m.mine && ctx.group ? `<small class="dm-who">${esc(who)}</small>` : "";
  if (m.del) return `<div class="dm-m ${m.mine ? "me" : ""}"><div class="dm-b del">Message supprimé</div></div>`;
  if (m.kind === "idea") {
    const i = m.idea, v = m.votes || {}, mine = v[SOC.tag];
    const people = ctx.group ? ctx.d.members.map(x => x.tag) : [SOC.tag, ctx.ref.tag];
    const yes = Object.entries(v).filter(([, x]) => x === "yes").map(([t]) => t), can = mine === "yes" && yes.length >= 2;
    const waiting = people.filter(t => !v[t]);
    return `<div class="dm-m ${m.mine ? "me" : ""}">${whoTag}<div class="dm-card"><small>💡 ${m.mine ? "Tu proposes" : `${esc(who)} propose`} de financer ensemble</small><b>${esc(i.title)}</b>
      <span class="hint">${[i.budget ? ensMoney(i.budget, i.cur) : "", i.when ? `le ${frDate(i.when)}` : ""].filter(Boolean).map(esc).join(" · ")}</span>${i.note ? `<p>${linkify(i.note)}</p>` : ""}
      <div class="dm-votes">${people.map(t => `<span>${esc(nameOf(t))} ${v[t] === "yes" ? "👍" : v[t] === "no" ? "✋" : "…"}</span>`).join("")}</div>
      ${m.act ? `<button type="button" class="btn primary" data-dmact="${esc(m.act)}">Voir l'activité</button>`
        : mine !== "yes" ? `<div class="dm-cta"><button type="button" class="btn primary" data-dmvote="${esc(m.id)}" data-v="yes">👍 Partant</button><button type="button" class="btn" data-dmvote="${esc(m.id)}" data-v="no">Pas pour moi</button></div>`
        : can ? `<button type="button" class="btn primary" data-dmcreate="${esc(m.id)}">📅 Créer l'activité</button>${waiting.length ? `<small class="hint">Pas encore répondu : ${esc(waiting.map(nameOf).join(", "))}</small>` : ""}`
        : `<small class="hint">En attente de la réponse de ${esc(waiting.map(nameOf).join(", ") || "tes proches")}.</small>`}</div><small class="dm-t">${esc(dmTime(m.at))}</small></div>`;
  }
  if (m.kind === "act") { const a = ACTS.find(x => x.id === m.act); return `<div class="dm-m ${m.mine ? "me" : ""}">${whoTag}<button type="button" class="dm-card dm-actlink" data-dmact="${esc(m.act)}"><small>📅 Activité</small><b>${esc(a ? `${a.emoji} ${a.title}` : m.text || "Activité")}</b><span class="linkbtn">Ouvrir ›</span></button><small class="dm-t">${esc(dmTime(m.at))}</small></div>`; }
  return `<div class="dm-m ${m.mine ? "me" : ""}">${whoTag}<div class="dm-b">${linkify(m.text || "")}</div><small class="dm-t">${esc(dmTime(m.at))}</small></div>`;
}
function chatMsgBind(box, ctx, upd) {
  box.querySelectorAll("[data-dmvote]").forEach(b => b.onclick = async () => { try { await ctx.post({ action: "vote", mid: b.dataset.dmvote, v: b.dataset.v }); } catch (e) { toast(e.message); } });
  box.querySelectorAll("[data-dmact]").forEach(b => b.onclick = () => { closeForm(); setTimeout(() => actOpen(b.dataset.dmact), 220); });
  box.querySelectorAll("[data-dmcreate]").forEach(b => b.onclick = () => {
    const m = ctx.d.msgs.find(x => x.id === b.dataset.dmcreate); if (!m) return;
    const v = m.votes || {}, people = ctx.group ? ctx.d.members.map(x => x.tag) : [ctx.ref.tag];
    const withT = Object.keys(v).filter(t => v[t] === "yes" && t !== SOC.tag), inv = people.filter(t => t !== SOC.tag && !v[t]);
    closeForm(); setTimeout(() => actNew({ title: m.idea.title, budget: m.idea.budget, when: m.idea.when, desc: m.idea.note, with: withT, invite: inv, fromChat: { ref: ctx.ref, mid: m.id } }), 220);
  });
}
function chatIdea(f, post) {
  const box = f.querySelector(".dm-sheet"); if (!box || box.querySelector(".dm-ideaform")) return;
  const wrap = document.createElement("div"); wrap.className = "dm-ideaform card";
  wrap.innerHTML = `<b>💡 On finance ensemble…</b><input class="field" id="diTitle" maxlength="80" placeholder="ex. Week-end à la mer, cadeau pour Léa">
    <div class="two"><input class="field" id="diBudget" inputmode="decimal" placeholder="Budget total (${esc(typeof curSym === "function" ? curSym() : "€")})"><input class="field" id="diWhen" type="date" aria-label="Quand"></div>
    <div class="dm-cta"><button type="button" class="btn primary" id="diGo">Proposer</button><button type="button" class="btn" id="diNo">Annuler</button></div>`;
  box.querySelector(".dm-in").before(wrap); box.querySelector("#dmIdea").hidden = true; wrap.querySelector("#diTitle").focus();
  const close = () => { wrap.remove(); box.querySelector("#dmIdea").hidden = false; };
  wrap.querySelector("#diNo").onclick = close;
  wrap.querySelector("#diGo").onclick = async () => {
    const title = wrap.querySelector("#diTitle").value.trim(); if (!title) { toast("Dis ce que vous voulez financer"); return; }
    try { await post({ idea: { title, budget: parseAmount(wrap.querySelector("#diBudget").value) || 0, when: wrap.querySelector("#diWhen").value, cur: baseCurrency() } }); close(); const b = box.querySelector("#dmBox"); b.scrollTop = b.scrollHeight; }
    catch (e) { toast(e.message); }
  };
}

// ---------- Activités ----------
const ACT_EMO = ["🎉", "🍽️", "🏖️", "🎁", "🎬", "🎳", "⚽", "✈️", "🏕️", "🎂"];
function actNew(pre) {
  pre = pre || {};
  if (!(typeof socOn === "function" && socOn())) { toast("Connecte-toi avec Google ou Microsoft pour créer une activité"); return; }
  const pick = new Set(pre.with || []), people = prochesTagged().slice(0, 14);
  if (pre.preInvite) pick.add(pre.preInvite);
  for (const t of pre.invite || []) pick.add(t);
  for (const t of pick) if (!people.some(p => p.tag === t)) people.unshift({ tag: t, name: "" });
  let emo = pre.emoji || ACT_EMO[0];
  const f = openForm(`<div class="f2"><h3>Créer une activité ensemble</h3>
    <div class="act-emos" id="acEmo">${ACT_EMO.map(e => `<button type="button" data-e="${e}" aria-pressed="${e === emo}">${e}</button>`).join("")}</div>
    ${fld("acTitle", "Quoi ?", `maxlength="80" placeholder="ex. Week-end à la mer, resto d'anniversaire" value="${esc(pre.title || "")}"`)}
    <div class="two"><div>${fld("acWhen", "Quand", `type="date" value="${esc(pre.when || "")}"`)}</div><div>${fld("acPlace", "Où (facultatif)", `maxlength="80" placeholder="ex. Biarritz"`)}</div></div>
    ${fld("acBudget", `Budget total (${esc(typeof curSym === "function" ? curSym() : "€")})`, `inputmode="decimal" placeholder="ex. 400" value="${pre.budget ? esc(String(pre.budget).replace(".", ",")) : ""}"`)}
    <p class="hint" id="acShare" style="margin:4px 0 0"></p>
    <span class="lbl">Avec qui ?</span>${people.length ? `<div class="chips" id="acPeople">${people.map(p => `<button type="button" class="chip" data-tag="${esc(p.tag)}" aria-pressed="${pick.has(p.tag)}">${esc(p.name || "@" + p.tag)}</button>`).join("")}</div>` : ""}
    <input class="field" id="acFind" placeholder="Chercher un @tag…" autocapitalize="off" spellcheck="false" autocomplete="off" style="margin-top:8px"><div id="acRes"></div>
    ${fld("acGuests", "Sans l'appli (prénoms, séparés par des virgules)", `placeholder="ex. Léa, Hugo"`)}
    <p class="hint" style="margin:8px 0 0">Chacun verse sa part à l'organisateur (toi), de banque à banque : c'est toi qui confirmes ce que tu reçois.</p></div>`, () => {
    const title = f.querySelector("#acTitle").value.trim(), budget = parseAmount(f.querySelector("#acBudget").value);
    if (!title) { toast("Dis ce que vous faites"); return false; }
    if (!(budget > 0)) { toast("Indique le budget total"); return false; }
    const guests = f.querySelector("#acGuests").value.split(",").map(s => s.trim()).filter(Boolean);
    const already = new Set(pre.with || []), invite = [...pick].filter(t => !already.has(t)), withT = [...pick].filter(t => already.has(t));
    (async () => {
      try {
        const r = await socApi("/acts", { method: "POST", body: JSON.stringify({ title, emoji: emo, when: f.querySelector("#acWhen").value, place: f.querySelector("#acPlace").value, desc: pre.desc || "", budget, cur: baseCurrency(), invite, with: withT, guests, name: ensName() }) });
        ACTS.unshift(r.act);
        if (pre.fromChat) { try { await socApi(chatPath(pre.fromChat.ref), { method: "POST", body: JSON.stringify({ action: "link", mid: pre.fromChat.mid, act: r.act.id }) }); } catch (e) {} }
        render(); toast(`${emo} Activité créée${invite.length ? ` : ${invite.length} invitation${invite.length > 1 ? "s" : ""} envoyée${invite.length > 1 ? "s" : ""}` : ""}`);
        setTimeout(() => actOpen(r.act.id), 300);
      } catch (e) { toast(e.message); }
    })();
  });
  f.querySelector("button[type=submit]").textContent = "Créer l'activité";
  const share = () => {
    const b = parseAmount(f.querySelector("#acBudget").value), n = 1 + pick.size + f.querySelector("#acGuests").value.split(",").filter(s => s.trim()).length;
    f.querySelector("#acShare").textContent = b > 0 && n > 1 ? `Soit ${ensMoney(Math.round(b / n * 100) / 100)} chacun à ${n}` : "";
  };
  ["#acBudget", "#acGuests"].forEach(s => f.querySelector(s).addEventListener("input", share));
  f.querySelectorAll("#acEmo [data-e]").forEach(b => b.onclick = () => { emo = b.dataset.e; f.querySelectorAll("#acEmo [data-e]").forEach(x => x.setAttribute("aria-pressed", x === b)); });
  const tog = b => { const t = b.dataset.tag; pick.has(t) ? pick.delete(t) : pick.add(t); b.setAttribute("aria-pressed", pick.has(t)); share(); };
  f.querySelectorAll("#acPeople [data-tag]").forEach(b => b.onclick = () => tog(b));
  tagPicker(f.querySelector("#acFind"), f.querySelector("#acRes"), (tag, nm) => {
    let b = f.querySelector(`#acPeople [data-tag="${tag}"]`);
    if (!b) { let box = f.querySelector("#acPeople"); if (!box) { box = document.createElement("div"); box.className = "chips"; box.id = "acPeople"; f.querySelector("#acFind").before(box); } box.insertAdjacentHTML("beforeend", `<button type="button" class="chip" data-tag="${esc(tag)}" aria-pressed="false">${esc(nm || "@" + tag)}</button>`); b = box.lastElementChild; b.onclick = () => tog(b); }
    if (!pick.has(tag)) tog(b); f.querySelector("#acFind").value = "";
  });
  share();
  if (!pre.title) setTimeout(() => f.querySelector("#acTitle").focus(), 80);
}
async function actCall(id, body) {
  try { const r = await socApi("/acts/" + id, { method: "POST", body: JSON.stringify({ name: ensName(), ...body }) }); if (r.act) { const i = ACTS.findIndex(x => x.id === id); if (i >= 0) ACTS[i] = r.act; else ACTS.unshift(r.act); } return r; }
  catch (e) { toast(e.message); return null; }
}
async function actOpen(id) {
  let a; try { a = (await socApi("/acts/" + id)).act; } catch (e) { toast("Cette activité n'existe plus"); ACTS = ACTS.filter(x => x.id !== id); return; }
  { const i = ACTS.findIndex(x => x.id === id); if (i >= 0) ACTS[i] = a; }
  const reopen = () => { closeForm(); setTimeout(() => actOpen(id), 220); };
  const st = { ok: "Reçue ✓", sent: "Versée, à confirmer", due: "À verser" };
  const me = a.members.find(m => m.id === a.me), owner = a.members.find(m => m.owner) || {}, pct = Math.min(100, Math.round(a.got / a.budget * 100));
  const head = `<div class="act-head"><span class="act-emo big">${esc(a.emoji || "📅")}</span><div><h3 style="margin:0">${esc(a.title)}</h3><small class="hint">${[a.when ? frDate(a.when) : "", a.place, `organisé par ${a.owner ? "toi" : a.ownerName}`].filter(Boolean).map(esc).join(" · ")}</small></div></div>
    ${a.desc ? `<p style="margin:0 0 8px">${linkify(a.desc)}</p>` : ""}
    <div class="act-bar big"><i style="width:${pct}%"></i></div><div class="act-sub"><span><span>Financé</span> <b class="num">${esc(ensMoney(a.got, a.cur))}</b> <span>sur</span> <span class="num">${esc(ensMoney(a.budget, a.cur))}</span></span><span class="num">${pct} %</span></div>`;
  if (!me) {
    const f = openForm(`<div class="f2 act-sheet">${head}<p>${esc(a.ownerName)} te propose de participer. ${a.members.length + 1} personnes : ta part serait d'environ <b class="num">${esc(ensMoney(Math.round(a.budget / (a.members.length + 1) * 100) / 100, a.cur))}</b>.</p></div>`, () => { (async () => { const r = await actCall(id, { action: "join" }); if (r) { render(); toast("Tu participes 🙌"); setTimeout(() => actOpen(id), 300); } })(); });
    f.querySelector("button[type=submit]").textContent = "Je participe";
    if (a.invited) { const no = document.createElement("button"); no.type = "button"; no.className = "linkbtn"; no.textContent = "Non merci"; no.style.marginTop = "10px"; f.querySelector(".f2").append(no); no.onclick = async () => { await actCall(id, { action: "decline" }); ACTS = ACTS.filter(x => x.id !== id); closeForm(); render(); }; }
    return;
  }
  const myPart = a.owner ? `<div class="act-me ok"><span>Ta part : <b class="num">${esc(ensMoney(me.share, a.cur))}</b></span><small>Tu organises : chacun te verse sa part, et tu confirmes ce que tu reçois.</small></div>`
    : `<div class="act-me ${me.st}"><span>Ta part : <b class="num">${esc(ensMoney(me.share, a.cur))}</b></span>${me.st === "ok" ? `<small>✓ ${esc(a.ownerName)} l'a bien reçue.</small>` : me.st === "sent" ? `<small>Tu l'as versée : ${esc(a.ownerName)} confirmera dès réception.</small>` : `<button type="button" class="btn primary" id="acPay">💸 Verser ma part à ${esc(favFirst(a.ownerName))}</button>`}</div>`;
  const rows = a.members.map(m => `<div class="act-row"><span class="fav-av sm" style="background:${favColor(m.tag ? "@" + m.tag : "n:" + m.name)}">${esc(favFirst(m.name).charAt(0))}</span>
      <span class="act-nm"><b>${esc(m.id === a.me ? "Toi" : m.name)}</b><small>${m.owner ? "organise" : m.guest ? "sans l'appli" : ""}</small></span><span class="num">${esc(ensMoney(m.share, a.cur))}</span>
      <span class="act-chip ${m.st === "ok" ? "ok" : m.st === "sent" ? "" : "warn"}">${m.owner ? "✓" : esc(st[m.st])}</span>
      ${a.owner && !m.owner ? `<span class="act-ops">${m.st !== "ok" ? `<button type="button" class="btn" data-acok="${esc(m.id)}">Reçu</button>` : `<button type="button" class="linkbtn" data-acun="${esc(m.id)}" title="Annuler">↺</button>`}${m.st === "due" && m.tag ? `<button type="button" class="linkbtn" data-acrem="${esc(m.id)}" title="Relancer">🔔</button>` : ""}</span>` : ""}</div>`).join("")
    + (a.pending || []).map(p => `<div class="act-row pend"><span class="fav-av sm">·</span><span class="act-nm"><b>${esc(p.name || "@" + p.tag)}</b><small>invité, pas encore répondu</small></span></div>`).join("");
  const f = openForm(`<div class="f2 act-sheet">${head}${myPart}
    <span class="lbl">Participants</span><div class="act-rows">${rows}</div>
    ${a.owner ? `<div class="fav-btns"><button type="button" class="btn" id="acInv">+ Inviter</button><button type="button" class="btn" id="acGuest">+ Sans l'appli</button></div>` : ""}
    <span class="lbl">Discussion</span><div class="dm-box act-chat" id="acChat">${a.msgs.length ? a.msgs.map(m => `<div class="dm-m ${m.from === SOC.tag ? "me" : ""}">${m.from === SOC.tag ? "" : `<small class="dm-who">${esc(m.name)}</small>`}<div class="dm-b">${linkify(m.text)}</div><small class="dm-t">${esc(dmTime(m.at))}</small></div>`).join("") : `<p class="hint" style="text-align:center;margin:14px 0">Organisez-vous ici : horaires, réservations, idées…</p>`}</div>
    <div class="dm-in"><textarea class="field" id="acText" rows="1" maxlength="1000" placeholder="Écris aux participants…"></textarea><button type="button" class="btn primary" id="acSend" aria-label="Envoyer">➤</button></div>
    <div class="act-foot">${a.owner ? `<button type="button" class="linkbtn" id="acEdit">Modifier</button><button type="button" class="linkbtn" id="acDone">Terminer</button><button type="button" class="linkbtn" id="acDel" style="color:var(--bad)">Annuler l'activité</button>` : me.st !== "ok" ? `<button type="button" class="linkbtn" id="acLeave" style="color:var(--bad)">Ne plus participer</button>` : ""}</div></div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Fermer";
  { const c = f.querySelector("#acChat"); c.scrollTop = c.scrollHeight; }
  const on = (s, fn) => { const b = f.querySelector(s); if (b) b.onclick = fn; };
  on("#acPay", () => { closeForm(); setTimeout(() => actPay(a), 220); });
  f.querySelectorAll("[data-acok]").forEach(b => b.onclick = async () => { const r = await actCall(id, { action: "received", mid: b.dataset.acok }); if (r) { toast("Part reçue ✓"); reopen(); render(); } });
  f.querySelectorAll("[data-acun]").forEach(b => b.onclick = async () => { const r = await actCall(id, { action: "unreceived", mid: b.dataset.acun }); if (r) reopen(); });
  f.querySelectorAll("[data-acrem]").forEach(b => b.onclick = async () => {
    const m = a.members.find(x => x.id === b.dataset.acrem); const msg = await remindPick(m.name, ensMoney(m.share, a.cur), a.title); if (!msg) return reopen();
    const r = await actCall(id, { action: "remind", mid: m.id, msg }); if (r) toast(r.reminded === "recent" ? "Déjà relancé il y a moins de 6 h" : `Rappel envoyé à ${favFirst(m.name)}`); reopen();
  });
  const sendMsg = async () => { const ta = f.querySelector("#acText"), text = ta.value.trim(); if (!text) return; ta.value = ""; const r = await actCall(id, { action: "msg", text }); if (r) reopen(); else ta.value = text; };
  on("#acSend", sendMsg);
  f.querySelector("#acText").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !/Mobi/.test(navigator.userAgent)) { e.preventDefault(); sendMsg(); } });
  on("#acInv", () => { closeForm(); setTimeout(() => {
    const h = openForm(`<div class="f2"><h3>Inviter à « ${esc(a.title)} »</h3><input class="field" id="aiFind" placeholder="@tag…" autocapitalize="off" spellcheck="false" autocomplete="off"><div id="aiRes"></div></div>`, () => true);
    h.querySelector("button[type=submit]").hidden = true;
    tagPicker(h.querySelector("#aiFind"), h.querySelector("#aiRes"), async tag => { const r = await actCall(id, { action: "invite", tags: [tag] }); if (r) { toast(r.invited ? `@${tag} invité` : `@${tag} participe déjà`); reopen(); } });
    setTimeout(() => h.querySelector("#aiFind").focus(), 80); }, 220); });
  on("#acGuest", () => { closeForm(); setTimeout(() => {
    const h = openForm(`<div class="f2"><h3>Ajouter quelqu'un sans l'appli</h3>${fld("agName", "Son prénom", `maxlength="40" placeholder="ex. Léa"`)}<p class="hint" style="margin:6px 0 0">Tu noteras toi-même quand tu reçois sa part.</p></div>`, () => { const n = document.getElementById("agName").value.trim(); if (!n) return false; (async () => { if (await actCall(id, { action: "guest", guest: n })) reopen(); })(); });
    h.querySelector("button[type=submit]").textContent = "Ajouter"; setTimeout(() => h.querySelector("#agName").focus(), 80); }, 220); });
  on("#acEdit", () => { closeForm(); setTimeout(() => {
    const h = openForm(`<div class="f2"><h3>Modifier l'activité</h3>${fld("aeTitle", "Quoi ?", `maxlength="80" value="${esc(a.title)}"`)}
      <div class="two"><div>${fld("aeWhen", "Quand", `type="date" value="${esc(a.when || "")}"`)}</div><div>${fld("aePlace", "Où", `maxlength="80" value="${esc(a.place || "")}"`)}</div></div>
      ${fld("aeBudget", "Budget total", `inputmode="decimal" value="${esc(String(a.budget).replace(".", ","))}"`)}<p class="hint" style="margin:4px 0 0">Les parts sont recalculées à égalité.</p></div>`, () => {
      (async () => { if (await actCall(id, { action: "edit", title: document.getElementById("aeTitle").value, when: document.getElementById("aeWhen").value, place: document.getElementById("aePlace").value, budget: parseAmount(document.getElementById("aeBudget").value), split: "equal" })) { render(); reopen(); } })();
    }); }, 220); });
  const twice = (s, label, fn) => on(s, async e => { const q = e.currentTarget; if (!q.dataset.sure) { q.dataset.sure = "1"; q.textContent = label; return; } await fn(); });
  twice("#acDone", "Toucher encore pour terminer", async () => { if (await actCall(id, { action: "done" })) { closeForm(); render(); toast("Activité terminée 🎉"); } });
  twice("#acDel", "Toucher encore pour annuler pour tout le monde", async () => { if (await actCall(id, { action: "delete" })) { ACTS = ACTS.filter(x => x.id !== id); closeForm(); render(); toast("Activité annulée"); } });
  twice("#acLeave", "Toucher encore pour ne plus participer", async () => { if (await actCall(id, { action: "leave" })) { ACTS = ACTS.filter(x => x.id !== id); closeForm(); render(); toast("Tu ne participes plus"); } });
}

// Verser ma part d'un projet : les moyens de paiement de l'organisateur, puis « J'ai payé » (l'organisateur confirme à réception)
async function actPay(a) {
  if (!a.pay) { try { a = (await socApi("/acts/" + a.id)).act; } catch (e) {} }
  const me = a.members.find(m => m.id === a.me); if (!me) return actOpen(a.id);
  const done = async () => { const r = await actCall(a.id, { action: "paid" }); if (r) { render(); toast(`C'est noté : ${favFirst(a.ownerName)} confirmera dès réception`); } };
  if (a.pay) return showPay(a.pay, me.share, a.title, a.ownerName, done);
  const g = openForm(`<div class="f2"><h3>Verser ma part</h3><p>${esc(a.ownerName)} n'a pas encore indiqué comment le payer dans Bourselle. Verse <b class="num">${esc(ensMoney(me.share, a.cur))}</b> comme d'habitude (virement, espèces…), puis appuie sur « J'ai payé ».</p></div>`, () => { done(); });
  g.querySelector("button[type=submit]").textContent = "J'ai payé";
}
