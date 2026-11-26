/* Bourselle — affichage partagé (app et page publique g.html) :
 * - COMUI : commentaires avec réponses et réactions (groupes et achats groupés) ;
 * - DEALUI : un achat groupé ou une cagnotte (progression, participation, paiement de banque à banque, participants, gestion).
 * Les textes passent par ctx.t (traduction) ; l'app traduit aussi la page elle-même. */
const EMOJIS = ["👍", "❤️", "😂", "😮", "🙏", "🎉"];
const hesc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const COMUI = {
  // items : [{ id, name, text, at, re, mine }] ; reacts : { "id|qui": { e } } ; me : la clé de l'utilisateur dans reacts
  html(items, reacts, me, t, fdate, opts) {
    opts = opts || {};
    const byId = Object.fromEntries(items.map(c => [c.id, c]));
    const list = items.map(c => {
      const rs = Object.entries(reacts || {}).filter(([k, r]) => r && r.e && k.split("|")[0] === c.id);
      const counts = {}; for (const [k, r] of rs) { counts[r.e] = counts[r.e] || { n: 0, mine: false }; counts[r.e].n++; if (k.split("|")[1] === me) counts[r.e].mine = true; }
      const parent = c.re && byId[c.re];
      return `<div class="cm" data-cm="${hesc(c.id)}">
        ${parent ? `<div class="cm-re">↪ <b>${hesc(parent.name)}</b> <span>${hesc(String(parent.text).slice(0, 60))}${String(parent.text).length > 60 ? "…" : ""}</span></div>` : ""}
        <div class="cm-h"><b>${hesc(c.name)}</b> <small>${hesc(fdate(c.at))}</small></div>
        <p class="cm-t">${hesc(c.text)}</p>
        <div class="cm-a">${Object.entries(counts).map(([e, x]) => `<button type="button" class="cm-r${x.mine ? " on" : ""}" data-react="${hesc(c.id)}" data-e="${e}">${e} ${x.n}</button>`).join("")}
          ${me ? `<button type="button" class="cm-b" data-pick="${hesc(c.id)}" aria-label="${hesc(t("Réagir"))}">☺︎+</button><button type="button" class="cm-b" data-reply="${hesc(c.id)}">${hesc(t("Répondre"))}</button>` : ""}
          ${c.mine && opts.canDelete ? `<button type="button" class="cm-b" data-cdel="${hesc(c.id)}">${hesc(t("Supprimer"))}</button>` : ""}</div>
        <div class="cm-pick" hidden>${EMOJIS.map(e => `<button type="button" data-react="${hesc(c.id)}" data-e="${e}">${e}</button>`).join("")}</div></div>`;
    }).join("");
    return `<div class="cm-list">${list || `<p class="hint" style="margin:0">${hesc(t(opts.empty || "Aucun commentaire."))}</p>`}</div>
      ${me ? `<div class="cm-replying" hidden><span></span><button type="button" class="cm-b" data-noreply>✕</button></div>
      <div class="cm-new"><input type="text" class="field cm-in" maxlength="500" placeholder="${hesc(t("Écrire un commentaire…"))}"><button type="button" class="btn primary cm-send">${hesc(t("Envoyer"))}</button></div>`
      : opts.locked ? `<p class="hint" style="margin:8px 0 0">${hesc(t(opts.locked))}</p>` : ""}`;
  },
  // h : { onSend(text, re), onReact(id, e) (e vide = retirer), onDelete(id) } ; mine(id) → emoji actuel de l'utilisateur
  bind(root, items, reacts, me, h, t) {
    let re = "";
    const rep = root.querySelector(".cm-replying"), inp = root.querySelector(".cm-in"), send = root.querySelector(".cm-send");
    const cur = id => { const r = (reacts || {})[id + "|" + me]; return r && r.e || ""; };
    root.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { const p = b.closest(".cm").querySelector(".cm-pick"); p.hidden = !p.hidden; });
    root.querySelectorAll("[data-react]").forEach(b => b.onclick = () => { if (!me) return; const id = b.dataset.react, e = b.dataset.e; h.onReact(id, cur(id) === e ? "" : e); });
    root.querySelectorAll("[data-reply]").forEach(b => b.onclick = () => {
      re = b.dataset.reply; const c = items.find(x => x.id === re);
      if (rep) { rep.hidden = false; rep.querySelector("span").textContent = t("En réponse à {x}", c ? c.name : ""); }
      if (inp) inp.focus();
    });
    root.querySelectorAll("[data-noreply]").forEach(b => b.onclick = () => { re = ""; if (rep) rep.hidden = true; });
    root.querySelectorAll("[data-cdel]").forEach(b => b.onclick = () => h.onDelete && h.onDelete(b.dataset.cdel));
    const go = () => { const v = inp.value.trim(); if (!v) return; send.disabled = true; Promise.resolve(h.onSend(v, re)).finally(() => { send.disabled = false; }); };
    if (send) send.onclick = go;
    if (inp) inp.onkeydown = ev => { if (ev.key === "Enter") { ev.preventDefault(); go(); } };
  },
};

