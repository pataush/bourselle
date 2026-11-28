/* Bourselle — anniversaires
 * 1. Mon anniversaire (jour et mois) avec « Visible par mes proches » : demandé à côté de mon @tag (accueil, Mon compte),
 *    et une fois aux comptes existants. S'il est visible, mes proches qui m'ont ajouté le récupèrent tout seuls.
 * 2. Les anniversaires de mes proches qui l'ont rendu visible sont ajoutés à ma liste (synchronisés au plus toutes les 12 h).
 * 3. Import d'un fichier de contacts (.vcf, exporté depuis iCloud, Google Contacts, Android…) : on ne garde que les prénoms et les dates. */
const BD = { d: "", vis: true, loaded: false, loading: null };
const BD_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const bdFmt = d => BD_RE.test(d || "") ? `${Number(d.slice(3))} ${MOIS[Number(d.slice(0, 2)) - 1]}` : "";

async function bdLoadMine(force) {
  if (!(typeof socOn === "function" && socOn())) return BD;
  if (BD.loaded && !force) return BD;
  if (!BD.loading) BD.loading = socApi("/me/bday").then(j => { BD.d = j.d || ""; BD.vis = j.vis !== false; BD.loaded = true; }).catch(() => {}).finally(() => { BD.loading = null; });
  await BD.loading; return BD;
}
async function bdSaveMine(d, vis) {
  const j = await socApi("/me/bday", { method: "POST", body: JSON.stringify({ d, vis }) });
  BD.d = j.d || ""; BD.vis = j.vis !== false; BD.loaded = true; return BD;
}
// Jour + mois + « Visible par mes proches »
function bdPickHTML(p, d, vis) {
  const dd = d ? Number(d.slice(3)) : 0, mm = d ? Number(d.slice(0, 2)) : 0;
  return `<div class="bd-pick"><select class="field" id="${p}Day" aria-label="Jour"><option value="">Jour</option>${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}"${i + 1 === dd ? " selected" : ""}>${i + 1}</option>`).join("")}</select>
    <select class="field" id="${p}Mon" aria-label="Mois"><option value="">Mois</option>${MOIS.map((m, i) => `<option value="${i + 1}"${i + 1 === mm ? " selected" : ""}>${m}</option>`).join("")}</select></div>
    <label class="toggle bd-vis" for="${p}Vis"><span>Visible par mes proches</span><input type="checkbox" id="${p}Vis"${vis !== false ? " checked" : ""}></label>`;
}
function bdPickVal(root, p) {
  const d = root.querySelector("#" + p + "Day").value, m = root.querySelector("#" + p + "Mon").value;
  if (!d || !m) return { d: "", vis: root.querySelector("#" + p + "Vis").checked, empty: !d && !m };
  const v = `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const ok = BD_RE.test(v) && new Date(`2024-${v}T12:00:00`).getDate() === Number(d);   // 2024 : le 29 février existe
  return { d: ok ? v : "", vis: root.querySelector("#" + p + "Vis").checked, bad: !ok };
}
// Accueil (écran « Invite un premier proche », sous le tag) : enregistré dès qu'on choisit
function bdObHTML() {
  if (!(typeof socOn === "function" && socOn())) return "";
  return `<div class="ob-bd"><span class="lbl">🎂 Ton anniversaire</span>${bdPickHTML("obBd", BD.d, BD.vis)}<p class="hint" style="margin:4px 0 0">Jour et mois seulement. Tes proches qui t'ajoutent le verront, pour ne jamais l'oublier.</p></div>`;
}
function bdObBind(el) {
  const w = el.querySelector(".ob-bd"); if (!w) return;
  if (!BD.loaded) bdLoadMine().then(() => { if (BD.d && document.contains(w)) w.outerHTML = bdObHTML(), bdObBind(el); });
  const save = () => { const v = bdPickVal(w, "obBd"); if (v.bad || (!v.d && !v.empty)) return; bdSaveMine(v.d, v.vis).catch(e => toast(e.message)); };
  w.querySelectorAll("select,input").forEach(i => i.onchange = save);
}
// Mon compte : une ligne sous le tag
function bdMineRowHTML() {
  if (!(typeof socOn === "function" && socOn()) || !SOC.tag) return "";
  if (!BD.loaded) { bdLoadMine().then(() => { const r = document.getElementById("bdMineRow"); if (r) { r.outerHTML = bdMineRowHTML(); bdMineRowBind(); } }); }
  return `<div class="soc-tag-row" id="bdMineRow"><span class="hint">Anniversaire</span> ${BD.d ? `<b>🎂 ${esc(bdFmt(BD.d))}</b><small class="hint">${BD.vis ? "visible par mes proches" : "caché"}</small>` : `<span class="hint">${BD.loaded ? "non indiqué" : "…"}</span>`}
    <span class="soc-tag-btns"><button class="linkbtn" id="bdMineEdit">${BD.d ? "Modifier" : "Ajouter"}</button></span></div>`;
}
function bdMineRowBind() { const b = document.getElementById("bdMineEdit"); if (b) b.onclick = () => bdMineEdit(); }
function bdMineEdit(after) {
  const f = openForm(`<div class="f2"><h3>🎂 Mon anniversaire</h3>${bdPickHTML("mbd", BD.d, BD.vis)}
    <p class="hint" style="margin:8px 0 0">Jour et mois seulement, jamais l'année. Visible : tes proches qui t'ajoutent avec ton @tag le voient, et Bourselle leur rappelle une semaine avant.</p></div>`, () => {
    const v = bdPickVal(f, "mbd"); if (v.bad || (!v.d && !v.empty)) { toast("Choisis le jour et le mois"); return false; }
    bdSaveMine(v.d, v.vis).then(() => { closeForm(); render(); toast(v.d ? `🎂 Anniversaire enregistré : ${bdFmt(v.d)}` : "Anniversaire retiré"); if (after) after(); }).catch(e => toast(e.message));
    return false;
  });
}
// Comptes existants : on le demande une fois, dans « Entre proches », avec « Plus tard »
function bdAskCardHTML() {
  if (!(typeof socOn === "function" && socOn()) || !SOC.tag || settings.bdAskOff) return "";
  if (!BD.loaded) { bdLoadMine().then(() => { if (!BD.d && typeof tab !== "undefined" && tab === "partage") render(); }); return ""; }
  if (BD.d) return "";
  return `<div class="card bd-ask"><b>🎂 Et toi, c'est quand ton anniversaire ?</b><small class="hint">Tes proches pourront te le souhaiter (et préparer une surprise 🤫).</small>
    ${bdPickHTML("akbd", "", true)}<div class="dm-cta"><button type="button" class="btn primary" id="akbdOk">Enregistrer</button><button type="button" class="btn" id="akbdNo">Plus tard</button></div></div>`;
}
function bdAskBind(root) {
  const c = root.querySelector(".bd-ask"); if (!c) return;
  c.querySelector("#akbdNo").onclick = () => { settings.bdAskOff = 1; saveSettings(); render(); };
  c.querySelector("#akbdOk").onclick = async () => { const v = bdPickVal(c, "akbd"); if (!v.d) { toast("Choisis le jour et le mois"); return; }
    try { await bdSaveMine(v.d, v.vis); settings.bdAskOff = 1; saveSettings(); render(); toast(`🎂 Noté : ${bdFmt(v.d)}`); } catch (e) { toast(e.message); } };
}

