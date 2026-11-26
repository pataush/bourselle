/* Bourselle — bons plans partenaires.
 * Des marques proposent une promotion (lien, code promo) ou une offre de groupe à paliers (« -10 % à 5, -15 % à 10 »).
 * On rejoint une offre de groupe ; quand le palier est atteint, chaque partant reçoit le code et achète sur le site du
 * partenaire. L'argent ne passe jamais par Bourselle. Seul le propriétaire de Bourselle publie les offres. */
let BPLANS = [], OFF_ADMIN = false, OFF_LEADS = [], offLoaded = false, offState = { focus: null, filter: "all" };
const offBase = () => (typeof PLUS_CFG !== "undefined" && PLUS_CFG.api ? PLUS_CFG.api.replace(/\/$/, "") : "");
async function offApi(path, body) {
  if (typeof socOn === "function" && socOn()) return socApi(path, body ? { method: "POST", body: JSON.stringify(body) } : {});
  const r = await fetch(offBase() + path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.error || "erreur"); e.status = r.status; throw e; } return j;
}
async function offRefresh(rerender) {
  if (!offBase()) return;
  try {
    const j = await offApi("/offers"); BPLANS = j.offers || []; OFF_ADMIN = !!j.admin; OFF_LEADS = j.leads || []; offLoaded = true; offBkNews();
    if (!offRefresh.link) { offRefresh.link = true; let id = ""; try { id = sessionStorage.getItem("bourselle-offre") || ""; sessionStorage.removeItem("bourselle-offre"); } catch (e) {} if (id) setTimeout(() => offersOpen(id), 500); }
    { const c = document.getElementById("bonsCnt"), n = BPLANS.filter(o => o.status !== "off" && offVisible(o) && offTimed(o) && offNow(o)).length; if (c) { c.hidden = !n; c.textContent = n; } }
    if (rerender !== false && typeof tab !== "undefined" && ["bons", "partage", "mois"].includes(tab) && !document.querySelector("#sheet2Root.open")) render();
  } catch (e) {}
}
{ const o = new URLSearchParams(location.search).get("offre"); if (o && /^[a-z0-9]{10}$/.test(o)) { try { sessionStorage.setItem("bourselle-offre", o); } catch (e) {} history.replaceState(null, "", location.pathname); } }

