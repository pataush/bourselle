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
      ${owner && pid !== you.pid && !p.paid && canPay && d.status !== "cancelled" ? `<button type="button" class="linkbtn" data-arem="${hesc(pid)}">${hesc(t("Relancer"))}</button>` : ""}${owner && pid !== you.pid ? `${p.ok ? `<button type="button" class="linkbtn" data-own="unconfirm" data-pid="${hesc(pid)}">${hesc(t("Annuler"))}</button>` : `<button type="button" class="linkbtn" data-own="confirm" data-pid="${hesc(pid)}">${hesc(t("Confirmer la réception"))}</button>`}<button type="button" class="linkbtn danger" data-own="remove" data-pid="${hesc(pid)}">${hesc(t("Retirer"))}</button>` : ""}</span></div>`).join("")
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
    root.querySelectorAll("[data-arem]").forEach(b => b.onclick = () => DEALUI.remind(d, ctx, [b.dataset.arem]));
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
const addDaysISO = (iso, n) => { const x = new Date(iso + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const TON_FREQ_FR = { semaine: "chaque semaine", mois: "chaque mois", an: "chaque année" };
const TON_FREQ_EN = { semaine: "every week", mois: "every month", an: "every year" };
DEALUI.tonCard = function (d, ctx) {
  const t = ctx.t, m = v => ctx.money(v, d.cur), st = d.stats || {}, n = (d.order || []).length;
  const fr = (window.LANG === "en" ? TON_FREQ_EN : TON_FREQ_FR)[d.freq] || "";
  const inv = d.you && d.you.pid && (d.parts[d.you.pid] || {}).inv;
  const badge = inv ? "✉️ " + t("Invitation à accepter") : d.status === "cancelled" ? t("Annulé") : st.done ? t("Terminée") : d.started ? t("Tour {x}", Math.max(1, st.round + 1)) + "/" + n : t("Inscriptions ouvertes");
  const pct = st.need ? Math.min(100, st.paid / st.need * 100) : 0;
  return `<button type="button" class="deal-card" data-deal="${hesc(d.id)}">
    <div class="dc-top"><span class="dc-kind cagnotte">${hesc(t("Cagnotte"))}</span><span class="dc-st${inv ? " inv" : d.started ? " ok" : ""}">${hesc(badge)}</span></div>
    <b class="dc-t">${hesc(d.title)}</b><div class="dc-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
    <div class="dc-s">${hesc(m(d.amount) + " " + t("par personne") + " · " + fr + " · " + t(n === 1 ? "{x} membre" : "{x} membres", n) + " · " + t("pot de {x}", m(st.sum)))}</div></button>`;
};
// Relancer : notification aux membres qui ont un compte, message prêt à envoyer (avec le lien pour payer) pour les autres
DEALUI.remind = async function (d, ctx, pids, k) {
  const t = ctx.t, m = v => ctx.money(v, d.cur), notified = [], toShare = []; let last = null;
  const amtOf = pid => d.ton ? d.amount * (((d.parts[pid] || {}).sh) || 1) : d.kind === "achat" ? ((d.parts[pid] || {}).qty || 0) * d.price : (d.parts[pid] || {}).amount || 0;
  let msg = "";
  if (ctx.pickMsg) {
    const r = d.ton ? d.rounds[k] : null, who = pids.length === 1 ? (d.parts[pids[0]] || {}).name || "" : t("{x} membres", pids.length);
    const preset = d.ton ? t("Petit rappel : ta cotisation de {m} (tour {k}) est à verser à {b} au plus tard le {d} 🙂").replace("{m}", m(d.amount)).replace("{k}", k + 1).replace("{b}", (d.parts[r.ben] || {}).name || "").replace("{d}", ctx.fdate(r.due || r.date))
      : t("Petit rappel : merci de régler ta part de {m} 🙂").replace("{m}", m(amtOf(pids[0])));
    msg = await ctx.pickMsg(who, m(amtOf(pids[0])), d.title, { preset }); if (!msg) return;
  }
  for (const pid of pids) {
    try { const r = await ctx.call("me", { action: "remind", k, pid, msg }); last = r; (r.notified ? notified : toShare).push(pid); } catch (e) { ctx.toast(e.message); return; }
  }
  if (last) ctx.onUpdate(last);
  const nm = pid => (d.parts[pid] || {}).name || "";
  if (toShare.length) {
    const amt = pid => d.ton ? d.amount * (((d.parts[pid] || {}).sh) || 1) : d.kind === "achat" ? (d.parts[pid].qty || 0) * d.price : d.parts[pid].amount || 0;
    const r = d.ton ? d.rounds[k] : null;
    const who = toShare.map(nm).join(", ");
    const lc = x => /^[A-ZÀ-Ý][a-zà-ÿ]/.test(x) ? x[0].toLowerCase() + x.slice(1) : x;
    const txt = msg ? who + ", " + lc(msg) : d.ton ? t("Petit rappel 🙂 {x} : ta cotisation de {m} pour « {t} » (tour {k}, le {d}) est à verser à {b}. Pour payer :", who).replace("{m}", m(d.amount)).replace("{t}", d.title).replace("{k}", k + 1).replace("{d}", ctx.fdate(r.date)).replace("{b}", nm(r.ben))
      : t("Petit rappel 🙂 {x} : ta part de {m} pour « {t} » est à régler à {b}. Pour payer :", who).replace("{m}", m(amt(toShare[0]))).replace("{t}", d.title).replace("{b}", d.ownerName || "");
    const lk = d.ton && toShare.length === 1 && (d.parts[toShare[0]] || {}).lk;
    await ctx.share(txt, lk ? DEALUI.tonPersonalLink(ctx, toShare[0] + "." + lk) : ctx.url);
  }
  if (notified.length) setTimeout(() => ctx.toast(t("Rappel envoyé à {x}", notified.map(nm).join(", "))), toShare.length ? 1800 : 0);
};
// Statut d'un versement : reçu, versé (à confirmer), à verser, en retard (date butoir dépassée)
DEALUI.tonStatus = function (d, r, pid, today) {
  const st = ((d.pays || {})[r.k + "|" + pid] || {}).st;
  return st === "ok" ? "ok" : st === "sent" ? "sent" : r.due && today > r.due ? "late" : "due";
};
DEALUI.tonPersonalLink = (ctx, link) => ctx.url + "&m=" + link;
DEALUI.renderTon = function (root, S, ctx) {
  const S0 = S;
  const d = S.deal, t = ctx.t, m = v => ctx.money(v, d.cur), st = d.stats || {}, you = d.you || {};
  const owner = you.role === "owner", me = you.pid || "", isMember = me && (d.order || []).includes(me), n = (d.order || []).length;
  const sh = pid => (d.parts[pid] || {}).sh || 1, roles = d.roles || {}, bureau = owner || ["president", "tresorier"].includes(roles[me]);
  const ROLE = { president: t("Président·e"), tresorier: t("Trésorier·e") }, slots = d.slots || d.order || [], NS = slots.length;
  const potOf = r => d.amount * d.order.filter(pid => pid !== r.ben).reduce((a, pid) => a + sh(pid), 0);
  const invited = isMember && (d.parts[me] || {}).inv;
  const name = pid => (d.parts[pid] || {}).name || "?", today = new Date().toISOString().slice(0, 10);
  const fr = (window.LANG === "en" ? TON_FREQ_EN : TON_FREQ_FR)[d.freq] || "";
  const pinfo = S.payinfo || {}, warns = d.warns || {};
  const dueTxt = !d.due ? t("le jour du tour") : t(d.due === 1 ? "{x} jour après la date du tour" : "{x} jours après la date du tour", d.due);
  const stLabel = s => ({ ok: t("Payé ✓"), sent: t("Versé, à confirmer"), late: t("En retard"), due: t("À verser") })[s];
  let h = "";
  if (invited) h += `<div class="card ton-inv"><h2>${hesc(t("Invitation"))}</h2><p class="hint" style="margin:0 0 10px">${hesc(t("{x} t'invite dans cette cagnotte. Accepte pour la suivre, commenter et voir les versements.", d.ownerName || ""))}</p>
    <div class="acts"><button type="button" class="btn" id="tDecl">${hesc(t("Refuser"))}</button><button type="button" class="btn primary" id="tAcc">${hesc(t("Accepter"))}</button></div></div>`;
  h += `<div class="card deal-hero">${d.photo ? `<div class="dh-ph" id="dhPh"></div>` : ""}
    <div class="dc-top"><span class="dc-kind cagnotte">${hesc(t("Cagnotte"))}</span>${d.started ? `<span class="dc-st ok">${hesc(st.done ? t("Terminée") : t("En cours"))}</span>` : `<span class="dc-st">${hesc(t("Inscriptions ouvertes"))}</span>`}</div>
    <h2 class="dh-t">${hesc(d.title)}</h2><div class="hint">${hesc(t("Gérée par {x}", (d.ownerName || "") + (d.owner ? " (@" + d.owner + ")" : "")))}</div>
    ${d.desc ? `<p class="dh-d">${hesc(d.desc)}</p>` : ""}
    <div class="dh-big"><b>${hesc(m(d.amount))}</b> <span>${hesc(t("par part") + ", " + fr)}</span></div>
    <div class="dh-s">${hesc(t(n === 1 ? "{x} membre" : "{x} membres", n) + (NS !== n ? " · " + t("{x} parts", NS) : "") + " · " + t("{x} tours", NS) + " · " + t("chaque tour, un membre reçoit le pot de {x}", m(st.sum)))}</div>
    <div class="dh-s">${hesc(t("1er tour le {x}", ctx.fdate(d.start)))}</div>
    <div class="ton-clauses"><b>${hesc(t("Clauses de la cagnotte"))}</b><p>⏰ ${hesc(t("Date butoir de règlement"))} : ${hesc(dueTxt)}.</p>${d.rules ? `<p class="ton-rules">${hesc(d.rules)}</p>` : ""}</div>
    ${!d.started ? `<p class="dh-note">${hesc(t("Les inscriptions sont ouvertes. L'ordre des tours (qui reçoit le pot, et quand) sera fixé au démarrage."))}</p>` : ""}
    ${owner || !d.started ? `<button type="button" class="btn" id="dShare" style="margin-top:10px;width:100%">${hesc(owner ? t("Partager le lien de la cagnotte") : t("Inviter des amis"))}</button>` : ""}</div>`;
  if (!isMember && !d.started && d.status === "open" && !owner) h += `<div class="card"><h2>${hesc(t("Rejoindre la cagnotte"))}</h2>${ctx.needName ? `<label class="lbl" for="djName">${hesc(t("Ton prénom"))}</label><input class="field" id="djName" maxlength="40" value="${hesc(ctx.defaultName || "")}">` : ""}
    <button type="button" class="btn primary" id="djGo" style="margin-top:12px;width:100%">${hesc(t("Je participe"))}</button></div>`;
  // La période en cours : qui a payé, qui est en retard (visible par tous)
  const cur = d.started && st.round >= 0 && !st.done ? d.rounds[st.round] : null;
  if (cur) {
    const payers = d.order.filter(pid => pid !== cur.ben), ok = payers.filter(pid => DEALUI.tonStatus(d, cur, pid, today) === "ok").length;
    const per = { semaine: t("Cette semaine"), mois: t("Ce mois-ci"), an: t("Cette année") }[d.freq] || t("Tour en cours");
    const lateL = payers.filter(pid => DEALUI.tonStatus(d, cur, pid, today) === "late");
    h += `<div class="card ton-now"><h2>${hesc(per)}<small>${ok}/${payers.length}</small></h2>
      <p class="hint" style="margin:0 0 4px">${hesc(t("Tour {x}", cur.k + 1) + " · " + t("{x} reçoit le pot", name(cur.ben)) + " (" + m(potOf(cur)) + ") · " + t("à régler au plus tard le {x}", ctx.fdate(cur.due)))}</p>
      ${payers.map(pid => { const s = DEALUI.tonStatus(d, cur, pid, today), w = (warns[cur.k + "|" + pid] || {}).n || 0;
        return `<div class="ton-st ${s}"><span class="ton-dot"></span><span class="ton-sn"><b>${hesc(name(pid))}</b>${pid === me ? ` <small>(${hesc(t("moi"))})</small>` : ""}${w ? `<small class="ton-w">⚠️ ${hesc(t(w === 1 ? "averti 1 fois" : "averti {x} fois", w))}</small>` : ""}</span>
        <span class="pj-st ${s === "late" ? "late" : s}">${hesc(stLabel(s))}</span>
        ${bureau && s !== "ok" && pid !== me ? `<span class="ton-oa"><button type="button" class="linkbtn" data-trem="${cur.k}" data-pid="${hesc(pid)}">🔔 ${hesc(t("Relancer"))}</button>${s === "late" ? `<button type="button" class="linkbtn danger" data-twarn="${cur.k}" data-pid="${hesc(pid)}">⚠️ ${hesc(t("Avertir"))}</button>` : ""}</span>` : ""}</div>`; }).join("")}
      ${bureau && lateL.length > 1 ? `<button type="button" class="btn ton-all danger-soft" data-twall="${cur.k}">⚠️ ${hesc(t("Avertir tous les retardataires ({x})", lateL.length))}</button>` : ""}
      ${bureau && payers.filter(pid => pid !== me && DEALUI.tonStatus(d, cur, pid, today) === "due").length > 1 ? `<button type="button" class="btn ton-all" data-tall="${cur.k}">🔔 ${hesc(t("Relancer ceux qui n'ont pas versé"))}</button>` : ""}</div>`;
  }
  // Membres (parts, rôles) puis ordre des tours
  const curK = d.started ? st.round : -1, nextRole = r => r === "" ? "president" : r === "president" ? "tresorier" : "";
  h += `<div class="card"><h2>${hesc(t("Membres"))}<small>${n}</small></h2>${(d.order || []).map(pid => { const p = d.parts[pid] || {}, r = roles[pid] || "";
      const badge = p.inv ? t("invitation envoyée") : !p.member ? t("sans l'appli") : "";
      const canRemove = pid !== me && (!d.started || !slots.some((x, k) => x === pid && k <= curK));
      return `<div class="ton-m mem${pid === me ? " me" : ""}"><span class="ton-n"><b>${hesc(name(pid))}</b>${pid === me ? ` <small>(${hesc(t("moi"))})</small>` : ""}${r ? ` <span class="ton-role ${r}">${hesc(ROLE[r])}</span>` : ""}${sh(pid) > 1 ? ` <span class="ton-sh">×${sh(pid)}</span>` : ""}${badge ? ` <span class="ton-b${p.inv ? " inv" : ""}">${hesc(badge)}</span>` : ""}
        <small>${hesc(t(sh(pid) > 1 ? "{x} parts · verse {y} par tour" : "1 part · verse {y} par tour", sh(pid)).replace("{y}", m(d.amount * sh(pid))))}</small></span>
      ${owner ? `<span class="ton-mv">${!d.started ? `<span class="ton-shc"><button type="button" class="linkbtn" data-tsh="${hesc(pid)}" data-v="${sh(pid) - 1}" ${sh(pid) > 1 ? "" : "disabled"} aria-label="${hesc(t("Une part de moins"))}">−</button><b>${sh(pid)}</b><button type="button" class="linkbtn" data-tsh="${hesc(pid)}" data-v="${sh(pid) + 1}" ${sh(pid) < 5 ? "" : "disabled"} aria-label="${hesc(t("Une part de plus"))}">+</button></span>` : ""}
        ${p.member || pid === me ? `<button type="button" class="linkbtn ton-rb" data-trole="${hesc(pid)}" data-r="${nextRole(r)}" title="${hesc(t("Rôle"))}">${r ? "🎖" : "☆"}</button>` : ""}${!p.member && pid !== me ? `<button type="button" class="linkbtn" data-tlink="${hesc(pid)}" title="${hesc(t("Envoyer son lien"))}">🔗</button>` : ""}${canRemove ? `<button type="button" class="linkbtn danger" data-own="remove" data-pid="${hesc(pid)}" title="${hesc(t("Retirer"))}">✕</button>` : ""}</span>` : ""}</div>`; }).join("")}
    ${owner ? `<p class="hint" style="margin:8px 0 0">${hesc(t(d.started ? "☆ : nommer président·e ou trésorier·e. Ils peuvent relancer, avertir, confirmer les versements et échanger des tours." : "− / + : nombre de parts (une part de plus = cotiser et recevoir le pot une fois de plus). ☆ : nommer président·e ou trésorier·e."))}</p>` : ""}
    ${owner && !d.started ? `<div class="ton-add"><label class="lbl" for="tAdd">${hesc(t("Ajouter un membre"))}</label>
      <input class="field" id="tAdd" maxlength="40" autocomplete="off" autocapitalize="words" placeholder="${hesc(ctx.search ? t("Prénom, ou @tag d'un utilisateur Bourselle") : t("Prénom"))}"><div id="tAddRes" class="ton-addres"></div>
      <p class="hint" style="margin:6px 0 0">${hesc(t("Avec l'appli : il reçoit l'invitation dans Bourselle et l'accepte. Sans l'appli : tu lui envoies son lien pour suivre la cagnotte, payer et commenter."))}</p></div>` : ""}
    ${isMember && !owner && !d.started && !invited ? `<div class="acts" style="margin-top:10px"><button type="button" class="btn danger" id="dLeave">${hesc(t("Me retirer"))}</button></div>` : ""}</div>`;
  const swapSel = DEALUI._swap && DEALUI._swap.id === d.id ? DEALUI._swap.k : -1;
  h += `<div class="card"><h2>${hesc(t("Ordre des tours"))}<small>${NS}</small></h2>${slots.map((pid, k) => { const r = d.rounds[k] || {}, nth = slots.slice(0, k + 1).filter(x => x === pid).length;
      const canSwap = bureau && (!d.started || k > curK) && NS > 1;
      return `<div class="ton-m${pid === me ? " me" : ""}${k === curK ? " cur" : ""}${swapSel === k ? " sel" : ""}"><span class="ton-k">${k + 1}</span><span class="ton-n"><b>${hesc(name(pid))}</b>${sh(pid) > 1 ? ` <small>(${hesc(t("part {x}/{y}", nth).replace("{y}", sh(pid)))})</small>` : ""}<small>${hesc(t("reçoit {m} le {x}", ctx.fdate(r.date)).replace("{m}", m(potOf(r))))}</small></span>
      <span class="ton-mv">${owner && !d.started ? `<button type="button" class="linkbtn" data-up="${k}" ${k ? "" : "disabled"}>↑</button><button type="button" class="linkbtn" data-dn="${k}" ${k < NS - 1 ? "" : "disabled"}>↓</button>` : ""}${canSwap && d.started ? `<button type="button" class="linkbtn ton-swap" data-tswap="${k}" title="${hesc(t("Échanger ce tour"))}">⇄</button>` : ""}</span></div>`; }).join("")}
    ${bureau && d.started && NS > 1 ? `<p class="hint" style="margin:8px 0 0">${hesc(swapSel >= 0 ? t("Touche ⇄ sur un autre tour à venir pour l'échanger avec le tour {x}.", swapSel + 1) : t("⇄ : échanger deux tours à venir (par exemple quand deux membres s'arrangent)."))}</p>` : ""}
    ${owner && !d.started ? `<div class="acts" style="margin-top:10px"><button type="button" class="btn" data-own="shuffle">${hesc(t("Tirer au sort"))}</button><button type="button" class="btn primary" data-own="start" ${n < 2 ? "disabled" : ""}>${hesc(t("Démarrer la cagnotte"))}</button></div>` : ""}</div>`;
  // Les tours
  if (d.started) {
    h += `<div class="hub-sec"><span>${hesc(t("Les tours"))}</span></div>`;
    for (const r of d.rounds) {
      const payers = d.order.filter(pid => pid !== r.ben), got = payers.filter(pid => ((d.pays || {})[r.k + "|" + pid] || {}).st === "ok").length;
      const isCur = r.k === st.round, mineBen = r.ben === me;
      h += `<div class="card ton-r${isCur ? " cur" : ""}${got === payers.length ? " done" : ""}"><div class="ton-rh"><b>${hesc(t("Tour {x}", r.k + 1))}</b><span>${hesc(ctx.fdate(r.date))}</span>${isCur ? `<span class="dc-st ok">${hesc(t("en cours"))}</span>` : ""}</div>
        <div class="hint">${hesc(t("{x} reçoit le pot", name(r.ben)) + " (" + m(potOf(r)) + ") · " + got + "/" + payers.length + " " + t("versements reçus") + " · " + t("date butoir : {x}", ctx.fdate(r.due)))}</div>
        ${payers.map(pid => { const s = DEALUI.tonStatus(d, r, pid, today), cls = s === "late" ? "due late" : s; return `<div class="pj-line ${cls}"><div class="pj-l"><b>${hesc(name(pid))}</b>${pid === me ? ` <small>(${hesc(t("moi"))})</small>` : ""}<small>${hesc(t("verse {x} à {y}", m(d.amount * sh(pid))).replace("{y}", name(r.ben)))}</small></div>
          <div class="pj-r"><span class="pj-st ${s}">${hesc(s === "ok" ? t("Reçu ✓") : stLabel(s))}</span></div>
          <div class="pj-acts">${pid === me && (s === "due" || s === "late") && !invited ? `<button type="button" class="btn primary" data-tpay="${r.k}">${hesc(t("Payer {x}", name(r.ben)))}</button>` : ""}${bureau && s !== "ok" && s !== "sent" && pid !== me && r.date <= addDaysISO(today, 7) && !isCur ? `<button type="button" class="linkbtn ton-rem" data-trem="${r.k}" data-pid="${hesc(pid)}">${hesc(t("Relancer"))}</button>` : ""}${bureau && s === "late" && pid !== me && !isCur ? `<button type="button" class="linkbtn danger ton-rem" data-twarn="${r.k}" data-pid="${hesc(pid)}">${hesc(t("Avertir"))}</button>` : ""}${(mineBen || (bureau && (!(d.parts[r.ben] || {}).member || s === "sent"))) && s !== "ok" && pid !== me ? `<button type="button" class="btn ${s === "sent" ? "primary" : ""}" data-trec="${r.k}" data-pid="${hesc(pid)}">${hesc(t("Confirmer la réception"))}</button>` : ""}</div>
          ${pid === me && (s === "due" || s === "late") ? `<div class="ton-paybox" id="tpb${r.k}" hidden></div>` : ""}</div>`; }).join("")}</div>`;
    }
  }
  if (owner) h += `<div class="card"><h2>${hesc(t("Gérer"))}</h2><div class="acts">${d.status === "open" ? `<button type="button" class="btn danger" data-own="cancel">${hesc(t("Annuler"))}</button>` : `<button type="button" class="btn" data-own="reopen">${hesc(t("Rouvrir"))}</button>`}${ctx.edit ? `<button type="button" class="btn" id="dEditDeal">${hesc(t("Modifier"))}</button>` : ""}</div></div>`;
  const items = Object.entries(d.comments || {}).map(([id, c]) => ({ id, name: c.name, text: c.text, at: c.at, re: c.re, mine: c.by === (owner ? "owner" : me) })).sort((a, b2) => a.at - b2.at);
  const cme = owner ? "owner" : invited ? "" : me;
  h += `<div class="card"><h2>${hesc(t("Discussion"))}<small>${items.length || ""}</small></h2><div id="dCom">${COMUI.html(items, d.reacts, cme, t, v => ctx.fdate(new Date(v).toISOString().slice(0, 10)), { locked: invited ? "Accepte l'invitation pour commenter et réagir." : "Participe pour commenter et réagir.", empty: "Pas encore de message. Pose une question ou dis bonjour !" })}</div></div>`;
  root.innerHTML = h;
  const $ = id => root.querySelector("#" + id);
  const run = async (sub, body, msg) => { try { const r = await ctx.call(sub, body || {}); if (msg) ctx.toast(msg); ctx.onUpdate(r); return r; } catch (e) { ctx.toast(e.message); } };
  if (d.photo && ctx.getPhoto) ctx.getPhoto(d.photo).then(src => { const b2 = $("dhPh"); if (b2) { b2.innerHTML = `<img alt="">`; b2.firstChild.src = src; } }).catch(() => {});
  if ($("dShare")) $("dShare").onclick = () => ctx.share(t(owner && d.started ? "Cagnotte « {x} » : suis les tours et les versements" : "Cagnotte « {x} » : participe !", d.title), ctx.url);
  if ($("tAcc")) $("tAcc").onclick = () => run("me", { action: "accept" }, t("Bienvenue dans la cagnotte !"));
  if ($("tDecl")) $("tDecl").onclick = e => { if (e.target.dataset.c !== "1") { e.target.dataset.c = "1"; e.target.textContent = t("Confirmer ?"); return; } run("me", { action: "decline" }, t("Invitation refusée")); };
  if ($("djGo")) $("djGo").onclick = () => { const nm = $("djName") ? $("djName").value.trim() : ""; if ($("djName") && !nm) return ctx.toast(t("Indique ton prénom")); run("join", { name: nm }, t("C'est noté, tu participes !")); };
  if ($("dLeave")) $("dLeave").onclick = () => run("me", { action: "leave" }, t("Tu ne participes plus"));
  // Envoyer à quelqu'un sans l'appli son lien personnel (suivre, payer, commenter)
  const sendLink = async (pid, link, dd) => {
    const nm = ((dd || d).parts[pid] || {}).name || "", url = DEALUI.tonPersonalLink(ctx, link);
    await ctx.share(t("Bonjour {x} ! Voici ton lien pour la cagnotte « {t} » ({m} {f}) : tu y vois les tours, qui a payé, et tu peux payer et commenter. Pas besoin d'appli.", nm).replace("{t}", d.title).replace("{m}", m(d.amount)).replace("{f}", fr), url);
  };
  root.querySelectorAll("[data-tlink]").forEach(b2 => b2.onclick = async () => { const r = await run("owner", { action: "link", pid: b2.dataset.tlink }); if (r && r.link) sendLink(b2.dataset.tlink, r.link, r.deal); });
  // Ajouter un membre : prénom (sans l'appli) ou @tag (avec l'appli)
  const add = $("tAdd"), res = $("tAddRes");
  if (add) {
    let tmr = null;
    const draw = (q, users) => {
      const isTag = q.startsWith("@"), nm = q.replace(/^@/, "").trim();
      res.innerHTML = (users || []).map(u => `<div class="soc-contact"><div><b>@${hesc(u.tag)}</b>${u.name ? ` <span class="hint">${hesc(u.name)}</span>` : ""}</div><button type="button" class="btn" data-tinv="${hesc(u.tag)}" data-n="${hesc(u.name || "")}">${hesc(t("Inviter"))}</button></div>`).join("")
        + (nm && !isTag ? `<button type="button" class="btn ton-addg" data-tg="1">+ ${hesc(t("Ajouter « {x} » (sans l'appli)", nm))}</button>` : "");
      res.querySelectorAll("[data-tinv]").forEach(b2 => b2.onclick = async () => { const r = await run("owner", { action: "invite", tag: b2.dataset.tinv, name: b2.dataset.n || "" }, t("Invitation envoyée à @{x}", b2.dataset.tinv)); if (r) { add.value = ""; } });
      const g = res.querySelector("[data-tg]"); if (g) g.onclick = async () => { const r = await run("owner", { action: "add", name: nm }); if (r && r.link) { ctx.toast(t("{x} est ajouté·e : envoie-lui son lien", nm)); setTimeout(() => sendLink(r.added, r.link, r.deal), 400); } };
    };
    add.oninput = () => {
      clearTimeout(tmr); const q = add.value.trim(); draw(q, []);
      const tq = q.replace(/^@/, "").toLowerCase();
      if (ctx.search && tq.length >= 3 && /^[a-z0-9_-]+$/.test(tq)) tmr = setTimeout(async () => { try { const users = await ctx.search(tq); if (add.value.trim() === q) draw(q, users.filter(u => !Object.values(d.parts).some(p => p.tag === u.tag))); } catch (e) {} }, 400);
    };
    add.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); const g = res.querySelector("[data-tg]"); if (g) g.click(); } };
  }
  const ord = slots.slice();
  root.querySelectorAll("[data-tsh]").forEach(b2 => b2.onclick = () => run("owner", { action: "shares", pid: b2.dataset.tsh, sh: +b2.dataset.v }));
  root.querySelectorAll("[data-trole]").forEach(b2 => b2.onclick = () => { const r = b2.dataset.r; run("owner", { action: "role", pid: b2.dataset.trole, role: r }, r ? t("{x} est maintenant {y}", name(b2.dataset.trole)).replace("{y}", ROLE[r]) : t("Rôle retiré")); });
  root.querySelectorAll("[data-tswap]").forEach(b2 => b2.onclick = async () => { const k = +b2.dataset.tswap;
    if (swapSel < 0 || swapSel === k) { DEALUI._swap = swapSel === k ? null : { id: d.id, k }; DEALUI.render(root, S0, ctx); return; }
    DEALUI._swap = null; await run("owner", { action: "swap", a: swapSel, b: k }, t("Tours {x} et {y} échangés", swapSel + 1).replace("{y}", k + 1)); });
  root.querySelectorAll("[data-up]").forEach(b2 => b2.onclick = () => { const k = +b2.dataset.up; [ord[k - 1], ord[k]] = [ord[k], ord[k - 1]]; run("owner", { action: "order", order: ord }); });
  root.querySelectorAll("[data-dn]").forEach(b2 => b2.onclick = () => { const k = +b2.dataset.dn; [ord[k + 1], ord[k]] = [ord[k], ord[k + 1]]; run("owner", { action: "order", order: ord }); });
  root.querySelectorAll("[data-own]").forEach(b2 => b2.onclick = () => {
    const act = b2.dataset.own;
    if ((act === "cancel" || act === "remove" || act === "start") && b2.dataset.c !== "1") { b2.dataset.c = "1"; b2.textContent = act === "start" ? t("Confirmer : l'ordre sera fixé") : act === "remove" ? t("Retirer ?") : t("Confirmer ?"); return; }
    run("owner", { action: act, pid: b2.dataset.pid || "" }, { start: t("C'est parti : les membres sont prévenus"), shuffle: t("Ordre tiré au sort"), cancel: t("Annulé : les participants sont prévenus"), remove: t("Membre retiré") }[act]);
  });
  root.querySelectorAll("[data-tpay]").forEach(b2 => b2.onclick = () => {
    const k = +b2.dataset.tpay, ben = d.rounds[k].ben, box = $("tpb" + k), p = pinfo[ben];
    if (box.hidden) {
      box.hidden = false;
      box.innerHTML = (p ? PAY.html(p, d.amount * sh(me), d.cur, d.title + " · " + t("Tour {x}", k + 1), t, m) : `<p class="hint">${hesc(t("{x} n'a pas encore indiqué comment le payer : règle-le comme d'habitude, puis appuie sur « J'ai payé ».", name(ben)))}</p>`);
      if (p) PAY.bind(box, ctx.toast);
      b2.textContent = t("J'ai payé"); return;
    }
    run("me", { action: "paid", k }, t("Merci ! {x} est prévenu.", name(ben)));
  });
  root.querySelectorAll("[data-trem]").forEach(b2 => b2.onclick = () => DEALUI.remind(d, ctx, [b2.dataset.pid], +b2.dataset.trem));
  root.querySelectorAll("[data-tall]").forEach(b2 => b2.onclick = () => { const k = +b2.dataset.tall, r = d.rounds[k]; DEALUI.remind(d, ctx, d.order.filter(pid => pid !== r.ben && pid !== me && DEALUI.tonStatus(d, r, pid, today) === "due"), k); });
  root.querySelectorAll("[data-twarn]").forEach(b2 => b2.onclick = () => DEALUI.warn(d, ctx, [b2.dataset.pid], +b2.dataset.twarn));
  root.querySelectorAll("[data-twall]").forEach(b2 => b2.onclick = () => { const k = +b2.dataset.twall, r = d.rounds[k]; DEALUI.warn(d, ctx, d.order.filter(pid => pid !== r.ben && pid !== me && DEALUI.tonStatus(d, r, pid, today) === "late"), k); });
  root.querySelectorAll("[data-trec]").forEach(b2 => b2.onclick = () => run("me", { action: "received", k: +b2.dataset.trec, pid: b2.dataset.pid }, t("Réception confirmée")));
  if ($("dEditDeal")) $("dEditDeal").onclick = () => ctx.edit(d);
  COMUI.bind($("dCom"), items, d.reacts, cme, { onSend: (text, re) => run("comment", { text, re }), onReact: (cid, e) => run("react", { cid, e }) }, t);
};
// Avertir (date butoir dépassée) : notification aux membres qui ont l'appli, message prêt à envoyer (avec leur lien) pour les autres
DEALUI.warn = async function (d, ctx, pids, k) {
  const t = ctx.t, m = v => ctx.money(v, d.cur), r = d.rounds[k], nm = pid => (d.parts[pid] || {}).name || "";
  const notified = [], toShare = []; let last = null, msg = "";
  if (ctx.pickMsg) {
    const preset = t("⚠️ Avertissement : ta cotisation de {m} (tour {k}) devait être réglée au plus tard le {d}. Merci de régulariser au plus vite.").replace("{m}", m(d.amount)).replace("{k}", k + 1).replace("{d}", ctx.fdate(r.due));
    msg = await ctx.pickMsg(pids.length === 1 ? nm(pids[0]) : t("{x} membres", pids.length), m(d.amount), d.title, { preset, title: t("Avertir"), payLabel: t("Date butoir dépassée") }); if (!msg) return;
  }
  for (const pid of pids) {
    try { const x = await ctx.call("owner", { action: "warn", k, pid, msg }); last = x; (x.notified ? notified : x.member ? [] : toShare).push(pid); } catch (e) { ctx.toast(e.message); return; }
  }
  if (last) ctx.onUpdate(last);
  for (const pid of toShare) {
    let url = ctx.url; const lk = (d.parts[pid] || {}).lk; if (lk) url = DEALUI.tonPersonalLink(ctx, pid + "." + lk);
    if (msg) { await ctx.share(nm(pid) + " — " + msg, url); continue; }
    await ctx.share(t("⚠️ Avertissement {x} : ta cotisation de {m} pour « {t} » (tour {k}, pour {b}) devait être réglée au plus tard le {d}. Merci de régulariser au plus vite :", nm(pid)).replace("{m}", m(d.amount)).replace("{t}", d.title).replace("{k}", k + 1).replace("{b}", nm(r.ben)).replace("{d}", ctx.fdate(r.due)), url);
  }
  if (notified.length) setTimeout(() => ctx.toast(t("Avertissement envoyé à {x}", notified.map(nm).join(", "))), toShare.length ? 1800 : 0);
};
Object.assign(DEAL_EN, {
  "Composer {x}": "Dial {x}",  "Scanne ce QR code depuis l'appli Wero ou celle de ta banque.": "Scan this QR code from the Wero app or your bank's app.", "Ouvrir l'appli Wero": "Open the Wero app", "Ou ouvre l'appli de ta banque, rubrique Wero, et envoie le montant à ce numéro ou cet e-mail.": "Or open your bank's app, Wero section, and send the amount to this number or email.", "Ou ouvre l'appli de ta banque, rubrique Wero, et scanne le QR code.": "Or open your bank's app, Wero section, and scan the QR code.", "Ouvrir PayPal": "Open PayPal", "Dans PayPal, choisis « Envoyer » et colle cet e-mail ou ce numéro.": "In PayPal, choose “Send” and paste this email or number.", "Copier le code": "Copy the code", "Le code s'ouvre dans ton téléphone : suis les étapes de ton opérateur. Sur iPhone, compose-le toi-même si le bouton ne marche pas.": "The code opens in your phone: follow your operator's steps. On iPhone, dial it yourself if the button doesn't work.", "Ton nom PayPal.me (le plus pratique)": "Your PayPal.me name (easiest)", "Ou l'e-mail / le téléphone de ton compte PayPal": "Or your PayPal account email / phone", "Avec PayPal.me, le montant est déjà rempli. Sinon, la personne colle ton e-mail dans PayPal.": "With PayPal.me, the amount is pre-filled. Otherwise, they paste your email into PayPal.", "Code pour envoyer de l'argent (facultatif)": "Code to send money (optional)", "Ceux qui te paient pourront le composer d'un geste.": "People paying you can dial it in one tap.", "Dans l'appli Wero ou celle de ta banque (rubrique Wero), affiche ton QR code, fais une capture d'écran et choisis-la ici.": "In the Wero app or your bank's app (Wero section), show your QR code, take a screenshot and choose it here.", "Indique ton numéro, ton e-mail ou ajoute ton QR code Wero": "Enter your number, your email or add your Wero QR code", "Indique ton PayPal.me ou l'e-mail de ton compte": "Enter your PayPal.me or your account email",
  "Petit rappel : ta cotisation de {m} (tour {k}) est à verser à {b} au plus tard le {d} 🙂": "Friendly reminder: your {m} contribution (round {k}) is due to {b} by {d} 🙂", "Petit rappel : merci de régler ta part de {m} 🙂": "Friendly reminder: please pay your {m} share 🙂", "Date butoir dépassée": "Deadline passed", "⚠️ Avertissement : ta cotisation de {m} (tour {k}) devait être réglée au plus tard le {d}. Merci de régulariser au plus vite.": "⚠️ Warning: your {m} contribution (round {k}) was due by {d}. Please settle it as soon as possible.",
  "Choisis comment payer": "Choose how to pay", "Comment payer": "How to pay", "Ouvrir {x}": "Open {x}", "le lien de paiement": "the payment link", "Virement": "Bank transfer", "Le lien s'ouvre dans l'appli concernée si elle est installée, sinon dans le navigateur.": "The link opens in the right app if it's installed, otherwise in your browser.", "S'ouvre dans l'appli {x} si elle est installée, sinon sur le site.": "Opens in the {x} app if it's installed, otherwise on the website.", "Tu paies depuis un autre téléphone ? Scanne ce QR code.": "Paying from another phone? Scan this QR code.",
  "Paiement rapide": "Quick payment", "Virement bancaire": "Bank transfer", "Lien de paiement": "Payment link", "Dans l'appli de ta banque, ouvre Wero et envoie le montant à ce numéro ou cet e-mail.": "In your bank's app, open Wero and send the amount to this number or email.",
  "le jour du tour": "on the day of the round", "{x} jour après la date du tour": "{x} day after the round date", "{x} jours après la date du tour": "{x} days after the round date",
  "Payé ✓": "Paid ✓", "En retard": "Late", "Invitation": "Invitation", "{x} t'invite dans cette cagnotte. Accepte pour la suivre, commenter et voir les versements.": "{x} invited you to this money pot. Accept to follow it, comment and see payments.",
  "Refuser": "Decline", "Accepter": "Accept", "Gérée par {x}": "Managed by {x}", "Clauses de la cagnotte": "Money pot terms", "Date butoir de règlement": "Payment deadline",
  "Partager le lien de la cagnotte": "Share the money pot link", "Cette semaine": "This week", "Ce mois-ci": "This month", "Cette année": "This year", "Tour en cours": "Current round",
  "à régler au plus tard le {x}": "to pay by {x}", "averti 1 fois": "warned once", "averti {x} fois": "warned {x} times", "Avertir": "Warn", "Avertir tous les retardataires ({x})": "Warn everyone who is late ({x})",
  "Membres et ordre des tours": "Members and order of rounds", "invitation envoyée": "invitation sent", "sans l'appli": "no app", "Envoyer son lien": "Send their link", "Retirer": "Remove", "Retirer ?": "Remove?",
  "Ajouter un membre": "Add a member", "Prénom, ou @tag d'un utilisateur Bourselle": "First name, or @tag of a Bourselle user", "Prénom": "First name",
  "Avec l'appli : il reçoit l'invitation dans Bourselle et l'accepte. Sans l'appli : tu lui envoies son lien pour suivre la cagnotte, payer et commenter.": "With the app: they get the invitation in Bourselle and accept it. Without the app: send them their link to follow the pot, pay and comment.",
  "date butoir : {x}": "deadline: {x}", "Accepte l'invitation pour commenter et réagir.": "Accept the invitation to comment and react.",
  "Cagnotte « {x} » : suis les tours et les versements": "Money pot “{x}”: follow the rounds and payments", "Bienvenue dans la cagnotte !": "Welcome to the money pot!", "Invitation refusée": "Invitation declined",
  "Bonjour {x} ! Voici ton lien pour la cagnotte « {t} » ({m} {f}) : tu y vois les tours, qui a payé, et tu peux payer et commenter. Pas besoin d'appli.": "Hi {x}! Here's your link for the money pot “{t}” ({m} {f}): see the rounds and who has paid, pay and comment. No app needed.",
  "Inviter": "Invite", "Ajouter « {x} » (sans l'appli)": "Add “{x}” (no app)", "Invitation envoyée à @{x}": "Invitation sent to @{x}", "{x} est ajouté·e : envoie-lui son lien": "{x} added: send them their link", "Membre retiré": "Member removed",
  "⚠️ Avertissement {x} : ta cotisation de {m} pour « {t} » (tour {k}, pour {b}) devait être réglée au plus tard le {d}. Merci de régulariser au plus vite :": "⚠️ Warning {x}: your {m} contribution for “{t}” (round {k}, to {b}) was due by {d}. Please settle it as soon as possible:",
  "Avertissement envoyé à {x}": "Warning sent to {x}", "Invitation à accepter": "Invitation to accept",
  "Terminée": "Finished", "Tour {x}": "Round {x}", "Inscriptions ouvertes": "Sign-ups open", "par personne": "per person", "{x} membre": "{x} member", "{x} membres": "{x} members", "pot de {x}": "pot of {x}",
  "chaque tour, un membre reçoit le pot de {x}": "each round, one member receives the pot of {x}", "1er tour le {x}": "1st round on {x}",
  "Les inscriptions sont ouvertes. L'ordre des tours (qui reçoit le pot, et quand) sera fixé au démarrage.": "Sign-ups are open. The order of rounds (who gets the pot, and when) will be fixed at the start.",
  "Rejoindre la cagnotte": "Join the money pot", "Ordre des tours": "Order of rounds", "reçoit le pot le {x}": "gets the pot on {x}", "Tirer au sort": "Draw lots", "Démarrer la cagnotte": "Start the money pot",
  "par part": "per share", "{x} parts": "{x} shares", "{x} tours": "{x} rounds", "Membres": "Members", "Président·e": "President", "Trésorier·e": "Treasurer", "Rôle": "Role", "Rôle retiré": "Role removed",
  "{x} parts · verse {y} par tour": "{x} shares · pays {y} per round", "1 part · verse {y} par tour": "1 share · pays {y} per round", "Une part de moins": "One share less", "Une part de plus": "One more share",
  "part {x}/{y}": "share {x}/{y}", "reçoit {m} le {x}": "gets {m} on {x}", "Échanger ce tour": "Swap this round", "Tours {x} et {y} échangés": "Rounds {x} and {y} swapped", "{x} est maintenant {y}": "{x} is now {y}",
  "Touche ⇄ sur un autre tour à venir pour l'échanger avec le tour {x}.": "Tap ⇄ on another upcoming round to swap it with round {x}.", "⇄ : échanger deux tours à venir (par exemple quand deux membres s'arrangent).": "⇄: swap two upcoming rounds (e.g. when two members agree).",
  "☆ : nommer président·e ou trésorier·e. Ils peuvent relancer, avertir, confirmer les versements et échanger des tours.": "☆: appoint a president or treasurer. They can remind, warn, confirm payments and swap rounds.",
  "− / + : nombre de parts (une part de plus = cotiser et recevoir le pot une fois de plus). ☆ : nommer président·e ou trésorier·e.": "− / +: number of shares (one more share = pay and get the pot one more time). ☆: appoint a president or treasurer.",
  "Les tours": "Rounds", "en cours": "current", "{x} reçoit le pot": "{x} gets the pot", "versements reçus": "payments received", "verse {x} à {y}": "pays {x} to {y}",
  "Versé, à confirmer": "Paid, to confirm", "À verser": "To pay", "Confirmer : l'ordre sera fixé": "Confirm: the order will be fixed", "C'est parti : les membres sont prévenus": "It's on: members have been notified",
  "Ordre tiré au sort": "Order drawn", "Relancer": "Remind", "Relancer ceux qui n'ont pas versé": "Remind those who haven't paid", "Rappel envoyé à {x}": "Reminder sent to {x}",
  "Petit rappel 🙂 {x} : ta cotisation de {m} pour « {t} » (tour {k}, le {d}) est à verser à {b}. Pour payer :": "Friendly reminder 🙂 {x}: your {m} contribution for “{t}” (round {k}, on {d}) is due to {b}. To pay:",
  "Petit rappel 🙂 {x} : ta part de {m} pour « {t} » est à régler à {b}. Pour payer :": "Friendly reminder 🙂 {x}: your {m} share for “{t}” is due to {b}. To pay:",
  "Mobile Money": "Mobile Money", "Scanne ce QR code avec ton appli {x}.": "Scan this QR code with your {x} app.", "Envoie le montant depuis ton appli {x} à ce numéro.": "Send the amount from your {x} app to this number.", "Merci ! {x} est prévenu.": "Thanks! {x} has been notified.", "En cours": "Ongoing",
});
// Les cagnottes créées avant (avec un objectif) gardent l'ancien affichage
{
  const _render = DEALUI.render, _card = DEALUI.card;
  DEALUI.render = function (root, S, ctx) { return S.deal && S.deal.ton ? DEALUI.renderTon(root, S, ctx) : _render(root, S, ctx); };
  DEALUI.card = function (d, ctx) { return d.ton ? DEALUI.tonCard(d, ctx) : _card(d, ctx); };
}
