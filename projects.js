/* Bourselle — gérer un paiement.
 * Exemple : des travaux chez moi. Je crée le paiement, j'ajoute une ligne par personne (ce que je lui dois, la date convenue).
 * Chacune voit seulement ce que je lui dois dans son app. Je paie (de banque à banque) puis j'indique « payé » : la ligne passe
 * au jaune ; quand la personne confirme la réception, elle passe au vert chez moi. Rouge : encore à payer.
 * C'est toujours la personne qui reçoit l'argent qui confirme : sans compte Bourselle, elle le fait avec le lien que je lui envoie. */
let PROJECTS = (() => { try { return JSON.parse(localStorage.getItem("bourselle-projets") || "[]") || []; } catch (e) { return []; } })();
let openProject = null;
// Un paiement fait va dans les dépenses (à sa date) ; de l'argent reçu va dans les rentrées. Jamais deux fois (src).
function autoTx(src, tx) {
  if (allItems().some(x => x.src === src)) return false;
  addTx({ ...tx, src, fixe: false }); return true;
}
const incomeCat = () => settings.rentree.find(x => /rembourse|refund/i.test(x)) || settings.rentree[settings.rentree.length - 1] || settings.rentree[0];
const projSave = () => { try { localStorage.setItem("bourselle-projets", JSON.stringify(PROJECTS.slice(0, 80))); } catch (e) {} };
function projPut(pj) { const i = PROJECTS.findIndex(x => x.id === pj.id); if (i >= 0) PROJECTS[i] = pj; else PROJECTS.unshift(pj); projSave(); }
async function projRefresh() {
  if (typeof socOn !== "function" || !socOn()) return;
  try { const j = await socApi("/projects"); PROJECTS = j.projects || []; projSave(); if (tab === "accueil" && !openDeal) render(); } catch (e) {}
}
const PJ_ST = { due: ["À payer", "due"], sent: ["Paiement envoyé", "sent"], ok: ["Reçu ✓", "ok"] };
const pjMoney = (v, cur) => dealMoney(v, cur);
function pjStats(pj) {
  if (pj.stats) return pj.stats;
  const L = Object.values(pj.lines || {}), sum = st => L.filter(l => !st || l.status === st).reduce((a, l) => a + l.amount, 0);
  return { total: sum(), due: sum("due"), sent: sum("sent"), ok: sum("ok"), n: L.length };
}
const pjBar = st => st.total ? `<div class="pj-bar"><i class="ok" style="width:${(st.ok / st.total * 100).toFixed(1)}%"></i><i class="sent" style="width:${(st.sent / st.total * 100).toFixed(1)}%"></i><i class="due" style="width:${(st.due / st.total * 100).toFixed(1)}%"></i></div>` : "";
// Sur « Partage » : mes paiements à gérer, et ce qu'on me doit
function projHubHTML() {
  const mine = PROJECTS.filter(p => p.role === "owner"), owed = PROJECTS.filter(p => p.role === "payee");
  let h = "";
  if (mine.length) h += `<div class="hub-sec"><span>Mes paiements à faire</span></div><div class="hub-deals">${mine.map(pj => { const st = pjStats(pj); return `<button type="button" class="deal-card" data-pj="${esc(pj.id)}">
      <div class="dc-top"><span class="dc-kind pj">Paiement</span><span class="dc-st${st.due + st.sent < 0.005 ? " ok" : ""}">${st.due + st.sent < 0.005 ? "Tout est payé ✓" : `Reste ${esc(pjMoney(st.due, pj.cur))} à payer`}</span></div>
      <b class="dc-t">${esc(pj.title)}</b>${pjBar(st)}
      <div class="dc-s">Total ${esc(pjMoney(st.total, pj.cur))} · ${st.n} personne${st.n > 1 ? "s" : ""} · <span class="pj-c ok">${esc(pjMoney(st.ok, pj.cur))} reçus</span>${st.sent ? ` · <span class="pj-c sent">${esc(pjMoney(st.sent, pj.cur))} envoyés</span>` : ""}</div></button>`; }).join("")}</div>`;
  const rows = owed.flatMap(pj => Object.entries(pj.lines || {}).map(([lid, l]) => ({ pj, lid, l })));
  if (rows.length) h += `<div class="hub-sec"><span>On te doit</span></div><div class="card pj-owed">${rows.map(({ pj, lid, l }) => `<div class="pj-line ${l.status}">
      <div class="pj-l"><b>${esc(pj.ownerName || "@" + pj.owner)}</b> <small>@${esc(pj.owner)}</small><small>${esc(pj.title)}${l.what ? " · " + esc(l.what) : ""}${l.due ? ` · prévu le ${esc(frDate(l.due))}` : ""}</small></div>
      <div class="pj-r"><b class="num">${esc(pjMoney(l.amount, pj.cur))}</b><span class="pj-st ${l.status}">${esc(l.status === "sent" ? "Envoyé, à confirmer" : PJ_ST[l.status][0].replace("À payer", "En attente"))}</span>
      ${l.status !== "ok" ? `<button type="button" class="btn ${l.status === "sent" ? "primary" : ""}" data-pjok="${esc(pj.id)}" data-lid="${esc(lid)}">J'ai reçu le paiement</button>` : ""}</div><div class="pj-acts">${invBtn(pj, lid, l)}</div></div>`).join("")}</div>`;
  return h;
}
function projBindHub() {
  invBind(view);
  view.querySelectorAll("[data-pj]").forEach(b => b.onclick = () => showProject(b.dataset.pj));
  view.querySelectorAll("[data-pjok]").forEach(b => b.onclick = () => projAct(b.dataset.pjok, { action: "ok", lid: b.dataset.lid }, "Réception confirmée ✓"));
}
async function projAct(id, body, msg) {
  try { const r = await socApi("/projects/" + id, { method: "POST", body: JSON.stringify(body) });
    if (r.project && body.action === "ok" && r.project.role === "payee") {
      const l = r.project.lines[body.lid];
      if (l && autoTx(`pj:${id}:${body.lid}:in`, { type: "rentree", amount: l.amount, cat: incomeCat(), date: todayISO(), note: `${r.project.title} · ${r.project.ownerName || "@" + r.project.owner}`.slice(0, 80) })) msg = "Réception confirmée : ajoutée à tes rentrées ✓";
    } if (r.project) projPut(r.project); else { PROJECTS = PROJECTS.filter(x => x.id !== id); projSave(); openProject = null; } if (msg) toast(msg); render(); return r; }
  catch (e) { toast(e.message); }
}
function showProject(id) { openProject = id; if (typeof openDeal !== "undefined") openDeal = null; if (tab !== "accueil") switchTab("accueil"); else render(); window.scrollTo(0, 0); projRefresh(); }
function renderProject() {
  const pj = PROJECTS.find(x => x.id === openProject);
  if (!pj) { openProject = null; return renderAccueil(); }
  const st = pjStats(pj), owner = pj.role === "owner";
  document.getElementById("periodLabel").textContent = owner ? "Paiement à faire" : "On te doit";
  document.getElementById("resCap").textContent = pj.title;
  const big = document.getElementById("resBig"); big.className = "big num"; big.textContent = pjMoney(owner ? st.total : Object.values(pj.lines).reduce((a, l) => a + l.amount, 0), pj.cur);
  document.getElementById("resPill").innerHTML = owner ? `<span class="pill" style="background:rgba(255,255,255,.15);color:#fff">Reçu ${esc(pjMoney(st.ok, pj.cur, true))} · envoyé ${esc(pjMoney(st.sent, pj.cur))} · reste ${esc(pjMoney(st.due, pj.cur))}</span>` : "";
  const today = todayISO();
  const lines = Object.entries(pj.lines || {}).sort((a, b) => ({ due: 0, sent: 1, ok: 2 }[a[1].status] - { due: 0, sent: 1, ok: 2 }[b[1].status]) || (a[1].due || "9").localeCompare(b[1].due || "9"));
  let h = banner + `<button class="btn" id="pjBack" style="align-self:flex-start">‹ Entre proches</button>`;
  if (owner) h += `<div class="card"><h2>${esc(pj.title)}<small>${st.n} personne${st.n > 1 ? "s" : ""}</small></h2>${pj.note ? `<p class="hint" style="margin:0 0 8px">${esc(pj.note)}</p>` : ""}${pjBar(st)}
    <div class="pj-legend"><span class="pj-c due">● À payer ${esc(pjMoney(st.due, pj.cur))}</span><span class="pj-c sent">● Envoyé ${esc(pjMoney(st.sent, pj.cur))}</span><span class="pj-c ok">● Reçu ${esc(pjMoney(st.ok, pj.cur))}</span></div></div>`;
  h += `<div class="card"><h2>${owner ? "Personnes à payer" : "Ce qu'on te doit"}</h2>${lines.map(([lid, l]) => {
    const late = l.status === "due" && l.due && l.due < today;
    return `<div class="pj-line ${l.status}">
      <div class="pj-l"><b>${esc(l.name)}</b>${l.toTag ? ` <small>@${esc(l.toTag)}</small>` : owner ? ` <small>(sans compte)</small>` : ""}<small>${l.what ? esc(l.what) : ""}${l.due ? `${l.what ? " · " : ""}<span class="${late ? "pj-late" : ""}">${late ? "en retard, prévu le " : "prévu le "}${esc(frDate(l.due))}</span>` : ""}</small></div>
      <div class="pj-r"><b class="num">${esc(pjMoney(l.amount, pj.cur))}</b><span class="pj-st ${l.status}">${esc(owner ? PJ_ST[l.status][0] : l.status === "sent" ? "Envoyé, à confirmer" : l.status === "ok" ? "Reçu ✓" : "En attente")}</span></div>
      <div class="pj-acts">${owner ? (l.status === "due" ? `<button type="button" class="btn primary" data-pay="${esc(lid)}">Payer</button>` : l.status === "sent" ? `<span class="hint">En attente de confirmation de ${esc(l.name)}</span>${!l.member ? `<button type="button" class="btn" data-plink="${esc(lid)}">🔗 Lui envoyer le lien pour confirmer</button>` : ""}<button type="button" class="linkbtn" data-act="unsent" data-lid="${esc(lid)}">Annuler l'envoi</button>` : "")
        + (l.status !== "ok" ? `<button type="button" class="linkbtn" data-edit="${esc(lid)}">Modifier</button><button type="button" class="linkbtn danger" data-rm="${esc(lid)}">Retirer</button>` : "")
        : l.status !== "ok" ? `<button type="button" class="btn ${l.status === "sent" ? "primary" : ""}" data-act="ok" data-lid="${esc(lid)}">J'ai reçu le paiement</button>` : ""}${invBtn(pj, lid, l)}</div></div>`;
  }).join("") || `<p class="hint" style="margin:0">Personne pour l'instant.</p>`}
    ${owner ? `<button type="button" class="btn" id="pjAdd" style="width:100%;margin-top:10px">+ Ajouter une personne</button>` : ""}</div>`;
  if (owner) h += `<div class="acts"><button type="button" class="btn" id="pjRen">Renommer</button><button type="button" class="btn danger" id="pjDel">Supprimer ce paiement</button></div>
    <p class="hint" style="text-align:center;margin:4px 0 0">Rouge : à payer · jaune : paiement envoyé · vert : réception confirmée par la personne. Chacune ne voit que ce que tu lui dois.</p>`;
  else h += `<p class="hint" style="text-align:center;margin:4px 0 0">${esc(pj.ownerName || "@" + pj.owner)} suit ce paiement. Quand tu as reçu l'argent, confirme-le : la ligne passera au vert chez lui.</p>`;
  view.innerHTML = h;
  document.getElementById("pjBack").onclick = () => { openProject = null; render(); window.scrollTo(0, 0); };
  view.querySelectorAll("[data-act]").forEach(b => b.onclick = () => projAct(pj.id, { action: b.dataset.act, lid: b.dataset.lid }, b.dataset.act === "ok" ? "Réception confirmée ✓" : null));
  view.querySelectorAll("[data-pay]").forEach(b => b.onclick = () => payLine(pj, b.dataset.pay));
  view.querySelectorAll("[data-plink]").forEach(b => b.onclick = () => projSendConfirm(pj, b.dataset.plink));
  view.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => editLine(pj, b.dataset.edit));
  view.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = "Confirmer ?"; return; } projAct(pj.id, { action: "remove", lid: b.dataset.rm }, "Ligne retirée"); });
  invBind(view);
  const add = document.getElementById("pjAdd"); if (add) add.onclick = () => editLine(pj, null);
  const ren = document.getElementById("pjRen"); if (ren) ren.onclick = () => {
    const f = openForm(`<div class="f2"><h3>Renommer</h3>${fld("pjT", "Nom", `maxlength="60" value="${esc(pj.title)}"`)}<label class="lbl" for="pjN">Note (facultatif)</label><textarea class="field" id="pjN" rows="2" maxlength="300">${esc(pj.note || "")}</textarea></div>`, () => { projAct(pj.id, { action: "title", title: val("pjT"), note: val("pjN") }, "Modifié"); });
  };
  const del = document.getElementById("pjDel"); if (del) del.onclick = () => { if (del.dataset.c !== "1") { del.dataset.c = "1"; del.textContent = "Confirmer la suppression ?"; return; } projAct(pj.id, { action: "delete" }, "Paiement supprimé"); };
}
// Facture d'une ligne : photo (réduite) ou PDF (2 Mo au plus), visible par les deux personnes concernées
const invBtn = (pj, lid, l) => (l.invoice ? `<button type="button" class="linkbtn pj-inv" data-inv="${esc(lid)}" data-pjid="${esc(pj.id)}">📎 ${esc(l.invoice.name.length > 22 ? l.invoice.name.slice(0, 21) + "…" : l.invoice.name)}</button>` : "")
  + `<label class="linkbtn pj-inv" style="cursor:pointer">${l.invoice ? "Remplacer" : "＋ Facture"}<input type="file" accept="image/*,application/pdf" data-invup="${esc(lid)}" data-pjid="${esc(pj.id)}" hidden></label>`;
