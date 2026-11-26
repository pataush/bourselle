/* Bourselle — ensemble : écrire à un proche, et monter des activités qu'on finance ensemble.
 * Messagerie : une conversation par proche (qui a Bourselle). On peut y proposer « On finance ensemble ? » :
 * chacun dit s'il est partant, puis on crée l'activité d'un geste.
 * Activité : un budget, des participants (avec ou sans l'appli), chacun verse sa part à l'organisateur.
 * C'est l'organisateur, qui reçoit l'argent, qui confirme. Chaque activité a sa discussion. */
let ACTS = [], DMS = [], dmPoll = null, dmSeen = new Set();
try { dmSeen = new Set(JSON.parse(localStorage.getItem("bourselle-dm-seen") || "[]")); } catch (e) {}
const ensMoney = (v, c) => typeof fmtCur === "function" ? fmtCur(v, c || baseCurrency()) : eur(v);
const ensName = () => favFirst((store && store.user ? store.user() : {}).name || "");
const dmUnread = tag => (DMS.find(t => t.tag === tag) || {}).unread || 0;
const dmTime = at => { const d = new Date(at), t = d.toTimeString().slice(0, 5); return Date.now() - at < 864e5 && d.getDate() === new Date().getDate() ? t : `${frDate(d.toISOString().slice(0, 10)).slice(0, 5)} ${t}`; };
const linkify = s => esc(s).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);

async function ensRefresh() {
  if (!(typeof socOn === "function" && socOn())) return;
  try {
    const [d, a] = await Promise.all([socApi("/dm"), socApi("/acts")]);
    DMS = d.threads || []; ACTS = a.acts || [];
    // Nouveaux messages : un petit mot tout de suite (en plus de la notification sur le téléphone)
    const fresh = DMS.filter(t => t.unread && !dmSeen.has(t.tag + ":" + t.last.id) && !document.querySelector(`.dm-sheet[data-tag="${t.tag}"]`));
    if (fresh.length) {
      const t = fresh[0]; toast(fresh.length === 1 ? `💬 ${t.name || "@" + t.tag} : ${t.last.kind === "idea" ? "💡 " + t.last.idea.title : (t.last.text || "").slice(0, 80)}` : `💬 ${fresh.length} nouveaux messages`);
      fresh.forEach(x => dmSeen.add(x.tag + ":" + x.last.id)); try { localStorage.setItem("bourselle-dm-seen", JSON.stringify([...dmSeen].slice(-300))); } catch (e) {}
    }
    if (!ensRefresh.link) {
      ensRefresh.link = true; let dm = "", act = "";
      try { dm = sessionStorage.getItem("bourselle-dm") || ""; act = sessionStorage.getItem("bourselle-act") || ""; sessionStorage.removeItem("bourselle-dm"); sessionStorage.removeItem("bourselle-act"); } catch (e) {}
      if (dm) setTimeout(() => dmOpen(dm), 400); else if (act) setTimeout(() => actOpen(act), 400);
    }
    if (typeof refreshBell === "function") refreshBell();
    if (typeof tab !== "undefined" && tab === "partage" && !openGroup && !document.querySelector("#sheet2Root.open")) render();
  } catch (e) {}
}
// Liens des notifications : « ?dm=tag » et « ?act=id », gardés jusqu'à la connexion
{
  const q = new URLSearchParams(location.search), dm = q.get("dm"), act = q.get("act");
  if ((dm && /^[a-z0-9][a-z0-9_-]{2,23}$/.test(dm)) || (act && /^[a-z0-9]{12}$/.test(act))) {
    try { if (dm) sessionStorage.setItem("bourselle-dm", dm); if (act) sessionStorage.setItem("bourselle-act", act); } catch (e) {}
    history.replaceState(null, "", location.pathname);
  }
}

