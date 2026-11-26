/* Bourselle — bons plans partenaires.
 * Des marques proposent une promotion (lien, code promo) ou une offre de groupe à paliers (« -10 % à 5, -15 % à 10 »).
 * On rejoint une offre de groupe ; quand le palier est atteint, chaque partant reçoit le code et achète sur le site du
 * partenaire. L'argent ne passe jamais par Bourselle. Seul le propriétaire de Bourselle publie les offres. */
let BPLANS = [], OFF_ADMIN = false, OFF_LEADS = [], offLoaded = false;
const offBase = () => (typeof PLUS_CFG !== "undefined" && PLUS_CFG.api ? PLUS_CFG.api.replace(/\/$/, "") : "");
async function offApi(path, body) {
  if (typeof socOn === "function" && socOn()) return socApi(path, body ? { method: "POST", body: JSON.stringify(body) } : {});
  const r = await fetch(offBase() + path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.error || "erreur"); e.status = r.status; throw e; } return j;
}
async function offRefresh(rerender) {
  if (!offBase()) return;
  try {
    const j = await offApi("/offers"); BPLANS = j.offers || []; OFF_ADMIN = !!j.admin; OFF_LEADS = j.leads || []; offLoaded = true;
    if (!offRefresh.link) { offRefresh.link = true; let id = ""; try { id = sessionStorage.getItem("bourselle-offre") || ""; sessionStorage.removeItem("bourselle-offre"); } catch (e) {} if (id) setTimeout(() => offersOpen(id), 500); }
    if (rerender !== false && typeof tab !== "undefined" && tab === "accueil" && !document.querySelector("#sheet2Root.open")) render();
  } catch (e) {}
}
{ const o = new URLSearchParams(location.search).get("offre"); if (o && /^[a-z0-9]{10}$/.test(o)) { try { sessionStorage.setItem("bourselle-offre", o); } catch (e) {} history.replaceState(null, "", location.pathname); } }