// Bons plans près de chez moi : ma ville reste sur mon appareil (dans mes réglages) ; le tri se fait ici, sans l'envoyer.
const cityKey = c => String(c || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const myCity = () => (settings && settings.myCity) || "";
// Mon pays : celui que j'ai choisi, sinon celui de la région du téléphone (ex. fr-FR → FR, fr-BJ → BJ)
const OFF_COUNTRIES = ["FR", "BE", "CH", "LU", "CA", "MC", "BJ", "CI", "SN", "CM", "TG", "BF", "ML", "NE", "GA", "CG", "CD", "GN", "MG", "MA", "DZ", "TN", "HT", "GB", "DE", "ES", "IT", "PT", "US"];
function phoneCountry() { for (const l of [].concat(navigator.languages || [], navigator.language || [])) { const m = /^[a-z]{2,3}[-_]([A-Za-z]{2})\b/.exec(l || ""); if (m) return m[1].toUpperCase(); } try { const r = new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale).region; if (r) return r.toUpperCase(); } catch (e) {} return ""; }
const myCountry = () => (settings && settings.myCountry) || phoneCountry();
const countryName = c => { try { return new Intl.DisplayNames([window.LANG === "en" ? "en" : "fr"], { type: "region" }).of(c); } catch (e) { return c; } };
const flag = c => /^[A-Z]{2}$/.test(c || "") ? String.fromCodePoint(...[...c].map(x => 0x1f1a5 + x.charCodeAt(0))) : "🌍";
const offInCountry = o => !o.country || !myCountry() || o.country === myCountry();
const offLocal = o => !!o.city && !!myCity() && offInCountry(o) && cityKey(o.city) === cityKey(myCity());
// Une offre avec un pays n'apparaît que dans ce pays ; avec une ville, seulement dans cette ville (sauf « Toutes les villes »)
const offVisible = (o, all) => OFF_ADMIN || (offInCountry(o) && (all || !o.city || offLocal(o)));
const offSort = l => l.slice().sort((a, b) => offLocal(b) - offLocal(a) || b.featured - a.featured);
function offCityAsk(after) {
  const cities = [...new Set(BPLANS.filter(o => offInCountry(o)).map(o => o.city).filter(Boolean))].slice(0, 10);
  const cc = myCountry(), list = [...new Set([cc, ...OFF_COUNTRIES].filter(Boolean))];
  const f = openForm(`<div class="f2"><h3>📍 Ta ville</h3><p class="hint" style="margin:0 0 8px">Pour te montrer les bons plans de ton pays et des commerces près de chez toi. Ta ville et ton pays restent sur ton appareil : ils ne sont envoyés à personne.</p>
    <label class="lbl" for="ocCountry">Pays</label><select class="field" id="ocCountry">${list.map(c => `<option value="${c}" ${c === cc ? "selected" : ""}>${flag(c)} ${esc(countryName(c))}</option>`).join("")}</select>
    ${fld("ocCity", "Ville", `maxlength="60" placeholder="ex. Lyon" value="${esc(myCity())}" autocomplete="address-level2"`)}
    ${cities.length ? `<div class="chips" style="margin-top:8px">${cities.map(c => `<button type="button" class="chip" data-oc="${esc(c)}">${esc(c)}</button>`).join("")}</div>` : ""}
    ${myCity() ? `<button type="button" class="linkbtn" id="ocClear" style="margin-top:10px">Ne plus utiliser de ville</button>` : ""}</div>`, () => {
    const c = document.getElementById("ocCity").value.trim().slice(0, 60); settings.myCity = c.charAt(0).toUpperCase() + c.slice(1);
    const k = document.getElementById("ocCountry").value; settings.myCountry = k === phoneCountry() ? "" : k; saveSettings(); render(); if (after) setTimeout(after, 220);
  });
  f.querySelector("button[type=submit]").textContent = "Enregistrer";
  f.querySelectorAll("[data-oc]").forEach(b => b.onclick = () => { f.querySelector("#ocCity").value = b.dataset.oc; });
  const cl = f.querySelector("#ocClear"); if (cl) cl.onclick = () => { settings.myCity = ""; saveSettings(); closeForm(); render(); if (after) setTimeout(after, 220); };
  setTimeout(() => f.querySelector("#ocCity").focus(), 80);
}
// ---------- Créneaux horaires (« -15 % le mardi de 14 h à 16 h ») ----------
const DAYS_FR = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"], DAYS_S = ["", "L", "M", "M", "J", "V", "S", "D"];
const dowOf = d => ((d.getDay() + 6) % 7) + 1;
const hmNow = (d = new Date()) => d.toTimeString().slice(0, 5);
const hFmt = v => v.endsWith(":00") ? `${parseInt(v, 10)} h` : `${parseInt(v, 10)} h ${v.slice(3)}`;
const slotTxt = sl => { const d = sl.days; const run = d.length > 2 && d.every((x, i) => i === 0 || x === d[i - 1] + 1); return `${run ? `du ${DAYS_FR[d[0]]} au ${DAYS_FR[d[d.length - 1]]}` : d.length === 7 ? "tous les jours" : `le ${d.map(x => DAYS_FR[x]).join(", ")}`} de ${hFmt(sl.from)} à ${hFmt(sl.to)}`; };
const offTimed = o => (o.slots || []).length > 0;
function offNow(o, d = new Date()) { const t = hmNow(d), w = dowOf(d); return (o.slots || []).find(sl => sl.days.includes(w) && t >= sl.from && t < sl.to) || null; }
function offLaterToday(o, d = new Date()) { const t = hmNow(d), w = dowOf(d); return (o.slots || []).filter(sl => sl.days.includes(w) && t < sl.from).sort((a, b) => a.from.localeCompare(b.from))[0] || null; }
// Les dates proposées pour réserver : les 14 prochains jours qui tombent sur un créneau
function offBookDates(o) { const out = []; for (let i = 0; i < 15; i++) { const d = new Date(); d.setDate(d.getDate() + i); const w = dowOf(d), sls = o.slots.filter(sl => sl.days.includes(w)); if (!sls.length) continue; const iso = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); const times = []; for (const sl of sls) { let [h, m] = sl.from.split(":").map(Number); for (;;) { const v = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; if (v >= sl.to) break; if (i > 0 || v > hmNow()) times.push(v); m += 30; if (m >= 60) { h++; m -= 60; } } } if (times.length) out.push({ iso, d, times }); } return out; }
const bkDay = iso => { const d = new Date(iso + "T12:00:00"); return d.toLocaleDateString(window.LANG === "en" ? "en-GB" : "fr-FR", { weekday: "short", day: "numeric", month: "short" }); };
const BK_ST = { pending: "en attente de réponse", ok: "confirmée ✓", no: "refusée", cancel: "annulée" };
const offPct = o => o.kind === "group" ? `Jusqu'à -${Math.max(...o.tiers.map(t => t.pct))} %` : "";
function offStatus(o) {
  if (o.kind !== "group") return "";
  if (o.unlocked && o.next) return `-${o.unlocked.pct} % débloqué · plus que ${o.next.n - o.count} pour -${o.next.pct} %`;
  if (o.unlocked) return `-${o.unlocked.pct} % débloqué 🎉`;
  return o.next ? `${o.count} partant${o.count > 1 ? "s" : ""} · plus que ${o.next.n - o.count} pour -${o.next.pct} %` : "";
}
function offBookHTML(o) {
  const mine = (o.mybk || []).filter(x => x.st !== "cancel" && x.date >= new Date(Date.now() - 864e5).toISOString().slice(0, 10));
  return `<div class="off-book">${mine.map(x => `<div class="off-bk ${x.st}"><span>📅 ${esc(bkDay(x.date))} · ${esc(hFmt(x.time))}${x.people > 1 ? ` · ${x.people} pers.` : ""}<small>Réservation ${esc(BK_ST[x.st] || x.st)}${x.msg ? ` · « ${esc(x.msg)} »` : ""}</small></span>${x.st !== "no" ? `<button type="button" class="linkbtn" data-obkx="${esc(o.id)}" data-bid="${esc(x.id)}">Annuler</button>` : ""}</div>`).join("")}
    <button type="button" class="btn" data-obook="${esc(o.id)}" style="width:100%;margin-top:6px">📅 Je réserve</button></div>`;
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
    <div class="off-top"><span class="act-emo">${esc(o.emoji || "🎁")}</span><span class="off-tt"><small><span class="off-tag">Partenaire</span> ${esc(o.partner)}${o.city ? ` · <span class="off-city${offLocal(o) ? " near" : ""}">📍 ${esc(o.city)}</span>` : ""}${o.country && (OFF_ADMIN || o.country !== myCountry()) ? ` · ${flag(o.country)}` : ""}${o.until ? ` · jusqu'au ${esc(frDate(o.until))}` : ""}</small><b>${esc(o.title)}</b></span>${o.kind === "group" ? `<span class="act-chip warn">Groupe</span>` : ""}</div>
    ${offTimed(o) ? `<div class="off-slots">${offNow(o) ? `<span class="off-now">● En ce moment · jusqu'à ${esc(hFmt(offNow(o).to))}</span>` : offLaterToday(o) ? `<span class="off-soon">Aujourd'hui dès ${esc(hFmt(offLaterToday(o).from))}</span>` : ""}${o.slots.map(sl => `<small>🕑 ${esc(slotTxt(sl))}</small>`).join("")}</div>` : ""}
    ${full && o.desc ? `<p class="off-desc">${esc(o.desc)}</p>` : ""}${tiers}${acts}${full && o.book ? offBookHTML(o) : ""}
    ${full && (o.kind !== "group" || o.unlocked && o.joined) ? `<button type="button" class="linkbtn off-used" data-oused="${esc(o.id)}">💰 J'ai utilisé ce bon plan${(() => { const n = savedList().filter(x => x.oid === o.id).reduce((a, x) => a + x.amount, 0); return n ? ` · ${eur(n)} économisés` : ""; })()}</button>` : ""}</div>`;
}
// Dans « Partage » : les bons plans mis en avant
// « En ce moment » : les offres à créneau actives maintenant (ou plus tard aujourd'hui) près de chez moi
function offNowHTML() {
  const vis = BPLANS.filter(o => o.status !== "off" && offTimed(o) && offInCountry(o) && (!o.city || offLocal(o)));
  const now = vis.filter(o => offNow(o)), later = vis.filter(o => !offNow(o) && offLaterToday(o));
  if (!now.length && !later.length) return "";
  const row = (o, on) => `<button type="button" class="off-mini" data-oopen="${esc(o.id)}"><span class="act-emo">${esc(o.emoji || "🎁")}</span><span class="off-tt"><b>${esc(o.title)}</b><small>${esc(o.partner)}${o.city ? ` · 📍 ${esc(o.city)}` : ""}</small></span><span class="${on ? "off-now" : "off-soon"}">${on ? `● jusqu'à ${esc(hFmt(offNow(o).to))}` : `dès ${esc(hFmt(offLaterToday(o).from))}`}</span></button>`;
  return `<div class="hub-sec"><span>En ce moment</span><small>${myCity() ? `près de chez toi` : ""}</small></div><div class="card off-nowlist">${now.map(o => row(o, true)).join("")}${later.slice(0, 3).map(o => row(o, false)).join("")}</div>`;
}
function offHubHTML() {
  if (offLoaded && BPLANS.length) return offNowHTML() + offHubHTML0();
  return offHubHTML0();
}
function offHubHTML0() {
  if (!offLoaded || !BPLANS.length) return OFF_ADMIN ? `<div class="hub-sec"><span>Bons plans</span><button class="linkbtn" data-oall>Gérer ›</button></div>` : "";
  const top = offSort(BPLANS.filter(o => o.status !== "off" && offVisible(o))).slice(0, 2), hasLocal = BPLANS.some(o => o.city || o.country);
  return `<div class="hub-sec"><span>Bons plans partenaires</span><button class="linkbtn" data-oall>Voir tout ›</button></div>
    ${hasLocal ? `<button type="button" class="off-where" data-ocity>${flag(myCountry())} ${myCity() ? `Près de chez toi : <b>${esc(myCity())}</b> · changer` : "Voir les bons plans près de chez toi ›"}</button>` : ""}${top.map(o => offCardHTML(o, false)).join("")}`;
}
function offHubBind(root) {
  root.querySelectorAll("[data-oall]").forEach(b => b.onclick = () => offersOpen());
  root.querySelectorAll("[data-ocity]").forEach(b => b.onclick = () => offCityAsk());
  root.querySelectorAll("[data-oopen]").forEach(b => b.onclick = () => offersOpen(b.dataset.oopen));
}
function offListRender(root, focus, filter) {
  filter = filter || "all";
  const allCities = filter === "cities";
  const list = (filter === "now" ? l => l.slice().sort((a, b) => offLocal(b) - offLocal(a)) : offSort)(BPLANS.filter(o => (OFF_ADMIN || o.status !== "off") && offVisible(o, allCities || (focus && o.id === focus)) && (filter === "all" || filter === "cities" || (filter === "now" ? !!offNow(o) : filter === "near" ? offLocal(o) : filter === "group" ? o.kind === "group" : o.kind !== "group"))));
  const elsewhere = !allCities && BPLANS.some(o => o.city && !offVisible(o));
  root.insertAdjacentHTML("beforeend", `<div class="off-sheet" id="offAll"><div class="hub-sec"><span>Tous les bons plans</span></div>
    <button type="button" class="off-where" id="offCity">${flag(myCountry())} ${myCity() ? `Près de chez toi : <b>${esc(myCity())}</b> · changer` : "Indique ta ville pour les bons plans près de chez toi ›"}</button>
    <div class="chips" id="offF">${[["all", "Tout"], ...(BPLANS.some(o => offTimed(o) && offNow(o)) ? [["now", "En ce moment"]] : []), ...(myCity() ? [["near", "Près de moi"]] : []), ["group", "Offres de groupe"], ["promo", "Codes promo"], ...(BPLANS.some(o => o.city) ? [["cities", "Toutes les villes"]] : [])].map(([k, l]) => `<button type="button" class="chip" data-of="${k}" aria-pressed="${filter === k}">${l}</button>`).join("")}</div>
    ${OFF_ADMIN ? `<button type="button" class="btn" id="offAdmin" style="width:100%;margin-top:10px">⚙️ Gérer les bons plans${OFF_LEADS.length ? ` <i class="badge">${OFF_LEADS.length}</i>` : ""}</button>` : ""}
    <div class="off-list">${list.length ? list.map(o => offCardHTML(o, true)).join("") : `<p class="hint" style="text-align:center;margin:24px 0">${filter === "near" ? `Pas encore de bon plan à ${esc(myCity())}. Tu connais un commerce ? Envoie-lui la page « Devenir partenaire » !` : "Pas encore de bon plan ici. Reviens bientôt !"}</p>`}</div>
    ${elsewhere ? `<button type="button" class="linkbtn" data-of="cities" style="display:block;margin:10px auto 0">Voir aussi les bons plans des autres villes ›</button>` : ""}
    <p class="hint off-legal">Offres de nos partenaires. Tu paies directement le partenaire, sur son site : l'argent ne passe pas par Bourselle. Bourselle peut toucher une commission quand tu achètes via ces liens. Tes données de budget ne sont jamais partagées.</p>
    <button type="button" class="linkbtn" id="offLead" style="display:block;margin:4px auto 0">Tu es une marque ? Propose ton offre ›</button></div>`);
  const f = root;
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
  f.querySelectorAll("[data-oused]").forEach(b => b.onclick = () => { closeForm(); setTimeout(() => offUsed(find(b.dataset.oused), () => offersOpen(b.dataset.oused, filter)), 220); });
  f.querySelectorAll("[data-obook]").forEach(b => b.onclick = () => { if (!(typeof socOn === "function" && socOn())) { toast("Connecte-toi avec Google ou Microsoft pour réserver"); return; } closeForm(); setTimeout(() => offBook(find(b.dataset.obook), () => offersOpen(b.dataset.obook, filter)), 220); });
  f.querySelectorAll("[data-obkx]").forEach(b => b.onclick = async () => { try { const r = await offApi("/offers/" + b.dataset.obkx, { action: "unbook", bid: b.dataset.bid }); const o = find(b.dataset.obkx); o.mybk = r.mybk; focus = o.id; toast("Réservation annulée"); reopen(); } catch (e) { toast(e.message); } });
  f.querySelector("#offLead").onclick = () => { closeForm(); setTimeout(offLeadForm, 220); };
  const ad = f.querySelector("#offAdmin"); if (ad) ad.onclick = () => { closeForm(); setTimeout(offAdminOpen, 220); };
  if (focus) setTimeout(() => { const el = document.getElementById("off-" + focus); if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("flash"); } }, 120);
  offState.focus = null;
  if (focus) offApi("/offers/" + focus, { action: "view" }).catch(() => {});
}
// « Tu es une marque ? » : la proposition arrive chez Bourselle
function offLeadForm() {
  const f = openForm(`<div class="f2"><h3>Devenir partenaire</h3><p class="hint" style="margin:0 0 8px">Proposez une promotion ou une offre de groupe aux utilisateurs de Bourselle. Nous revenons vers vous rapidement.</p>
    ${fld("olCompany", "Marque / entreprise", `maxlength="80"`)}${fld("olContact", "Votre nom", `maxlength="80"`)}${fld("olEmail", "E-mail professionnel", `type="email" maxlength="120"`)}${fld("olSite", "Site web", `maxlength="200" placeholder="https://"`)}${fld("olCity", "Ville (si vous avez une boutique)", `maxlength="60" placeholder="ex. Lyon"`)}
    <label class="lbl" for="olOffer">Votre offre</label><textarea class="field" id="olOffer" rows="3" maxlength="1000" placeholder="ex. -15 % pour un groupe de 10 personnes sur nos séjours"></textarea>
    <label class="chk" style="margin-top:8px"><input type="checkbox" id="olGroup"> C'est une offre de groupe (prix réduit à partir d'un nombre de personnes)</label></div>`, () => {
    const v = id => document.getElementById(id).value.trim();
    (async () => { try { await offApi("/offers/lead", { company: v("olCompany"), contact: v("olContact"), email: v("olEmail"), site: v("olSite"), city: v("olCity"), country: myCountry(), offer: v("olOffer"), group: document.getElementById("olGroup").checked }); toast("Merci ! Nous revenons vers vous rapidement."); } catch (e) { toast(e.message); setTimeout(offLeadForm, 300); } })();
  });
  f.querySelector("button[type=submit]").textContent = "Envoyer";
}
// Espace propriétaire : publier et suivre les offres, lire les demandes des marques
function offAdminOpen() {
  const f = openForm(`<div class="f2"><h3>⚙️ Gérer les bons plans</h3>
    <button type="button" class="btn primary" id="oaNew" style="width:100%">+ Nouvelle offre</button>
    <span class="lbl">Offres (${BPLANS.length})</span>${BPLANS.map(o => `<button type="button" class="pm-row" data-oaedit="${esc(o.id)}"><span class="pm-t"><b>${esc(o.emoji)} ${esc(o.partner)} · ${esc(o.title)}</b><small>${flag(o.country)} ${o.city ? `📍 ${esc(o.city)} · ` : ""}${o.status === "off" ? "En pause · " : ""}${o.kind === "group" ? `${o.count} partants · ` : ""}${o.book ? `📅 ${o.bkPending || 0} demande${(o.bkPending || 0) > 1 ? "s" : ""} en attente · ` : ""}${o.clicks || 0} clic${(o.clicks || 0) > 1 ? "s" : ""} · ${o.views || 0} vue${(o.views || 0) > 1 ? "s" : ""}${o.until ? ` · jusqu'au ${frDate(o.until)}` : ""}</small></span><span class="pm-chev">›</span></button>`).join("") || `<p class="hint">Aucune offre.</p>`}
    <span class="lbl">Demandes des marques (${OFF_LEADS.length})</span>${OFF_LEADS.map(l => `<div class="card off-lead"><b>${esc(l.company)}</b>${l.city || l.country ? ` <small style="display:inline">${l.country ? flag(l.country) + " " : ""}${l.city ? "📍 " + esc(l.city) : ""}</small>` : ""}${l.group ? ` <span class="act-chip warn">Groupe</span>` : ""}<small>${esc(l.contact || "")} · <a href="mailto:${esc(l.email)}">${esc(l.email)}</a>${l.site ? ` · <a href="${esc(/^https?:/.test(l.site) ? l.site : "https://" + l.site)}" target="_blank" rel="noopener">site</a>` : ""} · ${esc(agoText(l.at))}</small><p>${esc(l.offer)}</p><button type="button" class="linkbtn" data-oalead="${esc(l.id)}">Traité ✓</button></div>`).join("") || `<p class="hint">Aucune demande pour l'instant. Partage le formulaire : ${esc(appBase())}g.html#partenaire</p>`}</div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Fermer";
  f.querySelector("#oaNew").onclick = () => { closeForm(); setTimeout(() => offEdit(null), 220); };
  f.querySelectorAll("[data-oaedit]").forEach(b => b.onclick = () => { closeForm(); setTimeout(() => offEdit(BPLANS.find(o => o.id === b.dataset.oaedit)), 220); });
  f.querySelectorAll("[data-oalead]").forEach(b => b.onclick = async () => { try { await offApi("/offers", { leadDone: b.dataset.oalead }); OFF_LEADS = OFF_LEADS.filter(l => l.id !== b.dataset.oalead); closeForm(); setTimeout(offAdminOpen, 220); } catch (e) { toast(e.message); } });
}
const slotRow = (sl, i) => `<div class="off-slot" data-si="${i}"><div class="off-days">${[1, 2, 3, 4, 5, 6, 7].map(d => `<button type="button" data-d="${d}" aria-pressed="${(sl.days || []).includes(d)}" title="${DAYS_FR[d]}">${DAYS_S[d]}</button>`).join("")}</div><input class="field" type="time" data-sf value="${esc(sl.from || "")}" aria-label="De"><span>→</span><input class="field" type="time" data-st value="${esc(sl.to || "")}" aria-label="À"></div>`;
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
    <label class="lbl" for="oeCountry">Pays</label><select class="field" id="oeCountry"><option value="">🌍 Tous les pays (offre internationale en ligne)</option>${[...new Set([o.country, myCountry(), ...OFF_COUNTRIES].filter(Boolean))].map(c => `<option value="${c}" ${c === (o.id ? o.country : myCountry()) ? "selected" : ""}>${flag(c)} ${esc(countryName(c))}</option>`).join("")}</select>
    <div class="two"><div>${fld("oeCity", "Ville (vide = tout le pays)", `maxlength="60" placeholder="ex. Lyon" value="${esc(o.city || "")}"`)}</div><div>${fld("oeCat", "Catégorie", `maxlength="30" placeholder="Resto, Sport…" value="${esc(o.cat || "")}"`)}</div></div>
    <span class="lbl">Créneaux horaires (facultatif : l'offre ne vaut qu'à ces moments)</span><div id="oeSlots">${(o.slots && o.slots.length ? o.slots : []).concat([{ days: [] }]).map((sl, i) => slotRow(sl, i)).join("")}</div>
    <button type="button" class="linkbtn" id="oeSlotAdd">+ Un autre créneau</button>
    <label class="chk"><input type="checkbox" id="oeBook" ${o.book ? "checked" : ""}> Réservation : « Je réserve » sur les créneaux, le commerçant confirme ou refuse</label>
    ${o.id ? `<button type="button" class="btn" id="oePoster" style="width:100%;margin:8px 0">🖨️ Affichette A5 pour la vitrine</button>` : ""}
    ${o.mlink ? `<div class="off-code"><span>Lien commerçant</span><b style="font-size:.8rem;letter-spacing:0;word-break:break-all">${esc(offMerchantLink(o))}</b><button type="button" class="linkbtn" id="oeMl">Partager</button></div>` : ""}
    <label class="chk"><input type="checkbox" id="oeFeat" ${o.featured ? "checked" : ""}> Mettre en avant (en tête et dans Partage)</label>
    <label class="chk"><input type="checkbox" id="oeOff" ${o.status === "off" ? "checked" : ""}> En pause (cachée)</label>
    ${o.id ? `<button type="button" class="linkbtn" id="oeDel" style="color:var(--bad);margin-top:10px">Supprimer l'offre</button>` : ""}</div>`, () => {
    const v = id => document.getElementById(id).value.trim();
    const tl = [...document.querySelectorAll("[data-tn]")].map(x => { const i = x.dataset.tn; return { n: parseInt(x.value, 10), pct: parseAmount(document.querySelector(`[data-tp="${i}"]`).value), code: document.querySelector(`[data-tc="${i}"]`).value.trim() }; }).filter(t => t.n >= 2 && t.pct > 0);
    (async () => {
      try {
        const slots = [...document.querySelectorAll("#oeSlots .off-slot")].map(r => ({ days: [...r.querySelectorAll("[data-d][aria-pressed=true]")].map(x => +x.dataset.d), from: r.querySelector("[data-sf]").value, to: r.querySelector("[data-st]").value })).filter(x => x.days.length && x.from && x.to);
        await offApi("/offers", { id: o.id || "", slots, book: document.getElementById("oeBook").checked, kind, partner: v("oePartner"), emoji: v("oeEmoji"), title: v("oeTitle"), desc: v("oeDesc"), url: v("oeUrl"), code: v("oeCode"), until: v("oeUntil"), cat: v("oeCat"), city: v("oeCity"), country: document.getElementById("oeCountry").value, featured: document.getElementById("oeFeat").checked, status: document.getElementById("oeOff").checked ? "off" : "on", tiers: kind === "group" ? tl : [] });
        await offRefresh(false); render(); toast("Offre enregistrée"); setTimeout(offAdminOpen, 250);
      } catch (e) { toast(e.message); setTimeout(() => offEdit({ ...o, kind, partner: v("oePartner"), title: v("oeTitle"), desc: v("oeDesc"), url: v("oeUrl"), code: v("oeCode"), until: v("oeUntil"), city: v("oeCity"), country: document.getElementById("oeCountry").value, tiers: tl }), 300); }
    })();
  });
  f.querySelector("button[type=submit]").textContent = "Publier";
  const bindSlots = () => f.querySelectorAll("#oeSlots [data-d]").forEach(b => b.onclick = () => b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true"));
  bindSlots(); f.querySelector("#oeSlotAdd").onclick = () => { const box = f.querySelector("#oeSlots"); box.insertAdjacentHTML("beforeend", slotRow({ days: [] }, box.children.length)); bindSlots(); };
  { const pp = f.querySelector("#oePoster"); if (pp) pp.onclick = () => { closeForm(); setTimeout(() => offPoster(o), 220); }; }
  { const ml = f.querySelector("#oeMl"); if (ml) ml.onclick = () => shareText(`${o.partner} : voici votre espace Bourselle pour confirmer ou refuser les réservations de votre offre « ${o.title} ». Gardez ce lien pour vous.`, offMerchantLink(o), "Lien copié"); }
  f.querySelectorAll("#oeKind [data-k]").forEach(b => b.onclick = () => { kind = b.dataset.k; f.querySelectorAll("#oeKind [data-k]").forEach(x => x.setAttribute("aria-pressed", x === b)); f.querySelector("#oeTiers").hidden = kind !== "group"; });
  const del = f.querySelector("#oeDel"); if (del) del.onclick = async e => { const q = e.currentTarget; if (!q.dataset.sure) { q.dataset.sure = "1"; q.textContent = "Toucher encore pour supprimer"; return; } try { await offApi("/offers", { id: o.id, delete: true }); await offRefresh(false); closeForm(); render(); toast("Offre supprimée"); setTimeout(offAdminOpen, 250); } catch (err) { toast(err.message); } };
}

// Réserver un créneau : le commerçant reçoit la demande et la confirme ou la refuse
function offBook(o, back) {
  const dates = offBookDates(o); if (!dates.length) { toast("Plus de créneau disponible ces 15 prochains jours"); return; }
  const u = store && store.user ? store.user() : {};
  const f = openForm(`<div class="f2"><h3>📅 Réserver · ${esc(o.partner)}</h3><p class="hint" style="margin:0 0 8px">${esc(o.title)} · ${o.slots.map(slotTxt).map(esc).join(" ; ")}</p>
    <span class="lbl">Quel jour ?</span><div class="chips" id="bkDays">${dates.map((d, i) => `<button type="button" class="chip" data-di="${i}" aria-pressed="${i === 0}">${esc(bkDay(d.iso))}</button>`).join("")}</div>
    <span class="lbl">À quelle heure ?</span><div class="chips" id="bkTimes"></div>
    <div class="two"><div>${fld("bkPeople", "Nombre de personnes", `type="number" min="1" max="50" value="1"`)}</div><div>${fld("bkName", "À quel nom ?", `maxlength="40" value="${esc(favFirst(u.name || ""))}"`)}</div></div>
    ${fld("bkNote", "Un mot pour le commerçant (facultatif)", `maxlength="200" placeholder="ex. coupe + brushing"`)}
    <p class="hint" style="margin:8px 0 0">${esc(o.partner)} confirme ou refuse ta demande : tu es prévenu dans l'appli.</p></div>`, () => {
    if (!time) { toast("Choisis l'heure"); return false; }
    (async () => {
      try { const r = await offApi("/offers/" + o.id, { action: "book", date: dates[di].iso, time, people: +document.getElementById("bkPeople").value || 1, name: document.getElementById("bkName").value.trim(), note: document.getElementById("bkNote").value.trim() }); o.mybk = r.mybk; offBkSeenMark(); toast(`Demande envoyée à ${o.partner} : tu seras prévenu de sa réponse`); if (back) setTimeout(back, 250); }
      catch (e) { toast(e.message); }
    })();
  });
  f.querySelector("button[type=submit]").textContent = "Envoyer la demande";
  let di = 0, time = "";
  const drawTimes = () => { const box = f.querySelector("#bkTimes"); time = ""; box.innerHTML = dates[di].times.map(t => `<button type="button" class="chip" data-t="${t}" aria-pressed="false">${esc(hFmt(t))}</button>`).join(""); box.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { time = b.dataset.t; box.querySelectorAll("[data-t]").forEach(x => x.setAttribute("aria-pressed", x === b)); }); };
  f.querySelectorAll("#bkDays [data-di]").forEach(b => b.onclick = () => { di = +b.dataset.di; f.querySelectorAll("#bkDays [data-di]").forEach(x => x.setAttribute("aria-pressed", x === b)); drawTimes(); });
  drawTimes();
}
// Réponse du commerçant : un petit mot dès qu'on ouvre l'appli (en plus de la notification)
function offBkSeenMark() { try { localStorage.setItem("bourselle-bk-seen", JSON.stringify(BPLANS.flatMap(o => (o.mybk || []).map(x => x.id + ":" + x.st)))); } catch (e) {} }
function offBkNews() {
  let seen = null; try { seen = JSON.parse(localStorage.getItem("bourselle-bk-seen") || "null"); } catch (e) {}
  const all = BPLANS.flatMap(o => (o.mybk || []).map(x => ({ o, x })));
  if (seen) { const fresh = all.filter(({ x }) => (x.st === "ok" || x.st === "no") && !seen.includes(x.id + ":" + x.st)); if (fresh.length) { const { o, x } = fresh[0]; toast(x.st === "ok" ? `✓ ${o.partner} confirme ta réservation : ${bkDay(x.date)} à ${hFmt(x.time)}` : `${o.partner} ne peut pas te recevoir ${bkDay(x.date)} à ${hFmt(x.time)}${x.msg ? ` : « ${x.msg} »` : ""}`); } }
  offBkSeenMark();
}
// Espace propriétaire : envoyer au commerçant son lien pour traiter les réservations
function offMerchantLink(o) { return appBase() + "g.html#m=" + o.mlink; }