// ---------- Entre proches : discussions et activités ----------
function ensHTML() {
  if (!(typeof socOn === "function" && socOn())) return "";
  let h = "";
  const threads = DMS.slice().sort((a, b) => b.at - a.at).slice(0, 3);
  if (threads.length) h += `<div class="hub-sec"><span>Discussions</span>${DMS.some(t => t.unread) ? `<small>${DMS.reduce((a, t) => a + t.unread, 0)} non lu${DMS.reduce((a, t) => a + t.unread, 0) > 1 ? "s" : ""}</small>` : ""}</div>
    <div class="card dm-list">${threads.map(t => `<button type="button" class="dm-th${t.unread ? " unread" : ""}" data-dm="${esc(t.tag)}"><span class="fav-av" style="background:${favColor("@" + t.tag)}">${esc(favFirst(t.name || t.tag).charAt(0))}</span>
      <span class="dm-tx"><b>${esc(t.name || "@" + t.tag)}</b><small>${t.last.mine ? "Toi : " : ""}${esc(t.last.kind === "idea" ? "💡 " + t.last.idea.title : t.last.kind === "act" ? "📅 " + (t.last.text || "Activité") : t.last.del ? "Message supprimé" : t.last.text || "")}</small></span>
      <span class="dm-meta"><small>${esc(agoText(t.at))}</small>${t.unread ? `<i>${t.unread}</i>` : ""}</span></button>`).join("")}</div>`;
  const acts = ACTS.filter(a => a.status === "open").sort((a, b) => b.invited - a.invited || (a.when || "9") .localeCompare(b.when || "9"));
  h += `<div class="hub-sec"><span>Activités ensemble</span><button class="linkbtn" id="actNew">+ Créer une activité</button></div>`;
  h += acts.length ? acts.map(a => { const pct = Math.min(100, Math.round(a.got / a.budget * 100)), me = a.members.find(m => m.id === a.me);
    return `<button type="button" class="card act-card" data-act="${esc(a.id)}"><div class="act-top"><span class="act-emo">${esc(a.emoji || "📅")}</span><span class="act-tt"><b>${esc(a.title)}</b><small>${[a.when ? frDate(a.when) : "", a.place, `${a.members.length} participant${a.members.length > 1 ? "s" : ""}`].filter(Boolean).map(esc).join(" · ")}</small></span></div>
      <div class="act-bar"><i style="width:${pct}%"></i></div><div class="act-sub"><span><span>Financé</span> <b class="num">${esc(ensMoney(a.got, a.cur))}</b> <span>sur</span> <span class="num">${esc(ensMoney(a.budget, a.cur))}</span></span>
      ${a.invited ? `<span class="act-chip warn">Invitation</span>` : me && !a.owner ? `<span class="act-chip ${me.st === "ok" ? "ok" : me.st === "sent" ? "" : "warn"}">${me.st === "ok" ? "Ta part ✓" : me.st === "sent" ? "À confirmer" : `Ta part : ${esc(ensMoney(me.share, a.cur))}`}</span>` : a.owner && a.members.some(m => m.st === "sent") ? `<span class="act-chip warn">À confirmer</span>` : ""}</div></button>`; }).join("")
    : `<button type="button" class="card act-card act-empty" id="actNew2"><b>Une sortie, un week-end, un cadeau ?</b><small>Fixez un budget, chacun verse sa part à l'organisateur, de banque à banque. Vous en discutez dans l'activité.</small></button>`;
  return h;
}
function ensBind(root) {
  root.querySelectorAll("[data-dm]").forEach(b => b.onclick = () => dmOpen(b.dataset.dm));
  root.querySelectorAll("[data-act]").forEach(b => b.onclick = () => actOpen(b.dataset.act));
  ["#actNew", "#actNew2"].forEach(s => { const b = root.querySelector(s); if (b) b.onclick = () => actNew(); });
}