function readAsDataURL(file) { return new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ko(new Error("Fichier illisible")); r.readAsDataURL(file); }); }
function invBind(root) {
  root.querySelectorAll("[data-inv]").forEach(b => b.onclick = async () => {
    try {
      const j = await socApi(`/projects/${b.dataset.pjid}/file?l=${b.dataset.inv}`);
      if (j.data.startsWith("data:application/pdf")) {
        const bin = atob(j.data.split(",")[1]), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([u8], { type: "application/pdf" }));
        if (!window.open(url, "_blank")) { const a = document.createElement("a"); a.href = url; a.download = j.name || "facture.pdf"; a.click(); }
      } else showPhoto(j.data);
    } catch (e) { toast(e.message); }
  });
  root.querySelectorAll("[data-invup]").forEach(inp => inp.onchange = async () => {
    const file = inp.files && inp.files[0]; if (!file) return;
    try {
      toast("Envoi de la facture…");
      const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      if (pdf && file.size > 2 * 1024 * 1024) throw new Error("PDF trop lourd (2 Mo au plus)");
      const data = pdf ? (await readAsDataURL(file)).replace(/^data:[^;]*;/, "data:application/pdf;") : await shrinkPhoto(file);
      const r = await socApi(`/projects/${inp.dataset.pjid}/file`, { method: "POST", body: JSON.stringify({ lid: inp.dataset.invup, data, name: file.name || (pdf ? "facture.pdf" : "facture.jpg") }) });
      projPut(r.project); toast("Facture ajoutée"); render();
    } catch (e) { toast(e.message); }
  });
}
// Payer une personne : ses coordonnées (si elle les a indiquées), puis « J'ai payé » → jaune
function payLine(pj, lid) {
  const l = pj.lines[lid];
  const f = openForm(`<div class="f2"><h3>Payer ${esc(l.name)}</h3>
    ${l.pay ? PAY.html(l.pay, l.amount, pj.cur, pj.title + (l.what ? " · " + l.what : ""), x => x, v => pjMoney(v, pj.cur)) : `<div class="pay-amt"><span>À payer</span><b>${esc(pjMoney(l.amount, pj.cur))}</b></div><p class="hint">${l.member ? `${esc(l.name)} n'a pas encore indiqué ses coordonnées : règle-le comme convenu (virement, espèces…).` : "Règle-le comme convenu (virement, espèces, chèque…)."}</p>`}
    ${l.invoice ? `<p style="margin:10px 0 0">${invBtn(pj, lid, l).split("<label")[0]}</p>` : ""}
    ${fld("plDate", "Date du paiement", `type="date" value="${todayISO()}"`)}
    <label class="toggle" for="plTx" style="margin-top:12px"><span>Ajouter ce paiement à mes dépenses</span><input type="checkbox" id="plTx" checked></label>
    <p class="hint" style="margin:8px 0 0">Une fois payé, appuie sur « J'ai payé » : la ligne passe au jaune. ${esc(l.name)} confirmera la réception${l.member ? " dans son appli" : " avec le lien que tu vas lui envoyer (sans compte)"} : elle passera alors au vert.</p></div>`, () => {
    const tx = document.getElementById("plTx").checked, date = /^\d{4}-\d{2}-\d{2}$/.test(val("plDate")) ? val("plDate") : todayISO();
    projAct(pj.id, { action: "sent", lid }, tx ? "Payé : ajouté à tes dépenses, en attente de confirmation" : "Paiement indiqué : en attente de confirmation").then(r => {
      if (r && tx) autoTx(`pj:${pj.id}:${lid}:out`, { type: "depense", amount: l.amount, cat: defCat("logement"), date, note: `${pj.title} · ${l.name}${l.what ? " (" + l.what + ")" : ""}`.slice(0, 80) });
      if (r && !l.member) setTimeout(() => projSendConfirm(r.project || pj, lid), 900);   // sans compte : il confirme avec son lien
    });
  });
  f.querySelector("button[type=submit]").textContent = "J'ai payé";
  PAY.bind(f, toast); invBind(f);
}
// Personne payée sans compte : on lui envoie un lien pour confirmer elle-même la réception
async function projSendConfirm(pj, lid) {
  const l = (pj.lines || {})[lid]; if (!l) return;
  try {
    const r = await socApi("/projects/" + pj.id, { method: "POST", body: JSON.stringify({ action: "link", lid }) });
    const url = appBase() + "g.html#j=" + r.link;
    shareText(`Bonjour ${l.name}, je t'ai payé ${pjMoney(l.amount, pj.cur)} pour « ${pj.title} »${l.what ? ` (${l.what})` : ""}. Quand tu l'as reçu, confirme-le ici (pas besoin d'appli) :`, url);
  } catch (e) { toast(e.message); }
}
// Ajouter / modifier une ligne
function editLine(pj, lid) {
  const l = lid ? pj.lines[lid] : null; let who = null;
  const f = openForm(`<div class="f2"><h3>${l ? "Modifier · " + esc(l.name) : "Ajouter une personne"}</h3>
    ${l ? "" : `<label class="lbl" for="plFind">Personne</label><input class="field" id="plFind" placeholder="@tag, contact, ou un nom (ex. Marc, carreleur)" autocapitalize="off" autocomplete="off"><div id="plRes"></div><div id="plWho" class="hint" style="margin-top:4px"></div>`}
    ${fld("plWhat", "Pour quoi (facultatif)", `maxlength="60" placeholder="ex. Plomberie, peinture, carrelage" value="${esc(l ? l.what || "" : "")}"`)}
    <div class="two"><div>${fld("plAmt", `Ce que je lui dois (${esc(pj.cur)})`, `inputmode="decimal" value="${l ? esc(String(l.amount).replace(".", ",")) : ""}"`)}</div><div>${fld("plDue", "Date convenue", `type="date" value="${esc(l ? l.due || "" : "")}"`)}</div></div></div>`, () => {
    const amount = parseAmount(val("plAmt")); if (!(amount > 0)) { toast("Indique le montant"); return false; }
    if (l) { projAct(pj.id, { action: "edit", lid, amount, due: val("plDue"), what: val("plWhat") }, "Modifié"); return; }
    const raw = val("plFind").trim(), line = who ? { to: who.tag, name: who.name } : { name: raw.replace(/^@/, "") };
    if (!who && !raw) { toast("Indique la personne"); return false; }
    projAct(pj.id, { action: "add", line: { ...line, what: val("plWhat"), amount, due: val("plDue") } }, "Personne ajoutée");
  });
  if (!l) {
    const showWho = () => { document.getElementById("plWho").textContent = who ? `✓ @${who.tag} recevra ce que tu lui dois dans son app` : "Sans compte Bourselle : tu suivras la ligne toi-même"; };
    tagPicker(document.getElementById("plFind"), document.getElementById("plRes"), (tag, nm) => { who = { tag, name: (nm || "@" + tag).slice(0, 40) }; document.getElementById("plFind").value = who.name; showWho(); });
    document.getElementById("plFind").addEventListener("input", () => { who = null; showWho(); });
    showWho();
  }
}
// Créer un paiement à gérer
function editProject() {
  if (typeof socOn !== "function" || !socOn()) { toast("Connecte-toi avec Google ou Microsoft pour payer plusieurs personnes"); return; }
  const lines = []; let who = null;
  const f = openForm(`<div class="f2"><h3>Payer</h3>
    <p class="hint" style="margin:0 0 8px">Des travaux, un événement… Ajoute chaque personne à payer, combien tu lui dois et quand. Chacune le voit dans son app et confirme quand elle a reçu l'argent.</p>
    ${fld("pjTitle", "Nom", `maxlength="60" placeholder="ex. Travaux de la cuisine"`)}
    <span class="lbl">Personnes à payer</span><div id="pjLines" class="pj-draft"></div>
    <div class="pj-new"><input class="field" id="pjFind" placeholder="@tag, contact, ou un nom" autocapitalize="off" autocomplete="off"><div id="pjRes"></div>
      <div class="two"><div><input class="field" id="pjWhat" placeholder="Pour quoi (ex. Plomberie)" maxlength="60"></div><div><input class="field num" id="pjAmt" inputmode="decimal" placeholder="Montant (${esc(curSym())})"></div></div>
      <label class="lbl" for="pjDue">Date convenue (facultatif)</label><input class="field" id="pjDue" type="date">
      <button type="button" class="btn" id="pjPlus" style="width:100%;margin-top:8px">+ Ajouter cette personne</button></div>
    <p class="hint" id="pjTot" style="margin:8px 0 0"></p></div>`, () => {
    const title = val("pjTitle").trim(); if (!title) { toast("Donne un nom au paiement"); return false; }
    if (val("pjFind").trim() && parseAmount(val("pjAmt")) > 0) addLine();
    if (!lines.length) { toast("Ajoute au moins une personne"); return false; }
    const u = store && store.user ? store.user() : {};
    (async () => {
      try {
        const r = await socApi("/projects", { method: "POST", body: JSON.stringify({ title, cur: baseCurrency(), ownerName: String(u.name || "").trim().split(/[\s@]/)[0], lines }) });
        projPut(r.project); showProject(r.project.id); toast("Paiement créé : chaque personne est prévenue");
      } catch (e) { toast(e.message); }
    })();
  });
  const draw = () => {
    document.getElementById("pjLines").innerHTML = lines.length ? lines.map((l, i) => `<div class="pj-line due"><div class="pj-l"><b>${esc(l.name)}</b>${l.to ? ` <small>@${esc(l.to)}</small>` : ` <small>(sans compte)</small>`}<small>${esc(l.what || "")}${l.due ? ` · prévu le ${esc(frDate(l.due))}` : ""}</small></div><div class="pj-r"><b class="num">${esc(eur(l.amount))}</b><button type="button" class="linkbtn danger" data-x="${i}">Retirer</button></div></div>`).join("") : `<p class="hint" style="margin:0">Personne pour l'instant.</p>`;
    document.querySelectorAll("#pjLines [data-x]").forEach(b => b.onclick = () => { lines.splice(Number(b.dataset.x), 1); draw(); });
    const tot = lines.reduce((a, l) => a + l.amount, 0); document.getElementById("pjTot").textContent = lines.length ? `Total : ${eur(tot)} pour ${lines.length} personne${lines.length > 1 ? "s" : ""}` : "";
  };
  const addLine = () => {
    const raw = val("pjFind").trim(), amount = parseAmount(val("pjAmt"));
    if (!raw && !who) { toast("Indique la personne"); return; }
    if (!(amount > 0)) { toast("Indique le montant"); return; }
    if (who && who.tag === SOC.tag) { toast("Tu ne peux pas te payer toi-même"); return; }
    lines.push({ ...(who ? { to: who.tag, name: who.name } : { name: raw.replace(/^@/, "") }), what: val("pjWhat").trim(), amount, due: val("pjDue") });
    who = null; ["pjFind", "pjWhat", "pjAmt", "pjDue"].forEach(id => document.getElementById(id).value = ""); draw();
  };
  tagPicker(document.getElementById("pjFind"), document.getElementById("pjRes"), (tag, nm) => { who = { tag, name: (nm || "@" + tag).slice(0, 40) }; document.getElementById("pjFind").value = who.name; });
  document.getElementById("pjFind").addEventListener("input", () => { who = null; });
  document.getElementById("pjPlus").onclick = addLine;
  draw();
}
// Recherche d'un @tag ou d'un contact (formulaires)
function tagPicker(find, res, onAdd) {
  const list = items => res.innerHTML = items.length ? `<div class="soc-contacts">${items.map(u => `<div class="soc-contact"><div><b>@${esc(u.tag)}</b>${u.name ? ` <span class="hint">${esc(u.name)}</span>` : ""}</div><button type="button" class="btn" data-add="${esc(u.tag)}" data-n="${esc(u.name || "")}">Choisir</button></div>`).join("")}</div>` : "";
  const bind = () => res.querySelectorAll("[data-add]").forEach(b => b.onclick = () => { res.innerHTML = ""; onAdd(b.dataset.add, b.dataset.n); });
  const src = () => typeof prochesTagged === "function" ? prochesTagged() : (settings.contacts || []).filter(x => x && x.tag);
  const contacts = q => { const c = src().filter(x => !q || x.tag.includes(q) || (x.name || "").toLowerCase().includes(q)).slice(0, 6); list(c); bind(); return c.length; };
  let tmr = null;
  find.addEventListener("focus", () => { if (!find.value) contacts(""); });
  find.addEventListener("input", () => {
    clearTimeout(tmr); const q = find.value.trim().toLowerCase().replace(/^@/, "");
    contacts(q);
    if (q.length >= 3) tmr = setTimeout(async () => {
      try {
        const j = await socApi("/search?q=" + encodeURIComponent(q)), have = new Set(src().filter(x => x.tag.includes(q) || (x.name || "").toLowerCase().includes(q)).map(x => x.tag));
        if (find.value.trim().toLowerCase().replace(/^@/, "") === q) { list(src().filter(x => have.has(x.tag)).concat((j.users || []).filter(u => !have.has(u.tag))).slice(0, 8)); bind(); }
      } catch (e) {}
    }, 450);
  });
}
// Dans « Dettes » : le récap de « Payer » (ce que je dois payer, ce qu'on doit me payer)
function projDebtTotals() {
  let owe = 0, owed = 0;
  for (const pj of PROJECTS) for (const l of Object.values(pj.lines || {})) {
    if (pj.role === "owner" && l.status === "due") owe += l.amount;
    if (pj.role === "payee" && l.status !== "ok") owed += l.amount;
  }
  return { owe: Math.round(owe * 100) / 100, owed: Math.round(owed * 100) / 100 };
}
function projDebtsHTML() {
  const rows = PROJECTS.flatMap(pj => Object.entries(pj.lines || {}).filter(([, l]) => pj.role === "owner" ? l.status !== "ok" : l.status !== "ok").map(([lid, l]) => ({ pj, lid, l })));
  if (!rows.length) return "";
  const t = projDebtTotals(), today = todayISO();
  const line = ({ pj, l }) => {
    const mine = pj.role === "owner", late = mine && l.status === "due" && l.due && l.due < today;
    const who = mine ? l.name : pj.ownerName || "@" + pj.owner;
    const st = mine ? (l.status === "sent" ? "Envoyé, à confirmer" : late ? "En retard" : "À payer") : (l.status === "sent" ? "Envoyé, à confirmer" : "En attente");
    return `<button type="button" class="pj-dline ${late ? "late" : l.status}" data-pjopen="${esc(pj.id)}"><span class="pj-dl"><b>${esc(who)}</b><small>${esc(pj.title)}${l.due ? ` · ${mine ? "prévu le" : "prévu le"} ${esc(frDate(l.due))}` : ""}</small></span>
      <span class="pj-dr"><b class="num">${esc(pjMoney(l.amount, pj.cur))}</b><span class="pj-st ${late ? "late" : l.status}">${esc(st)}</span></span></button>`;
  };
  const mine = rows.filter(r => r.pj.role === "owner"), owed = rows.filter(r => r.pj.role !== "owner");
  return `<div class="card pj-debts"><h2>Payer · récap<small>${rows.length}</small></h2>
    ${mine.length ? `<div class="pj-dh"><span>Je dois payer</span><b class="num">${esc(eur(t.owe))}</b></div>${mine.map(line).join("")}` : ""}
    ${owed.length ? `<div class="pj-dh"><span>On doit me payer</span><b class="num good">${esc(eur(t.owed))}</b></div>${owed.map(line).join("")}` : ""}
    <p class="hint" style="margin:8px 0 0">Les paiements suivis dans Partage › Payer. Touche une ligne pour l'ouvrir.</p></div>`;
}
