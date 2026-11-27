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
    <button type="button" class="linkbtn danger acc-del" id="delAcc">Supprimer mon compte</button>
    ${bk ? `<button type="button" class="linkbtn" id="resetUndo" style="margin-top:10px">↩︎ Restaurer la sauvegarde du ${esc(new Date(bk.at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }))}</button>` : ""}</div>`;
}
function resetBind() {
  document.querySelectorAll("[data-reset]").forEach(b => b.onclick = () => resetOpen(b.dataset.reset));
  const da = document.getElementById("delAcc"); if (da) da.onclick = () => accDeleteOpen();
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

// ---------- Supprimer mon compte ----------
// Efface tout : le budget (dans le Drive ou OneDrive, et sur l'appareil), et sur le serveur le tag, l'avatar, les moyens de
// paiement, les notifications et rappels. Ce qui a été partagé avec d'autres (groupes, cagnottes, messages) reste chez eux,
// sous le seul prénom. Puis on se déconnecte en retirant l'accès au Drive. Exigé par Google Play et l'App Store.
function accDeleteOpen() {
  const soc = typeof socOn === "function" && socOn(), tag = typeof SOC !== "undefined" && SOC.tag ? SOC.tag : "";
  const f = openForm(`<div class="f2"><h3>Supprimer mon compte</h3>
    <p style="margin:0 0 8px">C'est définitif. Seront effacés :</p>
    <ul class="acc-del-l"><li>tout ton budget : opérations, suivis, réglages${store && store.label && store.id !== "local" ? ` (le fichier Bourselle de ton ${esc(store.label)} est vidé)` : ""} ;</li>
      ${soc ? `<li>ton tag${tag ? " @" + esc(tag) : ""}, ton avatar, tes moyens de paiement, tes notifications et tes rappels ;</li>` : ""}
      <li>les données gardées sur ce téléphone.</li></ul>
    ${soc ? `<p class="hint" style="margin:0 0 10px">Ce que tu as partagé avec d'autres (groupes, cagnottes, messages) reste visible pour eux, sous ton prénom seulement, pour que leurs comptes restent justes.</p>` : ""}
    <p class="hint" style="margin:0 0 10px">Conseil : exporte d'abord tes données (Paramètres › Exporter mes données) si tu veux les garder.</p>
    <label class="lbl" for="adConfirm">Pour confirmer, écris SUPPRIMER</label>
    <input class="field" id="adConfirm" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="SUPPRIMER"></div>`, () => {
    if (f.querySelector("#adConfirm").value.trim().toUpperCase() !== "SUPPRIMER") { toast("Écris SUPPRIMER pour confirmer"); return false; }
    accDeleteDo(); return true;
  });
  const sb = f.querySelector("button[type=submit]"); sb.textContent = "Supprimer définitivement"; sb.classList.remove("primary"); sb.classList.add("danger");
}
async function accDeleteDo() {
  toast("Suppression en cours…");
  // 1. Le serveur (si connecté)
  if (typeof socOn === "function" && socOn()) {
    try { await socApi("/me/delete", { method: "POST", body: JSON.stringify({ confirm: "SUPPRIMER" }) }); }
    catch (e) { toast("Suppression impossible pour l'instant : " + (e.message || "réessaie") + ". Rien n'a été effacé."); return; }
    try { const sub = typeof pushSupported === "function" && pushSupported() ? await Promise.race([pushSub(false), new Promise(r => setTimeout(() => r(null), 1500))]) : null; if (sub) await sub.unsubscribe(); } catch (e) {}
  }
  // 2. Le budget : on enregistre un fichier vide dans le Drive ou OneDrive
  months = {}; subs = {}; recs = {}; goals = {}; tontines = {}; trips = {}; accounts = {}; patri = {}; debts = {}; groups = {};
  settings = clone(DEFAULT_SETTINGS); settings.deleted = Date.now();
  try { if (store && store.id !== "local") { const v = await store.save(snapshot()); if (v) version = v; } } catch (e) {}
  // 3. L'appareil : toutes les clés de Bourselle
  try { for (const k of Object.keys(localStorage)) if (/^(bourselle|mb-)/.test(k)) localStorage.removeItem(k); sessionStorage.clear(); } catch (e) {}
  try { if (typeof dropPending === "function") dropPending(); } catch (e) {}
  dirty = false;
  // 4. Déconnexion en retirant l'accès au Drive
  try { signOut(true); } catch (e) { location.reload(); return; }
  const m = document.getElementById("loginMsg"); if (m) m.textContent = "Ton compte Bourselle est supprimé. Tu peux aussi effacer le dossier « Bourselle » de ton Drive ou OneDrive.";
}
// Lien « …/?supprimer=1 » (page web de suppression de compte) : après la connexion, la fenêtre de suppression s'ouvre
{ if (new URLSearchParams(location.search).get("supprimer") === "1") { try { sessionStorage.setItem("bourselle-del", "1"); } catch (e) {} history.replaceState(null, "", location.pathname); } }
function accDeleteFromUrl() { let w = ""; try { w = sessionStorage.getItem("bourselle-del"); sessionStorage.removeItem("bourselle-del"); } catch (e) {} if (w) { switchTab("reglages"); setTimeout(accDeleteOpen, 600); } }
