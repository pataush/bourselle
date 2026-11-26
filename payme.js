/* Bourselle — « Me faire payer » : demander un paiement et gérer ses moyens de paiement.
 * 1. Demander : un montant, un motif, et soit une personne de Bourselle (elle reçoit la demande dans son appli),
 *    soit personne : un QR code à montrer ou un lien à envoyer (la personne paie sans compte).
 * 2. Mes moyens de paiement : une tuile par moyen (Revolut, Wero, PayPal, lien, virement, Mobile Money), chacun se règle à part ;
 *    le moyen préféré est proposé en premier. On peut aussi coller un lien ou un IBAN : il est reconnu tout seul.
 * 3. Mes demandes : rouge en attente, jaune « dit avoir payé » (je confirme « J'ai bien reçu »), vert reçu.
 * Celui qui paie dit « J'ai payé » ; seul celui qui reçoit l'argent confirme. Les demandes à un utilisateur Bourselle sont
 * gratuites dans la limite de quelques-unes par mois, illimitées avec Bourselle Plus. QR code et lien : illimités. */
const PM_DEFS = [
  { id: "rev", label: "Revolut", ic: "⚫", has: p => !!p.revolut, sum: p => "@" + p.revolut },
  { id: "wero", label: "Wero", ic: "🔵", has: p => !!p.wero, sum: p => p.wero },
  { id: "pp", label: "PayPal", ic: "🟡", has: p => !!p.paypal, sum: p => "paypal.me/" + p.paypal },
  { id: "iban", label: "Virement (RIB)", ic: "🏦", has: p => !!p.iban, sum: p => PAY.ibanFmt(p.iban).slice(0, 14) + "…" },
  { id: "momo", label: "Mobile Money", ic: "📱", has: p => !!(p.momo && (p.momo.num || p.momo.qr)), sum: p => `${p.momo.op}${p.momo.num ? " · " + p.momo.num : ""}` },
  { id: "link", label: "Autre lien", ic: "🔗", has: p => !!p.link, sum: p => String(p.link).replace(/^https:\/\/(www\.)?/, "").slice(0, 24) },
];
const reqLink = id => appBase() + "g.html#q=" + id;
const reqLeft = c => Math.max(0, Math.round((c.amount - (c.payments || []).filter(p => !p.pend).reduce((a, p) => a + p.amount, 0)) * 100) / 100);
const reqPend = c => (c.payments || []).find(p => p.pend);
const reqState = c => c.status === "settled" ? "ok" : ["cancelled", "declined"].includes(c.status) ? "off" : reqPend(c) ? "sent" : "due";
const reqMoney = c => typeof fmtCur === "function" ? fmtCur(c.amount, c.cur) : eur(c.amount);
const reqWho = c => c.to ? "@" + c.to : c.guest ? c.guest : "QR code / lien";

// Sans « Notifications en direct », on n'est prévenu qu'en ouvrant l'appli : on le propose là où ça compte
function pushNudgeHTML(why) {
  if (typeof pushOn !== "function" || pushOn() || typeof socOn !== "function" || !socOn()) return "";
  let off = false; try { off = localStorage.getItem("bourselle-push-nudge") === "off"; } catch (e) {}
  if (off) return "";
  return `<div class="push-nudge"><span>🔔</span><div><b>Active les notifications</b><small>${esc(why || "pour être prévenu tout de suite quand on te paie ou qu'on te demande de l'argent.")}</small></div>
    <button type="button" class="btn primary" data-pushon>Activer</button><button type="button" class="push-x" data-pushx aria-label="Plus tard">✕</button></div>`;
}
function pushNudgeBind(root) {
  root.querySelectorAll("[data-pushon]").forEach(b => b.onclick = async () => { await enablePush(); render(); const n = b.closest(".push-nudge"); if (n && pushOn()) n.remove(); });
  root.querySelectorAll("[data-pushx]").forEach(b => b.onclick = () => { try { localStorage.setItem("bourselle-push-nudge", "off"); } catch (e) {} b.closest(".push-nudge").remove(); });
}
// Enregistre les moyens de paiement (on renvoie tout, en changeant seulement ce qui est passé)
async function payPut(patch) {
  const p = { ...(SOC.pay || {}), ...patch };
  const body = { name: p.name || "", iban: p.iban || "", paypal: p.paypal || "", link: p.link || "", revolut: p.revolut || "", wero: p.wero || "", order: p.order || [],
    momo: patch.momo !== undefined ? patch.momo : p.momo ? { op: p.momo.op, num: p.momo.num || "", qr: p.momo.qr ? "keep" : "" } : { op: "Autre", num: "", qr: "" } };
  const j = await socApi("/me/pay", { method: "POST", body: JSON.stringify(body) });
  SOC.pay = j.pay; SOC.payToken = j.token || ""; SOC.payLoaded = true;
  return j.pay;
}