// Anniversaires de mes proches (ceux qui l'ont rendu visible)
async function bdSync(force) {
  if (!(typeof socOn === "function" && socOn())) return;
  const tags = socContacts().map(c => c.tag).filter(Boolean); if (!tags.length) return;
  const sig = tags.slice().sort().join(",");
  if (!force && settings.bdSync && settings.bdSync.sig === sig && Date.now() - settings.bdSync.at < 12 * 36e5) return;
  let j; try { j = await socApi("/bdays", { method: "POST", body: JSON.stringify({ tags }) }); } catch (e) { return; }
  const got = j.bdays || {}, hide = settings.bdHide || {};
  const manual = (settings.bdays || []).filter(b => b.src !== "tag");
  const fromTag = Object.entries(got).filter(([t]) => !hide[t] && !manual.some(b => b.tag === t)).map(([t, d]) => {
    const c = socContacts().find(x => x.tag === t) || {}; return { name: favFirst(c.name || t), d, tag: t, src: "tag" };
  });
  const before = JSON.stringify(settings.bdays || []);
  settings.bdays = [...manual, ...fromTag]; settings.bdSync = { sig, at: Date.now() };
  saveSettings();
  if (JSON.stringify(settings.bdays) !== before && typeof render === "function") render();
}
// Après chaque rafraîchissement social, et quand on ajoute un proche
if (typeof socRefresh === "function") { const _sr = socRefresh; socRefresh = async function (...a) { const r = await _sr.apply(this, a); setTimeout(() => bdSync(false), 400); return r; }; }
if (typeof socAdded === "function") { const _sa = socAdded; socAdded = function (...a) { const r = _sa.apply(this, a); setTimeout(() => bdSync(true), 800); return r; }; }

