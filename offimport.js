/* Bourselle — Gérer les bons plans › Importer des offres (propriétaire seulement).
 * On colle une liste (copiée d'un tableur, ou une offre par ligne) : chaque ligne devient une offre, vérifiée avant publication.
 * Colonnes, dans cet ordre si la 1re ligne n'est pas un en-tête : Marque · Offre · Code · Lien · Ville · Pays · Catégorie · Jusqu'au · Emoji · Description
 * Séparateurs acceptés : tabulation (copié d'Excel ou Google Sheets), « ; », « | » ou « , ». Sans ville : code promo en ligne. */
const OI_COLS = ["partner", "title", "code", "url", "city", "country", "cat", "until", "emoji", "desc"];
const OI_HEAD = { partner: /^(marque|partenaire|enseigne|commerce|brand|partner|nom)$/, title: /^(offre|titre|réduction|reduction|promo|title|offer|deal)$/, code: /^(code|code promo|coupon)$/, url: /^(lien|url|site|link)$/,
  city: /^(ville|city|lieu)$/, country: /^(pays|country)$/, cat: /^(catégorie|categorie|category|cat)$/, until: /^(jusqu'au|fin|expire|expiration|until|valable jusqu'au|date de fin)$/, emoji: /^(emoji|icône|icone|icon)$/, desc: /^(description|desc|détails|details)$/ };
