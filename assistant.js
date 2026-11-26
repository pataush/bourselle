/* Bourselle — l'assistant intégré.
 * Répond aux questions d'argent les plus courantes en calculant tout sur l'appareil, à partir de tes propres données :
 * aucune IA, rien n'est envoyé. Les réponses s'appuient sur les mêmes calculs que la prévision du mois. */
const EN = () => window.LANG === "en";
const L = (fr, en) => EN() ? en : fr;
const ASK_SUGG_FR = ["Combien me reste-t-il après mes factures ?", "Puis-je dépenser 200 € ce mois-ci ?", "Où part mon argent ?", "Quelles sont mes prochaines factures ?", "Qui me doit de l'argent ?", "Combien j'ai épargné ce mois-ci ?"];
const ASK_SUGG_EN = ["How much will I have left after my bills?", "Can I spend 200 this month?", "Where does my money go?", "What are my next bills?", "Who owes me money?", "How much have I saved this month?"];
const askSugg = () => EN() ? ASK_SUGG_EN : ASK_SUGG_FR;
const askNorm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// Les calculs portent sur le mois en cours, quel que soit le mois affiché
function askWithNow(fn) { const keep = { ...cur }; cur.y = now.getFullYear(); cur.m = now.getMonth() + 1; try { return fn(); } finally { cur.y = keep.y; cur.m = keep.m; } }
function askMonth() {
  return askWithNow(() => {
    const t = totals(itemsOf(cur.y, cur.m)), up = upcomingThisMonth();
    const sum = ty => up.filter(u => u.type === ty).reduce((a, u) => a + u.amount, 0);
    const billsLeft = sum("depense"), incomeLeft = sum("rentree"), savingsLeft = sum("epargne") + sum("invest");
    const reste = t.reste + incomeLeft - billsLeft - savingsLeft;
    const day = now.getDate(), dim = new Date(cur.y, cur.m, 0).getDate();
    const hist = prevMonths(cur.y, cur.m, 3).map(q => totals(itemsOf(q.y, q.m))).filter(x => x.depense > 0);
    const avgVar = hist.length ? hist.reduce((a, x) => a + x.variable, 0) / hist.length : 0;
    const rythme = avgVar > 0 ? Math.max(0, avgVar - t.variable) : day >= 10 && t.variable > 0 ? t.variable / day * (dim - day) : 0;
    const ex = forecastExtras();
    const bal = typeof accHasBalance === "function" && accHasBalance() ? accTotalAt(todayISO()) : null;
    return { t, up, billsLeft, incomeLeft, savingsLeft, reste, rythme, goalsNeed: ex.goalsNeed || 0, ex, bal, dim, day, hist, avgVar };
  });
}
const askB = v => `<b class="num">${esc(eur(v))}</b>`;
const askList = items => `<ul class="ask-ul">${items.map(x => `<li>${x}</li>`).join("")}</ul>`;
// ---------- Réponses ----------
const ASK = {
  reste() {
    const M = askMonth(), lines = [];
    const nb = M.up.filter(u => u.type === "depense").length, left = M.bal != null ? M.bal + M.incomeLeft - M.billsLeft - M.savingsLeft : M.reste;
    let h = M.bal != null
      ? L(`Sur tes comptes, tu as ${askB(M.bal)} aujourd'hui. Après ce qui doit encore passer d'ici la fin du mois, il te restera environ ${askB(left)}.`, `You have ${askB(M.bal)} in your accounts today. After everything still due by the end of the month, you'll have about ${askB(left)} left.`)
      : L(`D'ici la fin du mois, il te restera environ ${askB(M.reste)} une fois tes factures passées.`, `By the end of the month, you'll have about ${askB(M.reste)} left once your bills are paid.`);
    lines.push(L(`Déjà ce mois-ci : rentrées ${askB(M.t.rentree)}, dépenses ${askB(M.t.depense)}`, `So far this month: income ${askB(M.t.rentree)}, spending ${askB(M.t.depense)}`) + (M.t.epargne + M.t.invest ? L(`, épargne ${askB(M.t.epargne + M.t.invest)}`, `, savings ${askB(M.t.epargne + M.t.invest)}`) : ""));
    if (M.billsLeft) lines.push(L(`Encore à payer : ${askB(M.billsLeft)} (${nb} prélèvement${nb > 1 ? "s" : ""}, mensualités ou paiements)`, `Still to pay: ${askB(M.billsLeft)} (${nb} direct debit${nb > 1 ? "s" : ""}, instalments or payments)`));
    if (M.incomeLeft) lines.push(L(`Rentrées encore attendues : ${askB(M.incomeLeft)}`, `Income still expected: ${askB(M.incomeLeft)}`));
    if (M.savingsLeft) lines.push(L(`Épargne programmée : ${askB(M.savingsLeft)}`, `Scheduled savings: ${askB(M.savingsLeft)}`));
    h += askList(lines);
    if (M.rythme > 1) h += `<p>${L(`Si tes dépenses courantes (courses, sorties…) suivent ${M.avgVar > 0 ? "ta moyenne" : "le rythme actuel"}, compte encore ≈ ${askB(M.rythme)} : il resterait alors ${askB(left - M.rythme)}.`, `If your everyday spending (groceries, going out…) follows ${M.avgVar > 0 ? "your average" : "the current pace"}, expect about ${askB(M.rythme)} more: you'd then have ${askB(left - M.rythme)} left.`)}</p>`;
    if (!M.up.length && !Object.keys(recs).length) h += `<p class="hint">${L("Astuce : ajoute ton loyer, ton salaire et tes abonnements en opérations automatiques pour une réponse plus juste.", "Tip: add your rent, salary and subscriptions as recurring transactions for a more accurate answer.")}</p>`;
    return h;
  },
  depenser(q) {
    const m = /(\d[\d\s.,]*)/.exec(q), amount = m ? parseAmount(m[1].replace(/\s/g, "")) : 0;
    if (!(amount > 0)) return L(`Dis-moi le montant, par exemple : « Puis-je dépenser 200 € ce mois-ci ? »`, `Tell me the amount, for example: “Can I spend 200 this month?”`);
    const M = askMonth(), base = M.bal != null ? M.bal + M.incomeLeft - M.billsLeft - M.savingsLeft : M.reste;
    const after = base - amount, afterAll = after - M.rythme - M.goalsNeed;
    let h;
    const due = M.ex.owed + M.ex.grp + M.ex.ndf;
    if (afterAll >= 0) h = `<p class="ask-yes">${L("Oui", "Yes")} 👍</p><p>${L(`Après tes factures, il te reste ≈ ${askB(base)}. En dépensant ${askB(amount)}, il resterait ${askB(after)}`, `After your bills you have about ${askB(base)}. Spending ${askB(amount)} leaves ${askB(after)}`)}${M.rythme > 1 || M.goalsNeed > 1 ? L(`, et encore ${askB(afterAll)} une fois tes dépenses courantes${M.goalsNeed > 1 ? " et tes objectifs" : ""} prévues`, `, and still ${askB(afterAll)} after your usual spending${M.goalsNeed > 1 ? " and goals" : ""}`) : ""}.</p>`;
    else if (after >= 0) h = `<p class="ask-mid">${L("Oui, mais c'est juste", "Yes, but it's tight")} ⚠️</p><p>${L(`Il te reste ≈ ${askB(base)} après tes factures : ${askB(amount)} passent, mais il ne resterait que ${askB(after)} pour tes dépenses courantes (≈ ${askB(M.rythme)} d'habitude)`, `You have about ${askB(base)} after your bills: ${askB(amount)} fits, but only ${askB(after)} would be left for everyday spending (about ${askB(M.rythme)} usually)`)}${M.goalsNeed > 1 ? L(` et tes objectifs (${askB(M.goalsNeed)})`, ` and your goals (${askB(M.goalsNeed)})`) : ""}.</p>`;
    else h = `<p class="ask-no">${L("Plutôt non", "Better not")} ✋</p><p>${L(`Après tes factures, il te reste ≈ ${askB(base)} : il manquerait ${askB(-after)}.`, `After your bills you have about ${askB(base)}: you'd be short by ${askB(-after)}.`)} ${due > 1 ? L(`On te doit ${askB(due)} : une fois remboursé, ça pourrait passer.`, `You're owed ${askB(due)}: once that's paid back, it could work.`) : L("Tu pourrais attendre le mois prochain ou étaler l'achat.", "You could wait until next month or spread the purchase.")}</p>`;
    return h;
  },
  ou() {
    return askWithNow(() => {
      const t = totals(itemsOf(cur.y, cur.m)), hist = prevMonths(cur.y, cur.m, 3).map(q => totals(itemsOf(q.y, q.m))).filter(x => x.depense > 0);
      const cats = Object.entries(t.byCat).sort((a, c) => c[1] - a[1]);
      if (!cats.length) return L(`Pas encore de dépense ce mois-ci. Ajoute tes achats (bouton +) et je te dirai où part ton argent.`, `No spending yet this month. Add your purchases (+ button) and I'll tell you where your money goes.`);
      const tot = t.depense || 1, avg = id => hist.length ? hist.reduce((a, x) => a + (x.byCat[id] || 0), 0) / hist.length : 0;
      let h = `<p>${L(`Ce mois-ci, tu as dépensé ${askB(t.depense)}. Les postes les plus lourds :`, `This month you've spent ${askB(t.depense)}. The biggest items:`)}</p>` + askList(cats.slice(0, 5).map(([id, v]) => {
        const a = avg(id), c = catById(id), diff = a > 0 ? (v - a) / a : 0;
        return `<span class="ask-dot" style="background:${esc(c.color)}"></span>${esc(c.name)} : ${askB(v)} <small>(${Math.round(v / tot * 100)} %)${a > 0 && Math.abs(diff) >= .15 ? ` · ${diff > 0 ? "+" : "−"}${Math.round(Math.abs(diff) * 100)} % ${L("par rapport à d'habitude", "vs usual")}` : ""}</small>`;
      }));
      const big = itemsOf(cur.y, cur.m).filter(x => x.type === "depense" && !x.ndf).sort((a, c) => c.amount - a.amount).slice(0, 3);
      if (big.length) h += `<p>${L("Plus grosses dépenses :", "Biggest expenses:")} ${big.map(x => `${esc(x.note || catById(x.cat).name)} (${askB(x.amount)})`).join(", ")}.</p>`;
      const over = settings.cats.filter(c => c.budget && (t.byCat[c.id] || 0) > c.budget);
      if (over.length) h += `<p>${L("Budget dépassé :", "Over budget:")} ${over.map(c => `${esc(c.name)} (${askB(t.byCat[c.id])} ${L("sur", "of")} ${askB(c.budget)})`).join(", ")}.</p>`;
      return h;
    });
  },
  factures() {
    const today = todayISO(), lim = addDays(today, 31), out = [];
    for (const r of Object.values(recs)) { if (r.active === false || r.type !== "depense") continue; let d = r.next; for (let g = 0; g < 40 && d && d <= lim; g++) { if (d >= today && (!r.until || d <= r.until)) out.push({ d, n: recName(r), a: Number(r.amount) }); d = advance(d, r.freq); } }
    for (const x of Object.values(subs)) { if (x.status === "resilie") continue; let d = nextOcc(x); for (let g = 0; g < 40 && d && d <= lim; g++) { if (d >= today) out.push({ d, n: x.name, a: Number(x.amount) }); d = advance(d, x.freq); } }
    if (typeof PROJECTS !== "undefined") for (const pj of PROJECTS) if (pj.role === "owner") for (const l of Object.values(pj.lines || {})) if (l.status === "due" && l.due && l.due <= lim) out.push({ d: l.due, n: `${l.name} · ${pj.title}`, a: l.amount, late: l.due < today });
    for (const x of Object.values(debts)) if (x.kind === "dois" && !x.closed && x.due && x.due <= lim && !debtCalc(x).done) out.push({ d: x.due, n: x.name + (x.who ? " (" + x.who + ")" : ""), a: debtCalc(x).remaining, late: x.due < today });
    out.sort((a, c) => a.d.localeCompare(c.d));
    if (!out.length) return L(`Rien de prévu dans les 30 prochains jours. Ajoute tes abonnements et prélèvements (Suivis › Abonnements, ou « Répéter » quand tu ajoutes une opération) pour les voir ici.`, `Nothing due in the next 30 days. Add your subscriptions and direct debits (Tracking › Subscriptions, or “Repeat” when adding a transaction) to see them here.`);
    return `<p>${L(`Dans les 30 prochains jours : ${askB(out.reduce((a, x) => a + x.a, 0))} à payer.`, `In the next 30 days: ${askB(out.reduce((a, x) => a + x.a, 0))} to pay.`)}</p>` + askList(out.slice(0, 12).map(x => `<b class="num">${esc(frDate(x.d).slice(0, 5))}</b> ${esc(x.n)} · ${askB(x.a)}${x.late ? ` <small class="ask-late">${L("en retard", "overdue")}</small>` : ""}`)) + (out.length > 12 ? `<p class="hint">+ ${out.length - 12} ${L("autres", "more")}</p>` : "");
  },
  doit() {
    const owed = [], owe = [];
    const gl = n => L(`Groupe « ${esc(n)} »`, `Group “${esc(n)}”`);
    for (const g of Object.values(groups)) { const v = groupBalances(g)[g.me] || 0; if (v > 0.004) owed.push(`${gl(g.name)} : ${askB(v)}`); if (v < -0.004) owe.push(`${gl(g.name)} : ${askB(-v)}`); }
    for (const x of Object.values(debts)) { if (x.closed || x.kind === "credit") continue; const r = debtCalc(x).remaining; if (r < 0.005) continue; (x.kind === "medoit" ? owed : owe).push(`${esc(x.who || x.name)}${x.who && x.name ? ` · ${esc(x.name)}` : ""} : ${askB(r)}`); }
    if (typeof PROJECTS !== "undefined") for (const pj of PROJECTS) for (const l of Object.values(pj.lines || {})) if (l.status !== "ok") (pj.role === "payee" ? owed : owe).push(pj.role === "payee" ? `${esc(pj.ownerName || "@" + pj.owner)} · ${esc(pj.title)} : ${askB(l.amount)}${l.status === "sent" ? ` <small>(${L("envoyé, à confirmer", "sent, to confirm")})</small>` : ""}` : `${esc(l.name)} · ${esc(pj.title)} : ${askB(l.amount)}`);
    const nd = allItems().filter(x => x.type === "depense" && x.ndf && x.ndfStatus !== "rembourse").reduce((a, x) => a + Number(x.amount), 0);
    if (nd > 0.004) owed.push(`${L("Notes de frais à rembourser", "Expense claims to be reimbursed")} : ${askB(nd)}`);
    let h = owed.length ? `<p>${L("On te doit :", "You're owed:")}</p>${askList(owed)}` : `<p>${L("Personne ne te doit d'argent en ce moment.", "Nobody owes you money right now.")}</p>`;
    h += owe.length ? `<p>${L("Tu dois :", "You owe:")}</p>${askList(owe)}` : `<p>${L("Et tu ne dois rien à personne", "And you don't owe anyone anything")} 🙌</p>`;
    return h;
  },
  epargne() {
    return askWithNow(() => {
      const t = totals(itemsOf(cur.y, cur.m)), s = t.epargne + t.invest;
      let h = s > 0 ? `<p>${L(`Ce mois-ci, tu as mis de côté ${askB(s)}`, `This month you've put aside ${askB(s)}`)}${t.rentree ? ` (${Math.round(s / t.rentree * 100)} % ${L("de tes rentrées", "of your income")})` : ""}.</p>` : `<p>${L("Pas encore d'épargne ce mois-ci.", "No savings yet this month.")}</p>`;
      const gl = Object.entries(goals).map(([id, g]) => ({ ...g, saved: goalSaved(id) }));
      if (gl.length) h += askList(gl.map(g => `${esc(g.name)} : ${askB(g.saved)} ${L("sur", "of")} ${askB(g.target)} (${Math.min(100, Math.round(g.saved / (g.target || 1) * 100))} %)`));
      const M = askMonth(); if (M.goalsNeed > 1) h += `<p>${L(`Pour rester dans les temps sur tes objectifs, il faudrait encore verser ${askB(M.goalsNeed)} ce mois-ci.`, `To stay on track with your goals, you'd need to put in ${askB(M.goalsNeed)} more this month.`)}</p>`;
      return h;
    });
  },
  budget() {
    return askWithNow(() => {
      const t = totals(itemsOf(cur.y, cur.m)), cats = settings.cats.filter(c => c.budget);
      if (!cats.length) return L(`Tu n'as pas encore fixé de budget par catégorie (Paramètres › Budget mensuel par catégorie).`, `You haven't set category budgets yet (Settings › Monthly budget by category).`);
      const rows = cats.map(c => ({ c, v: t.byCat[c.id] || 0 })).sort((a, d) => d.v / d.c.budget - a.v / a.c.budget);
      return `<p>${L("Où en sont tes budgets ce mois-ci :", "Your budgets this month:")}</p>` + askList(rows.slice(0, 8).map(({ c, v }) => `${esc(c.name)} : ${askB(v)} ${L("sur", "of")} ${askB(c.budget)} ${v > c.budget ? `<small class="ask-late">${L("dépassé de", "over by")} ${esc(eur(v - c.budget))}</small>` : `<small>${L("reste", "left")} ${esc(eur(c.budget - v))}</small>`}`));
    });
  },
};
const ASK_RULES = [
  [/(puis[- ]?je|je peux|est[- ]ce que je peux|can i|afford|me permettre|acheter|depenser \d|spend \d)/, "depenser"],
  [/(qui me doi|me doit|on me doit|je dois|dois[- ]je|owe|rembours)/, "doit"],
  [/(prochain|a venir|prelevement|echeance|upcoming|next bill|factures a|bills due)/, "factures"],
  [/(ou part|ou va|ou passe|plus depense|categorie|where.*money|spend the most|depense le plus)/, "ou"],
  [/(epargn|econom|mis de cote|objectif|saving|saved|goal)/, "epargne"],
  [/(budget|depasse|over budget)/, "budget"],
  [/(reste|restera|apres mes factures|fin du mois|left|remain|combien j.ai|solde|after my bills|end of the month)/, "reste"],
];
function askAnswer(q) {
  const n = askNorm(q);
  for (const [re, k] of ASK_RULES) if (re.test(n)) { try { return ASK[k](n); } catch (e) { return L("Je n'ai pas pu calculer ça, désolé.", "Sorry, I couldn't work that out."); } }
  return L(`Je sais répondre à ces questions (calculées sur ton téléphone, rien n'est envoyé) :`, `I can answer these questions (worked out on your phone, nothing is sent):`) + askList(askSugg().map(s => esc(s)));
}
// ---------- Fenêtre de discussion ----------
function showAssistant(first) {
  const f = openForm(`<div class="f2 ask"><h3>💬 ${L("Demande à Bourselle", "Ask Bourselle")}</h3>
    <p class="hint" style="margin:0 0 8px">${L("Calculé sur ton téléphone avec tes propres données. Rien n'est envoyé.", "Worked out on your phone from your own data. Nothing is sent.")}</p>
    <div class="ask-log" id="askLog"></div>
    <div class="ask-chips" id="askChips">${askSugg().map(s => `<button type="button" class="chip" data-q="${esc(s)}">${esc(s)}</button>`).join("")}</div>
    <div class="ask-new"><input class="field" id="askIn" placeholder="${L("Pose ta question…", "Ask your question…")}" maxlength="200" autocomplete="off"><button type="button" class="btn primary" id="askGo">${L("Demander", "Ask")}</button></div></div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = L("Fermer", "Close");
  const log = f.querySelector("#askLog"), inp = f.querySelector("#askIn");
  const ask = q => {
    q = String(q || "").trim(); if (!q) return;
    log.insertAdjacentHTML("beforeend", `<div class="ask-q">${esc(q)}</div><div class="ask-a">${askAnswer(q)}</div>`);
    inp.value = ""; const last = log.lastElementChild; if (last) last.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  f.querySelectorAll("[data-q]").forEach(c => c.onclick = () => ask(c.dataset.q));
  f.querySelector("#askGo").onclick = () => ask(inp.value);
  inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); ask(inp.value); } };
  if (first) ask(first);
  setTimeout(() => { if (document.activeElement === inp) inp.blur(); }, 150);   // pas de clavier d'office : les questions proposées restent visibles
}
// Carte sur l'Accueil
function askCardHTML() {
  return `<div class="card ask-card"><h2>💬 ${L("Demande à Bourselle", "Ask Bourselle")}</h2><div class="ask-chips">${askSugg().slice(0, 3).map(s => `<button type="button" class="chip" data-askq="${esc(s)}">${esc(s)}</button>`).join("")}<button type="button" class="chip" data-askq="">${L("Autre question…", "Another question…")}</button></div></div>`;
}
function askBind() { document.querySelectorAll("[data-askq]").forEach(c => c.onclick = () => showAssistant(c.dataset.askq)); }
