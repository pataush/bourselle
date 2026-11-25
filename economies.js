// ---------- Plan d'économies ----------
// L'utilisateur fixe combien il veut économiser par mois ; Bourselle analyse ses 3 derniers mois
// (catégories, abonnements, crédits) et propose des pistes chiffrées qu'il coche pour bâtir son plan.
// En adoptant le plan, les budgets des catégories concernées sont abaissés et un suivi apparaît.

// Part réaliste qu'on peut retirer d'une catégorie variable, et effort demandé.
const ECO_VAR = { courses: [0.10, 2], transport: [0.12, 2], loisirs: [0.25, 1], shopping: [0.30, 1], cadeaux: [0.20, 2], divers: [0.25, 1], maison: [0.15, 2], enfants: [0.05, 3] };
const ECO_SKIP = new Set(["sante", "logement", "credits", "impots"]);
const ECO_LEVEL = { 1: "Facile", 2: "Demande un effort", 3: "Plus difficile" };
const ecoRound = v => v >= 20 ? Math.round(v / 5) * 5 : Math.round(v);

function ecoState() {
  if (!settings.eco || typeof settings.eco !== "object") settings.eco = {};
  return settings.eco;
}
// Les 3 derniers mois complets qui contiennent des opérations (sinon le mois en cours).
function ecoMonths() {
  const t = new Date(todayISO() + "T12:00:00"); const out = [];
  for (let k = 1; k <= 6 && out.length < 3; k++) {
    const d = new Date(t.getFullYear(), t.getMonth() - k, 1); const y = d.getFullYear(), m = d.getMonth() + 1;
    if (itemsOf(y, m).length) out.push({ y, m });
  }
  if (!out.length && itemsOf(t.getFullYear(), t.getMonth() + 1).length) out.push({ y: t.getFullYear(), m: t.getMonth() + 1 });
  return out;
}
function goalsMonthlyNeed() {
  const today = todayISO(); let need = 0;
  for (const [id, g] of Object.entries(goals)) {
    const left = Math.max(0, (Number(g.target) || 0) - goalSaved(id));
    if (!left || !g.deadline) continue;
    const m = monthsBetween(today, g.deadline); if (m >= 1) need += left / m;
  }
  return need;
}
function ecoAnalysis() {
  const ms = ecoMonths(), n = ms.length;
  const res = { n, ms, income: 0, spend: 0, saved: 0, avg: {}, list: [] };
  if (!n) return res;
  const notes = {};
  for (const { y, m } of ms) {
    const list = itemsOf(y, m), t = totals(list);
    res.income += t.rentree / n; res.spend += t.depense / n; res.saved += (t.epargne + t.invest) / n;
    for (const [c, v] of Object.entries(t.byCat)) res.avg[c] = (res.avg[c] || 0) + v / n;
    for (const x of list) {
      if (x.type !== "depense" || x.ndf || x.fixe) continue;
      const key = (x.note || "").trim().toLowerCase(); if (!key) continue;
      const k = x.cat + "|" + key; const o = notes[k] || (notes[k] = { label: x.note.trim(), cat: x.cat, n: 0, sum: 0 });
      o.n += 1 / n; o.sum += Number(x.amount) / n;
    }
  }
  const activeSubs = Object.entries(subs).filter(([, s]) => s.status !== "resilie").map(([id, s]) => ({ ...s, id, pm: monthlyCost(s) }));
  const subsByCat = {}; for (const s of activeSubs) subsByCat[s.cat] = (subsByCat[s.cat] || 0) + s.pm;
  const L = res.list;
  // 1. Abonnements : résilier les loisirs, renégocier télécom / assurances / énergie
  const nego = (s, rate, level, title, detail) => { const save = ecoRound(s.pm * rate); if (save >= 3) L.push({ id: "sub:" + s.id, kind: "nego", level, save, title, detail }); };
  for (const s of activeSubs) {
    if (!(s.pm > 0)) continue;
    const eng = s.engEnd && daysUntil(s.engEnd) > 0 ? `Engagé jusqu'au ${frDate(s.engEnd)}` : "Sans engagement : tu peux changer quand tu veux";
    if (["loisirs", "shopping", "divers", "cadeaux"].includes(s.cat))
      L.push({ id: "sub:" + s.id, kind: "sub", sub: s.id, level: 1, save: Math.round(s.pm * 100) / 100, title: `Résilier ou mettre en pause « ${s.name} »`, detail: `${eur(s.pm)} par mois, soit ${eur(s.pm * 12, true)} par an. ${eng}.` });
    else if (s.cat === "telecom")
      nego(s, 0.3, 1, `Passer à une offre moins chère pour « ${s.name} »`, `Les offres sans engagement coûtent souvent 30 % de moins. ${eng}.`);
    else if (s.cat === "assurances")
      nego(s, 0.15, 2, `Comparer « ${s.name} »`, `Faire jouer la concurrence fait souvent gagner 15 %. ${eng}.`);
    else if (s.cat === "energie")
      nego(s, 0.1, 2, `Comparer les offres pour « ${s.name} »`, `Changer de fournisseur ou d'offre fait souvent gagner 10 %.`);
  }
  // 2. Catégories variables
  for (const c of settings.cats) {
    if (ECO_SKIP.has(c.id) || c.fixe) continue;
    const [rate, level] = ECO_VAR[c.id] || [0.15, 2];
    const base = Math.max(0, (res.avg[c.id] || 0) - (subsByCat[c.id] || 0));
    const save = ecoRound(base * rate); if (save < 5) continue;
    const top = Object.values(notes).filter(o => o.cat === c.id && o.sum >= 10).sort((a, b) => b.sum - a.sum).slice(0, 2);
    const topTxt = top.length ? ` Postes principaux : ${top.map(o => `${o.label} (${o.n >= 1.5 ? `${Math.round(o.n)} fois, ` : ""}${eur(o.sum, true)}${window.LANG === "en" ? "/mo" : "/mois"})`).join(" · ")}.` : "";
    L.push({ id: "cat:" + c.id, kind: "cat", cat: c.id, level, save, from: Math.round(res.avg[c.id] || 0), title: `Réduire « ${c.name} » de ${Math.round(rate * 100)} %`, detail: `Tu y dépenses ≈ ${eur(res.avg[c.id] || 0, true)} par mois : vise ${eur((res.avg[c.id] || 0) - save, true)}.${topTxt}` });
  }
  // 3. Charges fixes sans abonnement suivi : énergie, assurances, télécom
  for (const [cid, rate, lab] of [["energie", 0.08, "Comparer les fournisseurs d'énergie et ajuster ton contrat"], ["assurances", 0.12, "Faire jouer la concurrence sur tes assurances"], ["telecom", 0.2, "Revoir tes forfaits mobile et internet"]]) {
    if (subsByCat[cid]) continue;
    const save = ecoRound((res.avg[cid] || 0) * rate); if (save < 5) continue;
    L.push({ id: "fix:" + cid, kind: "fix", level: 2, save, title: lab, detail: `${catById(cid).name} : ≈ ${eur(res.avg[cid], true)} par mois en moyenne.` });
  }
  // 4. Crédits chers
  for (const [id, d] of Object.entries(debts)) {
    if (d.kind !== "credit" || !(Number(d.rate) >= 4) || !(Number(d.monthly) > 0)) continue;
    const k = debtCalc(d); if (k.done || k.remaining < 3000) continue;
    const save = ecoRound(Number(d.monthly) * 0.06); if (save < 5) continue;
    L.push({ id: "debt:" + id, kind: "debt", level: 3, save, title: `Renégocier ou faire racheter « ${d.name} »`, detail: `Taux de ${window.LANG === "en" ? String(d.rate) : String(d.rate).replace(".", ",")} % sur ${eur(k.remaining, true)} restants : un meilleur taux allège la mensualité.` });
  }
  L.sort((a, b) => a.level - b.level || b.save - a.save);
  return res;
}
// Sélection : celle de l'utilisateur, sinon les pistes les plus faciles jusqu'à atteindre l'objectif.
function ecoPicked(an, st) {
  if (st.picks) return new Set(an.list.filter(s => st.picks[s.id]).map(s => s.id));
  const out = new Set(); let sum = 0; const target = Number(st.target) || 0;
  for (const s of an.list) { if (target && sum >= target) break; out.add(s.id); sum += s.save; }
  return out;
}
function renderEconomies() {
  const st = ecoState(), an = ecoAnalysis(), target = Number(st.target) || 0;
  const picked = ecoPicked(an, st), found = an.list.filter(s => picked.has(s.id)).reduce((a, s) => a + s.save, 0);
  document.getElementById("periodLabel").textContent = "Économies";
  document.getElementById("resCap").textContent = target ? "Ton objectif d'économies par mois" : "Combien veux-tu économiser ?";
  const big = document.getElementById("resBig"); big.textContent = target ? eur(target) : "—"; big.className = "big num";
  document.getElementById("resPill").innerHTML = target ? `<span class="pill ${found >= target ? "good" : ""}">${found >= target ? "Plan complet" : `${esc(eur(found, true))} trouvés`}</span>` : "";
  let html = banner;
  if (st.adopted) html += ecoFollowHTML(st);
  if (!an.n) {
    html += `<div class="card"><div class="empty">Ajoute tes dépenses pendant quelques semaines : Bourselle pourra ensuite te proposer où économiser, chiffres à l'appui.</div></div>`;
    document.getElementById("view").innerHTML = html; ecoBind(st, an); return;
  }
  const need = goalsMonthlyNeed();
  const reste = an.income - an.spend - an.saved;
  html += `<div class="card"><h2>Combien veux-tu économiser ?<small>par mois</small></h2>
    <div class="eco-in"><input id="ecoTarget" inputmode="decimal" aria-label="Montant à économiser par mois" placeholder="ex. 150" value="${target ? esc(String(target).replace(".", ",")) : ""}"><span>${esc(curSym())} / mois</span></div>
    <div class="chips" style="margin-top:10px">${[50, 100, 200, 300].map(v => `<button type="button" class="chip" data-eco-t="${v}" aria-pressed="${target === v}">${esc(eur(v, true))}</button>`).join("")}
    ${need >= 1 ? `<button type="button" class="chip" data-eco-t="${Math.ceil(need)}">Pour mes objectifs : ${esc(eur(Math.ceil(need), true))}</button>` : ""}</div>
    <p class="hint" style="margin:12px 0 0">Sur ${an.n === 1 ? "ton dernier mois" : `tes ${an.n} derniers mois`}, en moyenne : rentrées <b>${esc(eur(an.income, true))}</b>, dépenses <b>${esc(eur(an.spend, true))}</b>, épargne <b>${esc(eur(an.saved, true))}</b>, il te reste <b>${esc(eur(reste, true))}</b>.</p></div>`;
  if (!an.list.length) html += `<div class="card"><div class="empty">Tes dépenses sont déjà très serrées : aucune piste chiffrée pour l'instant. Continue à tout noter, Bourselle réessaiera le mois prochain.</div></div>`;
  else {
    const pct = target ? Math.min(100, found / target * 100) : 0;
    html += `<div class="card"><h2>Ton plan<small>${picked.size} piste${picked.size > 1 ? "s" : ""} choisie${picked.size > 1 ? "s" : ""}</small></h2>
      ${target ? `<div class="eco-sum"><span class="num"><b>${esc(eur(found, true))}</b> / ${esc(eur(target, true))} par mois</span><span class="${found >= target ? "good" : "hint"}">${found >= target ? "Objectif atteint" : `Il manque ${esc(eur(target - found, true))}`}</span></div>
      <div class="bar" style="margin:8px 0 4px"><i style="width:${pct}%;background:${found >= target ? "var(--good)" : "var(--accent)"}"></i></div>` : `<p class="hint">Choisis un montant ci-dessus : Bourselle cochera les pistes les plus faciles pour l'atteindre.</p>`}
      <p class="hint" style="margin:6px 0 12px">Soit <b>${esc(eur(found * 12, true))}</b> par an. Coche ou décoche les pistes selon ce qui te convient.</p>
      <div class="eco-list">${an.list.map(s => `<label class="eco-item${picked.has(s.id) ? " on" : ""}">
        <input type="checkbox" data-eco-p="${esc(s.id)}" ${picked.has(s.id) ? "checked" : ""}>
        <span class="eco-body"><span class="eco-top"><b>${esc(s.title)}</b><span class="eco-save num">+${esc(eur(s.save, true))}/mois</span></span>
        <span class="eco-det">${esc(s.detail)}</span><span class="eco-lvl l${s.level}">${ECO_LEVEL[s.level]}</span></span></label>`).join("")}</div>
      <div class="acts" style="margin-top:14px"><button type="button" class="btn primary" id="ecoAdopt" ${picked.size ? "" : "disabled"}>${st.adopted ? "Mettre à jour mon plan" : "Adopter ce plan"}</button>${st.picks ? `<button type="button" class="btn" id="ecoAuto">Sélection automatique</button>` : ""}</div>
      <p class="hint" style="margin:10px 0 0">En adoptant le plan, les budgets des catégories concernées sont abaissés et Bourselle suit tes progrès chaque mois. Les montants sont des estimations.</p></div>`;
  }
  document.getElementById("view").innerHTML = html;
  ecoBind(st, an);
}
function ecoFollowHTML(st) {
  const t = new Date(todayISO() + "T12:00:00"), y = t.getFullYear(), m = t.getMonth() + 1;
  const tot = totals(itemsOf(y, m)), ap = st.applied || {};
  const rows = Object.entries(ap).map(([cid, a]) => {
    const c = catById(cid), sp = tot.byCat[cid] || 0, b = Number(a.to) || 0, pct = b ? Math.min(100, sp / b * 100) : 100, over = sp > b;
    return `<div class="row ${over ? "over" : ""}"><div class="t"><span>${esc(c.name)}</span><span class="num">${esc(eur(sp, true))} / ${esc(eur(b, true))}</span></div><div class="bar"><i style="width:${pct}%;background:${over ? "var(--bad)" : c.color}"></i></div></div>`;
  }).join("");
  const todo = (st.subsTodo || []).filter(id => subs[id] && subs[id].status !== "resilie");
  const done = (st.subsTodo || []).filter(id => subs[id] && subs[id].status === "resilie");
  return `<div class="card eco-follow"><h2>Suivi de ton plan<small>depuis le ${esc(frDate(st.adopted))}</small></h2>
    ${rows ? `<p class="hint" style="margin:0 0 8px">Ce mois-ci, dans les catégories de ton plan (dépensé / nouveau budget) :</p><div class="bud">${rows}</div>` : ""}
    ${todo.length ? `<p class="hint" style="margin:12px 0 6px">À faire :</p>${todo.map(id => `<div class="eco-todo"><span>Résilier « ${esc(subs[id].name)} » <span class="hint num">(${esc(eur(monthlyCost(subs[id]), true))}/mois)</span></span><button type="button" class="btn" data-eco-done="${esc(id)}">C'est fait</button></div>`).join("")}` : ""}
    ${done.length ? `<p class="hint" style="margin:10px 0 0">Déjà résiliés : ${done.map(id => esc(subs[id].name)).join(", ")} (soit ${esc(eur(done.reduce((a, id) => a + monthlyCost(subs[id]), 0), true))} par mois).</p>` : ""}
    <div class="acts" style="margin-top:12px"><button type="button" class="btn" id="ecoStop">Abandonner le plan</button></div></div>`;
}
function ecoBind(st, an) {
  const view = document.getElementById("view");
  const setT = v => { st.target = v > 0 ? Math.round(v * 100) / 100 : 0; delete st.picks; saveSettings(); render(); };
  const inp = document.getElementById("ecoTarget");
  if (inp) inp.onchange = () => { const v = parseAmount(inp.value); setT(isFinite(v) ? v : 0); };
  view.querySelectorAll("[data-eco-t]").forEach(b => b.onclick = () => setT(Number(b.dataset.ecoT)));
  view.querySelectorAll("[data-eco-p]").forEach(cb => cb.onchange = () => {
    const cur = ecoPicked(an, st); st.picks = {}; cur.forEach(id => st.picks[id] = true);
    if (cb.checked) st.picks[cb.dataset.ecoP] = true; else delete st.picks[cb.dataset.ecoP];
    saveSettings(); render();
  });
  const auto = document.getElementById("ecoAuto"); if (auto) auto.onclick = () => { delete st.picks; saveSettings(); render(); };
  const ad = document.getElementById("ecoAdopt");
  if (ad) ad.onclick = () => {
    const picked = ecoPicked(an, st), prev = st.applied || {};
    // remet d'abord les budgets d'un plan précédent, puis applique le nouveau
    for (const [cid, a] of Object.entries(prev)) { const c = settings.cats.find(x => x.id === cid); if (c) c.budget = a.from; }
    const applied = {};
    for (const s of an.list) {
      if (!picked.has(s.id) || s.kind !== "cat") continue;
      const c = settings.cats.find(x => x.id === s.cat); if (!c) continue;
      const aim = Math.max(0, Math.round((an.avg[s.cat] || 0) - s.save));
      applied[s.cat] = { from: c.budget || 0, to: c.budget > 0 ? Math.min(c.budget, aim) : aim };   // on n'augmente jamais un budget
      c.budget = applied[s.cat].to;
    }
    st.applied = applied; st.adopted = st.adopted || todayISO();
    st.subsTodo = an.list.filter(s => picked.has(s.id) && s.kind === "sub").map(s => s.sub);
    st.picks = {}; picked.forEach(id => st.picks[id] = true);
    saveSettings(); render(); window.scrollTo(0, 0); toast("Plan adopté : tes budgets sont mis à jour");
  };
  view.querySelectorAll("[data-eco-done]").forEach(b => b.onclick = () => {
    const s = subs[b.dataset.ecoDone]; if (!s) return;
    s.status = "resilie"; s.endedOn = todayISO(); saveSubs(); render(); toast("Abonnement marqué résilié");
  });
  const stop = document.getElementById("ecoStop");
  if (stop) stop.onclick = () => {
    if (stop.dataset.c !== "1") { stop.dataset.c = "1"; stop.textContent = "Confirmer ?"; toast("Tes budgets d'avant le plan seront rétablis."); setTimeout(() => { if (stop.isConnected) { stop.dataset.c = ""; stop.textContent = "Abandonner le plan"; } }, 4000); return; }
    for (const [cid, a] of Object.entries(st.applied || {})) { const c = settings.cats.find(x => x.id === cid); if (c) c.budget = a.from; }
    delete st.applied; delete st.adopted; delete st.subsTodo; saveSettings(); render(); toast("Plan abandonné : budgets rétablis");
  };
}