// Fichier de contacts .vcf : on lit les noms (FN) et les dates (BDAY), sans rien envoyer nulle part
function vcfParse(text) {
  const lines = String(text || "").replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/), out = [];
  let cur = null;
  for (const l of lines) {
    if (/^BEGIN:VCARD/i.test(l)) cur = {};
    else if (/^END:VCARD/i.test(l)) { if (cur && cur.d && cur.name) out.push(cur); cur = null; }
    else if (cur) {
      const i = l.indexOf(":"); if (i < 0) continue;
      const key = l.slice(0, i).toUpperCase(), val = l.slice(i + 1).trim();
      if (/^(ITEM\d+\.)?FN(;|$)/.test(key)) cur.name = val.replace(/\\,/g, ",").replace(/\\;/g, ";").trim();
      else if (/^(ITEM\d+\.)?N(;|$)/.test(key) && !cur.name) { const p = val.split(";"); cur.name = [p[1], p[0]].filter(Boolean).join(" ").trim(); }
      else if (/^(ITEM\d+\.)?BDAY(;|$)/.test(key)) {
        const v = val.replace(/T.*$/, ""), m = v.match(/^(?:\d{4}|--)-?(\d{2})-?(\d{2})$/) || v.match(/^(\d{4})?-?-?(\d{2})-?(\d{2})$/);
        if (m) { const mm = m.length === 3 ? m[1] : m[2], dd = m.length === 3 ? m[2] : m[3], d = `${mm}-${dd}`; if (BD_RE.test(d)) cur.d = d; }
      }
    }
  }
  return out;
}
function bdImportVcf(file, done) {
  const r = new FileReader();
  r.onload = () => {
    const list = vcfParse(r.result), have = new Set((settings.bdays || []).map(b => norm(b.name) + "|" + b.d));
    const fresh = list.filter(x => !have.has(norm(x.name) + "|" + x.d));
    if (!list.length) { toast("Aucun anniversaire trouvé dans ce fichier"); return; }
    if (!fresh.length) { toast("Tous ces anniversaires sont déjà dans ta liste"); return; }
    const f = openForm(`<div class="f2"><h3>📇 ${fresh.length} anniversaire${fresh.length > 1 ? "s" : ""} trouvé${fresh.length > 1 ? "s" : ""}</h3>
      <p class="hint" style="margin:0 0 8px">Décoche ceux que tu ne veux pas suivre. Seuls le prénom et la date sont gardés.</p>
      <div class="vcf-list">${fresh.map((x, i) => `<label class="vcf-row"><input type="checkbox" data-vi="${i}" checked><span>${esc(x.name)}</span><small>${esc(bdFmt(x.d))}</small></label>`).join("")}</div></div>`, () => {
      const keep = [...f.querySelectorAll("[data-vi]")].filter(c => c.checked).map(c => fresh[+c.dataset.vi]);
      if (!keep.length) { toast("Aucun anniversaire choisi"); return false; }
      settings.bdays = (settings.bdays || []).concat(keep.map(x => ({ name: x.name.slice(0, 40), d: x.d }))); saveSettings(); render();
      toast(`🎂 ${keep.length} anniversaire${keep.length > 1 ? "s" : ""} ajouté${keep.length > 1 ? "s" : ""}`); if (done) setTimeout(done, 250);
    });
    f.querySelector("button[type=submit]").textContent = "Ajouter";
  };
  r.readAsText(file);
}