// ---------- Messagerie ----------
async function dmOpen(tag, nameHint) {
  if (!(typeof socOn === "function" && socOn())) { toast("Connecte-toi avec Google ou Microsoft pour écrire à tes proches"); return; }
  let j; try { j = await socApi("/dm/" + encodeURIComponent(tag)); } catch (e) { toast(e.message); return; }
  const th = DMS.find(t => t.tag === tag); if (th) th.unread = 0;
  const name = j.peer.name || nameHint || "@" + tag;
  const f = openForm(`<div class="f2 dm-sheet" data-tag="${esc(tag)}"><div class="dm-head"><span class="fav-av" style="background:${favColor("@" + tag)}">${esc(favFirst(name).charAt(0))}</span><div><h3 style="margin:0">${esc(name)}</h3><small class="hint">@${esc(tag)}</small></div></div>
    <div class="dm-box" id="dmBox"></div>
    <button type="button" class="dm-idea-btn" id="dmIdea">💡 Proposer de financer quelque chose ensemble</button>
    <div class="dm-in"><textarea class="field" id="dmText" rows="1" maxlength="1000" placeholder="Écris un message…"></textarea><button type="button" class="btn primary" id="dmSend" aria-label="Envoyer">➤</button></div></div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Fermer";
  let msgs = j.msgs, last = "";
  const draw = () => {
    const box = f.querySelector("#dmBox"); if (!box) return;
    const sig = JSON.stringify(msgs); if (sig === last) return; last = sig;
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    box.innerHTML = msgs.length ? msgs.map(m => dmMsgHTML(m, tag, name)).join("") : `<p class="hint" style="text-align:center;margin:30px 0">Dis bonjour à ${esc(favFirst(name))} 👋<br>Vous pouvez aussi décider ici de financer quelque chose ensemble.</p>`;
    dmMsgBind(box, msgs, tag, name, r => { msgs = r.msgs; draw(); });
    if (atBottom || !draw.once) { box.scrollTop = box.scrollHeight; draw.once = true; }
  };
  draw();
  const send = async () => {
    const ta = f.querySelector("#dmText"), text = ta.value.trim(); if (!text) return;
    ta.value = ""; ta.style.height = "";
    try { const r = await socApi("/dm/" + encodeURIComponent(tag), { method: "POST", body: JSON.stringify({ text, name: ensName() }) }); msgs = r.msgs; draw(); const b = f.querySelector("#dmBox"); b.scrollTop = b.scrollHeight; }
    catch (e) { ta.value = text; toast(e.message); }
  };
  f.querySelector("#dmSend").onclick = send;
  const ta = f.querySelector("#dmText");
  ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !/Mobi/.test(navigator.userAgent)) { e.preventDefault(); send(); } });
  ta.addEventListener("input", () => { ta.style.height = ""; ta.style.height = Math.min(120, ta.scrollHeight) + "px"; });
  f.querySelector("#dmIdea").onclick = () => dmIdea(tag, r => { msgs = r.msgs; draw(); const b = f.querySelector("#dmBox"); b.scrollTop = b.scrollHeight; });
  // Les nouveaux messages arrivent pendant que la conversation est ouverte
  clearInterval(dmPoll);
  dmPoll = setInterval(async () => {
    if (!document.querySelector(`.dm-sheet[data-tag="${tag}"]`)) { clearInterval(dmPoll); ensRefresh(); return; }
    if (document.hidden) return;
    try { const r = await socApi("/dm/" + encodeURIComponent(tag)); msgs = r.msgs; draw(); } catch (e) {}
  }, 4000);
}
function dmMsgHTML(m, tag, name) {
  const who = m.mine ? "Toi" : favFirst(name);
  if (m.del) return `<div class="dm-m ${m.mine ? "me" : ""}"><div class="dm-b del">Message supprimé</div></div>`;
  if (m.kind === "idea") {
    const i = m.idea, v = m.votes || {}, mine = v[SOC.tag], his = v[tag], both = mine === "yes" && his === "yes";
    return `<div class="dm-m ${m.mine ? "me" : ""}"><div class="dm-card"><small>💡 ${m.mine ? "Tu proposes" : `${esc(who)} propose`} de financer ensemble</small><b>${esc(i.title)}</b>
      <span class="hint">${[i.budget ? ensMoney(i.budget, i.cur) : "", i.when ? `le ${frDate(i.when)}` : ""].filter(Boolean).map(esc).join(" · ")}</span>${i.note ? `<p>${linkify(i.note)}</p>` : ""}
      <div class="dm-votes"><span>${esc("Toi")} ${mine === "yes" ? "👍" : mine === "no" ? "✋" : "…"}</span><span>${esc(favFirst(name))} ${his === "yes" ? "👍" : his === "no" ? "✋" : "…"}</span></div>
      ${m.act ? `<button type="button" class="btn primary" data-dmact="${esc(m.act)}">Voir l'activité</button>`
        : both ? `<button type="button" class="btn primary" data-dmcreate="${esc(m.id)}">📅 Créer l'activité</button>`
        : mine !== "yes" ? `<div class="dm-cta"><button type="button" class="btn primary" data-dmvote="${esc(m.id)}" data-v="yes">👍 Partant</button><button type="button" class="btn" data-dmvote="${esc(m.id)}" data-v="no">Pas pour moi</button></div>`
        : his === "no" ? `<small class="hint">${esc(favFirst(name))} n'est pas partant.</small>` : `<small class="hint">En attente de la réponse de ${esc(favFirst(name))}.</small>`}</div><small class="dm-t">${esc(dmTime(m.at))}</small></div>`;
  }
  if (m.kind === "act") { const a = ACTS.find(x => x.id === m.act); return `<div class="dm-m ${m.mine ? "me" : ""}"><button type="button" class="dm-card dm-actlink" data-dmact="${esc(m.act)}"><small>📅 Activité</small><b>${esc(a ? `${a.emoji} ${a.title}` : m.text || "Activité")}</b><span class="linkbtn">Ouvrir ›</span></button><small class="dm-t">${esc(dmTime(m.at))}</small></div>`; }
  return `<div class="dm-m ${m.mine ? "me" : ""}"><div class="dm-b">${linkify(m.text || "")}</div><small class="dm-t">${esc(dmTime(m.at))}</small></div>`;
}
function dmMsgBind(box, msgs, tag, name, upd) {
  box.querySelectorAll("[data-dmvote]").forEach(b => b.onclick = async () => { try { upd(await socApi("/dm/" + encodeURIComponent(tag), { method: "POST", body: JSON.stringify({ action: "vote", mid: b.dataset.dmvote, v: b.dataset.v }) })); } catch (e) { toast(e.message); } });
  box.querySelectorAll("[data-dmact]").forEach(b => b.onclick = () => { closeForm(); setTimeout(() => actOpen(b.dataset.dmact), 220); });
  box.querySelectorAll("[data-dmcreate]").forEach(b => b.onclick = () => {
    const m = msgs.find(x => x.id === b.dataset.dmcreate); if (!m) return;
    closeForm(); setTimeout(() => actNew({ title: m.idea.title, budget: m.idea.budget, when: m.idea.when, desc: m.idea.note, with: [tag], fromDm: { tag, mid: m.id } }), 220);
  });
}
function dmIdea(tag, upd) {
  const host = document.getElementById("sheet2"), wrap = document.createElement("div");
  // petit formulaire dans la conversation (sans quitter le fil)
  const box = host.querySelector(".dm-sheet"); if (!box || box.querySelector(".dm-ideaform")) return;
  wrap.className = "dm-ideaform card";
  wrap.innerHTML = `<b>💡 On finance ensemble…</b><input class="field" id="diTitle" maxlength="80" placeholder="ex. Week-end à la mer, cadeau pour Léa">
    <div class="two"><input class="field" id="diBudget" inputmode="decimal" placeholder="Budget total (${esc(typeof curSym === "function" ? curSym() : "€")})"><input class="field" id="diWhen" type="date" aria-label="Quand"></div>
    <div class="dm-cta"><button type="button" class="btn primary" id="diGo">Proposer</button><button type="button" class="btn" id="diNo">Annuler</button></div>`;
  box.querySelector(".dm-in").before(wrap); box.querySelector("#dmIdea").hidden = true; wrap.querySelector("#diTitle").focus();
  const close = () => { wrap.remove(); box.querySelector("#dmIdea").hidden = false; };
  wrap.querySelector("#diNo").onclick = close;
  wrap.querySelector("#diGo").onclick = async () => {
    const title = wrap.querySelector("#diTitle").value.trim(); if (!title) { toast("Dis ce que vous voulez financer"); return; }
    try { const r = await socApi("/dm/" + encodeURIComponent(tag), { method: "POST", body: JSON.stringify({ name: ensName(), idea: { title, budget: parseAmount(wrap.querySelector("#diBudget").value) || 0, when: wrap.querySelector("#diWhen").value, cur: baseCurrency() } }) }); close(); upd(r); }
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
        if (pre.fromDm) { try { await socApi("/dm/" + encodeURIComponent(pre.fromDm.tag), { method: "POST", body: JSON.stringify({ action: "link", mid: pre.fromDm.mid, act: r.act.id }) }); } catch (e) {} }
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
  on("#acPay", () => {
    const done = async () => { const r = await actCall(id, { action: "paid" }); if (r) { render(); toast(`C'est noté : ${favFirst(a.ownerName)} confirmera dès réception`); } };
    if (a.pay) { closeForm(); setTimeout(() => showPay(a.pay, me.share, a.title, a.ownerName, done), 220); }
    else { closeForm(); setTimeout(() => { const g = openForm(`<div class="f2"><h3>Verser ma part</h3><p>${esc(a.ownerName)} n'a pas encore indiqué comment le payer dans Bourselle. Verse <b class="num">${esc(ensMoney(me.share, a.cur))}</b> comme d'habitude (virement, espèces…), puis appuie sur « J'ai payé ».</p></div>`, () => { done(); }); g.querySelector("button[type=submit]").textContent = "J'ai payé"; }, 220); }
  });
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