// ---------- Économisé grâce à Bourselle ----------
// Chaque bon plan utilisé s'ajoute (montant noté par moi, gardé dans mon Drive avec mes réglages).
const savedList = () => (settings.saved = Array.isArray(settings.saved) ? settings.saved : []);
const savedTotal = (ym) => savedList().filter(x => !ym || x.date.startsWith(ym)).reduce((a, x) => a + (Number(x.amount) || 0), 0);
const offPctOf = o => o.unlocked ? o.unlocked.pct : (o.tiers && o.tiers.length ? 0 : +((/-\s?(\d+(?:[.,]\d+)?)\s?%/.exec(o.title + " " + (o.desc || "")) || [])[1] || "0").replace(",", "."));
function offUsed(o, back) {
  const pct = offPctOf(o);
  const f = openForm(`<div class="f2"><h3>💰 J'ai utilisé ce bon plan</h3><p class="hint" style="margin:0 0 8px">${esc(o.emoji || "🎁")} ${esc(o.partner)} · ${esc(o.title)}</p>
    <div class="two"><div>${fld("ouPaid", "Prix sans la réduction", `inputmode="decimal" placeholder="ex. 40"`)}</div><div>${fld("ouPct", "Réduction (%)", `inputmode="decimal" value="${pct || ""}"`)}</div></div>
    ${fld("ouSaved", "Économisé", `inputmode="decimal" placeholder="ex. 6"`)}
    <p class="hint" style="margin:6px 0 0">Ça s'ajoute à ton compteur « Économisé grâce à Bourselle ». Reste sur ton appareil et ton Drive.</p></div>`, () => {
    const v = parseAmount(document.getElementById("ouSaved").value);
    if (!(v > 0)) { toast("Indique ce que tu as économisé"); return false; }
    savedList().unshift({ id: newId(), oid: o.id, partner: o.partner, title: o.title, amount: Math.round(v * 100) / 100, date: todayISO() }); saveSettings(); render();
    toast(`+${eur(v)} économisés 🎉 Total : ${eur(savedTotal())}`); if (back) setTimeout(back, 250);
  });
  f.querySelector("button[type=submit]").textContent = "Ajouter à mes économies";
  const calc = () => { const p = parseAmount(f.querySelector("#ouPaid").value), r = parseAmount(f.querySelector("#ouPct").value); if (p > 0 && r > 0) f.querySelector("#ouSaved").value = String(Math.round(p * r) / 100).replace(".", ","); };
  ["#ouPaid", "#ouPct"].forEach(s => f.querySelector(s).addEventListener("input", calc));
  setTimeout(() => f.querySelector("#ouPaid").focus(), 80);
}
function savedOpen() {
  const l = savedList(), ym = todayISO().slice(0, 7);
  const f = openForm(`<div class="f2"><h3>💰 Économisé grâce à Bourselle</h3>
    <div class="today-big"><b class="num">${esc(eur(savedTotal()))}</b><small>en tout · <span class="num">${esc(eur(savedTotal(ym)))}</span> ce mois-ci</small></div>
    ${l.length ? l.map(x => `<div class="act-row"><span class="act-nm"><b>${esc(x.partner)}</b><small>${esc(x.title)} · ${esc(frDate(x.date))}</small></span><span class="num good">+${esc(eur(x.amount))}</span><button type="button" class="linkbtn" data-svx="${esc(x.id)}" aria-label="Retirer">✕</button></div>`).join("")
      : `<p class="hint">Utilise un bon plan, puis appuie sur « J'ai utilisé ce bon plan » : ce que tu économises s'additionne ici.</p>`}
    <button type="button" class="btn" id="svPlans" style="width:100%;margin-top:12px">🎁 Voir les bons plans</button></div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Fermer";
  f.querySelectorAll("[data-svx]").forEach(b => b.onclick = () => { settings.saved = l.filter(x => x.id !== b.dataset.svx); saveSettings(); render(); closeForm(); setTimeout(savedOpen, 220); });
  f.querySelector("#svPlans").onclick = () => { closeForm(); setTimeout(() => offersOpen(), 220); };
}

// ---------- Aujourd'hui (en tête de l'accueil) ----------
// Ce qu'il me reste à dépenser ce mois-ci (et par jour), mes économies, les bons plans actifs près de chez moi.
function todayHTML(t) {
  const now = new Date(), last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), daysLeft = last - now.getDate() + 1;
  const budget = (settings.cats || []).reduce((a, c) => a + (Number(c.budget) || 0), 0);
  const spentB = (settings.cats || []).filter(c => (Number(c.budget) || 0) > 0).reduce((a, c) => a + (t.byCat[c.id] || 0), 0);
  const left = Math.round((budget - spentB) * 100) / 100;
  const nowOffers = BPLANS.filter(o => o.status !== "off" && offTimed(o) && offNow(o) && offInCountry(o) && (!o.city || offLocal(o)));
  const todo = typeof alertsList === "function" ? alertsList().reduce((a, x) => a + x.n, 0) : 0;
  const jour = now.toLocaleDateString(window.LANG === "en" ? "en-GB" : "fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return `<div class="card today"><div class="today-h"><span>Aujourd'hui</span><small>${esc(jour)}</small></div>
    ${budget > 0 ? `<button type="button" class="today-left ${left < 0 ? "bad" : ""}" id="tdBud"><small>${left >= 0 ? "Il te reste à dépenser ce mois-ci" : "Budget du mois dépassé de"}</small><b class="num">${esc(eur(Math.abs(left)))}</b>${left > 0 ? `<small>soit <span class="num">${esc(eur(left / daysLeft))}</span> par jour pendant ${daysLeft} jour${daysLeft > 1 ? "s" : ""}</small>` : ""}</button>`
      : `<button type="button" class="today-left" id="tdBud"><small>Fixe ton budget du mois pour savoir ce qu'il te reste à dépenser chaque jour ›</small></button>`}
    <div class="today-row">
      <button type="button" class="today-chip" id="tdSaved">💰 <span><b class="num">${esc(eur(savedTotal()))}</b><small>économisés grâce à Bourselle</small></span></button>
      ${todo ? `<button type="button" class="today-chip" id="tdTodo">🔔 <span><b>${todo}</b><small>chose${todo > 1 ? "s" : ""} à faire</small></span></button>` : ""}
    </div>
    ${nowOffers.length ? `<div class="today-now"><small class="off-now">● En ce moment près de chez toi</small>${nowOffers.slice(0, 2).map(o => `<button type="button" class="off-mini" data-oopen="${esc(o.id)}"><span class="act-emo">${esc(o.emoji || "🎁")}</span><span class="off-tt"><b>${esc(o.title)}</b><small>${esc(o.partner)}${o.city ? ` · 📍 ${esc(o.city)}` : ""} · jusqu'à ${esc(hFmt(offNow(o).to))}</small></span></button>`).join("")}</div>` : ""}</div>`;
}
function todayBind(root) {
  const on = (s, fn) => { const b = root.querySelector(s); if (b) b.onclick = fn; };
  on("#tdBud", () => { const e = document.getElementById("budEdit"); if (e) e.click(); else window.scrollTo({ top: 400, behavior: "smooth" }); });
  on("#tdSaved", () => savedOpen());
  on("#tdTodo", () => { const b = document.getElementById("bellBtn"); if (b) b.click(); });
  root.querySelectorAll(".today [data-oopen]").forEach(b => b.onclick = () => offersOpen(b.dataset.oopen));
}

// ---------- Affichette A5 pour la vitrine du commerçant ----------
// « -15 % ici avec Bourselle » + QR code vers l'offre. Imprimable (ou enregistrable en PDF) depuis le navigateur.
function offPoster(o) {
  const pct = offPctOf(o) || (o.tiers && o.tiers.length ? Math.max(...o.tiers.map(t => t.pct)) : 0);
  const url = appBase() + "?offre=" + o.id;
  const head0 = pct ? `-${String(pct).replace(".", ",")} % ici avec Bourselle` : "Bon plan ici avec Bourselle";
  const sub0 = o.kind === "group" ? `Venez à plusieurs : ${o.tiers.map(t => `-${t.pct} % dès ${t.n} personnes`).join(", ")}` : (o.slots && o.slots.length ? o.slots.map(slotTxt).join(" ; ").replace(/^./, c => c.toUpperCase()) : o.title);
  const poster = (head, sub) => `<div class="poster"><div class="poster-top">${esc(o.partner)}</div><div class="poster-head">${esc(head)}</div><div class="poster-sub">${esc(sub)}</div>
    <div class="poster-qr">${typeof QR !== "undefined" ? QR.svg(url, { px: 6 }) : ""}</div><div class="poster-how">Scannez avec l'appareil photo de votre téléphone</div>
    <div class="poster-foot"><b>Bourselle</b> · budget, partage entre proches et bons plans près de chez vous · gratuit</div></div>`;
  const f = openForm(`<div class="f2"><h3>🖨️ Affichette A5</h3>
    ${fld("ppHead", "Titre", `maxlength="40" value="${esc(head0)}"`)}${fld("ppSub", "Sous-titre", `maxlength="120" value="${esc(sub0)}"`)}
    <div class="poster-prev" id="ppPrev">${poster(head0, sub0)}</div>
    <p class="hint" style="margin:8px 0 0">Imprime en A5 (ou en A4, puis découpe), ou enregistre en PDF pour l'envoyer au commerçant. Le QR code ouvre l'offre dans Bourselle.</p></div>`, () => {
    let area = document.getElementById("printArea"); if (!area) { area = document.createElement("div"); area.id = "printArea"; document.body.append(area); }
    area.innerHTML = poster(document.getElementById("ppHead").value, document.getElementById("ppSub").value);
    const pg = document.createElement("style"); pg.textContent = "@page { size: A5; margin: 0; }"; document.head.append(pg);
    document.documentElement.classList.add("printing-poster");
    setTimeout(() => { window.print(); setTimeout(() => { document.documentElement.classList.remove("printing-poster"); pg.remove(); }, 800); }, 100);
    return false;
  });
  f.querySelector("button[type=submit]").textContent = "Imprimer / PDF";
  const upd = () => { f.querySelector("#ppPrev").innerHTML = poster(f.querySelector("#ppHead").value, f.querySelector("#ppSub").value); };
  ["#ppHead", "#ppSub"].forEach(s => f.querySelector(s).addEventListener("input", upd));
}

// ---------- Onglet « Bons plans » : grandes cartes en haut, « En ce moment », puis toute la liste avec les filtres ----------
function offersOpen(focus, filter) {
  offState = { focus: focus || null, filter: filter || (focus ? "all" : offState.filter || "all") };
  if (document.querySelector("#sheet2Root.open")) closeForm();
  if (typeof tab !== "undefined" && tab === "bons") { render(); if (!focus) window.scrollTo(0, 0); } else switchTab("bons");
}
function offBigCardHTML(o) {
  const pct = offPctOf(o) || (o.tiers && o.tiers.length ? Math.max(...o.tiers.map(t => t.pct)) : 0), now = offTimed(o) && offNow(o);
  return `<button type="button" class="off-big${now ? " now" : ""}" data-ofocus="${esc(o.id)}"><span class="off-big-top"><span class="off-big-emo">${esc(o.emoji || "🎁")}</span>${now ? `<span class="off-big-now">● En ce moment</span>` : o.kind === "group" ? `<span class="off-big-now grp">Offre de groupe</span>` : ""}</span>
    <span class="off-big-pct">${pct ? `-${String(pct).replace(".", ",")} %` : "Bon plan"}</span><span class="off-big-tt">${esc(o.title)}</span>
    <span class="off-big-p">${esc(o.partner)}${o.city ? ` · 📍 ${esc(o.city)}` : ""}</span></button>`;
}
function renderBons() {
  document.getElementById("periodLabel").textContent = "Bons plans";
  document.getElementById("resCap").textContent = "Économisé grâce à Bourselle";
  const big = document.getElementById("resBig"); big.textContent = eur(savedTotal()); big.className = "big num good";
  document.getElementById("resPill").innerHTML = myCity() ? `<span class="pill" style="background:rgba(255,255,255,.15);color:#fff">${flag(myCountry())} ${esc(myCity())}</span>` : "";
  if (!offLoaded) { view.innerHTML = banner + `<div class="card"><div class="empty">Chargement des bons plans…</div></div>`; if (!offRefresh.busy) { offRefresh.busy = true; offRefresh(false).then(() => { if (tab === "bons") render(); }); } return; }
  const vis = offSort(BPLANS.filter(o => o.status !== "off" && offVisible(o)));
  const top = vis.slice().sort((a, b) => !!(offTimed(b) && offNow(b)) - !!(offTimed(a) && offNow(a)) || offLocal(b) - offLocal(a) || b.featured - a.featured).slice(0, 8);
  view.innerHTML = banner + (top.length ? `<div class="off-carousel">${top.map(offBigCardHTML).join("")}</div>` : "") + offNowHTML();
  offListRender(view, offState.focus, offState.filter);
  view.querySelectorAll("[data-ofocus]").forEach(b => b.onclick = () => { const el = document.getElementById("off-" + b.dataset.ofocus); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); offApi("/offers/" + b.dataset.ofocus, { action: "view" }).catch(() => {}); } });
  view.querySelectorAll(".off-nowlist [data-oopen]").forEach(b => b.onclick = () => offersOpen(b.dataset.oopen));
}
// Dans « Entre proches » : juste un petit rappel vers l'onglet Bons plans
function offTeaserHTML() {
  if (!offLoaded) { if (!offRefresh.busy) { offRefresh.busy = true; offRefresh(false); } return ""; }
  const vis = BPLANS.filter(o => o.status !== "off" && offVisible(o)), now = vis.filter(o => offTimed(o) && offNow(o));
  if (!vis.length) return "";
  return `<button type="button" class="off-teaser" data-oall>🎁 <span>${now.length ? `<b>${now.length} bon${now.length > 1 ? "s" : ""} plan${now.length > 1 ? "s" : ""} en ce moment</b> près de chez toi` : `<b>${vis.length} bon${vis.length > 1 ? "s" : ""} plan${vis.length > 1 ? "s" : ""}</b> pour sortir entre proches`}</span><span class="pm-chev">›</span></button>`;
}