async function editPay(opts) {
  if (!socOn()) { toast("Connecte-toi avec Google ou Microsoft pour te faire payer"); return; }
  opts = opts || {};
  await socLoadPay(true);
  if (typeof socRefresh === "function" && !SOC.loaded) await socRefresh();
  const p = SOC.pay || {}, contacts = (settings.contacts || []).slice(0, 8);
  let to = opts.to || "";
  const reqs = (SOC.out || []).filter(c => c.kind === "req").sort((a, b) => (reqState(a) === "ok") - (reqState(b) === "ok") || (b.updated || 0) - (a.updated || 0));
  const q = SOC.quota || { used: 0, free: 3 }, left = Math.max(0, q.free - q.used);
  const tiles = PM_DEFS.map(d => { const on = d.has(p); return `<button type="button" class="pm-tile${on ? " on" : ""}" data-pm="${d.id}"><span class="pm-ti">${d.ic}</span><b>${esc(d.label)}</b><small>${on ? "✓ " + esc(d.sum(p)) : "+ Ajouter"}</small></button>`; }).join("");
  const reqRow = c => { const st = reqState(c), pend = reqPend(c);
    return `<div class="rq-row ${st}"><div class="rq-l"><b>${esc(c.name || "Paiement")}</b><small>${esc(reqWho(c))} · ${esc(frDate(new Date(c.created).toISOString().slice(0, 10)))}</small></div>
      <div class="rq-r"><b class="num">${esc(reqMoney(c))}</b><span class="pj-st ${st === "off" ? "" : st}">${esc(st === "ok" ? "Reçu ✓" : st === "sent" ? (c.to ? "@" + c.to : c.guest || "Quelqu'un") + " dit avoir payé" : st === "off" ? (c.status === "declined" ? "Refusée" : "Annulée") : "En attente")}</span></div>
      ${st === "sent" || st === "due" ? `<div class="rq-acts">${st === "sent" ? `<button type="button" class="btn primary" data-rqok="${esc(c.id)}" data-pid="${esc(pend.id)}">J'ai bien reçu</button>` : ""}${c.open ? `<button type="button" class="btn" data-rqqr="${esc(c.id)}">QR code</button>` : `<button type="button" class="linkbtn" data-rqrem="${esc(c.id)}">🔔 Relancer</button>`}${st === "due" ? `<button type="button" class="linkbtn danger" data-rqx="${esc(c.id)}">Annuler</button>` : ""}</div>` : ""}</div>`; };
  const f = openForm(`<div class="f2 pm2"><h3>Me faire payer</h3>${pushNudgeHTML()}
    <div class="pm-sec"><b>Demander un paiement</b></div>
    <div class="two"><div>${fld("rqAmt", `Montant (${esc(curSym())})`, `inputmode="decimal" placeholder="ex. 25" value="${opts.amount ? esc(String(opts.amount).replace(".", ",")) : ""}"`)}</div><div>${fld("rqNote", "Pour quoi ? (facultatif)", `maxlength="60" placeholder="ex. Resto samedi" value="${esc(opts.note || "")}"`)}</div></div>
    <span class="lbl">À qui ?</span>
    <div class="chips" id="rqTo"><button type="button" class="chip" data-to="" aria-pressed="${!to}">📷 QR code / lien</button>${contacts.map(c => `<button type="button" class="chip" data-to="${esc(c.tag)}" aria-pressed="${to === c.tag}">${esc(c.name || "@" + c.tag)}</button>`).join("")}</div>
    <input class="field" id="rqFind" placeholder="Chercher un @tag Bourselle…" autocapitalize="off" spellcheck="false" autocomplete="off" style="margin-top:8px"><div id="rqRes" class="soc-contacts"></div>
    <p class="hint" id="rqHint" style="margin:6px 0 0"></p>
    <button type="button" class="btn primary" id="rqGo" style="width:100%;margin-top:10px"></button>
    <div class="pm-sec"><b>Mes moyens de paiement</b><small>Touche un moyen pour le régler. Le premier est proposé en premier.</small></div>
    <div class="pm-tiles">${tiles}</div>
    <div class="pm-paste"><input class="field" id="pmPaste" placeholder="Colle un lien Revolut, PayPal… ou ton IBAN" autocapitalize="off" spellcheck="false"><button type="button" class="btn" id="pmPasteGo">OK</button></div>
    <div class="pm-links">${PAY.methods(p, 0, baseCurrency()).length ? `<button type="button" class="linkbtn" id="pmPreview">👁 Ce que verra la personne</button>` : ""}${SOC.payToken ? `<button type="button" class="linkbtn" id="pyShare">Partager mon lien de paiement (sans montant)</button>` : ""}</div>
    ${reqs.length ? `<div class="pm-sec"><b>Mes demandes</b><small>${reqs.filter(c => reqState(c) !== "ok" && reqState(c) !== "off").length} en cours</small></div>${reqs.slice(0, 12).map(reqRow).join("")}` : ""}</div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Fermer";
  pushNudgeBind(f);
  const reopen = o => { closeForm(); setTimeout(() => editPay(o), 200); };
  const cur = () => ({ amount: parseAmount(val("rqAmt")) || 0, note: val("rqNote").trim(), to });
  // À qui : QR code ou une personne
  const drawTo = () => {
    f.querySelectorAll("#rqTo [data-to]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.to === to)));
    const go = f.querySelector("#rqGo"), hint = f.querySelector("#rqHint");
    go.textContent = to ? `Envoyer la demande à @${to}` : "Afficher le QR code / partager le lien";
    hint.textContent = to ? (isPlus() ? "La personne la reçoit dans son appli Bourselle, avec tes moyens de paiement." : `La personne la reçoit dans son appli. Gratuit : encore ${left} demande${left > 1 ? "s" : ""} ce mois-ci (illimité avec Bourselle Plus).`)
      : "À montrer en face ou à envoyer : la personne paie sans compte. Si elle a Bourselle, elle l'ouvre dans son appli.";
  };
  f.querySelectorAll("#rqTo [data-to]").forEach(b => b.onclick = () => { to = b.dataset.to; drawTo(); });
  { const find = f.querySelector("#rqFind"), res = f.querySelector("#rqRes"); let tmr = null;
    find.oninput = () => { clearTimeout(tmr); const qq = find.value.trim().toLowerCase().replace(/^@/, ""); res.innerHTML = "";
      if (qq.length >= 3) tmr = setTimeout(async () => { try { const j = await socApi("/search?q=" + encodeURIComponent(qq)); res.innerHTML = (j.users || []).map(u => `<div class="soc-contact"><div><b>@${esc(u.tag)}</b>${u.name ? ` <span class="hint">${esc(u.name)}</span>` : ""}</div><button type="button" class="btn" data-pick="${esc(u.tag)}">Choisir</button></div>`).join("") || `<p class="hint">Aucun utilisateur trouvé.</p>`;
        res.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { to = b.dataset.pick; const box = f.querySelector("#rqTo"); if (!box.querySelector(`[data-to="${to}"]`)) { const c = document.createElement("button"); c.type = "button"; c.className = "chip"; c.dataset.to = to; c.textContent = "@" + to; c.onclick = () => { to = c.dataset.to; drawTo(); }; box.appendChild(c); } res.innerHTML = ""; find.value = ""; drawTo(); }); } catch (e) {} }, 400); }; }
  drawTo();
  f.querySelector("#rqGo").onclick = async () => {
    const c = cur();
    if (!(c.amount > 0)) { toast("Indique le montant"); f.querySelector("#rqAmt").focus(); return; }
    if (!PAY.methods(SOC.pay || {}, 0, baseCurrency()).length) { toast("Ajoute d'abord au moins un moyen de paiement (ci-dessous)"); f.querySelector(".pm-tiles").scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    const b = f.querySelector("#rqGo"); b.disabled = true;
    try {
      const u = store && store.user ? store.user() : {};
      const r = await socApi("/claims", { method: "POST", body: JSON.stringify({ kind: "req", to: c.to, amount: c.amount, cur: baseCurrency(), name: c.note, plus: settings.licence || "", fromName: String(u.name || "").trim().split(/[\s@]/)[0] }) });
      SOC.out = [r, ...(SOC.out || [])]; if (c.to && !isPlus() && SOC.quota) SOC.quota.used++;
      if (c.to) { toast(`Demande envoyée à @${c.to}`); reopen(); } else { closeForm(); setTimeout(() => reqShowQr(r), 200); }
    } catch (e) { b.disabled = false; toast(e.message); if (e.status === 402) setTimeout(() => showPlus("claim"), 1500); }
  };
  // Moyens de paiement
  f.querySelectorAll("[data-pm]").forEach(b => b.onclick = () => { closeForm(); setTimeout(() => payMethodEdit(b.dataset.pm, () => editPay(cur())), 200); });
  f.querySelector("#pmPasteGo").onclick = async () => {
    const v = val("pmPaste").trim(); if (!v) return;
    const d = payDetect(v); if (!d) { toast("Je ne reconnais pas ce lien ou ce numéro"); return; }
    if (d.edit) { closeForm(); return setTimeout(() => payMethodEdit(d.edit, () => editPay(cur()), d.prefill), 200); }
    const key = Object.keys(d.patch)[0], mid = { revolut: "rev", paypal: "pp", iban: "iban", wero: "wero", link: "link" }[key];
    const ord = (SOC.pay && SOC.pay.order) || []; if (mid && !ord.includes(mid)) d.patch.order = [...ord, mid];
    try { await payPut(d.patch); toast(`${d.label} ajouté ✓`); reopen(cur()); } catch (e) { toast(e.message); }
  };
  { const pv = f.querySelector("#pmPreview"); if (pv) pv.onclick = () => { const c = cur(); closeForm(); setTimeout(() => { const g = openForm(`<div class="f2"><h3>Aperçu</h3><p class="hint" style="margin:0 0 8px">Voici ce que verra la personne qui te paie.</p>${PAY.html(SOC.pay, c.amount, baseCurrency(), c.note, x => x, v => eur(v))}</div>`, () => true); g.querySelector("button[type=submit]").hidden = true; g.querySelector("#f2Cancel").textContent = "Retour"; g.querySelector("#f2Cancel").onclick = () => { closeForm(); setTimeout(() => editPay(c), 200); }; PAY.bind(g, toast); }, 200); }; }
  { const sh = f.querySelector("#pyShare"); if (sh) sh.onclick = () => shareText("Pour me payer :", payLinkUrl(0, "")); }
  // Mes demandes
  f.querySelectorAll("[data-rqok]").forEach(b => b.onclick = () => reqAct(b.dataset.rqok, { action: "received", pid: b.dataset.pid }, "Réception confirmée ✓").then(() => reopen(cur())));
  f.querySelectorAll("[data-rqqr]").forEach(b => b.onclick = () => { const c = reqs.find(x => x.id === b.dataset.rqqr); closeForm(); setTimeout(() => reqShowQr(c), 200); });
  f.querySelectorAll("[data-rqrem]").forEach(b => b.onclick = async () => { const c = reqs.find(x => x.id === b.dataset.rqrem); closeForm(); await new Promise(r => setTimeout(r, 200));
    const msg = await remindPick("@" + c.to, typeof fmtCur === "function" ? fmtCur(reqLeft(c), c.cur) : eur(reqLeft(c)), c.name || "");
    if (msg) { const r = await reqAct(c.id, { action: "remind", msg }); if (r) toast(r.reminded === "recent" ? "Déjà relancé il y a moins de 6 h" : `Rappel envoyé à @${c.to}`); } });
  f.querySelectorAll("[data-rqx]").forEach(b => b.onclick = () => { if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = "Confirmer ?"; return; } reqAct(b.dataset.rqx, { action: "cancel" }, "Demande annulée").then(() => reopen(cur())); });
}
async function reqAct(id, body, msg) {
  try {
    const r = await socApi("/claims/" + id, { method: "POST", body: JSON.stringify(body) });
    const all = [...(SOC.out || []), ...(SOC.in || [])], i = SOC.out.findIndex(x => x.id === id), k = SOC.in.findIndex(x => x.id === id);
    if (i >= 0) SOC.out[i] = { ...SOC.out[i], ...r }; if (k >= 0) SOC.in[k] = { ...SOC.in[k], ...r };
    // Argent reçu (je confirme) → rentrée ; j'ai payé → dépense
    if (body.action === "received") { const c = SOC.out[i] || r, p = (c.payments || []).find(x => x.id === body.pid) || (c.payments || []).slice(-1)[0];
      if (p && typeof autoTx === "function") autoTx(`rq:${id}:${p.id}:in`, { type: "rentree", amount: p.amount, cat: incomeCat(), date: todayISO(), note: `${c.name || "Paiement"} · ${reqWho(c)}`.slice(0, 80) }); }
    if (msg) toast(msg); if (typeof refreshBell === "function") refreshBell(); render(); void all;
    return r;
  } catch (e) { toast(e.message); return null; }
}
// Grand QR code à montrer, et lien à partager
function reqShowQr(c) {
  const url = reqLink(c.id); let svg = ""; try { svg = QR.svg(url, { px: 6 }); } catch (e) {}
  const f = openForm(`<div class="f2 rq-qr"><h3>${esc(c.name || "Me faire payer")}</h3><div class="rq-big num">${esc(reqMoney(c))}</div>
    <div class="pay-qr">${svg}<p>Fais scanner ce QR code : la personne voit le montant et tes moyens de paiement, et paie sans compte. Avec Bourselle, elle l'ouvre dans son appli.</p></div>
    <button type="button" class="btn primary" id="rqShare" style="width:100%">Partager le lien</button>
    <p class="hint" style="margin:8px 0 0">Quand elle dira « J'ai payé », tu le verras dans Me faire payer › Mes demandes : confirme quand l'argent est arrivé.</p></div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Terminé";
  f.querySelector("#rqShare").onclick = () => shareText(`${c.name ? c.name + " : " : ""}${reqMoney(c)} à me payer. Tu peux payer ici :`, url);
}
// Reconnaître un lien ou un IBAN collé
function payDetect(v) {
  const s = v.trim();
  let m = /revolut\.me\/@?([A-Za-z0-9._-]{2,40})/i.exec(s); if (m) return { label: "Revolut", patch: { revolut: m[1] } };
  m = /paypal\.me\/([A-Za-z0-9]{1,40})/i.exec(s); if (m) return { label: "PayPal", patch: { paypal: m[1] } };
  if (PAY.ibanOk(s)) return (SOC.pay || {}).name ? { label: "IBAN", patch: { iban: PAY.clean(s) } } : { edit: "iban", prefill: { iban: s } };
  if (/^\+?[0-9 .-]{8,20}$/.test(s)) return { edit: "phone", prefill: { num: s } };
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return { label: "Wero", patch: { wero: s.toLowerCase() } };
  if (/^https:\/\/\S{4,}$/.test(s)) return { label: "Lien de paiement", patch: { link: s } };
  return null;
}
// Régler un seul moyen de paiement
function payMethodEdit(id, back, prefill) {
  const p = SOC.pay || {}; prefill = prefill || {};
  if (id === "phone") {   // un numéro collé : Wero ou Mobile Money ?
    const f = openForm(`<div class="f2"><h3>Ce numéro, c'est pour…</h3><div class="pm-tiles"><button type="button" class="pm-tile" data-k="wero"><span class="pm-ti">🔵</span><b>Wero</b></button><button type="button" class="pm-tile" data-k="momo"><span class="pm-ti">📱</span><b>Mobile Money</b></button></div></div>`, () => true);
    f.querySelector("button[type=submit]").hidden = true;
    f.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { closeForm(); setTimeout(() => payMethodEdit(b.dataset.k, back, b.dataset.k === "wero" ? { wero: prefill.num } : { num: prefill.num }), 200); });
    return;
  }
  const d = PM_DEFS.find(x => x.id === id), on = d.has(p), first = (p.order || [])[0] === id;
  const body = {
    rev: () => fld("pmV", "Ton identifiant Revolut", `placeholder="ex. annemartin (ce qui suit revolut.me/)" autocapitalize="off" value="${esc(p.revolut || "")}"`),
    wero: () => fld("pmV", "Ton numéro de téléphone ou ton e-mail Wero", `placeholder="ex. +33 6 12 34 56 78" autocapitalize="off" value="${esc(prefill.wero || p.wero || "")}"`),
    pp: () => fld("pmV", "Ton nom PayPal.me", `placeholder="ex. annemartin (ce qui suit paypal.me/)" autocapitalize="off" value="${esc(p.paypal || "")}"`),
    link: () => fld("pmV", "Ton lien de paiement", `placeholder="https://… (Lydia, Sumeria, Paylib…)" value="${esc(p.link || "")}"`),
    iban: () => fld("pmN", "Titulaire du compte", `placeholder="ex. Anne Martin" value="${esc(p.name || "")}"`) + fld("pmV", "IBAN", `placeholder="FR76 …" autocapitalize="characters" value="${esc(prefill.iban || (p.iban ? PAY.ibanFmt(p.iban) : ""))}"`) + `<p class="hint" style="margin:4px 0 0">Ceux qui te paient verront un QR code de virement déjà rempli (montant et motif).</p>`,
    momo: () => `<div class="two"><div><label class="lbl" for="pmOp">Opérateur</label><select class="field" id="pmOp">${["MTN MoMo", "Orange Money", "Wave", "Moov Money", "Airtel Money", "M-Pesa", "Free Money", "Autre"].map(o => `<option ${p.momo && p.momo.op === o ? "selected" : ""}>${o}</option>`).join("")}</select></div><div>${fld("pmV", "Numéro", `inputmode="tel" placeholder="+229 97 00 00 00" value="${esc(prefill.num || (p.momo ? p.momo.num : ""))}"`)}</div></div>
      ${fld("pmN", "Nom (facultatif)", `value="${esc(p.name || "")}"`)}
      <div class="py-qr"><div id="pyQrPrev" class="py-qrprev"></div><div><label class="btn" style="cursor:pointer;display:inline-block">${p.momo && p.momo.qr ? "Remplacer" : "Ajouter"} mon QR code<input type="file" accept="image/*" id="pyQrIn" hidden></label>
      <button type="button" class="linkbtn danger" id="pyQrDel" ${p.momo && p.momo.qr ? "" : "hidden"}>Retirer</button><p class="hint" style="margin:4px 0 0">Dans ton appli Mobile Money, affiche « Mon QR code », fais une capture d'écran et choisis-la ici.</p></div></div>`,
  }[id];
  let qrState = p.momo && p.momo.qr ? "keep" : "";
  const f = openForm(`<div class="f2"><h3>${d.ic} ${esc(d.label)}</h3>${body()}
    ${on ? `<div class="acts" style="margin-top:12px">${first ? `<span class="hint">⭐ Proposé en premier</span>` : `<button type="button" class="btn" id="pmFirst">⭐ Proposer en premier</button>`}<button type="button" class="btn danger" id="pmDel">Retirer</button></div>` : ""}</div>`, () => {
    const v = (f.querySelector("#pmV") || {}).value ? f.querySelector("#pmV").value.trim() : "", nm = f.querySelector("#pmN") ? f.querySelector("#pmN").value.trim() : undefined;
    let patch = {};
    if (id === "rev") { const x = v.replace(/^@/, "").replace(/^https?:\/\/(www\.)?revolut\.me\//i, "").replace(/[/?#].*$/, ""); if (!/^[A-Za-z0-9._-]{2,40}$/.test(x)) { toast("Identifiant Revolut invalide (ex. annemartin)"); return false; } patch.revolut = x; }
    if (id === "wero") { const ok = /^\+?[0-9]{8,15}$/.test(v.replace(/[\s.-]/g, "")) || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); if (!ok) { toast("Indique ton numéro de téléphone ou ton e-mail"); return false; } patch.wero = v; }
    if (id === "pp") { const x = v.replace(/^@/, "").replace(/^https?:\/\/(www\.)?paypal\.me\//i, "").replace(/\/.*$/, ""); if (!/^[A-Za-z0-9]{1,40}$/.test(x)) { toast("Nom PayPal.me invalide"); return false; } patch.paypal = x; }
    if (id === "link") { if (!/^https:\/\/\S{4,}$/.test(v)) { toast("Le lien doit commencer par https://"); return false; } patch.link = v; }
    if (id === "iban") { if (!PAY.ibanOk(v)) { toast("IBAN invalide : vérifie-le"); return false; } if (!nm) { toast("Indique le titulaire du compte"); return false; } patch.iban = PAY.clean(v); patch.name = nm; }
    if (id === "momo") { const n = v.replace(/[\s.-]/g, ""); if (n && !/^\+?[0-9]{8,15}$/.test(n)) { toast("Numéro invalide (ex. +229 97 00 00 00)"); return false; } if (!n && !qrState) { toast("Indique le numéro ou ajoute ton QR code"); return false; } patch.momo = { op: f.querySelector("#pmOp").value, num: n, qr: qrState }; if (nm !== undefined && nm) patch.name = nm; }
    if (!on) patch.order = [...(p.order || []).filter(x => x !== id), id];
    payPut(patch).then(() => { toast(`${d.label} enregistré ✓`); back && setTimeout(back, 200); }).catch(e => toast(e.message));
  });
  f.querySelector("#f2Cancel").onclick = () => { closeForm(); back && setTimeout(back, 200); };
  const fst = f.querySelector("#pmFirst"); if (fst) fst.onclick = () => payPut({ order: [id, ...(p.order || []).filter(x => x !== id)] }).then(() => { toast(`${d.label} proposé en premier`); closeForm(); back && setTimeout(back, 200); }).catch(e => toast(e.message));
  const del = f.querySelector("#pmDel"); if (del) del.onclick = () => {
    if (del.dataset.c !== "1") { del.dataset.c = "1"; del.textContent = "Confirmer ?"; return; }
    const patch = { rev: { revolut: "" }, wero: { wero: "" }, pp: { paypal: "" }, link: { link: "" }, iban: { iban: "" }, momo: { momo: { op: "Autre", num: "", qr: "" } } }[id];
    patch.order = (p.order || []).filter(x => x !== id);
    payPut(patch).then(() => { toast(`${d.label} retiré`); closeForm(); back && setTimeout(back, 200); }).catch(e => toast(e.message));
  };
  if (id === "momo") {
    const prev = f.querySelector("#pyQrPrev"), qin = f.querySelector("#pyQrIn"), qdel = f.querySelector("#pyQrDel");
    const showPrev = src => { prev.innerHTML = src ? `<img alt="QR">` : ""; if (src) prev.firstChild.src = src; prev.hidden = !src; };
    showPrev(""); if (p.momo && p.momo.qr) PAY.momoQr(p.momo.qr).then(showPrev).catch(() => {});
    qin.onchange = async () => { const file = qin.files && qin.files[0]; if (!file) return; try { const x = await prepMomoQr(file, s => window.T ? window.T(s) : s); qrState = x; showPrev(x); qdel.hidden = false; } catch (e) { toast(e.message); } };
    qdel.onclick = () => { qrState = ""; showPrev(""); qdel.hidden = true; };
  }
  setTimeout(() => { const i = f.querySelector("#pmV"); if (i && !i.value) i.focus(); }, 80);
}

// ---------- Côté de celui qui paie : demandes reçues ----------
function reqInHTML() {
  const linked = new Set(Object.values(debts).map(d => d.claim).filter(Boolean));   // « Plus tard » : elle est dans mes dettes
  const list = (SOC.in || []).filter(c => c.kind === "req" && !linked.has(c.id) && !["settled", "cancelled", "declined"].includes(c.status));
  if (!list.length) return "";
  return `<div class="card soc-in"><h2>Demandes de paiement<small>${list.length}</small></h2>${list.map(c => { const pend = reqPend(c);
    return `<div class="soc-claim"><div><b>${esc(c.fromName || "@" + c.from)}</b> <span class="hint">@${esc(c.from)}</span> <span>te demande</span> <b class="num">${esc(typeof fmtCur === "function" ? fmtCur(reqLeft(c), c.cur) : eur(reqLeft(c)))}</b></div>
    <div class="hint">${esc(c.name || "Paiement")}${c.note ? " · " + esc(c.note) : ""}</div>
    <div class="acts">${pend ? `<span class="pj-st sent">Payé, en attente de confirmation</span>` : `<button class="btn primary" data-rqpay="${esc(c.id)}">Payer</button>${c.status === "pending" ? `<button class="btn" data-soc="accept" data-cid="${esc(c.id)}">Plus tard</button><button class="btn" data-soc="decline" data-cid="${esc(c.id)}">Refuser</button>` : ""}`}</div></div>`; }).join("")}</div>`;
}
function reqInBind(root) {
  root.querySelectorAll("[data-rqpay]").forEach(b => b.onclick = () => reqPay(b.dataset.rqpay));
  root.querySelectorAll("[data-rqno]").forEach(b => b.onclick = () => { if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = "Confirmer ?"; return; } reqAct(b.dataset.rqno, { action: "decline" }, "Demande refusée"); });
}
function reqPay(id) {
  const c = (SOC.in || []).find(x => x.id === id); if (!c) return;
  const amt = reqLeft(c), who = c.fromName || "@" + c.from;
  const done = () => reqAct(c.id, { action: "paid", amount: amt }, `Merci ! ${who} va confirmer la réception.`).then(async r => {
    if (!r || typeof autoTx !== "function") return;
    let base = amt;   // dans une autre devise : la dépense est notée dans la mienne, au taux du jour
    if (c.cur && c.cur !== baseCurrency()) { try { const fx = await fxRate(c.cur); if (fx && fx.rate > 0) base = Math.round(amt / fx.rate * 100) / 100; } catch (e) {} }
    autoTx(`rq:${c.id}:out`, { type: "depense", amount: base, cat: defCat("loisirs"), date: todayISO(), note: `${c.name || "Paiement"} · ${who}${c.cur !== baseCurrency() ? ` (${fmtCur(amt, c.cur)})` : ""}`.slice(0, 80) });
  });
  if (c.pay) showPay(c.pay, amt, c.name || "Bourselle", who, done);
  else { const f = openForm(`<div class="f2"><h3>Payer ${esc(who)}</h3><p class="hint">${esc(who)} n'a pas encore indiqué comment le payer : règle-le comme d'habitude, puis appuie sur « J'ai payé ».</p></div>`, done); f.querySelector("button[type=submit]").textContent = "J'ai payé"; }
}
// Ouvrir dans l'appli une demande reçue par QR code / lien (…/?q=identifiant)
async function reqTakeFromUrl() {
  const m = /[?&]q=([a-z0-9]{10,16})/.exec(location.search); if (!m || !socOn()) return;
  history.replaceState(null, "", location.pathname);
  try { const r = await socApi("/claims/" + m[1], { method: "POST", body: JSON.stringify({ action: "take" }) });
    if (r.from === SOC.tag) { toast("C'est ta propre demande"); return; }
    SOC.in = [r, ...(SOC.in || []).filter(x => x.id !== r.id)]; switchTab("dettes"); setTimeout(() => reqPay(r.id), 300);
  } catch (e) { toast(e.message); }
}
