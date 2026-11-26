// Paramètres › Recommencer à zéro : réinitialiser les réglages, effacer ses données, ou les deux.
// On ne touche jamais au tag, aux contacts ni aux partages avec les autres membres (groupes partagés, demandes, discussions).
// Une copie de sauvegarde est gardée 30 jours sur l'appareil pour pouvoir revenir en arrière.
const RESET_BK = "bourselle-backup-reset";
// Réglages gardés quoi qu'il arrive : identité, proches, devise, version, licence
const RESET_KEEP = ["currency", "mode", "contacts", "favs", "prochesHidden", "licence", "chalMine", "actCleared", "ndfTrial", "fxLast", "shareCutoff", "alertsOff"];

function resetBackup() { try { const b = JSON.parse(localStorage.getItem(RESET_BK) || "null"); return b && Date.now() - b.at < 30 * 864e5 ? b : null; } catch (e) { return null; } }
function resetCardHTML() {
  const bk = resetBackup();
  return `<div class="card reset-card"><h2>Recommencer à zéro</h2>
    <p class="hint" style="margin:0 0 10px">Ton tag, tes proches et tes partages avec les autres membres sont toujours gardés.</p>
    <div class="reset-btns">
      <button type="button" class="btn" data-reset="settings">↺ Réinitialiser les réglages</button>
      <button type="button" class="btn danger" data-reset="data">🗑 Effacer mes données</button>
      <button type="button" class="btn danger" data-reset="all">⚠️ Réinitialiser toute l'appli</button>
    </div>
    ${bk ? `<button type="button" class="linkbtn" id="resetUndo" style="margin-top:10px">↩︎ Restaurer la sauvegarde du ${esc(new Date(bk.at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }))}</button>` : ""}</div>`;
}
function resetBind() {
  document.querySelectorAll("[data-reset]").forEach(b => b.onclick = () => resetOpen(b.dataset.reset));
  const u = document.getElementById("resetUndo"); if (u) u.onclick = resetRestore;
}
// Partages en cours : groupes partagés avec un solde, dettes liées à un proche Bourselle, demandes de paiement ouvertes
function resetShares() {
  const sg = Object.values(groups || {}).filter(g => g.shared || (g.members || []).some(m => m.tag));
  const sd = Object.values(debts || {}).filter(d => d.claim || d.claimTo || d.group);
  const open = c => c.kind === "req" && !["settled", "cancelled", "declined"].includes(c.status);
  const sr = typeof SOC !== "undefined" ? [...(SOC.in || []), ...(SOC.out || [])].filter(open) : [];
  return { n: sg.length + sd.length + sr.length, sg, sd, sr };
}
function resetOpen(kind) {
  const T = { settings: ["Réinitialiser les réglages", "Tes catégories, budgets, listes de rentrées et d'épargne, règles d'import et alertes reviennent comme au premier jour. Tes opérations et tes suivis ne bougent pas."],
    data: ["Effacer mes données", "Toutes tes saisies sont effacées : opérations, budgets du mois, abonnements, garanties, dettes, objectifs, économies, comptes, patrimoine et groupes qui ne sont qu'à toi. Tes réglages sont gardés."],
    all: ["Réinitialiser toute l'appli", "Toutes tes saisies sont effacées et tes réglages reviennent comme au premier jour : tu repars de zéro."] }[kind];
  const sh = kind === "settings" ? { n: 0 } : resetShares();
  let keepShares = true, armed = false;
  const f = openForm(`<div class="f2"><h3>${esc(T[0])}</h3><p style="margin:0 0 10px">${esc(T[1])}</p>
    <p class="hint" style="margin:0 0 10px">Toujours gardés : ton tag @${esc(typeof SOC !== "undefined" && SOC.tag ? SOC.tag : "…")}, tes proches, tes discussions et tes partages avec les autres membres. Une sauvegarde reste 30 jours sur ce téléphone pour revenir en arrière.</p>
    ${sh.n ? `<span class="lbl">Tes partages en cours (${sh.n})</span>
      <div class="cur-pick" id="rsKeep">
        <button type="button" class="cur-opt" data-k="1" aria-pressed="true"><b>Les reprendre dans mes nouveaux comptes</b><small>Ce que tu dois et ce qu'on te doit reste compté avec tes nouvelles saisies.</small></button>
        <button type="button" class="cur-opt" data-k="0" aria-pressed="false"><b>Repartir sans eux</b><small>Ils restent visibles pour les autres membres, mais ne comptent plus chez toi. Seuls les nouveaux partages seront pris en compte.</small></button>
      </div>` : ""}</div>`, () => {
    const sb = f.querySelector("button[type=submit]");
    if (!armed) { armed = true; sb.textContent = "Vraiment ? Touche encore pour confirmer"; sb.classList.add("danger"); setTimeout(() => { armed = false; sb.textContent = T[0]; sb.classList.remove("danger"); }, 5000); return false; }
    resetDo(kind, keepShares); return true;
  });
  f.querySelector("button[type=submit]").textContent = T[0];
  f.querySelectorAll("#rsKeep [data-k]").forEach(b => b.onclick = () => { keepShares = b.dataset.k === "1"; f.querySelectorAll("#rsKeep [data-k]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); });
}
function resetDo(kind, keepShares) {
  try { localStorage.setItem(RESET_BK, JSON.stringify({ at: Date.now(), kind, data: snapshot() })); }
  catch (e) { toast("Sauvegarde impossible sur ce téléphone (trop de données) : l'effacement est annulé. Exporte d'abord tes données."); return; }
  if (kind === "settings" || kind === "all") {
    const keep = {}; for (const k of RESET_KEEP) if (settings[k] !== undefined) keep[k] = settings[k];
    settings = { ...clone(DEFAULT_SETTINGS), ...keep };
    if (typeof catLangSync === "function") catLangSync();
  }
  if (kind === "data" || kind === "all") {
    const sh = resetShares();
    months = {}; subs = {}; recs = {}; goals = {}; tontines = {}; trips = {}; accounts = {}; patri = {};
    // Groupes : seuls ceux qui ne sont qu'à moi sont effacés
    for (const [id, g] of Object.entries(groups)) if (!(g.shared || (g.members || []).some(m => m.tag))) delete groups[id];
    // Dettes : celles liées à un proche Bourselle sont gardées si on reprend les partages
    const kd = {}; if (keepShares) for (const [id, d] of Object.entries(debts)) if (d.claim || d.claimTo || d.group) kd[id] = d;
    debts = kd;
    if (!keepShares && sh.n) settings.shareCutoff = Date.now(); else delete settings.shareCutoff;
  }
  settings.mode = settings.mode || "simple";
  applyCurrency(); saveSettings(); saveMonth(); saveSubs(); saveDebts(); saveRecs(); saveGoals(); saveGroups(); saveTontines();
  try { saveNow(); } catch (e) {}
  openGroup = null; render();
  toast(kind === "settings" ? "Réglages réinitialisés" : "C'est tout propre : à toi de jouer ✨");
}
function resetRestore() {
  const bk = resetBackup(); if (!bk) return;
  const f = openForm(`<div class="f2"><h3>Restaurer la sauvegarde ?</h3><p style="margin:0">Tes données et réglages reviennent comme avant l'effacement du ${esc(new Date(bk.at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }))}. Ce que tu as saisi depuis sera remplacé.</p></div>`, () => {
    const cur = groups; applyData(bk.data);
    // Les groupes partagés ont pu bouger depuis : on garde leur version actuelle
    for (const [id, g] of Object.entries(cur)) if (g.shared) groups[id] = g;
    saveSettings(); saveMonth(); saveSubs(); saveDebts(); saveRecs(); saveGoals(); saveGroups(); saveTontines(); try { saveNow(); } catch (e) {}
    try { localStorage.removeItem(RESET_BK); } catch (e) {}
    render(); toast("Sauvegarde restaurée"); return true;
  });
  f.querySelector("button[type=submit]").textContent = "Restaurer";
}