const DEALUI = {
  daysLeft(d) { if (!d) return null; const a = new Date(d + "T23:59:59"), n = Math.ceil((a - new Date()) / 86400000); return n; },
  // Petite carte (liste de l'accueil)
  card(d, ctx) {
    const t = ctx.t, m = v => ctx.money(v, d.cur), st = d.stats || {};
    const pct = d.kind === "achat" ? Math.min(100, (st.qty / (d.min || 1)) * 100) : d.target ? Math.min(100, st.sum / d.target * 100) : 0;
    const dl = DEALUI.daysLeft(d.deadline);
    const badge = d.status === "done" ? t(d.kind === "achat" ? "Achat validé" : "Cagnotte close") : d.status === "cancelled" ? t("Annulé") : st.reached ? t("Objectif atteint") : st.expired ? t("Date dépassée") : dl != null && dl >= 0 ? (dl <= 1 ? t("Dernier jour") : t("Plus que {x} jours", dl)) : t("En cours");
    return `<button type="button" class="deal-card" data-deal="${hesc(d.id)}">
      <div class="dc-top"><span class="dc-kind ${d.kind}">${hesc(t(d.kind === "achat" ? "Achat groupé" : "Cagnotte"))}</span><span class="dc-st${st.reached || d.status === "done" ? " ok" : d.status === "cancelled" ? " ko" : ""}">${hesc(badge)}</span></div>
      <b class="dc-t">${hesc(d.title)}</b>
      <div class="dc-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
      <div class="dc-s">${d.kind === "achat" ? hesc(t("{x} places réservées", st.qty) + " · " + t("minimum {x}", d.min) + " · " + m(d.price) + " " + t("la place")) : hesc(t("{x} réunis", m(st.sum)) + (d.target ? " · " + t("objectif {x}", m(d.target)) : "") + " · " + t(st.n === 1 ? "{x} participant" : "{x} participants", st.n))}</div></button>`;
  },
  render(root, S, ctx) {
    const d = S.deal, pay = S.pay, t = ctx.t, m = v => ctx.money(v, d.cur), st = d.stats || {}, you = d.you || {};
    const owner = you.role === "owner", mine = you.pid ? d.parts[you.pid] : null, open = d.status === "open" && !st.expired;
    const myAmount = mine ? (d.kind === "achat" ? mine.qty * d.price : mine.amount) : 0;
    const canPay = d.status !== "cancelled" && (d.kind === "cagnotte" || st.reached || d.status === "done");
    const dl = DEALUI.daysLeft(d.deadline);
    const pct = d.kind === "achat" ? Math.min(100, (st.qty / (d.min || 1)) * 100) : d.target ? Math.min(100, st.sum / d.target * 100) : 0;
    let h = `<div class="card deal-hero">${d.photo ? `<div class="dh-ph" id="dhPh"></div>` : ""}
      <div class="dc-top"><span class="dc-kind ${d.kind}">${hesc(t(d.kind === "achat" ? "Achat groupé" : "Cagnotte"))}</span>${d.status === "done" ? `<span class="dc-st ok">${hesc(t(d.kind === "achat" ? "Achat validé" : "Cagnotte close"))}</span>` : d.status === "cancelled" ? `<span class="dc-st ko">${hesc(t("Annulé"))}</span>` : st.reached ? `<span class="dc-st ok">${hesc(t("Objectif atteint"))}</span>` : ""}</div>
      <h2 class="dh-t">${hesc(d.title)}</h2>
      <div class="hint">${hesc(t("Organisé par {x}", (d.ownerName || "") + (d.owner ? " (@" + d.owner + ")" : "")))}</div>
      ${d.desc ? `<p class="dh-d">${hesc(d.desc)}</p>` : ""}
      ${d.kind === "achat" ? `<div class="dh-big"><b>${hesc(m(d.price))}</b> <span>${hesc(t("la place"))}</span></div>` : `<div class="dh-big"><b>${hesc(m(st.sum))}</b> <span>${hesc(d.target ? t("réunis sur {x}", m(d.target)) : t("réunis"))}</span></div>`}
      <div class="dc-bar big"><i style="width:${pct.toFixed(1)}%"></i></div>
      <div class="dh-s">${d.kind === "achat" ? hesc(t("{x} places réservées", st.qty) + " · " + t("minimum {x}", d.min) + (st.left != null ? " · " + t("{x} restantes", st.left) : "")) : hesc(t(st.n === 1 ? "{x} participant" : "{x} participants", st.n))}</div>
      ${d.deadline ? `<div class="dh-s">${hesc(d.status === "open" ? (dl < 0 ? t("Date limite dépassée ({x})", ctx.fdate(d.deadline)) : dl <= 1 ? t("Dernier jour pour participer") : t("Jusqu'au {x} · plus que {y} jours", ctx.fdate(d.deadline)).replace("{y}", dl)) : t("Date limite : {x}", ctx.fdate(d.deadline)))}</div>` : ""}
      ${d.status === "open" && d.kind === "achat" && !st.reached ? `<p class="dh-note">${hesc(t("Personne ne paie tant que le minimum n'est pas atteint."))}</p>` : ""}
      ${d.status === "cancelled" ? `<p class="dh-note ko">${hesc(t("Annulé par l'organisateur. Si tu as déjà payé, il doit te rembourser."))}</p>` : ""}
      <button type="button" class="btn" id="dShare" style="margin-top:10px;width:100%">${hesc(t("Inviter des amis"))}</button></div>`;
    // Ma participation
    const formHTML = () => `<div class="dj">${ctx.needName ? `<label class="lbl" for="djName">${hesc(t("Ton prénom"))}</label><input class="field" id="djName" maxlength="40" value="${hesc(ctx.defaultName || "")}">` : ""}
      ${d.kind === "achat" ? `<label class="lbl">${hesc(t("Nombre de places"))}</label><div class="dj-q"><button type="button" class="btn" id="djM">−</button><b id="djQ">${mine ? mine.qty : 1}</b><button type="button" class="btn" id="djP">+</button><span class="hint" id="djT"></span></div>`
        : `<label class="lbl" for="djA">${hesc(t("Ma participation"))} (${hesc(d.cur)})</label><input class="field" id="djA" inputmode="decimal" value="${mine ? String(mine.amount).replace(".", ",") : d.suggested ? String(d.suggested).replace(".", ",") : ""}" placeholder="0">`}
      <button type="button" class="btn primary" id="djGo" style="margin-top:12px;width:100%">${hesc(t(mine ? "Enregistrer" : "Je participe"))}</button></div>`;
    h += `<div class="card"><h2>${hesc(t(owner && !mine ? "Participer aussi" : "Ma participation"))}</h2>`;
    if (mine && !S.editing) {
      h += `<div class="dm"><b>${hesc(d.kind === "achat" ? t("{x} place(s)", mine.qty) + " · " + m(myAmount) : m(myAmount))}</b>
        <span class="dc-st${mine.ok ? " ok" : ""}">${hesc(mine.ok ? t("Paiement reçu ✓") : mine.paid ? t("Payé, à confirmer") : t("À payer"))}</span></div>`;
      if (!mine.paid && canPay && !owner) h += pay ? `<div id="dPayBox"></div><button type="button" class="btn primary" id="dPay" style="width:100%;margin-top:10px">${hesc(t("Payer {x}", d.ownerName || ""))} · ${hesc(m(myAmount))}</button>`
        : `<p class="hint">${hesc(t("{x} n'a pas encore indiqué comment le payer : règle-le comme d'habitude, puis appuie sur « J'ai payé ».", d.ownerName || ""))}</p><button type="button" class="btn primary" id="dPaid" style="width:100%">${hesc(t("J'ai payé"))}</button>`;
      else if (!mine.paid && !canPay) h += `<p class="hint">${hesc(t("Tu paieras quand le minimum sera atteint : on te préviendra."))}</p>`;
      else if (mine.paid && !mine.ok && !owner) h += `<p class="hint">${hesc(t("Paiement déclaré : {x} va confirmer la réception.", d.ownerName || ""))}</p>`;
      if (open) h += `<div class="acts" style="margin-top:10px"><button type="button" class="btn" id="dEdit">${hesc(t("Modifier"))}</button>${!mine.ok ? `<button type="button" class="btn danger" id="dLeave">${hesc(t("Me retirer"))}</button>` : ""}</div>`;
    } else if (open) h += formHTML();
    else h += `<p class="hint" style="margin:0">${hesc(t(d.status === "cancelled" ? "Cet achat a été annulé." : st.expired ? "La date limite est passée." : "Les participations sont closes."))}</p>`;
    h += `</div>`;
    // Participants
    const parts = Object.entries(d.parts || {}).sort((a, b) => a[1].at - b[1].at);
    h += `<div class="card"><h2>${hesc(t("Participants"))}<small>${parts.length}</small></h2>${parts.length ? parts.map(([pid, p]) => `<div class="dp"><span><b>${hesc(p.name)}</b>${pid === you.pid ? ` <small>(${hesc(t("moi"))})</small>` : ""}<small>${hesc(d.kind === "achat" ? t("{x} place(s)", p.qty) + " · " + m(p.qty * d.price) : m(p.amount))}</small></span>
      <span class="dp-r"><span class="dc-st${p.ok ? " ok" : ""}">${hesc(p.ok ? t("Reçu ✓") : p.paid ? t("Payé, à confirmer") : t("À payer"))}</span>
      ${owner && pid !== you.pid ? `${p.ok ? `<button type="button" class="linkbtn" data-own="unconfirm" data-pid="${hesc(pid)}">${hesc(t("Annuler"))}</button>` : `<button type="button" class="linkbtn" data-own="confirm" data-pid="${hesc(pid)}">${hesc(t("Confirmer la réception"))}</button>`}<button type="button" class="linkbtn danger" data-own="remove" data-pid="${hesc(pid)}">${hesc(t("Retirer"))}</button>` : ""}</span></div>`).join("")
      : `<p class="hint" style="margin:0">${hesc(t("Personne pour l'instant : partage le lien !"))}</p>`}
      ${parts.length ? `<div class="dp-tot"><span>${hesc(t("Payé"))}</span><b>${hesc(m(st.paid))} / ${hesc(m(st.sum))}</b></div>` : ""}</div>`;
    // Organisateur
    if (owner) h += `<div class="card"><h2>${hesc(t("Gérer"))}</h2><div class="acts">
      ${d.status === "open" ? `<button type="button" class="btn primary" data-own="done">${hesc(t(d.kind === "achat" ? "Valider l'achat" : "Clore la cagnotte"))}</button><button type="button" class="btn danger" data-own="cancel">${hesc(t("Annuler"))}</button>` : `<button type="button" class="btn" data-own="reopen">${hesc(t("Rouvrir"))}</button>`}
      ${ctx.edit ? `<button type="button" class="btn" id="dEditDeal">${hesc(t("Modifier"))}</button>` : ""}</div>
      ${!pay ? `<p class="hint" style="margin:10px 0 0">${hesc(t("Ajoute tes moyens de paiement (Profil › Me faire payer) pour que les participants te paient en un geste."))}</p>` : ""}</div>`;
    // Commentaires
    const me = owner ? "owner" : you.pid || "";
    const items = Object.entries(d.comments || {}).map(([id, c]) => ({ id, name: c.name, text: c.text, at: c.at, re: c.re, mine: c.by === me })).sort((a, b) => a.at - b.at);
    h += `<div class="card"><h2>${hesc(t("Discussion"))}<small>${items.length || ""}</small></h2><div id="dCom">${COMUI.html(items, d.reacts, me, t, v => ctx.fdate(new Date(v).toISOString().slice(0, 10)), { locked: "Participe pour commenter et réagir.", empty: "Pas encore de message. Pose une question ou dis bonjour !" })}</div></div>`;
    root.innerHTML = h;
    // ---- actions
    const $ = id => root.querySelector("#" + id);
    const run = async (sub, body, msg) => { try { const r = await ctx.call(sub, body || {}); if (msg) ctx.toast(msg); S.editing = false; ctx.onUpdate(r); } catch (e) { ctx.toast(e.message); } };
    if (d.photo && ctx.getPhoto) ctx.getPhoto(d.photo).then(src => { const b = $("dhPh"); if (b) { b.innerHTML = `<img alt="">`; b.firstChild.src = src; b.firstChild.onclick = () => typeof showPhoto === "function" && showPhoto(src); } }).catch(() => {});
    $("dShare").onclick = () => ctx.share(t(d.kind === "achat" ? "Achat groupé « {x} » : rejoins-nous !" : "Cagnotte « {x} » : participe !", d.title), ctx.url);
    if ($("djGo")) {
      let q = mine ? mine.qty : 1;
      const tot = () => { if ($("djQ")) { $("djQ").textContent = q; $("djT").textContent = "= " + m(q * d.price); } };
      if ($("djM")) { $("djM").onclick = () => { q = Math.max(1, q - 1); tot(); }; $("djP").onclick = () => { q = Math.min(st.left != null ? st.left + (mine ? mine.qty : 0) : 999, q + 1); tot(); }; tot(); }
      $("djGo").onclick = () => {
        const name = $("djName") ? $("djName").value.trim() : "";
        if ($("djName") && !name) return ctx.toast(t("Indique ton prénom"));
        const amount = $("djA") ? Number($("djA").value.replace(/\s/g, "").replace(",", ".")) : 0;
        if ($("djA") && !(amount > 0)) return ctx.toast(t("Montant invalide"));
        run("join", { name, qty: q, amount }, t(mine ? "Participation modifiée" : "C'est noté, tu participes !"));
      };
    }
    if ($("dEdit")) $("dEdit").onclick = () => { S.editing = true; DEALUI.render(root, S, ctx); };
    if ($("dLeave")) $("dLeave").onclick = () => { const b = $("dLeave"); if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = t("Confirmer ?"); return; } run("me", { action: "leave" }, t("Tu ne participes plus")); };
    if ($("dPay")) $("dPay").onclick = () => {
      const box = $("dPayBox"); box.innerHTML = PAY.html(pay, myAmount, d.cur, d.title, t, m) + `<p class="hint" style="margin:8px 0 0">${hesc(t("Une fois le paiement fait, appuie sur « J'ai payé » pour prévenir l'organisateur."))}</p>`;
      PAY.bind(box, ctx.toast);
      const b = $("dPay"); b.textContent = t("J'ai payé"); b.onclick = () => run("me", { action: "paid" }, t("Merci ! L'organisateur est prévenu."));
    };
    if ($("dPaid")) $("dPaid").onclick = () => run("me", { action: "paid" }, t("Merci ! L'organisateur est prévenu."));
    root.querySelectorAll("[data-own]").forEach(b => b.onclick = () => {
      const act = b.dataset.own;
      if ((act === "cancel" || act === "remove") && b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = t("Confirmer ?"); return; }
      run("owner", { action: act, pid: b.dataset.pid || "" }, { done: t(d.kind === "achat" ? "Achat validé : les participants sont prévenus" : "Cagnotte close"), cancel: t("Annulé : les participants sont prévenus"), confirm: t("Réception confirmée"), reopen: t("Rouvert") }[act]);
    });
    if ($("dEditDeal")) $("dEditDeal").onclick = () => ctx.edit(d);
    COMUI.bind($("dCom"), items, d.reacts, me, {
      onSend: (text, re) => run("comment", { text, re }),
      onReact: (cid, e) => run("react", { cid, e }),
    }, t);
  },
};
// Textes en anglais (l'app et la page publique) ; dealT(lang) renvoie la fonction de traduction
const DEAL_EN = {
  "Réagir": "React", "Répondre": "Reply", "Supprimer": "Delete", "Écrire un commentaire…": "Write a comment…", "Envoyer": "Send", "En réponse à {x}": "Replying to {x}",
  "Annulé": "Cancelled", "Objectif atteint": "Target reached", "Date dépassée": "Deadline passed", "Dernier jour": "Last day", "Plus que {x} jours": "{x} days left", "En cours": "Open",
  "{x} places réservées": "{x} spots booked", "minimum {x}": "minimum {x}", "la place": "per spot", "{x} réunis": "{x} raised", "objectif {x}": "target {x}", "{x} participants": "{x} participants", "{x} participant": "{x} participant",
  "Organisé par {x}": "Organised by {x}", "réunis sur {x}": "raised of {x}", "réunis": "raised", "{x} restantes": "{x} left", "Date limite dépassée ({x})": "Deadline passed ({x})",
  "Dernier jour pour participer": "Last day to join", "Jusqu'au {x} · plus que {y} jours": "Until {x} · {y} days left", "Date limite : {x}": "Deadline: {x}",
  "Personne ne paie tant que le minimum n'est pas atteint.": "Nobody pays until the minimum is reached.",
  "Annulé par l'organisateur. Si tu as déjà payé, il doit te rembourser.": "Cancelled by the organiser. If you've already paid, they'll refund you.",
  "Inviter des amis": "Invite friends", "Ton prénom": "Your first name", "Nombre de places": "Number of spots", "Ma participation": "My share", "{x} place(s)": "{x} spot(s)",
  "Paiement reçu ✓": "Payment received ✓", "Payé, à confirmer": "Paid, to be confirmed", "À payer": "To pay", "Payer {x}": "Pay {x}",
  "{x} n'a pas encore indiqué comment le payer : règle-le comme d'habitude, puis appuie sur « J'ai payé ».": "{x} hasn't added payment details yet: pay them as usual, then tap “I've paid”.",
  "J'ai payé": "I've paid", "Tu paieras quand le minimum sera atteint : on te préviendra.": "You'll pay once the minimum is reached: we'll let you know.",
  "Paiement déclaré : {x} va confirmer la réception.": "Payment declared: {x} will confirm receipt.", "Modifier": "Edit", "Me retirer": "Leave", "Participants": "Participants", "moi": "me",
  "Reçu ✓": "Received ✓", "Annuler": "Cancel", "Confirmer la réception": "Confirm receipt", "Retirer": "Remove", "Personne pour l'instant : partage le lien !": "Nobody yet: share the link!",
  "Payé": "Paid", "Gérer": "Manage", "Rouvrir": "Reopen", "Ajoute tes moyens de paiement (Profil › Me faire payer) pour que les participants te paient en un geste.": "Add your payment details (Profile › Get paid) so participants can pay you in one tap.",
  "Discussion": "Discussion", "Indique ton prénom": "Enter your first name", "Montant invalide": "Invalid amount", "Confirmer ?": "Confirm?", "Tu ne participes plus": "You've left",
  "Une fois le paiement fait, appuie sur « J'ai payé » pour prévenir l'organisateur.": "Once you've paid, tap “I've paid” to let the organiser know.",
  "Merci ! L'organisateur est prévenu.": "Thanks! The organiser has been notified.", "Annulé : les participants sont prévenus": "Cancelled: participants have been notified",
  "Réception confirmée": "Receipt confirmed", "Rouvert": "Reopened", "Participe pour commenter et réagir.": "Join to comment and react.",
  "Pas encore de message. Pose une question ou dis bonjour !": "No messages yet. Ask a question or say hi!", "Aucun commentaire.": "No comments yet.",
  "Achat groupé": "Group buy", "Cagnotte": "Money pot", "Achat validé": "Purchase confirmed", "Cagnotte close": "Pot closed", "Cet achat a été annulé.": "This purchase was cancelled.",
  "La date limite est passée.": "The deadline has passed.", "Les participations sont closes.": "Sign-ups are closed.", "Participer aussi": "Join too", "Valider l'achat": "Confirm the purchase",
  "Clore la cagnotte": "Close the pot", "Achat groupé « {x} » : rejoins-nous !": "Group buy “{x}”: join us!", "Cagnotte « {x} » : participe !": "Money pot “{x}”: chip in!",
  "Participation modifiée": "Share updated", "C'est noté, tu participes !": "Done, you're in!", "Achat validé : les participants sont prévenus": "Purchase confirmed: participants have been notified",
  "Je participe": "I'm in", "Enregistrer": "Save",
};
function dealT(lang, extra) {
  return (s, x) => { let r = lang === "en" ? ((extra && extra[s]) || DEAL_EN[s] || s) : s; return x != null ? r.replace("{x}", x) : r; };
}