const OI_CC = { france: "FR", belgique: "BE", suisse: "CH", luxembourg: "LU", canada: "CA", monaco: "MC", benin: "BJ", "côte d'ivoire": "CI", "cote d'ivoire": "CI", senegal: "SN", sénégal: "SN", cameroun: "CM", togo: "TG", "burkina faso": "BF", mali: "ML", niger: "NE", gabon: "GA", congo: "CG", rdc: "CD", guinée: "GN", guinee: "GN", madagascar: "MG", maroc: "MA", algérie: "DZ", algerie: "DZ", tunisie: "TN", haïti: "HT", haiti: "HT", "royaume-uni": "GB", allemagne: "DE", espagne: "ES", italie: "IT", portugal: "PT", "états-unis": "US", usa: "US" };
const oiNorm = s => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function oiParse(text) {
  const lines = String(text || "").split(/\r?\n/).map(l => l.replace(/^ +| +$/g, "")).filter(l => l.replace(/[\t;|,\s]/g, ""));   // on garde les tabulations du début : une 1re colonne vide reste vide if (!lines.length) return [];
  const sep = lines.some(l => l.includes("\t")) ? "\t" : lines.some(l => l.includes(";")) ? ";" : lines.some(l => l.includes("|")) ? "|" : ",";
  const split = l => l.split(sep).map(x => x.trim().replace(/^"(.*)"$/, "$1"));
  let cols = OI_COLS, rows = lines.map(split);
  const head = rows[0].map(h => { h = h.toLowerCase(); return Object.keys(OI_HEAD).find(k => OI_HEAD[k].test(h)) || ""; });
  if (head.filter(Boolean).length >= 2) { cols = head; rows = rows.slice(1); }
  const cats = (typeof OFF_CATS !== "undefined" ? OFF_CATS : []);
  return rows.map((r, i) => {
    const o = {}; cols.forEach((k, j) => { if (k && r[j] != null && r[j] !== "") o[k] = r[j]; });
    const errs = [];
    if (o.url && /^www\./i.test(o.url)) o.url = "https://" + o.url;
    if (o.url && /^http:\/\//i.test(o.url)) o.url = o.url.replace(/^http:/i, "https:");
    if (o.url && !/^https:\/\/\S+\.\S+/i.test(o.url)) { errs.push("lien invalide"); }
    if (o.until) { const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(o.until); if (m) o.until = `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; if (!/^\d{4}-\d{2}-\d{2}$/.test(o.until)) { errs.push("date de fin illisible (jj/mm/aaaa)"); delete o.until; } }
    if (o.country) { const c = o.country.length === 2 ? o.country.toUpperCase() : OI_CC[o.country.toLowerCase()] || OI_CC[oiNorm(o.country)]; if (c) o.country = c; else { errs.push("pays inconnu : " + o.country); delete o.country; } }
    if (!o.country) o.country = (typeof myCountry === "function" && myCountry()) || "FR";
    if (o.cat) { const c = cats.find(x => oiNorm(x) === oiNorm(o.cat)) || cats.find(x => oiNorm(x).startsWith(oiNorm(o.cat).slice(0, 4))); o.cat = c || o.cat; }
    if (o.code) o.code = o.code.replace(/\s+/g, "").toUpperCase();
    o.online = !o.city; o.kind = "promo"; o.status = "on";
    if (!o.emoji) o.emoji = o.online ? "🛒" : "🎁";
    if (!o.partner) errs.push("marque manquante");
    if (!o.title) errs.push("offre manquante");
    const dup = (typeof BPLANS !== "undefined" ? BPLANS : []).some(x => oiNorm(x.partner) === oiNorm(o.partner) && oiNorm(x.title) === oiNorm(o.title));
    return { n: i + 1, o, errs, dup };
  });
}
function offImportOpen() {
  const ex = "Marque\tOffre\tCode\tLien\tVille\nFnac\t-10 % sur les livres\tLIVRE10\thttps://www.fnac.com\t\nCafé Lumière\t-20 % le midi\t\t\tLyon";
  const f = openForm(`<div class="f2"><h3>📥 Importer des offres</h3>
    <p class="hint" style="margin:0 0 8px">Colle ta liste : copiée d'un tableur (Excel, Google Sheets), ou une offre par ligne avec des « ; ». Colonnes dans cet ordre : <b>Marque · Offre · Code · Lien · Ville</b> (puis Pays, Catégorie, Jusqu'au, Emoji, Description, facultatifs). Sans ville, c'est un code promo en ligne.</p>
    <textarea class="field" id="oiText" rows="8" placeholder="${esc(ex)}" style="font-family:ui-monospace,monospace;font-size:.85rem"></textarea>
    <div id="oiPrev"></div></div>`, () => false);
  const sb = f.querySelector("button[type=submit]"); sb.textContent = "Vérifier"; sb.disabled = false;
  let rows = [];
  const prev = () => {
    rows = oiParse(f.querySelector("#oiText").value);
    const good = rows.filter(r => !r.errs.length && !r.dup);
    f.querySelector("#oiPrev").innerHTML = rows.length ? `<span class="lbl">${rows.length} ligne${rows.length > 1 ? "s" : ""} · ${good.length} prête${good.length > 1 ? "s" : ""} à publier</span>
      <div class="oi-list">${rows.map(r => `<div class="oi-row ${r.errs.length ? "bad" : r.dup ? "dup" : "ok"}"><span>${r.errs.length ? "⚠️" : r.dup ? "↺" : "✓"}</span><span><b>${esc(r.o.emoji)} ${esc(r.o.partner || "?")} · ${esc(r.o.title || "?")}</b>
        <small>${[r.o.code ? "code " + r.o.code : "", r.o.online ? "en ligne · " + r.o.country : "📍 " + r.o.city, r.o.cat || "", r.o.until ? "jusqu'au " + frDate(r.o.until) : ""].filter(Boolean).map(esc).join(" · ")}${r.errs.length ? `<br><em>Ligne ${r.n} : ${esc(r.errs.join(", "))}</em>` : r.dup ? "<br><em>Déjà publiée : ignorée</em>" : ""}</small></span></div>`).join("")}</div>` : "";
    sb.textContent = good.length ? `Publier ${good.length} offre${good.length > 1 ? "s" : ""}` : "Vérifier";
    return good;
  };
  f.querySelector("#oiText").addEventListener("input", prev);
  sb.onclick = async e => {
    e.preventDefault();
    const good = prev(); if (!good.length) { toast(rows.length ? "Aucune ligne prête : corrige les lignes marquées ⚠️" : "Colle d'abord ta liste"); return; }
    sb.disabled = true; let ok = 0; const ko = [];
    for (const r of good) {
      sb.textContent = `Publication… ${ok + ko.length + 1}/${good.length}`;
      try { await offApi("/offers", { ...r.o, id: "", slots: [], book: false, featured: false, reward: false, lvl: 0, tiers: [], groupDays: 7 }); ok++; }
      catch (err) { ko.push(`ligne ${r.n} (${r.o.partner}) : ${err.message}`); }
    }
    await offRefresh(false); render();
    if (ko.length) { sb.disabled = false; prev(); toast(`${ok} publiée${ok > 1 ? "s" : ""}, ${ko.length} en erreur`); f.querySelector("#oiPrev").insertAdjacentHTML("afterbegin", `<p class="hint" style="color:var(--bad)">${ko.map(esc).join("<br>")}</p>`); }
    else { closeForm(); toast(`${ok} offre${ok > 1 ? "s" : ""} publiée${ok > 1 ? "s" : ""} ✓`); setTimeout(offAdminOpen, 250); }
  };
}
// Lien « …/#oi=<liste> » : ouvre l'import déjà rempli (pour le propriétaire, une fois connecté)
{
  const m = /[#&]oi=([^&]+)/.exec(location.hash);
  if (m) { try { sessionStorage.setItem("bourselle-oi", decodeURIComponent(m[1])); } catch (e) {} history.replaceState(null, "", location.pathname + location.search); }
  let tries = 0;
  const tick = setInterval(() => {
    let txt = ""; try { txt = sessionStorage.getItem("bourselle-oi") || ""; } catch (e) {}
    if (!txt || ++tries > 120) return clearInterval(tick);
    if (typeof offLoaded === "undefined" || !offLoaded || typeof store === "undefined" || !store) { if (typeof offRefresh === "function" && store && !offRefresh.busy) { offRefresh.busy = true; offRefresh(false).finally(() => { offRefresh.busy = false; }); } return; }
    clearInterval(tick); try { sessionStorage.removeItem("bourselle-oi"); } catch (e) {}
    if (!OFF_ADMIN) { toast("L'import d'offres est réservé au propriétaire de Bourselle"); return; }
    switchTab("bons"); setTimeout(() => { offImportOpen(); const t = document.getElementById("oiText"); if (t) { t.value = txt; t.dispatchEvent(new Event("input")); } }, 400);
  }, 1000);
}
