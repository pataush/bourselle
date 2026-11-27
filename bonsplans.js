/* Bourselle — bons plans partenaires.
 * Des marques proposent une promotion (lien, code promo) ou une offre de groupe à paliers (« -10 % à 5, -15 % à 10 »).
 * On rejoint une offre de groupe ; quand le palier est atteint, chaque partant reçoit le code et achète sur le site du
 * partenaire. L'argent ne passe jamais par Bourselle. Seul le propriétaire de Bourselle publie les offres. */
let OFF_MYINV = 0, OFF_HASREWARD = false;
let BPLANS = [], OFF_ADMIN = false, OFF_LEADS = [], OFF_CATS = ["Resto & bars", "Coiffure & beauté", "Sport & bien-être", "Loisirs & sorties", "Shopping", "Mode", "Maison", "High-tech", "Courses", "Voyage", "Autre"], OFF_INVITES = 0, offLoaded = false, offState = { focus: null, filter: "all", view: "home", mode: "near", cat: "" };
const offBase = () => (typeof PLUS_CFG !== "undefined" && PLUS_CFG.api ? PLUS_CFG.api.replace(/\/$/, "") : "");
async function offApi(path, body) {
  if (typeof socOn === "function" && socOn()) return socApi(path, body ? { method: "POST", body: JSON.stringify(body) } : {});
  const r = await fetch(offBase() + path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.error || "erreur"); e.status = r.status; throw e; } return j;
}
async function offRefresh(rerender) {
  if (!offBase()) return;
  try {
    const lv = typeof funTier === "function" ? funTier() : 0;
    const j = await offApi("/offers" + (lv ? "?lvl=" + lv : "")); BPLANS = j.offers || []; OFF_ADMIN = !!j.admin; OFF_LEADS = j.leads || []; if (j.cats) OFF_CATS = j.cats; OFF_INVITES = j.invites || 0; OFF_MYINV = j.myInv || 0; OFF_HASREWARD = !!j.hasReward; offLoaded = true; offBkNews();
    if (!offRefresh.link) { offRefresh.link = true; let id = ""; try { id = sessionStorage.getItem("bourselle-offre") || ""; sessionStorage.removeItem("bourselle-offre"); } catch (e) {} if (id) setTimeout(() => offersOpen(id), 500); let ad = ""; try { ad = sessionStorage.getItem("bourselle-offadmin"); sessionStorage.removeItem("bourselle-offadmin"); } catch (e) {} if (ad && OFF_ADMIN) setTimeout(offAdminOpen, 600); }
    { const c = document.getElementById("bonsCnt"), n = BPLANS.filter(o => o.status !== "off" && offVisible(o) && offTimed(o) && offNow(o)).length; if (c) { c.hidden = !n; c.textContent = n; } }
    bonsNavSync();
    if (rerender !== false && typeof tab !== "undefined" && ["bons", "partage", "mois", "home"].includes(tab) && !document.querySelector("#sheet2Root.open")) render();
  } catch (e) {}
}
{ const q = new URLSearchParams(location.search); if (q.get("offres") === "admin") { try { sessionStorage.setItem("bourselle-offadmin", "1"); } catch (e) {} history.replaceState(null, "", location.pathname); } }
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
  const sq = o.squad, live = sq && !sq.expired;
  const sqBox = !sq ? "" : sq.st === "inv" && !sq.expired
    ? `<div class="sq-box inv"><b>${esc(favFirst(sq.ownerName))} t'invite</b><small>Il faut ${sq.n} partants · déjà ${sq.in} · ${esc(sqLeft(sq))}</small><div class="dm-cta"><button type="button" class="btn primary" data-sqok="${esc(o.id)}">🙋 Je suis partant</button><button type="button" class="btn" data-sqno="${esc(o.id)}">Non merci</button></div></div>`
    : `<div class="sq-box${sq.reached ? " ok" : sq.expired ? " exp" : ""}"><div class="sq-h"><b>${sq.reached ? "🎉 Groupe complet" : sq.expired ? "Délai dépassé" : `${sq.in} sur ${sq.n} partants`}</b><small>${sq.expired ? "Le groupe n'a pas été réuni à temps." : sq.reached ? `${sq.in} partants` : esc(sqLeft(sq))}</small></div>
      <div class="act-bar"><i style="width:${Math.min(100, Math.round(sq.in / sq.n * 100))}%"></i></div>
      <div class="sq-mem">${sq.members.map(m => `<span class="${m.st}">${m.st === "in" ? "✓" : m.st === "inv" ? "…" : "✕"} ${esc(favFirst(m.name || m.tag))}</span>`).join("")}</div>
      <div class="sq-acts">${live && !sq.reached ? `<button type="button" class="btn" data-sqinv="${esc(o.id)}">+ Inviter</button><button type="button" class="btn" data-sqlink="${esc(sq.gc)}">🔗 Sans l'appli</button>` : ""}${sq.gc ? `<button type="button" class="btn" data-sqchat="${esc(sq.gc)}">💬 Discussion</button>` : ""}${sq.reached && o.book && !sq.booked ? `<button type="button" class="btn primary" data-sqbook="${esc(o.id)}">📅 Réserver pour le groupe</button>` : ""}${sq.expired ? `<button type="button" class="btn primary" data-sqnew="${esc(o.id)}">Relancer un groupe</button>` : ""}</div>
      ${live ? `<button type="button" class="linkbtn" data-sqleave="${esc(o.id)}" style="margin-top:6px">Quitter le groupe</button>` : ""}</div>`;
  const acts = !full ? "" : o.kind === "group"
    ? `${sqBox}${o.code ? `${code}${o.url ? `<button type="button" class="btn primary" data-ogo="${esc(o.id)}">J'en profite sur le site ›</button>` : ""}` : ""}
       ${!sq || (sq.expired && false) ? `<button type="button" class="btn primary" data-sqnew="${esc(o.id)}">🙋 Je suis partant · je réunis mes amis</button>` : ""}<button type="button" class="btn" data-ogt="${esc(o.id)}" style="width:100%;margin-top:6px">👥 Y aller ensemble</button><button type="button" class="linkbtn" data-oshare="${esc(o.id)}" style="margin-top:6px">Partager le lien</button>`
    : `${code}${o.url ? `<button type="button" class="btn primary" data-ogo="${esc(o.id)}">J'en profite ›</button>` : ""}<button type="button" class="btn" data-ogt="${esc(o.id)}" style="width:100%;margin-top:6px">👥 Y aller ensemble</button><button type="button" class="linkbtn" data-oshare="${esc(o.id)}" style="margin-top:6px">Partager</button>`;
  const stars = o.rating && o.rating.n ? `<span class="off-rate">★ ${String(o.rating.avg).replace(".", ",")} <small>(${o.rating.n})</small></span>` : "";
  const revs = full && o.reviews && o.reviews.length ? `<details class="off-revs"><summary>Avis (${o.rating.n})</summary>${o.reviews.map(r => `<div class="off-rev"><b>${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)}</b> <span>${esc(r.name)}</span>${r.text ? `<p>${esc(r.text)}</p>` : ""}</div>`).join("")}</details>` : "";
  const canReview = full && typeof socOn === "function" && socOn() && (o.joined || (o.mybk || []).some(x => x.st === "ok") || savedList().some(x => x.oid === o.id) || (sq && sq.booked));
  return `<div class="card off-card${o.featured ? " feat" : ""}" ${full ? `id="off-${esc(o.id)}"` : `data-oopen="${esc(o.id)}" role="button" tabindex="0"`}>
    <div class="off-top"><span class="act-emo">${esc(o.emoji || "🎁")}</span><span class="off-tt"><small><span class="off-tag">Partenaire</span> ${esc(o.partner)}${o.city ? ` · <span class="off-city${offLocal(o) ? " near" : ""}">📍 ${esc(o.city)}</span>` : ""}${o.country && (OFF_ADMIN || o.country !== myCountry()) ? ` · ${flag(o.country)}` : ""}${o.until ? ` · jusqu'au ${esc(frDate(o.until))}` : ""}</small><b>${esc(o.title)}</b>${stars}</span>${o.kind === "group" ? `<span class="act-chip warn">Groupe</span>` : ""}</div>
    ${offTimed(o) ? `<div class="off-slots">${offNow(o) ? `<span class="off-now">● En ce moment · jusqu'à ${esc(hFmt(offNow(o).to))}</span>` : offLaterToday(o) ? `<span class="off-soon">Aujourd'hui dès ${esc(hFmt(offLaterToday(o).from))}</span>` : ""}${o.slots.map(sl => `<small>🕑 ${esc(slotTxt(sl))}</small>`).join("")}</div>` : ""}
    ${full && o.desc ? `<p class="off-desc">${esc(o.desc)}</p>` : ""}${tiers}${acts}${full && o.book ? offBookHTML(o) : ""}
    ${revs}${canReview ? `<button type="button" class="linkbtn off-used" data-orev="${esc(o.id)}">${o.myReview ? `⭐ Ton avis : ${"★".repeat(o.myReview.stars)}` : "⭐ Donner mon avis"}</button>` : ""}
    ${full && (o.kind !== "group" || o.code) ? `<button type="button" class="linkbtn off-used" data-oused="${esc(o.id)}">💰 J'ai utilisé ce bon plan${(() => { const n = savedList().filter(x => x.oid === o.id).reduce((a, x) => a + x.amount, 0); return n ? ` · ${eur(n)} économisés` : ""; })()}</button>` : ""}</div>`;
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
// Les boutons d'une offre (code, réserver, groupe, avis…), dans la liste comme dans une fiche
function offBindActs(root, focus, filter) {
  const f = root;
  const reopen = () => { closeForm(); setTimeout(() => offersOpen(focus, filter), 220); };
  { const c = f.querySelector("#offCity"); if (c) c.onclick = () => { closeForm(); setTimeout(() => offCityAsk(() => offersOpen(null, filter)), 220); }; }
  f.querySelectorAll("[data-of]").forEach(b => b.onclick = () => { closeForm(); setTimeout(() => offersOpen(null, b.dataset.of), 200); });
  const find = id => BPLANS.find(o => o.id === id);
  const upd = o => { const i = BPLANS.findIndex(x => x.id === o.id); if (i >= 0) BPLANS[i] = o; };
  const sqAct = async (id, body, msg) => { try { const r = await offApi("/offers/" + id, body); if (r.offer) upd({ ...find(id), ...r.offer }); if (msg) toast(msg); focus = id; reopen(); if (typeof ensRefresh === "function") ensRefresh(); } catch (e) { toast(e.message); } };
  f.querySelectorAll("[data-sqnew]").forEach(b => b.onclick = () => { if (!(typeof socOn === "function" && socOn())) { toast("Connecte-toi avec Google ou Microsoft pour réunir tes amis"); return; } squadNew(find(b.dataset.sqnew), () => offersOpen(b.dataset.sqnew, filter)); });
  f.querySelectorAll("[data-sqok]").forEach(b => b.onclick = () => sqAct(b.dataset.sqok, { action: "sqaccept", name: (typeof ensName === "function" ? ensName() : "") }, "Tu es partant ✓"));
  f.querySelectorAll("[data-sqno]").forEach(b => b.onclick = () => sqAct(b.dataset.sqno, { action: "sqdecline" }));
  f.querySelectorAll("[data-sqleave]").forEach(b => b.onclick = e => { const q = e.currentTarget; if (!q.dataset.sure) { q.dataset.sure = "1"; q.textContent = "Toucher encore pour quitter le groupe"; return; } sqAct(b.dataset.sqleave, { action: "sqleave" }, "Tu as quitté le groupe"); });
  f.querySelectorAll("[data-sqchat]").forEach(b => b.onclick = () => gcOpen(b.dataset.sqchat));
  f.querySelectorAll("[data-sqlink]").forEach(b => b.onclick = () => chatInvite({ ref: { gid: b.dataset.sqlink }, d: { msgs: [] }, name: "" }));
  f.querySelectorAll("[data-ogt]").forEach(b => b.onclick = () => goTogether(find(b.dataset.ogt)));
  f.querySelectorAll("[data-sqinv]").forEach(b => b.onclick = () => squadInvite(find(b.dataset.sqinv), () => offersOpen(b.dataset.sqinv, filter)));
  f.querySelectorAll("[data-sqbook]").forEach(b => b.onclick = () => { const o = find(b.dataset.sqbook); offBook(o, () => offersOpen(o.id, filter), o.squad); });
  f.querySelectorAll("[data-orev]").forEach(b => b.onclick = () => offReview(find(b.dataset.orev), () => offersOpen(b.dataset.orev, filter)));
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
}
function offListRender(root, focus, filter) {
  filter = filter || "all";
  const allCities = filter === "cities";
  const list = (filter === "now" ? l => l.slice().sort((a, b) => offLocal(b) - offLocal(a)) : offSort)(BPLANS.filter(o => (OFF_ADMIN || o.status !== "off") && offVisible(o, allCities || (focus && o.id === focus)) && (filter === "all" || filter === "cities" || (filter === "now" ? !!offNow(o) : filter === "near" ? offLocal(o) : filter === "group" ? o.kind === "group" : filter === "promo" ? !!o.code : true))));
  const elsewhere = !allCities && BPLANS.some(o => o.city && !offVisible(o));
  root.insertAdjacentHTML("beforeend", `<div class="off-sheet" id="offAll"><div class="hub-sec"><span>Tous les bons plans</span></div>
    <button type="button" class="off-where" id="offCity">${flag(myCountry())} ${myCity() ? `Près de chez toi : <b>${esc(myCity())}</b> · changer` : "Indique ta ville pour les bons plans près de chez toi ›"}</button>
    <div class="chips" id="offF">${[["all", "Tout"], ...(BPLANS.some(o => offTimed(o) && offNow(o)) ? [["now", "En ce moment"]] : []), ...(myCity() ? [["near", "Près de moi"]] : []), ["group", "Offres de groupe"], ["promo", "Codes promo"], ...(BPLANS.some(o => o.city) ? [["cities", "Toutes les villes"]] : [])].map(([k, l]) => `<button type="button" class="chip" data-of="${k}" aria-pressed="${filter === k}">${l}</button>`).join("")}</div>
    ${OFF_ADMIN ? `<button type="button" class="btn" id="offAdmin" style="width:100%;margin-top:10px">⚙️ Gérer les bons plans${OFF_LEADS.length ? ` <i class="badge">${OFF_LEADS.length}</i>` : ""}</button>` : ""}
    <div class="off-list">${list.length ? list.map(o => offCardHTML(o, true)).join("") : `<p class="hint" style="text-align:center;margin:24px 0">${filter === "near" ? `Pas encore de bon plan à ${esc(myCity())}. Tu connais un commerce ? Envoie-lui la page « Devenir partenaire » !` : filter === "group" ? `Pas encore d'offre de groupe${myCity() ? ` à ${esc(myCity())}` : ""}. ${BPLANS.some(o => o.kind === "group" && o.status !== "off") ? "Il y en a dans d'autres villes : touche « Voir aussi les bons plans des autres villes »." : "Reviens bientôt !"}` : filter === "promo" ? `Pas encore de code promo${myCity() ? ` à ${esc(myCity())}` : ""}. ${BPLANS.some(o => o.code && o.status !== "off") ? "Il y en a dans d'autres villes : touche « Voir aussi les bons plans des autres villes »." : "Reviens bientôt !"}` : "Pas encore de bon plan ici. Reviens bientôt !"}</p>`}</div>
    ${elsewhere ? `<button type="button" class="linkbtn" data-of="cities" style="display:block;margin:10px auto 0">Voir aussi les bons plans des autres villes ›</button>` : ""}
    <p class="hint off-legal">Offres de nos partenaires. Tu paies directement le partenaire, sur son site : l'argent ne passe pas par Bourselle. Bourselle peut toucher une commission quand tu achètes via ces liens. Tes données de budget ne sont jamais partagées.</p>
    <button type="button" class="linkbtn" id="offLead" style="display:block;margin:4px auto 0">Tu es une marque ? Propose ton offre ›</button></div>`);
  offBindActs(root, focus, filter);
  const f = root;
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
    ${OFF_INVITES ? `<p class="hint" style="margin:8px 0 0">👥 Nouveaux comptes venus d'une invitation : <b>${OFF_INVITES}</b></p>` : ""}
    <span class="lbl">Offres (${BPLANS.length})</span>${BPLANS.map(o => `<div class="oa-row"><button type="button" class="pm-row" data-oaedit="${esc(o.id)}"><span class="pm-t"><b>${esc(o.emoji)} ${esc(o.partner)} · ${esc(o.title)}</b><small>${flag(o.country)} ${o.city ? `📍 ${esc(o.city)} · ` : ""}${o.status === "off" ? "En pause · " : ""}${o.kind === "group" ? `${o.count} partants · ` : ""}${o.book ? `📅 ${o.bkPending || 0} demande${(o.bkPending || 0) > 1 ? "s" : ""} en attente · ` : ""}${o.clicks || 0} clic${(o.clicks || 0) > 1 ? "s" : ""} · ${o.views || 0} vue${(o.views || 0) > 1 ? "s" : ""}${o.until ? ` · jusqu'au ${frDate(o.until)}` : ""}</small></span><span class="pm-chev">›</span></button>${o.mlink ? `<button type="button" class="linkbtn" data-oaml="${esc(o.id)}">📊 Envoyer son espace au commerçant</button>` : ""}</div>`).join("") || `<p class="hint">Aucune offre.</p>`}
    <span class="lbl">Demandes des marques (${OFF_LEADS.length})</span>${OFF_LEADS.map(l => `<div class="card off-lead"><b>${esc(l.company)}</b>${l.city || l.country ? ` <small style="display:inline">${l.country ? flag(l.country) + " " : ""}${l.city ? "📍 " + esc(l.city) : ""}</small>` : ""}${l.group ? ` <span class="act-chip warn">Groupe</span>` : ""}<small>${esc(l.contact || "")} · <a href="mailto:${esc(l.email)}">${esc(l.email)}</a>${l.site ? ` · <a href="${esc(/^https?:/.test(l.site) ? l.site : "https://" + l.site)}" target="_blank" rel="noopener">site</a>` : ""} · ${esc(agoText(l.at))}</small><p>${esc(l.offer)}</p>${l.draft ? `<p class="hint" style="margin:0 0 6px">📝 Offre saisie par la marque : <b>${esc(l.draft.title || "")}</b>${l.draft.kind === "group" ? ` · groupe (${(l.draft.tiers || []).map(t => `-${t.pct} % à ${t.n}`).join(", ")})` : l.draft.code ? ` · code ${esc(l.draft.code)}` : ""}${(l.draft.slots || []).length ? " · créneaux" : ""}</p>` : ""}
      <div class="dm-cta">${l.draft ? `<button type="button" class="btn primary" data-oapub="${esc(l.id)}">✓ Valider et publier</button>` : ""}<button type="button" class="btn${l.draft ? "" : " primary"}" data-oamake="${esc(l.id)}">${l.draft ? "Vérifier" : "Créer l'offre"}</button></div><button type="button" class="linkbtn" data-oalead="${esc(l.id)}" style="margin-top:6px">Traité ✓ (retirer)</button></div>`).join("") || `<p class="hint">Aucune demande pour l'instant. Partage le formulaire : ${esc(appBase())}g.html#partenaire</p>`}</div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Fermer";
  f.querySelector("#oaNew").onclick = () => { closeForm(); setTimeout(() => offEdit(null), 220); };
  f.querySelectorAll("[data-oaedit]").forEach(b => b.onclick = () => { closeForm(); setTimeout(() => offEdit(BPLANS.find(o => o.id === b.dataset.oaedit)), 220); });
  const lead = id => OFF_LEADS.find(l => l.id === id);
  f.querySelectorAll("[data-oamake]").forEach(b => b.onclick = () => { const l = lead(b.dataset.oamake), d = l.draft || {};
    closeForm(); setTimeout(() => offEdit({ ...d, partner: l.company, title: d.title || l.offer.slice(0, 100), desc: d.desc || l.offer, url: d.url || (/^https:\/\//.test(l.site) ? l.site : ""), city: d.city || l.city, country: d.country || l.country, kind: d.kind || (l.group ? "group" : "promo"), emoji: d.emoji || "🎁", tiers: d.tiers || [], slots: d.slots || [], status: "on", fromLeadId: l.id, contact: l.email }), 220); });
  f.querySelectorAll("[data-oapub]").forEach(b => b.onclick = async () => { const l = lead(b.dataset.oapub);
    try { const r = await offApi("/offers", { fromLead: l.id }); await offRefresh(false); closeForm(); render(); toast(`${l.company} : offre publiée ✓`); setTimeout(() => offMerchantSend(r.offer, l.email), 250); } catch (e) { toast(e.message); } });
  f.querySelectorAll("[data-oaml]").forEach(b => b.onclick = () => { const o = BPLANS.find(x => x.id === b.dataset.oaml); offMerchantSend(o, o.contact || ""); });
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
    <label class="toggle" for="oeOnline" style="margin-top:8px"><span>🛒 Code promo en ligne<small class="hint" style="display:block">Pour les achats sur internet : valable partout, sans ville</small></span><input type="checkbox" id="oeOnline" ${o.online || (o.code && o.url && !o.city && !(o.slots && o.slots.length) && o.kind !== "group") ? "checked" : ""}></label>
    <div id="oeTiers" ${kind === "group" ? "" : "hidden"}><span class="lbl">Paliers (personnes, réduction, code donné aux partants)</span>${tiers.map(tierRow).join("")}
      ${fld("oeDays", "Délai pour réunir un groupe (jours)", `type="number" min="1" max="60" value="${esc(o.groupDays || 7)}"`)}</div>
    <label class="lbl" for="oeCountry">Pays</label><select class="field" id="oeCountry"><option value="">🌍 Tous les pays (offre internationale en ligne)</option>${[...new Set([o.country, myCountry(), ...OFF_COUNTRIES].filter(Boolean))].map(c => `<option value="${c}" ${c === (o.id ? o.country : myCountry()) ? "selected" : ""}>${flag(c)} ${esc(countryName(c))}</option>`).join("")}</select>
    <div class="two"><div>${fld("oeCity", "Ville (vide = tout le pays)", `maxlength="60" placeholder="ex. Lyon" value="${esc(o.city || "")}"`)}</div><div><label class="lbl" for="oeCat">Catégorie</label><select class="field" id="oeCat"><option value="">—</option>${OFF_CATS.map(c => `<option ${o.cat === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div></div>
    <span class="lbl">Créneaux horaires (facultatif : l'offre ne vaut qu'à ces moments)</span><div id="oeSlots">${(o.slots && o.slots.length ? o.slots : []).concat([{ days: [] }]).map((sl, i) => slotRow(sl, i)).join("")}</div>
    <button type="button" class="linkbtn" id="oeSlotAdd">+ Un autre créneau</button>
    <label class="chk"><input type="checkbox" id="oeBook" ${o.book ? "checked" : ""}> Réservation : « Je réserve » sur les créneaux, le commerçant confirme ou refuse</label>
    ${o.id ? `<button type="button" class="btn" id="oePoster" style="width:100%;margin:8px 0">🖨️ Affichette A5 pour la vitrine</button>` : ""}
    ${o.mlink ? `<div class="off-code"><span>Lien commerçant</span><b style="font-size:.8rem;letter-spacing:0;word-break:break-all">${esc(offMerchantLink(o))}</b><button type="button" class="linkbtn" id="oeMl">Partager</button></div>` : ""}
    <label class="chk"><input type="checkbox" id="oeReward" ${o.reward ? "checked" : ""}> Récompense de parrainage (visible seulement après 3 amis invités)</label>
    <label class="lbl" for="oeLvl">Récompense de badges</label><select class="field" id="oeLvl">${[0, 1, 2, 3, 4, 5].map(n => `<option value="${n}"${(o.lvl || 0) === n ? " selected" : ""}>${n ? "Palier " + n + " (après " + n * 10 + " badges)" : "Non : offre normale"}</option>`).join("")}</select>
    <label class="chk"><input type="checkbox" id="oeFeat" ${o.featured ? "checked" : ""}> Mettre en avant (en tête et dans Partage)</label>
    <label class="chk"><input type="checkbox" id="oeOff" ${o.status === "off" ? "checked" : ""}> En pause (cachée)</label>
    ${o.id ? `<button type="button" class="linkbtn" id="oeDel" style="color:var(--bad);margin-top:10px">Supprimer l'offre</button>` : ""}</div>`, () => {
    const v = id => document.getElementById(id).value.trim();
    const tl = [...document.querySelectorAll("[data-tn]")].map(x => { const i = x.dataset.tn; return { n: parseInt(x.value, 10), pct: parseAmount(document.querySelector(`[data-tp="${i}"]`).value), code: document.querySelector(`[data-tc="${i}"]`).value.trim() }; }).filter(t => t.n >= 2 && t.pct > 0);
    (async () => {
      try {
        const slots = [...document.querySelectorAll("#oeSlots .off-slot")].map(r => ({ days: [...r.querySelectorAll("[data-d][aria-pressed=true]")].map(x => +x.dataset.d), from: r.querySelector("[data-sf]").value, to: r.querySelector("[data-st]").value })).filter(x => x.days.length && x.from && x.to);
        await offApi("/offers", { id: o.id || "", slots, book: document.getElementById("oeBook").checked, kind, partner: v("oePartner"), emoji: v("oeEmoji"), title: v("oeTitle"), desc: v("oeDesc"), url: v("oeUrl"), code: v("oeCode"), until: v("oeUntil"), cat: document.getElementById("oeCat").value, groupDays: +v("oeDays") || 7, fromLeadId: o.fromLeadId || "", contact: o.contact || "", city: v("oeCity"), country: document.getElementById("oeCountry").value, online: document.getElementById("oeOnline").checked, featured: document.getElementById("oeFeat").checked, reward: document.getElementById("oeReward").checked, lvl: +document.getElementById("oeLvl").value, status: document.getElementById("oeOff").checked ? "off" : "on", tiers: kind === "group" ? tl : [] });
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
function offBook(o, back, sq) {
  const dates = offBookDates(o); if (!dates.length) { toast("Plus de créneau disponible ces 15 prochains jours"); return; }
  const u = store && store.user ? store.user() : {};
  const f = openForm(`<div class="f2"><h3>📅 Réserver · ${esc(o.partner)}</h3><p class="hint" style="margin:0 0 8px">${esc(o.title)} · ${o.slots.map(slotTxt).map(esc).join(" ; ")}${sq ? ` · <b>pour le groupe (${sq.in} personnes)</b>` : ""}</p>
    <span class="lbl">Quel jour ?</span><div class="chips" id="bkDays">${dates.map((d, i) => `<button type="button" class="chip" data-di="${i}" aria-pressed="${i === 0}">${esc(bkDay(d.iso))}</button>`).join("")}</div>
    <span class="lbl">À quelle heure ?</span><div class="chips" id="bkTimes"></div>
    <div class="two"><div>${fld("bkPeople", "Nombre de personnes", `type="number" min="1" max="50" value="1"`)}</div><div>${fld("bkName", "À quel nom ?", `maxlength="40" value="${esc(favFirst(u.name || ""))}"`)}</div></div>
    ${fld("bkNote", "Un mot pour le commerçant (facultatif)", `maxlength="200" placeholder="ex. coupe + brushing"`)}
    <p class="hint" style="margin:8px 0 0">${esc(o.partner)} confirme ou refuse ta demande : tu es prévenu dans l'appli.</p></div>`, () => {
    if (!time) { toast("Choisis l'heure"); return false; }
    (async () => {
      try { const r = await offApi("/offers/" + o.id, { action: "book", ...(sq ? { sid: sq.sid } : {}), date: dates[di].iso, time, people: +document.getElementById("bkPeople").value || 1, name: document.getElementById("bkName").value.trim(), note: document.getElementById("bkNote").value.trim() }); o.mybk = r.mybk; if (r.offer) Object.assign(o, r.offer); offBkSeenMark(); toast(`Demande envoyée à ${o.partner} : tu seras prévenu de sa réponse`); if (back) setTimeout(back, 250); }
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
  const saved = savedTotal();
  return `<div class="card today">
    ${budget > 0 ? `<button type="button" class="today-left ${left < 0 ? "bad" : ""}" id="tdBud"><small>${left >= 0 ? "Il te reste à dépenser ce mois-ci" : "Budget du mois dépassé de"}</small><b class="num">${esc(eur(Math.abs(left)))}</b>${left > 0 ? `<small>soit <span class="num">${esc(eur(left / daysLeft))}</span> par jour pendant ${daysLeft} jour${daysLeft > 1 ? "s" : ""}</small>` : ""}</button>`
      : `<button type="button" class="today-left" id="tdBud"><small>Fixe ton budget du mois pour savoir ce qu'il te reste à dépenser chaque jour ›</small></button>`}
    ${saved > 0 || todo ? `<div class="today-row">
      ${saved > 0 ? `<button type="button" class="today-chip" id="tdSaved">💰 <span><b class="num">${esc(eur(savedTotal()))}</b><small>économisés grâce à Bourselle</small></span></button>` : ""}
      ${todo ? `<button type="button" class="today-chip" id="tdTodo">🔔 <span><b>${todo}</b><small>chose${todo > 1 ? "s" : ""} à faire</small></span></button>` : ""}
    </div>` : ""}
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
  offState = { ...offState, focus: focus || null, filter: filter || (focus ? "all" : offState.filter || "all"), view: focus || (filter && filter !== "all") ? "list" : offState.view || "home" };
  if (document.querySelector("#sheet2Root.open")) closeForm();
  const toList = !focus && filter && filter !== "all";
  if (typeof tab !== "undefined" && tab === "bons") { render(); if (!focus) window.scrollTo(0, 0); } else switchTab("bons");
  // Un filtre choisi : on descend jusqu'à la liste filtrée (sinon on croit que rien n'a changé)
  if (toList) setTimeout(() => { const el = document.getElementById("offF") || document.getElementById("offAll"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 120);
}
function offBigCardHTML(o) {
  const pct = offPctOf(o) || (o.tiers && o.tiers.length ? Math.max(...o.tiers.map(t => t.pct)) : 0), now = offTimed(o) && offNow(o);
  return `<button type="button" class="off-big${now ? " now" : ""}" data-ofocus="${esc(o.id)}"><span class="off-big-top"><span class="off-big-emo">${esc(o.emoji || "🎁")}</span>${now ? `<span class="off-big-now">● En ce moment</span>` : o.kind === "group" ? `<span class="off-big-now grp">Offre de groupe</span>` : ""}</span>
    <span class="off-big-pct">${pct ? `-${String(pct).replace(".", ",")} %` : "Bon plan"}</span><span class="off-big-tt">${esc(o.title)}</span>
    <span class="off-big-p">${esc(o.partner)}${o.city ? ` · 📍 ${esc(o.city)}` : ""}</span></button>`;
}
// Codes promo en ligne : valables partout (pas de ville), pour les achats et commandes sur internet
const offOnline = o => o.kind !== "group" && (!!o.online || (!!o.code && !!o.url && !o.city && !(o.slots && o.slots.length)));
const OFF_CAT_IC = { "Resto & bars": [icI("utensils"), "Resto"], "Coiffure & beauté": [icI("scissors"), "Beauté"], "Sport & bien-être": [icI("dumbbell"), "Sport"], "Loisirs & sorties": [icI("film"), "Sorties"], "Shopping": [icI("bag"), "Shopping"], "Mode": [icI("shirt"), "Mode"], "Maison": [icI("home"), "Maison"], "High-tech": [icI("phone"), "High-tech"], "Courses": [icI("cart"), "Courses"], "Voyage": [icI("plane"), "Voyage"], "Autre": [icI("sparkles"), "Autre"] };
const offPctTxt = o => { const p = offPctOf(o) || (o.tiers && o.tiers.length ? Math.max(...o.tiers.map(t => t.pct)) : 0); return p ? `-${String(p).replace(".", ",")} %` : "🎁 Offert"; };
function renderBons() {
  document.getElementById("periodLabel").textContent = "Bons plans";
  document.getElementById("resCap").textContent = "Économisé grâce à Bourselle";
  const big = document.getElementById("resBig"); big.textContent = eur(savedTotal()); big.className = "big num good";
  document.getElementById("resPill").innerHTML = "";
  if (!offLoaded) { document.body.classList.remove("bp-nohero"); view.innerHTML = banner + `<div class="card"><div class="empty">Chargement des bons plans…</div></div>`; if (!offRefresh.busy) { offRefresh.busy = true; offRefresh(false).then(() => { if (tab === "bons") render(); }); } return; }
  // Liste complète (un filtre, ou une offre ouverte) : l'ancienne vue détaillée, avec un retour
  if (offState.view === "list") {
    document.body.classList.remove("bp-nohero");
    view.innerHTML = banner + `<button class="btn" id="bpBack" style="align-self:flex-start">‹ Bons plans</button>`;
    offListRender(view, offState.focus, offState.filter);
    view.querySelector("#bpBack").onclick = () => { offState = { ...offState, view: "home", focus: null, filter: "all" }; render(); window.scrollTo(0, 0); };
    return;
  }
  document.body.classList.add("bp-nohero");
  const mode = offState.mode || "near", cat = offState.cat || "";
  const vis = BPLANS.filter(o => o.status !== "off" && !o.lvl && (offOnline(o) ? offInCountry(o) : offVisible(o)));
  const online = vis.filter(offOnline), local = offSort(vis.filter(o => !offOnline(o)));
  const inCat = l => cat ? l.filter(o => o.cat === cat) : l;
  const al = settings.offAlert;
  const bubbles = l => { const cs = OFF_CATS.filter(c => l.some(o => o.cat === c)); return cs.length ? `<div class="ep-cap"><span>Catégories</span></div><div class="bp-bub"><button type="button" data-bcat="" class="${!cat ? "on" : ""}"><span>${icI("sparkles")}</span>Tout</button>${cs.map(c => `<button type="button" data-bcat="${esc(c)}" class="${cat === c ? "on" : ""}"><span>${(OFF_CAT_IC[c] || [icI("gift")])[0]}</span>${esc((OFF_CAT_IC[c] || [, c])[1])}</button>`).join("")}</div>` : ""; };
  const row = o => `<button type="button" class="bp-row" data-odet="${esc(o.id)}"><span class="bp-em">${esc(o.emoji || "🎁")}</span><span class="bp-t"><b>${esc(o.partner)}</b><small>${esc(o.title)}${o.kind === "group" ? " · offre de groupe" : ""}${o.city ? " · 📍 " + esc(o.city) : offOnline(o) ? " · en ligne" : ""}</small></span><span class="bp-pct${offPctOf(o) || o.kind === "group" ? "" : " gift"}">${esc(offPctTxt(o))}</span></button>`;
  let html = banner + `<div class="ep-sum bp-sum">
      <div class="ep-card"><small>Économisé grâce à Bourselle</small><b class="num good">${esc(eur(savedTotal(), true))}</b><button type="button" class="ep-btn good" id="bpHist">📜 Mon historique</button></div>
      <div class="ep-card"><small>Près de chez moi</small><button type="button" class="bp-city" id="bpCity">📍 ${myCity() ? esc(myCity()) : "Choisir ma ville"}</button><button type="button" class="ep-btn ${al ? "good" : ""}" id="offAlert" style="${al ? "" : "background:var(--bg);color:var(--ink)"}">🔔 ${al ? "Alertes activées" : "Être prévenu"}</button></div></div>
    ${offRewardsHTML()}
    <div class="off-intro"><span>💰</span><p><b>Des réductions pour faire des économies.</b> Près de chez toi, ou en ligne avec des codes promo valables partout.</p></div>
    <div class="ep-tabs bp-tabs" role="tablist"><button type="button" role="tab" data-bmode="near" aria-selected="${mode === "near"}">📍 Près de chez moi</button><button type="button" role="tab" data-bmode="online" aria-selected="${mode === "online"}">🛒 En ligne${online.length ? ` <i class="ep-badge" style="background:var(--gold,#c9a24a)">${online.length}</i>` : ""}</button></div>`;
  if (mode === "near") {
    const L = inCat(local), now = L.filter(o => offTimed(o) && offNow(o)), groups = L.filter(o => o.kind === "group");
    html += bubbles(local);
    if (now.length) html += `<div class="ep-cap"><span>● En ce moment près de toi</span></div><div class="off-carousel">${now.slice(0, 8).map(offBigCardHTML).join("")}</div>`;
    if (online.length && !cat) html += `<div class="ep-cap"><span>🛒 Codes promo en ligne</span><button type="button" class="linkbtn" data-bmode="online">Tout voir</button></div><div class="bp-minis">${online.slice(0, 6).map(o => `<button type="button" class="bp-mini" data-odet="${esc(o.id)}"><span class="bp-em">${esc(o.emoji || "🛒")}</span><b>${esc(o.partner)}</b><small>${esc((OFF_CAT_IC[o.cat] || [, o.cat || "En ligne"])[1])} · partout</small><span class="bp-pct">${esc(offPctTxt(o))}</span></button>`).join("")}</div>`;
    if (groups.length) html += `<div class="ep-cap"><span>👥 À plusieurs, c'est moins cher</span></div>${groups.slice(0, 3).map(o => { const mx = Math.max(...o.tiers.map(t => t.n)), c = o.squad ? o.squad.in : o.count || 0;
      return `<div class="card bp-grp" data-odet="${esc(o.id)}" role="button" tabindex="0"><div class="act-top"><span class="act-emo">${esc(o.emoji || "👥")}</span><span class="act-tt"><b>${esc(o.partner)} · ${esc(o.title)}</b><small>${esc(o.tiers.map(t => `-${t.pct} % dès ${t.n}`).join(" · "))}</small></span><span class="bp-pct">${esc(offPctTxt(o))}</span></div>
        <div class="act-bar"><i style="width:${Math.min(100, Math.round(c / mx * 100))}%"></i></div><div class="ep-foot"><span class="hint" style="font-size:.8rem">${o.squad ? esc(offStatus(o)) : `${mx} personnes pour la meilleure réduction`}</span><span class="btn primary ep-b">🙋 Réunir mes amis</span></div></div>`; }).join("")}`;
    const rest = L.filter(o => o.kind !== "group");
    html += `<div class="ep-cap"><span>Tous les bons plans · ${rest.length}</span><button type="button" class="linkbtn" id="bpAll">Voir en détail</button></div>`
      + (rest.length ? `<div class="bp-list">${rest.map(row).join("")}</div>` : `<p class="hint ep-empty">${myCity() ? `Pas encore de bon plan à ${esc(myCity())}. Tu connais un commerce ? Envoie-lui la page « Devenir partenaire » !` : "Indique ta ville pour voir les bons plans près de chez toi."}</p>`);
    if (BPLANS.some(o => o.city && !offVisible(o) && !offOnline(o))) html += `<button type="button" class="linkbtn bp-other" data-of="cities">Voir les autres villes ›</button>`;
  } else {
    const L = inCat(online);
    html += bubbles(online) + `<div class="ep-cap"><span>🛒 Codes promo · partout</span></div>`;
    html += L.length ? L.map(o => `<div class="card bp-promo" id="off-${esc(o.id)}"><div class="act-top"><span class="act-emo">${esc(o.emoji || "🛒")}</span><span class="act-tt"><b>${esc(o.partner)}</b><small>${esc(o.title)}${o.desc ? " · " + esc(o.desc.slice(0, 60)) : ""}</small></span>${o.until ? `<span class="ep-when${(new Date(o.until) - Date.now()) / 864e5 < 7 ? " soon" : ""}">${(new Date(o.until) - Date.now()) / 864e5 < 7 ? "⏳ " + Math.max(0, Math.ceil((new Date(o.until) - Date.now()) / 864e5)) + " j" : "jusqu'au " + esc(frDate(o.until).slice(0, 5))}</span>` : ""}</div>
      ${o.code ? `<div class="bp-code"><span><small>Code promo</small><b>${esc(o.code)}</b></span><button type="button" class="btn" data-ocopy="${esc(o.id)}">📋 Copier</button></div>` : ""}
      <div class="bp-go">${o.url ? `<button type="button" class="btn primary" data-ogo="${esc(o.id)}">J'en profite sur le site ›</button>` : ""}<button type="button" class="btn" data-oshare="${esc(o.id)}">👥 Partager</button></div></div>`).join("")
      : `<p class="hint ep-empty">Pas encore de code promo en ligne. Reviens bientôt !</p>`;
  }
  html += `<p class="hint off-legal" style="text-align:center">Tu paies directement le partenaire : l'argent ne passe pas par Bourselle. Bourselle peut toucher une commission quand tu achètes via ces liens.</p>
    <button type="button" class="linkbtn" id="offLead" style="display:block;margin:4px auto 0">Tu es une marque ? Propose ton offre ›</button>
    ${OFF_ADMIN ? `<button type="button" class="btn" id="offAdmin" style="width:100%;margin-top:10px">⚙️ Gérer les bons plans${OFF_LEADS.length ? ` <i class="badge">${OFF_LEADS.length}</i>` : ""}</button>` : ""}`;
  view.innerHTML = html;
  offBindActs(view, null, "all");
  view.querySelectorAll("[data-bmode]").forEach(b => b.onclick = () => { offState.mode = b.dataset.bmode; offState.cat = ""; render(); window.scrollTo(0, 0); });
  view.querySelectorAll("[data-bcat]").forEach(b => b.onclick = () => { offState.cat = b.dataset.bcat; render(); });
  view.querySelectorAll("[data-odet]").forEach(b => b.onclick = () => offersOpen(b.dataset.odet));
  view.querySelectorAll("[data-ofocus]").forEach(b => b.onclick = () => offersOpen(b.dataset.ofocus));
  view.querySelector("#bpHist").onclick = () => savedOpen();
  { const bb = view.querySelector("#bpBdg"); if (bb) bb.onclick = () => funBadgesOpen(); }
  { const a = view.querySelector("#bpAll"); if (a) a.onclick = () => { offState = { ...offState, view: "list", filter: "all", focus: null }; render(); window.scrollTo(0, 0); }; }
  view.querySelector("#bpCity").onclick = () => offCityAsk(() => render());
  view.querySelector("#offAlert").onclick = () => offAlertsOpen();
  view.querySelector("#offLead").onclick = () => offLeadForm();
  { const ad = view.querySelector("#offAdmin"); if (ad) ad.onclick = () => offAdminOpen(); }
}

// L'onglet Bons plans n'apparaît que s'il y a quelque chose à y voir (offres près de chez moi ou codes promo de mon pays).
// Sinon, le widget de l'accueil aide à démarrer (choisir sa ville, faire connaître Bourselle à un commerce).
function offAvail() { return BPLANS.filter(o => o.status !== "off" && (offOnline(o) ? offInCountry(o) : offVisible(o))).length; }
// Pas encore de bon plan dans ma ville : je peux proposer Bourselle à un commerce que j'aime (page « Devenir partenaire »)
function offRecommend() {
  const link = appBase() + "g.html#partenaire", msg = `Bonjour ! J'utilise Bourselle pour mon budget. Vous pourriez y proposer vos offres aux habitants${myCity() ? " de " + myCity() : ""}, c'est gratuit : ${link}`;
  const f = openForm(`<div class="f2"><div style="font-size:2.2rem;text-align:center">🏪</div><h3 style="text-align:center">Pas encore de bon plan${myCity() ? " à " + esc(myCity()) : ""}</h3>
    <p class="hint" style="text-align:center;margin:0 0 12px">Ton coiffeur, ton resto, ta boutique préférée ? Envoie-leur la page partenaire : s'ils proposent une offre, tu seras le premier prévenu.</p>
    <button type="button" class="btn primary" id="orShare" style="width:100%">Envoyer à un commerce</button>
    <button type="button" class="btn" id="orCity" style="width:100%;margin-top:8px">📍 Changer de ville</button>
    <button type="button" class="btn" id="orOnline" style="width:100%;margin-top:8px">🛒 Voir les codes promo en ligne</button></div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Fermer";
  f.querySelector("#orShare").onclick = () => { if (navigator.share) navigator.share({ text: msg }).catch(() => {}); else { try { navigator.clipboard.writeText(msg); toast("Message copié"); } catch (e) { toast(link); } } };
  f.querySelector("#orCity").onclick = () => { closeForm(); setTimeout(() => offCityAsk(() => render()), 200); };
  const on = BPLANS.some(o => o.status !== "off" && offOnline(o) && offInCountry(o));
  if (!on) f.querySelector("#orOnline").remove(); else f.querySelector("#orOnline").onclick = () => { closeForm(); offState.mode = "online"; switchTab("bons"); };
}
function bonsNavSync() {
  const b = document.querySelector('nav.tabs [data-tab="bons"]'); if (!b) return;
  let n; if (offLoaded) { n = offAvail(); try { localStorage.setItem("bourselle-bons-n", String(n)); } catch (e) {} } else { try { n = Number(localStorage.getItem("bourselle-bons-n")) || 0; } catch (e) { n = 0; } }
  b.hidden = false;   // l'onglet Bons plans est toujours là, même vide (il explique alors comment en avoir)
}
// Récompenses des badges : chaque palier de 10 badges terminé débloque une récompense (offres marquées « palier N » par l'équipe)
function offRewardsHTML() {
  if (typeof funTierView !== "function") return "";
  const V = funTierView(), R = BPLANS.filter(o => o.lvl && o.status !== "off" && (OFF_ADMIN || o.lvl <= V.done)).sort((a, b) => a.lvl - b.lvl);
  const left = V.list.length - V.on;
  return `<div class="card bp-rw" id="bpRewards"><h2>🎁 Mes récompenses<small>${V.done} palier${V.done > 1 ? "s" : ""}</small></h2>
    ${R.length ? R.map(o => `<button type="button" class="bp-row" data-odet="${esc(o.id)}"><span class="bp-em">${esc(o.emoji || "🎁")}</span><span class="bp-t"><b>${esc(o.partner)}</b><small>${esc(o.title)} · palier ${o.lvl}</small></span><span class="bp-go">›</span></button>`).join("")
      : V.done ? `<p class="hint" style="margin:0 0 8px">Bravo, tu as terminé ${V.done > 1 ? V.done + " paliers" : "ton premier palier"} ! Ta récompense arrive très bientôt ici.</p>` : ""}
    ${V.all ? "" : `<button type="button" class="bp-rwp" id="bpBdg"><span>🏅 Palier ${V.cur + 1} · ${V.on} / ${V.list.length} badges</span><span class="bdg-bar"><i style="width:${Math.round(V.on / V.list.length * 100)}%"></i></span><small>${left ? `Encore ${left} badge${left > 1 ? "s" : ""} pour ta prochaine récompense ›` : "Palier terminé ›"}</small></button>`}</div>`;
}
// Dans « Entre proches » : juste un petit rappel vers l'onglet Bons plans
function offTeaserHTML() {
  if (!offLoaded) { if (!offRefresh.busy) { offRefresh.busy = true; offRefresh(false); } return ""; }
  const vis = BPLANS.filter(o => o.status !== "off" && offVisible(o)), now = vis.filter(o => offTimed(o) && offNow(o));
  if (!vis.length) return "";
  return `<button type="button" class="off-teaser" data-oall>🎁 <span>${now.length ? `<b>${now.length} bon${now.length > 1 ? "s" : ""} plan${now.length > 1 ? "s" : ""} en ce moment</b> près de chez toi` : `<b>${vis.length} bon${vis.length > 1 ? "s" : ""} plan${vis.length > 1 ? "s" : ""}</b> pour sortir entre proches`}</span><span class="pm-chev">›</span></button>`;
}

// ---------- Réunir ses amis autour d'une offre de groupe ----------
function sqLeft(sq) { const ms = sq.deadline - Date.now(); if (ms <= 0) return "délai dépassé"; const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5); return d >= 1 ? `encore ${d} j ${h} h` : `encore ${h} h ${Math.floor(ms % 36e5 / 6e4)} min`; }
function sqPeoplePicker(f, boxSel, findSel, resSel, pick, exclude) {
  const tog = b => { const t = b.dataset.tag; pick.has(t) ? pick.delete(t) : pick.add(t); b.setAttribute("aria-pressed", pick.has(t)); };
  f.querySelectorAll(`${boxSel} [data-tag]`).forEach(b => b.onclick = () => tog(b));
  tagPicker(f.querySelector(findSel), f.querySelector(resSel), (tag, nm) => {
    if ((exclude || new Set()).has(tag)) { toast(`@${tag} est déjà dans le groupe`); return; }
    let b = f.querySelector(`${boxSel} [data-tag="${tag}"]`);
    if (!b) { const c = f.querySelector(boxSel); c.insertAdjacentHTML("beforeend", `<button type="button" class="chip" data-tag="${esc(tag)}" aria-pressed="false">${esc(nm || "@" + tag)}</button>`); b = c.lastElementChild; b.onclick = () => tog(b); }
    if (!pick.has(tag)) tog(b); f.querySelector(findSel).value = "";
  });
}
function squadNew(o, back) {
  const tiers = o.tiers.slice().sort((a, b) => a.n - b.n), pick = new Set(), people = prochesTagged().slice(0, 14);
  let n = tiers[0].n, days = 7;
  const f = openForm(`<div class="f2"><h3>🙋 Je réunis mes amis</h3><p class="hint" style="margin:0 0 8px">${esc(o.emoji)} ${esc(o.partner)} · ${esc(o.title)}</p>
    <span class="lbl">Combien serez-vous ?</span><div class="chips" id="sqN">${tiers.map(t => `<button type="button" class="chip" data-n="${t.n}" aria-pressed="${t.n === n}">${t.n} personnes · -${t.pct} %</button>`).join("")}</div>
    <span class="lbl">Qui inviter ?</span><div class="chips" id="sqP">${people.map(p => `<button type="button" class="chip" data-tag="${esc(p.tag)}" aria-pressed="false">${esc(p.name || "@" + p.tag)}</button>`).join("")}</div>
    <input class="field" id="sqFind" placeholder="Chercher un @tag…" autocapitalize="off" spellcheck="false" autocomplete="off" style="margin-top:8px"><div id="sqRes"></div>
    <span class="lbl">Date limite pour réunir le groupe</span><div class="chips" id="sqD">${[3, 7, 14].map(d => `<button type="button" class="chip" data-d="${d}" aria-pressed="${d === days}">${d} jours</button>`).join("")}</div>
    <p class="hint" style="margin:8px 0 0">Tes amis reçoivent l'invitation dans l'appli et une discussion de groupe s'ouvre pour vous organiser. Une fois le groupe complet, le code se débloque${o.book ? " et vous réservez ensemble" : ""}. Ceux qui n'ont pas l'appli : partage-leur le lien.</p></div>`, () => {
    (async () => {
      try { const r = await offApi("/offers/" + o.id, { action: "squad", n, days, tags: [...pick], name: typeof ensName === "function" ? ensName() : "" }); Object.assign(o, r.offer); toast(pick.size ? `Groupe lancé : ${pick.size} invitation${pick.size > 1 ? "s" : ""} envoyée${pick.size > 1 ? "s" : ""}` : "Groupe lancé : invite tes amis"); if (typeof ensRefresh === "function") ensRefresh(); if (back) setTimeout(back, 250); }
      catch (e) { toast(e.message); }
    })();
  });
  f.querySelector("button[type=submit]").textContent = "Lancer le groupe";
  f.querySelectorAll("#sqN [data-n]").forEach(b => b.onclick = () => { n = +b.dataset.n; f.querySelectorAll("#sqN [data-n]").forEach(x => x.setAttribute("aria-pressed", x === b)); });
  f.querySelectorAll("#sqD [data-d]").forEach(b => b.onclick = () => { days = +b.dataset.d; f.querySelectorAll("#sqD [data-d]").forEach(x => x.setAttribute("aria-pressed", x === b)); });
  sqPeoplePicker(f, "#sqP", "#sqFind", "#sqRes", pick);
}
function squadInvite(o, back) {
  const sq = o.squad, inSq = new Set(sq.members.map(m => m.tag)), pick = new Set(), people = prochesTagged().filter(p => !inSq.has(p.tag)).slice(0, 14);
  const f = openForm(`<div class="f2"><h3>Inviter au groupe</h3><p class="hint" style="margin:0 0 8px">${sq.in} sur ${sq.n} partants · ${esc(sqLeft(sq))}</p>
    <div class="chips" id="siP">${people.map(p => `<button type="button" class="chip" data-tag="${esc(p.tag)}" aria-pressed="false">${esc(p.name || "@" + p.tag)}</button>`).join("")}</div>
    <input class="field" id="siFind" placeholder="Chercher un @tag…" autocapitalize="off" spellcheck="false" autocomplete="off" style="margin-top:8px"><div id="siRes"></div>
    <button type="button" class="btn" id="siLink" style="width:100%;margin-top:10px">🔗 Envoyer le lien à quelqu'un sans l'appli</button></div>`, () => {
    if (!pick.size) { toast("Choisis au moins une personne"); return false; }
    (async () => { try { const r = await offApi("/offers/" + o.id, { action: "sqinvite", sid: sq.sid, tags: [...pick] }); Object.assign(o, r.offer); toast(r.invited ? `${r.invited} invitation${r.invited > 1 ? "s" : ""} envoyée${r.invited > 1 ? "s" : ""}` : "Déjà dans le groupe"); if (back) setTimeout(back, 250); } catch (e) { toast(e.message); } })();
  });
  f.querySelector("button[type=submit]").textContent = "Inviter";
  sqPeoplePicker(f, "#siP", "#siFind", "#siRes", pick, inSq);
  f.querySelector("#siLink").onclick = () => shareText(`${o.emoji} ${o.partner} : ${o.title}. On se fait ça ? Il faut ${sq.n} personnes, on est déjà ${sq.in} :`, appBase() + "?offre=" + o.id, "Lien copié");
}
// ---------- Avis après la visite ----------
function offReview(o, back) {
  let stars = (o.myReview || {}).stars || 0;
  const f = openForm(`<div class="f2"><h3>⭐ Ton avis sur ${esc(o.partner)}</h3>
    <div class="rev-stars" id="rvS">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-s="${i}" aria-label="${i} étoile${i > 1 ? "s" : ""}">${i <= stars ? "★" : "☆"}</button>`).join("")}</div>
    <label class="lbl" for="rvT">Un petit mot (facultatif)</label><textarea class="field" id="rvT" rows="3" maxlength="300" placeholder="Accueil, ambiance, qualité…">${esc((o.myReview || {}).text || "")}</textarea>
    <p class="hint" style="margin:6px 0 0">Ton avis est visible par les autres utilisateurs, avec ton prénom.</p></div>`, () => {
    if (!stars) { toast("Choisis une note"); return false; }
    (async () => { try { const r = await offApi("/offers/" + o.id, { action: "review", stars, text: document.getElementById("rvT").value.trim(), name: typeof ensName === "function" ? ensName() : "" }); Object.assign(o, r.offer); toast("Merci pour ton avis ⭐"); if (back) setTimeout(back, 250); } catch (e) { toast(e.message); } })();
  });
  f.querySelector("button[type=submit]").textContent = "Publier mon avis";
  const draw = () => f.querySelectorAll("#rvS [data-s]").forEach(b => b.textContent = +b.dataset.s <= stars ? "★" : "☆");
  f.querySelectorAll("#rvS [data-s]").forEach(b => b.onclick = () => { stars = +b.dataset.s; draw(); });
}
// ---------- Alerte « nouveaux bons plans dans ma ville » ----------
async function offAlertsOpen() {
  if (!(typeof socOn === "function" && socOn())) { toast("Connecte-toi avec Google ou Microsoft pour recevoir les alertes"); return; }
  if (!myCity()) { offCityAsk(() => offAlertsOpen()); return; }
  let st = { on: false }, cats = []; try { const j = await offApi("/offers/alerts"); st = j.alerts || st; cats = j.cats || []; } catch (e) { toast(e.message); return; }
  const sel = new Set(st.cats || []);
  const f = openForm(`<div class="f2"><h3>🔔 Alerte nouveaux bons plans</h3><p class="hint" style="margin:0 0 8px">Reçois une notification quand un nouveau bon plan arrive à <b>${esc(myCity())}</b>. Pour ça, ta ville est enregistrée sur le serveur de Bourselle, uniquement pour cette alerte.</p>
    <span class="lbl">Ce qui t'intéresse (rien de coché = tout)</span><div class="chips" id="alC">${cats.map(c => `<button type="button" class="chip" data-c="${esc(c)}" aria-pressed="${sel.has(c)}">${esc(c)}</button>`).join("")}</div>
    ${typeof pushNudgeHTML === "function" ? pushNudgeHTML() : ""}
    ${st.on ? `<button type="button" class="linkbtn" id="alOff" style="margin-top:10px;color:var(--bad)">Désactiver l'alerte</button>` : ""}</div>`, () => {
    (async () => { try { await offApi("/offers/alerts", { on: true, city: myCity(), country: myCountry(), cats: [...sel] }); settings.offAlert = true; saveSettings(); toast(`🔔 Alerte activée pour ${myCity()}`); render(); } catch (e) { toast(e.message); } })();
  });
  f.querySelector("button[type=submit]").textContent = st.on ? "Mettre à jour" : "Activer l'alerte";
  if (typeof pushNudgeBind === "function") pushNudgeBind(f);
  f.querySelectorAll("#alC [data-c]").forEach(b => b.onclick = () => { const c = b.dataset.c; sel.has(c) ? sel.delete(c) : sel.add(c); b.setAttribute("aria-pressed", sel.has(c)); });
  const off = f.querySelector("#alOff"); if (off) off.onclick = async () => { try { await offApi("/offers/alerts", { on: false }); settings.offAlert = false; saveSettings(); closeForm(); render(); toast("Alerte désactivée"); } catch (e) { toast(e.message); } };
}

// Envoyer au commerçant le lien de son espace (statistiques, réservations) : par e-mail si on l'a, sinon partage
function offMerchantSend(o, email) {
  if (!o || !o.mlink) return;
  const url = offMerchantLink(o), txt = `Bonjour,\n\nVotre offre « ${o.title} » est en ligne sur Bourselle.\nVoici votre espace commerçant (gardez ce lien pour vous) : vous y voyez chaque semaine les vues, les clics, les personnes partantes, les réservations et les avis${o.book ? ", et vous confirmez les réservations" : ""}.\n\n${url}\n\nÀ bientôt !`;
  const f = openForm(`<div class="f2"><h3>📊 Espace commerçant · ${esc(o.partner)}</h3><p class="hint" style="margin:0 0 8px">Envoie ce lien au commerçant : il y suit ses statistiques et ses réservations, sans compte.</p>
    <div class="off-code"><b style="font-size:.78rem;letter-spacing:0;word-break:break-all">${esc(url)}</b></div>
    <div class="dm-cta">${email ? `<a class="btn primary" href="mailto:${esc(email)}?subject=${encodeURIComponent("Votre espace Bourselle")}&body=${encodeURIComponent(txt)}">✉️ Par e-mail</a>` : ""}<button type="button" class="btn" id="omShare">Partager</button></div></div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Fermer";
  f.querySelector("#omShare").onclick = () => shareText(txt.replace(url, "").trim(), url, "Lien copié");
}