// ---------- Cagnotte = tontine rotative ----------
const TON_FREQ_FR = { semaine: "chaque semaine", mois: "chaque mois", an: "chaque année" };
const TON_FREQ_EN = { semaine: "every week", mois: "every month", an: "every year" };
DEALUI.tonCard = function (d, ctx) {
  const t = ctx.t, m = v => ctx.money(v, d.cur), st = d.stats || {}, n = (d.order || []).length;
  const fr = (window.LANG === "en" ? TON_FREQ_EN : TON_FREQ_FR)[d.freq] || "";
  const badge = d.status === "cancelled" ? t("Annulé") : st.done ? t("Terminée") : d.started ? t("Tour {x}", Math.max(1, st.round + 1)) + "/" + n : t("Inscriptions ouvertes");
  const pct = st.need ? Math.min(100, st.paid / st.need * 100) : 0;
  return `<button type="button" class="deal-card" data-deal="${hesc(d.id)}">
    <div class="dc-top"><span class="dc-kind cagnotte">${hesc(t("Cagnotte"))}</span><span class="dc-st${d.started ? " ok" : ""}">${hesc(badge)}</span></div>
    <b class="dc-t">${hesc(d.title)}</b><div class="dc-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
    <div class="dc-s">${hesc(m(d.amount) + " " + t("par personne") + " · " + fr + " · " + t(n === 1 ? "{x} membre" : "{x} membres", n) + " · " + t("pot de {x}", m(st.sum)))}</div></button>`;
};
DEALUI.renderTon = function (root, S, ctx) {
  const d = S.deal, t = ctx.t, m = v => ctx.money(v, d.cur), st = d.stats || {}, you = d.you || {};
  const owner = you.role === "owner", me = you.pid || "", isMember = me && (d.order || []).includes(me), n = (d.order || []).length;
  const name = pid => (d.parts[pid] || {}).name || "?", today = new Date().toISOString().slice(0, 10);
  const fr = (window.LANG === "en" ? TON_FREQ_EN : TON_FREQ_FR)[d.freq] || "";
  const pinfo = S.payinfo || {};
  let h = `<div class="card deal-hero">${d.photo ? `<div class="dh-ph" id="dhPh"></div>` : ""}
    <div class="dc-top"><span class="dc-kind cagnotte">${hesc(t("Cagnotte"))}</span>${d.started ? `<span class="dc-st ok">${hesc(st.done ? t("Terminée") : t("En cours"))}</span>` : `<span class="dc-st">${hesc(t("Inscriptions ouvertes"))}</span>`}</div>
    <h2 class="dh-t">${hesc(d.title)}</h2><div class="hint">${hesc(t("Organisé par {x}", (d.ownerName || "") + (d.owner ? " (@" + d.owner + ")" : "")))}</div>
    ${d.desc ? `<p class="dh-d">${hesc(d.desc)}</p>` : ""}
    <div class="dh-big"><b>${hesc(m(d.amount))}</b> <span>${hesc(t("par personne") + ", " + fr)}</span></div>
    <div class="dh-s">${hesc(t(n === 1 ? "{x} membre" : "{x} membres", n) + " · " + t("chaque tour, un membre reçoit le pot de {x}", m(st.sum)))}</div>
    <div class="dh-s">${hesc(t("1er tour le {x}", ctx.fdate(d.start)))}</div>
    ${!d.started ? `<p class="dh-note">${hesc(t("Les inscriptions sont ouvertes. L'ordre des tours (qui reçoit le pot, et quand) sera fixé au démarrage."))}</p>` : ""}
    <button type="button" class="btn" id="dShare" style="margin-top:10px;width:100%">${hesc(t("Inviter des amis"))}</button></div>`;
  if (!isMember && !d.started && d.status === "open") h += `<div class="card"><h2>${hesc(t("Rejoindre la cagnotte"))}</h2>${ctx.needName ? `<label class="lbl" for="djName">${hesc(t("Ton prénom"))}</label><input class="field" id="djName" maxlength="40" value="${hesc(ctx.defaultName || "")}">` : ""}
    <button type="button" class="btn primary" id="djGo" style="margin-top:12px;width:100%">${hesc(t("Je participe"))}</button></div>`;
  // Membres et ordre des tours
  h += `<div class="card"><h2>${hesc(t("Ordre des tours"))}<small>${n}</small></h2>${(d.order || []).map((pid, k) => `<div class="ton-m${pid === me ? " me" : ""}"><span class="ton-k">${k + 1}</span><span class="ton-n"><b>${hesc(name(pid))}</b>${pid === me ? ` <small>(${hesc(t("moi"))})</small>` : ""}<small>${hesc(t("reçoit le pot le {x}", ctx.fdate(d.rounds[k].date)))}</small></span>
      ${owner && !d.started ? `<span class="ton-mv"><button type="button" class="linkbtn" data-up="${k}" ${k ? "" : "disabled"}>↑</button><button type="button" class="linkbtn" data-dn="${k}" ${k < n - 1 ? "" : "disabled"}>↓</button>${pid !== me ? `<button type="button" class="linkbtn danger" data-own="remove" data-pid="${hesc(pid)}">✕</button>` : ""}</span>` : ""}</div>`).join("")}
    ${owner && !d.started ? `<div class="acts" style="margin-top:10px"><button type="button" class="btn" data-own="shuffle">${hesc(t("Tirer au sort"))}</button><button type="button" class="btn primary" data-own="start" ${n < 2 ? "disabled" : ""}>${hesc(t("Démarrer la cagnotte"))}</button></div>` : ""}
    ${isMember && !owner && !d.started ? `<div class="acts" style="margin-top:10px"><button type="button" class="btn danger" id="dLeave">${hesc(t("Me retirer"))}</button></div>` : ""}</div>`;
  // Les tours
  if (d.started) {
    h += `<div class="hub-sec"><span>${hesc(t("Les tours"))}</span></div>`;
    for (const r of d.rounds) {
      const payers = d.order.filter(pid => pid !== r.ben), got = payers.filter(pid => ((d.pays || {})[r.k + "|" + pid] || {}).st === "ok").length;
      const isCur = r.k === st.round, past = r.date < today && !isCur, mineBen = r.ben === me;
      h += `<div class="card ton-r${isCur ? " cur" : ""}${got === payers.length ? " done" : ""}"><div class="ton-rh"><b>${hesc(t("Tour {x}", r.k + 1))}</b><span>${hesc(ctx.fdate(r.date))}</span>${isCur ? `<span class="dc-st ok">${hesc(t("en cours"))}</span>` : ""}</div>
        <div class="hint">${hesc(t("{x} reçoit le pot", name(r.ben)) + " · " + got + "/" + payers.length + " " + t("versements reçus"))}</div>
        ${payers.map(pid => { const s = ((d.pays || {})[r.k + "|" + pid] || {}).st || "due"; return `<div class="pj-line ${s === "due" ? "due" : s}"><div class="pj-l"><b>${hesc(name(pid))}</b>${pid === me ? ` <small>(${hesc(t("moi"))})</small>` : ""}<small>${hesc(t("verse {x} à {y}", m(d.amount)).replace("{y}", name(r.ben)))}</small></div>
          <div class="pj-r"><span class="pj-st ${s}">${hesc(s === "ok" ? t("Reçu ✓") : s === "sent" ? t("Versé, à confirmer") : t("À verser"))}</span></div>
          <div class="pj-acts">${pid === me && s === "due" ? `<button type="button" class="btn primary" data-tpay="${r.k}">${hesc(t("Payer {x}", name(r.ben)))}</button>` : ""}${(mineBen || (owner && !(d.parts[r.ben] || {}).member)) && s !== "ok" && pid !== me ? `<button type="button" class="btn ${s === "sent" ? "primary" : ""}" data-trec="${r.k}" data-pid="${hesc(pid)}">${hesc(t("Confirmer la réception"))}</button>` : ""}</div>
          ${pid === me && s === "due" ? `<div class="ton-paybox" id="tpb${r.k}" hidden></div>` : ""}</div>`; }).join("")}</div>`;
    }
  }
  if (owner) h += `<div class="card"><h2>${hesc(t("Gérer"))}</h2><div class="acts">${d.status === "open" ? `<button type="button" class="btn danger" data-own="cancel">${hesc(t("Annuler"))}</button>` : `<button type="button" class="btn" data-own="reopen">${hesc(t("Rouvrir"))}</button>`}${ctx.edit ? `<button type="button" class="btn" id="dEditDeal">${hesc(t("Modifier"))}</button>` : ""}</div></div>`;
  const items = Object.entries(d.comments || {}).map(([id, c]) => ({ id, name: c.name, text: c.text, at: c.at, re: c.re, mine: c.by === (owner ? "owner" : me) })).sort((a, b2) => a.at - b2.at);
  const cme = owner ? "owner" : me;
  h += `<div class="card"><h2>${hesc(t("Discussion"))}<small>${items.length || ""}</small></h2><div id="dCom">${COMUI.html(items, d.reacts, cme, t, v => ctx.fdate(new Date(v).toISOString().slice(0, 10)), { locked: "Participe pour commenter et réagir.", empty: "Pas encore de message. Pose une question ou dis bonjour !" })}</div></div>`;
  root.innerHTML = h;
  const $ = id => root.querySelector("#" + id);
  const run = async (sub, body, msg) => { try { const r = await ctx.call(sub, body || {}); if (msg) ctx.toast(msg); ctx.onUpdate(r); } catch (e) { ctx.toast(e.message); } };
  if (d.photo && ctx.getPhoto) ctx.getPhoto(d.photo).then(src => { const b2 = $("dhPh"); if (b2) { b2.innerHTML = `<img alt="">`; b2.firstChild.src = src; } }).catch(() => {});
  $("dShare").onclick = () => ctx.share(t("Cagnotte « {x} » : participe !", d.title), ctx.url);
  if ($("djGo")) $("djGo").onclick = () => { const nm = $("djName") ? $("djName").value.trim() : ""; if ($("djName") && !nm) return ctx.toast(t("Indique ton prénom")); run("join", { name: nm }, t("C'est noté, tu participes !")); };
  if ($("dLeave")) $("dLeave").onclick = () => run("me", { action: "leave" }, t("Tu ne participes plus"));
  const ord = (d.order || []).slice();
  root.querySelectorAll("[data-up]").forEach(b2 => b2.onclick = () => { const k = +b2.dataset.up; [ord[k - 1], ord[k]] = [ord[k], ord[k - 1]]; run("owner", { action: "order", order: ord }); });
  root.querySelectorAll("[data-dn]").forEach(b2 => b2.onclick = () => { const k = +b2.dataset.dn; [ord[k + 1], ord[k]] = [ord[k], ord[k + 1]]; run("owner", { action: "order", order: ord }); });
  root.querySelectorAll("[data-own]").forEach(b2 => b2.onclick = () => {
    const act = b2.dataset.own;
    if ((act === "cancel" || act === "remove" || act === "start") && b2.dataset.c !== "1") { b2.dataset.c = "1"; b2.textContent = act === "start" ? t("Confirmer : l'ordre sera fixé") : t("Confirmer ?"); return; }
    run("owner", { action: act, pid: b2.dataset.pid || "" }, { start: t("C'est parti : les membres sont prévenus"), shuffle: t("Ordre tiré au sort"), cancel: t("Annulé : les participants sont prévenus") }[act]);
  });
  root.querySelectorAll("[data-tpay]").forEach(b2 => b2.onclick = () => {
    const k = +b2.dataset.tpay, ben = d.rounds[k].ben, box = $("tpb" + k), p = pinfo[ben];
    if (box.hidden) {
      box.hidden = false;
      box.innerHTML = (p ? PAY.html(p, d.amount, d.cur, d.title + " · " + t("Tour {x}", k + 1), t, m) : `<p class="hint">${hesc(t("{x} n'a pas encore indiqué comment le payer : règle-le comme d'habitude, puis appuie sur « J'ai payé ».", name(ben)))}</p>`);
      if (p) PAY.bind(box, ctx.toast);
      b2.textContent = t("J'ai payé"); return;
    }
    run("me", { action: "paid", k }, t("Merci ! {x} est prévenu.", name(ben)));
  });
  root.querySelectorAll("[data-trec]").forEach(b2 => b2.onclick = () => run("me", { action: "received", k: +b2.dataset.trec, pid: b2.dataset.pid }, t("Réception confirmée")));
  if ($("dEditDeal")) $("dEditDeal").onclick = () => ctx.edit(d);
  COMUI.bind($("dCom"), items, d.reacts, cme, { onSend: (text, re) => run("comment", { text, re }), onReact: (cid, e) => run("react", { cid, e }) }, t);
};
Object.assign(DEAL_EN, {
  "Terminée": "Finished", "Tour {x}": "Round {x}", "Inscriptions ouvertes": "Sign-ups open", "par personne": "per person", "{x} membre": "{x} member", "{x} membres": "{x} members", "pot de {x}": "pot of {x}",
  "chaque tour, un membre reçoit le pot de {x}": "each round, one member receives the pot of {x}", "1er tour le {x}": "1st round on {x}",
  "Les inscriptions sont ouvertes. L'ordre des tours (qui reçoit le pot, et quand) sera fixé au démarrage.": "Sign-ups are open. The order of rounds (who gets the pot, and when) will be fixed at the start.",
  "Rejoindre la cagnotte": "Join the money pot", "Ordre des tours": "Order of rounds", "reçoit le pot le {x}": "gets the pot on {x}", "Tirer au sort": "Draw lots", "Démarrer la cagnotte": "Start the money pot",
  "Les tours": "Rounds", "en cours": "current", "{x} reçoit le pot": "{x} gets the pot", "versements reçus": "payments received", "verse {x} à {y}": "pays {x} to {y}",
  "Versé, à confirmer": "Paid, to confirm", "À verser": "To pay", "Confirmer : l'ordre sera fixé": "Confirm: the order will be fixed", "C'est parti : les membres sont prévenus": "It's on: members have been notified",
  "Ordre tiré au sort": "Order drawn", "Merci ! {x} est prévenu.": "Thanks! {x} has been notified.", "En cours": "Ongoing",
});
// Les cagnottes créées avant (avec un objectif) gardent l'ancien affichage
{
  const _render = DEALUI.render, _card = DEALUI.card;
  DEALUI.render = function (root, S, ctx) { return S.deal && S.deal.ton ? DEALUI.renderTon(root, S, ctx) : _render(root, S, ctx); };
  DEALUI.card = function (d, ctx) { return d.ton ? DEALUI.tonCard(d, ctx) : _card(d, ctx); };
}
