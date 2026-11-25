/* Bourselle — paiement partagé.
 * Tu as payé quelque chose pour plusieurs personnes : tu les ajoutes (tag Bourselle), tu choisis la répartition (parts égales,
 * montants, % ou parts) et chacune reçoit seulement sa part, à accepter dans son app (avec notification). Toi, tu suis le total.
 * Gratuit. L'argent est remboursé directement de banque à banque. */
function tagPicker(find, res, onAdd) {
  const list = items => res.innerHTML = items.length ? `<div class="soc-contacts">${items.map(u => `<div class="soc-contact"><div><b>@${esc(u.tag)}</b>${u.name ? ` <span class="hint">${esc(u.name)}</span>` : ""}</div><button type="button" class="btn" data-add="${esc(u.tag)}" data-n="${esc(u.name || "")}">Ajouter</button></div>`).join("")}</div>` : "";
  const bind = () => res.querySelectorAll("[data-add]").forEach(b => b.onclick = () => { onAdd(b.dataset.add, b.dataset.n); find.value = ""; res.innerHTML = ""; });
  const contacts = q => { const c = (settings.contacts || []).filter(x => !q || x.tag.includes(q) || (x.name || "").toLowerCase().includes(q)).slice(0, 6); list(c); bind(); return c.length; };
  let tmr = null;
  find.onfocus = () => { if (!find.value) contacts(""); };
  find.oninput = () => {
    clearTimeout(tmr); const q = find.value.trim().toLowerCase().replace(/^@/, "");
    const n = contacts(q);
    if (q.length >= 3) tmr = setTimeout(async () => {
      try {
        const j = await socApi("/search?q=" + encodeURIComponent(q)), have = new Set((settings.contacts || []).filter(x => x.tag.includes(q) || (x.name || "").toLowerCase().includes(q)).map(x => x.tag));
        if (find.value.trim().toLowerCase().replace(/^@/, "") === q) { list((settings.contacts || []).filter(x => have.has(x.tag)).concat((j.users || []).filter(u => !have.has(u.tag))).slice(0, 8)); bind(); }
      } catch (e) {}
    }, 450);
    else if (!n && q) res.innerHTML = `<p class="hint">Tape au moins 3 caractères pour chercher un tag.</p>`;
  };
}
function editBill() {
  if (typeof socOn !== "function" || !socOn()) { toast("Connecte-toi avec Google ou Microsoft pour partager un paiement"); return; }
  const people = [];   // { tag, name }
  let mode = "equal", meIn = true; const w = {};
  const f = openForm(`<div class="f2"><h3>Paiement à partager</h3>
    <p class="hint" style="margin:0 0 8px">Tu as payé pour plusieurs personnes ? Chacune reçoit seulement sa part dans son app, et toi tu suis le total.</p>
    ${fld("blTitle", "Quoi ?", `maxlength="60" placeholder="ex. Restaurant, billets de train, cadeau"`)}
    <div class="two"><div>${fld("blTotal", `Montant total (${esc(curSym())})`, `inputmode="decimal" placeholder="0,00"`)}</div><div>${fld("blDue", "À rembourser avant (facultatif)", `type="date"`)}</div></div>
    <span class="lbl">Avec qui ?</span><div class="chips" id="blPeople"></div>
    <input class="field" id="blFind" placeholder="Chercher un @tag ou un contact" autocapitalize="off" spellcheck="false" autocomplete="off" style="margin-top:6px"><div id="blRes"></div>
    <label class="toggle" for="blMe" style="margin-top:10px"><span>Je fais partie du partage (j'ai aussi ma part)</span><input type="checkbox" id="blMe" checked></label>
    <span class="lbl">Répartition</span><div class="seg2" id="blMode" style="grid-template-columns:repeat(4,1fr)">${SPLIT_MODES.map(([k, l]) => `<button type="button" data-mode="${k}">${l}</button>`).join("")}</div>
    <div id="blDetail" class="ge-detail"></div><p class="hint" id="blHint" style="margin:6px 0 0"></p>
    <label class="toggle" for="blMine" style="margin-top:10px"><span>Ajouter ma part à mes dépenses</span><input type="checkbox" id="blMine" checked></label></div>`, () => {
    const title = val("blTitle").trim(), total = parseAmount(val("blTotal"));
    if (!title) { toast("Indique ce qui a été payé"); return false; }
    if (!(total > 0)) { toast("Indique le montant total"); return false; }
    if (!people.length) { toast("Ajoute au moins une personne"); return false; }
    const ids = order(), owed = computeOwed(total, ids, mode, w), sum = ids.reduce((a, id) => a + (owed[id] || 0), 0);
    if (mode === "amounts" && Math.abs(sum - total) > 0.009) { toast(`Les montants font ${eur(sum)} au lieu de ${eur(total)}`); return false; }
    if (mode === "percent" && Math.abs(ids.reduce((a, id) => a + (Number(w[id]) || 0), 0) - 100) > 0.01) { toast("Les pourcentages doivent faire 100 %"); return false; }
    if (people.some(p => !(owed[p.tag] > 0))) { toast("Chaque personne doit avoir une part"); return false; }
    const due = val("blDue") || "", mine = document.getElementById("blMine").checked;
    (async () => {
      try {
        const r = await socApi("/bills", { method: "POST", body: JSON.stringify({ title, total, cur: baseCurrency(), due, shares: people.map(p => ({ to: p.tag, amount: owed[p.tag] })) }) });
        for (const c of r.claims) {
          const p = people.find(x => x.tag === c.to) || { name: "@" + c.to };
          debts[newId()] = { kind: "medoit", name: title, who: p.name, amount: c.amount, due, note: "", payments: [], created: Date.now(), claim: c.id, claimTo: c.to, claimStatus: c.status,
            bill: r.bill, billTitle: title, billTotal: total, billDate: todayISO(), rate: "", monthly: "", start: "", months: "" };
          SOC.out.unshift(c);
        }
        if (meIn && mine && owed.me > 0) addTx({ type: "depense", amount: owed.me, cat: defCat("loisirs"), date: todayISO(), note: `${title} (ma part)`.slice(0, 80), fixe: false });
        saveDebts(); switchTab("dettes");
        toast(people.length === 1 ? `Part envoyée à @${people[0].tag}` : `Parts envoyées à ${people.length} personnes`);
      } catch (e) { toast(e.message); }
    })();
  });
  const order = () => (meIn ? ["me"] : []).concat(people.map(p => p.tag));
  const nameOf = id => id === "me" ? "Moi" : (people.find(p => p.tag === id) || {}).name || "@" + id;
  const draw = () => {
    document.getElementById("blPeople").innerHTML = people.length ? people.map((p, i) => `<button type="button" class="chip" aria-pressed="true" data-rm="${i}">${esc(p.name)} <small>@${esc(p.tag)}</small> ✕</button>`).join("") : `<span class="hint">Personne pour l'instant.</span>`;
    document.querySelectorAll("#blPeople [data-rm]").forEach(b => b.onclick = () => { people.splice(Number(b.dataset.rm), 1); draw(); });
    document.querySelectorAll("#blMode [data-mode]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    const ids = order(), total = parseAmount(val("blTotal")) || 0, box = document.getElementById("blDetail"), hint = document.getElementById("blHint");
    if (mode === "shares") ids.forEach(id => { if (w[id] == null || w[id] === "") w[id] = 1; });
    const unit = mode === "amounts" ? curSym() : mode === "percent" ? "%" : mode === "shares" ? "part(s)" : "";
    const o = computeOwed(total, ids, mode, w);
    box.innerHTML = ids.map(id => `<label class="ge-row"><span>${esc(nameOf(id))}</span>${mode === "equal" ? "<span></span><small></small>" : `<input class="field num" inputmode="decimal" data-w="${esc(id)}" value="${w[id] == null || w[id] === "" ? "" : esc(String(w[id]).replace(".", ","))}" placeholder="0"><small>${esc(unit)}</small>`}<b class="num">${total > 0 ? esc(eur(o[id] || 0)) : ""}</b></label>`).join("");
    box.querySelectorAll("[data-w]").forEach(inp => inp.oninput = () => { w[inp.dataset.w] = parseNum(inp.value); const o2 = computeOwed(parseAmount(val("blTotal")) || 0, order(), mode, w); box.querySelectorAll(".ge-row").forEach((r, k) => { const b = r.querySelector("b"); if (b) b.textContent = total > 0 ? eur(o2[ids[k]] || 0) : ""; }); });
    const others = people.reduce((a, p) => a + (o[p.tag] || 0), 0);
    hint.textContent = total > 0 && people.length ? `Tu demanderas ${eur(others)} au total${meIn ? ` (ta part : ${eur(o.me || 0)})` : ""}.` : "";
    document.getElementById("blMine").closest("label").hidden = !meIn;
  };
  tagPicker(document.getElementById("blFind"), document.getElementById("blRes"), (tag, nm) => { if (tag !== SOC.tag && !people.some(p => p.tag === tag)) people.push({ tag, name: (nm || "@" + tag).slice(0, 40) }); draw(); });
  document.querySelectorAll("#blMode [data-mode]").forEach(b => b.onclick = () => { mode = b.dataset.mode; draw(); });
  document.getElementById("blMe").onchange = e => { meIn = e.target.checked; draw(); };
  document.getElementById("blTotal").oninput = () => draw();
  draw();
}
// Dans Dettes : une carte par paiement partagé (total, reçu, état de chaque part)
function billCardsHTML(list) {
  const by = {};
  for (const x of list) if (x.bill && x.kind === "medoit") (by[x.bill] = by[x.bill] || []).push(x);
  const ST = { pending: "En attente", accepted: "Acceptée", declined: "Refusée", settled: "Remboursée", cancelled: "Annulée" };
  return Object.values(by).sort((a, b) => (b[0].created || 0) - (a[0].created || 0)).map(xs => {
    const asked = xs.reduce((a, x) => a + Number(x.amount), 0), got = xs.reduce((a, x) => a + (x.c.done ? Number(x.amount) : Number(x.amount) - x.c.remaining), 0);
    const pct = asked ? Math.min(100, got / asked * 100) : 0, b = xs[0], done = xs.every(x => x.c.done);
    return `<div class="gar ${done ? "done" : "owed"} bill"><div class="top"><span class="n">${esc(b.billTitle || b.name)}</span><span class="st">Paiement partagé</span></div>
      <div class="top"><span class="amt num">${esc(eur(got))} reçus</span><span class="hint num">sur ${esc(eur(asked))} demandés${b.billTotal ? ` · total ${esc(eur(b.billTotal))}` : ""}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      ${xs.map(x => { const st = x.c.done ? "settled" : x.claimStatus || "pending"; return `<div class="bill-p"><span><b>${esc(x.who || "@" + x.claimTo)}</b> <small>@${esc(x.claimTo || "")}</small></span><span class="num">${esc(eur(Number(x.amount)))}</span><span class="bill-st ${st}">${esc(ST[st] || st)}</span>
        ${!x.c.done ? `<button class="linkbtn" data-a="pay" data-id="${esc(x.id)}">Reçu</button>` : ""}${st === "declined" ? `<button class="linkbtn" data-socre="${esc(x.id)}">Relancer</button>` : ""}</div>`; }).join("")}
      <div class="s">${b.billDate ? "Créé le " + esc(frDate(b.billDate)) : ""}${b.due ? ` · à rembourser avant le ${esc(frDate(b.due))}` : ""}</div></div>`;
  }).join("");
}