// Bons plans près de chez moi : ma ville reste sur mon appareil (dans mes réglages) ; le tri se fait ici, sans l'envoyer.
const cityKey = c => String(c || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const myCity = () => (settings && settings.myCity) || "";
const offLocal = o => !!o.city && !!myCity() && cityKey(o.city) === cityKey(myCity());
const offVisible = (o, all) => all || !o.city || offLocal(o);
const offSort = l => l.slice().sort((a, b) => offLocal(b) - offLocal(a) || b.featured - a.featured);
function offCityAsk(after) {
  const cities = [...new Set(BPLANS.map(o => o.city).filter(Boolean))].slice(0, 10);
  const f = openForm(`<div class="f2"><h3>📍 Ta ville</h3><p class="hint" style="margin:0 0 8px">Pour te montrer les bons plans des commerces près de chez toi. Ta ville reste sur ton appareil : elle n'est envoyée à personne.</p>
    ${fld("ocCity", "Ville", `maxlength="60" placeholder="ex. Lyon" value="${esc(myCity())}" autocomplete="address-level2"`)}
    ${cities.length ? `<div class="chips" style="margin-top:8px">${cities.map(c => `<button type="button" class="chip" data-oc="${esc(c)}">${esc(c)}</button>`).join("")}</div>` : ""}
    ${myCity() ? `<button type="button" class="linkbtn" id="ocClear" style="margin-top:10px">Ne plus utiliser de ville</button>` : ""}</div>`, () => {
    const c = document.getElementById("ocCity").value.trim().slice(0, 60); settings.myCity = c.charAt(0).toUpperCase() + c.slice(1); saveSettings(); render(); if (after) setTimeout(after, 220);
  });
  f.querySelector("button[type=submit]").textContent = "Enregistrer";
  f.querySelectorAll("[data-oc]").forEach(b => b.onclick = () => { f.querySelector("#ocCity").value = b.dataset.oc; });
  const cl = f.querySelector("#ocClear"); if (cl) cl.onclick = () => { settings.myCity = ""; saveSettings(); closeForm(); render(); if (after) setTimeout(after, 220); };
  setTimeout(() => f.querySelector("#ocCity").focus(), 80);
}
const offPct = o => o.kind === "group" ? `Jusqu'à -${Math.max(...o.tiers.map(t => t.pct))} %` : "";
function offStatus(o) {
  if (o.kind !== "group") return "";
  if (o.unlocked && o.next) return `-${o.unlocked.pct} % débloqué · plus que ${o.next.n - o.count} pour -${o.next.pct} %`;
  if (o.unlocked) return `-${o.unlocked.pct} % débloqué 🎉`;
  return o.next ? `${o.count} partant${o.count > 1 ? "s" : ""} · plus que ${o.next.n - o.count} pour -${o.next.pct} %` : "";
}
function offCardHTML(o, full) {
  const tiers = o.kind === "group" ? `<div class="off-tiers">${o.tiers.map(t => `<span class="${o.count >= t.n ? "on" : ""}"><b>-${t.pct} %</b><small>${t.n} pers.</small></span>`).join("")}</div>
    <div class="act-bar"><i style="width:${Math.min(100, Math.round(o.count / Math.max(...o.tiers.map(t => t.n)) * 100))}%"></i></div><p class="off-st">${esc(offStatus(o))}</p>` : "";
  const code = o.code ? `<div class="off-code"><span>Code</span><b class="num">${esc(o.code)}</b><button type="button" class="linkbtn" data-ocopy="${esc(o.id)}">Copier</button></div>` : "";
  const acts = !full ? "" : o.kind === "group"
    ? (o.joined ? `${o.unlocked ? `${code}<button type="button" class="btn primary" data-ogo="${esc(o.id)}">J'en profite sur le site ›</button>` : `<p class="hint" style="margin:0 0 6px">Tu es partant ✓ Tu recevras le code dès que le palier est atteint.</p>`}
        <div class="fav-btns"><button type="button" class="btn" data-oshare="${esc(o.id)}">Inviter mes proches</button><button type="button" class="btn" data-oleave="${esc(o.id)}">Je ne suis plus partant</button></div>`
      : `<button type="button" class="btn primary" data-ojoin="${esc(o.id)}">🙋 Je suis partant</button><button type="button" class="linkbtn" data-oshare="${esc(o.id)}" style="margin-top:6px">Inviter mes proches</button>`)
    : `${code}${o.url ? `<button type="button" class="btn primary" data-ogo="${esc(o.id)}">J'en profite ›</button>` : ""}<button type="button" class="linkbtn" data-oshare="${esc(o.id)}" style="margin-top:6px">Partager</button>`;
  return `<div class="card off-card${o.featured ? " feat" : ""}" ${full ? `id="off-${esc(o.id)}"` : `data-oopen="${esc(o.id)}" role="button" tabindex="0"`}>
    <div class="off-top"><span class="act-emo">${esc(o.emoji || "🎁")}</span><span class="off-tt"><small><span class="off-tag">Partenaire</span> ${esc(o.partner)}${o.city ? ` · <span class="off-city${offLocal(o) ? " near" : ""}">📍 ${esc(o.city)}</span>` : ""}${o.until ? ` · jusqu'au ${esc(frDate(o.until))}` : ""}</small><b>${esc(o.title)}</b></span>${o.kind === "group" ? `<span class="act-chip warn">Groupe</span>` : ""}</div>
    ${full && o.desc ? `<p class="off-desc">${esc(o.desc)}</p>` : ""}${tiers}${acts}</div>`;
}
// Dans « Partage » : les bons plans mis en avant
function offHubHTML() {
  if (!offLoaded || !BPLANS.length) return OFF_ADMIN ? `<div class="hub-sec"><span>Bons plans</span><button class="linkbtn" data-oall>Gérer ›</button></div>` : "";
  const top = offSort(BPLANS.filter(o => o.status !== "off" && offVisible(o))).slice(0, 2), hasLocal = BPLANS.some(o => o.city);
  return `<div class="hub-sec"><span>Bons plans partenaires</span><button class="linkbtn" data-oall>Voir tout ›</button></div>
    ${hasLocal ? `<button type="button" class="off-where" data-ocity>📍 ${myCity() ? `Près de chez toi : <b>${esc(myCity())}</b> · changer` : "Voir les bons plans près de chez toi ›"}</button>` : ""}${top.map(o => offCardHTML(o, false)).join("")}`;
}
function offHubBind(root) {
  root.querySelectorAll("[data-oall]").forEach(b => b.onclick = () => offersOpen());
  root.querySelectorAll("[data-ocity]").forEach(b => b.onclick = () => offCityAsk());
  root.querySelectorAll("[data-oopen]").forEach(b => b.onclick = () => offersOpen(b.dataset.oopen));
}
function offersOpen(focus, filter) {
  filter = filter || "all";
  const allCities = filter === "cities";
  const list = offSort(BPLANS.filter(o => (OFF_ADMIN || o.status !== "off") && offVisible(o, allCities || (focus && o.id === focus)) && (filter === "all" || filter === "cities" || (filter === "near" ? offLocal(o) : filter === "group" ? o.kind === "group" : o.kind !== "group"))));
  const elsewhere = !allCities && BPLANS.some(o => o.city && !offVisible(o));
  const f = openForm(`<div class="f2 off-sheet"><h3>🎁 Bons plans</h3>
    <button type="button" class="off-where" id="offCity">📍 ${myCity() ? `Près de chez toi : <b>${esc(myCity())}</b> · changer` : "Indique ta ville pour les bons plans près de chez toi ›"}</button>
    <div class="chips" id="offF">${[["all", "Tout"], ...(myCity() ? [["near", "Près de moi"]] : []), ["group", "Offres de groupe"], ["promo", "Codes promo"], ...(BPLANS.some(o => o.city) ? [["cities", "Toutes les villes"]] : [])].map(([k, l]) => `<button type="button" class="chip" data-of="${k}" aria-pressed="${filter === k}">${l}</button>`).join("")}</div>
    ${OFF_ADMIN ? `<button type="button" class="btn" id="offAdmin" style="width:100%;margin-top:10px">⚙️ Gérer les bons plans${OFF_LEADS.length ? ` <i class="badge">${OFF_LEADS.length}</i>` : ""}</button>` : ""}
    <div class="off-list">${list.length ? list.map(o => offCardHTML(o, true)).join("") : `<p class="hint" style="text-align:center;margin:24px 0">${filter === "near" ? `Pas encore de bon plan à ${esc(myCity())}. Tu connais un commerce ? Envoie-lui la page « Devenir partenaire » !` : "Pas encore de bon plan ici. Reviens bientôt !"}</p>`}</div>
    ${elsewhere ? `<button type="button" class="linkbtn" data-of="cities" style="display:block;margin:10px auto 0">Voir aussi les bons plans des autres villes ›</button>` : ""}
    <p class="hint off-legal">Offres de nos partenaires. Tu paies directement le partenaire, sur son site : l'argent ne passe pas par Bourselle. Bourselle peut toucher une commission quand tu achètes via ces liens. Tes données de budget ne sont jamais partagées.</p>
    <button type="button" class="linkbtn" id="offLead" style="display:block;margin:4px auto 0">Tu es une marque ? Propose ton offre ›</button></div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Fermer";
  const reopen = () => { closeForm(); setTimeout(() => offersOpen(focus, filter), 220); };
  f.querySelector("#offCity").onclick = () => { closeForm(); setTimeout(() => offCityAsk(() => offersOpen(null, filter)), 220); };
  f.querySelectorAll("[data-of]").forEach(b => b.onclick = () => { closeForm(); setTimeout(() => offersOpen(null, b.dataset.of), 200); });
  const find = id => BPLANS.find(o => o.id === id);
  const upd = o => { const i = BPLANS.findIndex(x => x.id === o.id); if (i >= 0) BPLANS[i] = o; };
  f.querySelectorAll("[data-ojoin]").forEach(b => b.onclick = async () => {
    if (!(typeof socOn === "function" && socOn())) { toast("Connecte-toi avec Google ou Microsoft pour rejoindre une offre de groupe"); return; }
    try { const r = await offApi("/offers/" + b.dataset.ojoin, { action: "join" }); upd(r.offer); toast(r.offer.code ? `🎉 Débloqué : -${r.offer.unlocked.pct} % !` : "Tu es partant ✓ Invite tes proches pour atteindre le palier"); focus = r.offer.id; reopen(); } catch (e) { toast(e.message); }
  });
  f.querySelectorAll("[data-oleave]").forEach(b => b.onclick = async () => { try { const r = await offApi("/offers/" + b.dataset.oleave, { action: "leave" }); upd(r.offer); reopen(); } catch (e) { toast(e.message); } });
  f.querySelectorAll("[data-ocopy]").forEach(b => b.onclick = () => { const o = find(b.dataset.ocopy); try { navigator.clipboard.writeText(o.code); toast("Code copié"); } catch (e) {} });
  f.querySelectorAll("[data-ogo]").forEach(b => b.onclick = () => {
    const o = find(b.dataset.ogo); if (!o || !o.url) return;
    if (o.code) { try { navigator.clipboard.writeText(o.code); } catch (e) {} }
    const u = o.url + (o.url.includes("?") ? "&" : "?") + "utm_source=bourselle&utm_medium=bonplan";
    window.open(u, "_blank", "noopener");
    offApi("/offers/" + o.id, { action: "click" }).catch(() => {});
    if (o.code) toast("Code copié : colle-le au moment de payer");
  });
  f.querySelectorAll("[data-oshare]").forEach(b => b.onclick = () => {
    const o = find(b.dataset.oshare), url = appBase() + "?offre=" + o.id;
    shareText(o.kind === "group" ? `${o.emoji} ${o.partner} : ${o.title}. ${offPct(o)} si on est assez nombreux, tu es partant ? Rejoins-moi sur Bourselle :` : `${o.emoji} ${o.partner} : ${o.title}${o.code ? ` (code ${o.code})` : ""}`, url, "Lien copié");
  });
  f.querySelector("#offLead").onclick = () => { closeForm(); setTimeout(offLeadForm, 220); };
  const ad = f.querySelector("#offAdmin"); if (ad) ad.onclick = () => { closeForm(); setTimeout(offAdminOpen, 220); };
  if (focus) setTimeout(() => { const el = document.getElementById("off-" + focus); if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("flash"); } }, 120);
  if (focus) offApi("/offers/" + focus, { action: "view" }).catch(() => {});
}
// « Tu es une marque ? » : la proposition arrive chez Bourselle
function offLeadForm() {
  const f = openForm(`<div class="f2"><h3>Devenir partenaire</h3><p class="hint" style="margin:0 0 8px">Proposez une promotion ou une offre de groupe aux utilisateurs de Bourselle. Nous revenons vers vous rapidement.</p>
    ${fld("olCompany", "Marque / entreprise", `maxlength="80"`)}${fld("olContact", "Votre nom", `maxlength="80"`)}${fld("olEmail", "E-mail professionnel", `type="email" maxlength="120"`)}${fld("olSite", "Site web", `maxlength="200" placeholder="https://"`)}${fld("olCity", "Ville (si vous avez une boutique)", `maxlength="60" placeholder="ex. Lyon"`)}
    <label class="lbl" for="olOffer">Votre offre</label><textarea class="field" id="olOffer" rows="3" maxlength="1000" placeholder="ex. -15 % pour un groupe de 10 personnes sur nos séjours"></textarea>
    <label class="chk" style="margin-top:8px"><input type="checkbox" id="olGroup"> C'est une offre de groupe (prix réduit à partir d'un nombre de personnes)</label></div>`, () => {
    const v = id => document.getElementById(id).value.trim();
    (async () => { try { await offApi("/offers/lead", { company: v("olCompany"), contact: v("olContact"), email: v("olEmail"), site: v("olSite"), city: v("olCity"), offer: v("olOffer"), group: document.getElementById("olGroup").checked }); toast("Merci ! Nous revenons vers vous rapidement."); } catch (e) { toast(e.message); setTimeout(offLeadForm, 300); } })();
  });
  f.querySelector("button[type=submit]").textContent = "Envoyer";
}
// Espace propriétaire : publier et suivre les offres, lire les demandes des marques
function offAdminOpen() {
  const f = openForm(`<div class="f2"><h3>⚙️ Gérer les bons plans</h3>
    <button type="button" class="btn primary" id="oaNew" style="width:100%">+ Nouvelle offre</button>
    <span class="lbl">Offres (${BPLANS.length})</span>${BPLANS.map(o => `<button type="button" class="pm-row" data-oaedit="${esc(o.id)}"><span class="pm-t"><b>${esc(o.emoji)} ${esc(o.partner)} · ${esc(o.title)}</b><small>${o.city ? `📍 ${esc(o.city)} · ` : ""}${o.status === "off" ? "En pause · " : ""}${o.kind === "group" ? `${o.count} partants · ` : ""}${o.clicks || 0} clic${(o.clicks || 0) > 1 ? "s" : ""} · ${o.views || 0} vue${(o.views || 0) > 1 ? "s" : ""}${o.until ? ` · jusqu'au ${frDate(o.until)}` : ""}</small></span><span class="pm-chev">›</span></button>`).join("") || `<p class="hint">Aucune offre.</p>`}
    <span class="lbl">Demandes des marques (${OFF_LEADS.length})</span>${OFF_LEADS.map(l => `<div class="card off-lead"><b>${esc(l.company)}</b>${l.city ? ` <small style="display:inline">📍 ${esc(l.city)}</small>` : ""}${l.group ? ` <span class="act-chip warn">Groupe</span>` : ""}<small>${esc(l.contact || "")} · <a href="mailto:${esc(l.email)}">${esc(l.email)}</a>${l.site ? ` · <a href="${esc(/^https?:/.test(l.site) ? l.site : "https://" + l.site)}" target="_blank" rel="noopener">site</a>` : ""} · ${esc(agoText(l.at))}</small><p>${esc(l.offer)}</p><button type="button" class="linkbtn" data-oalead="${esc(l.id)}">Traité ✓</button></div>`).join("") || `<p class="hint">Aucune demande pour l'instant. Partage le formulaire : ${esc(appBase())}g.html#partenaire</p>`}</div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Fermer";
  f.querySelector("#oaNew").onclick = () => { closeForm(); setTimeout(() => offEdit(null), 220); };
  f.querySelectorAll("[data-oaedit]").forEach(b => b.onclick = () => { closeForm(); setTimeout(() => offEdit(BPLANS.find(o => o.id === b.dataset.oaedit)), 220); });
  f.querySelectorAll("[data-oalead]").forEach(b => b.onclick = async () => { try { await offApi("/offers", { leadDone: b.dataset.oalead }); OFF_LEADS = OFF_LEADS.filter(l => l.id !== b.dataset.oalead); closeForm(); setTimeout(offAdminOpen, 220); } catch (e) { toast(e.message); } });
}
function offEdit(o) {
  o = o || { kind: "promo", emoji: "🎁", tiers: [], status: "on" };
  let kind = o.kind;
  const tierRow = (t, i) => `<div class="off-trow"><input class="field" data-tn="${i}" inputmode="numeric" placeholder="${i === 0 ? "ex. 5 pers." : i === 1 ? "ex. 10" : "Pers."}" value="${t.n || ""}"><input class="field" data-tp="${i}" inputmode="decimal" placeholder="${i === 0 ? "-10 %" : i === 1 ? "-15 %" : "-%"}" value="${t.pct || ""}"><input class="field" data-tc="${i}" placeholder="Code" value="${esc(t.code || "")}"></div>`;
  const tiers = (o.tiers.length ? o.tiers : [{}, {}]).concat([{}]);
  const f = openForm(`<div class="f2"><h3>${o.id ? "Modifier l'offre" : "Nouvelle offre"}</h3>
    <div class="seg" id="oeKind"><button type="button" data-k="promo" aria-pressed="${kind !== "group"}">Promo / lien</button><button type="button" data-k="group" aria-pressed="${kind === "group"}">Offre de groupe</button></div>
    <div class="two"><div>${fld("oePartner", "Partenaire", `maxlength="60" value="${esc(o.partner || "")}"`)}</div><div>${fld("oeEmoji", "Icône", `maxlength="4" value="${esc(o.emoji || "🎁")}"`)}</div></div>
    ${fld("oeTitle", "Titre", `maxlength="100" placeholder="ex. Séjour à Lisbonne en groupe" value="${esc(o.title || "")}"`)}
    <label class="lbl" for="oeDesc">Description</label><textarea class="field" id="oeDesc" rows="3" maxlength="800">${esc(o.desc || "")}</textarea>
    ${fld("oeUrl", "Lien (partenaire ou affilié, https://)", `maxlength="500" value="${esc(o.url || "")}"`)}
    <div class="two"><div>${fld("oeCode", "Code promo", `maxlength="30" value="${esc(o.code || "")}"`)}</div><div>${fld("oeUntil", "Jusqu'au", `type="date" value="${esc(o.until || "")}"`)}</div></div>
    <div id="oeTiers" ${kind === "group" ? "" : "hidden"}><span class="lbl">Paliers (personnes, réduction, code donné aux partants)</span>${tiers.map(tierRow).join("")}</div>
    <div class="two"><div>${fld("oeCity", "Ville (vide = partout, en ligne)", `maxlength="60" placeholder="ex. Lyon" value="${esc(o.city || "")}"`)}</div><div>${fld("oeCat", "Catégorie", `maxlength="30" placeholder="Resto, Sport…" value="${esc(o.cat || "")}"`)}</div></div>
    <label class="chk"><input type="checkbox" id="oeFeat" ${o.featured ? "checked" : ""}> Mettre en avant (en tête et dans Partage)</label>
    <label class="chk"><input type="checkbox" id="oeOff" ${o.status === "off" ? "checked" : ""}> En pause (cachée)</label>
    ${o.id ? `<button type="button" class="linkbtn" id="oeDel" style="color:var(--bad);margin-top:10px">Supprimer l'offre</button>` : ""}</div>`, () => {
    const v = id => document.getElementById(id).value.trim();
    const tl = [...document.querySelectorAll("[data-tn]")].map(x => { const i = x.dataset.tn; return { n: parseInt(x.value, 10), pct: parseAmount(document.querySelector(`[data-tp="${i}"]`).value), code: document.querySelector(`[data-tc="${i}"]`).value.trim() }; }).filter(t => t.n >= 2 && t.pct > 0);
    (async () => {
      try {
        await offApi("/offers", { id: o.id || "", kind, partner: v("oePartner"), emoji: v("oeEmoji"), title: v("oeTitle"), desc: v("oeDesc"), url: v("oeUrl"), code: v("oeCode"), until: v("oeUntil"), cat: v("oeCat"), city: v("oeCity"), featured: document.getElementById("oeFeat").checked, status: document.getElementById("oeOff").checked ? "off" : "on", tiers: kind === "group" ? tl : [] });
        await offRefresh(false); render(); toast("Offre enregistrée"); setTimeout(offAdminOpen, 250);
      } catch (e) { toast(e.message); setTimeout(() => offEdit({ ...o, kind, partner: v("oePartner"), title: v("oeTitle"), desc: v("oeDesc"), url: v("oeUrl"), code: v("oeCode"), until: v("oeUntil"), city: v("oeCity"), tiers: tl }), 300); }
    })();
  });
  f.querySelector("button[type=submit]").textContent = "Publier";
  f.querySelectorAll("#oeKind [data-k]").forEach(b => b.onclick = () => { kind = b.dataset.k; f.querySelectorAll("#oeKind [data-k]").forEach(x => x.setAttribute("aria-pressed", x === b)); f.querySelector("#oeTiers").hidden = kind !== "group"; });
  const del = f.querySelector("#oeDel"); if (del) del.onclick = async e => { const q = e.currentTarget; if (!q.dataset.sure) { q.dataset.sure = "1"; q.textContent = "Toucher encore pour supprimer"; return; } try { await offApi("/offers", { id: o.id, delete: true }); await offRefresh(false); closeForm(); render(); toast("Offre supprimée"); setTimeout(offAdminOpen, 250); } catch (err) { toast(err.message); } };
}
