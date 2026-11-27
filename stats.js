/* Bourselle — compteurs anonymes, pour savoir si l'appli sert vraiment (personnes actives, invitations, partages, bons plans).
 * On n'envoie qu'un mot (« actif », « invite »…), au plus une fois par jour : ni montant, ni nom, ni contenu.
 * Le serveur ne garde qu'un total par jour. Seul le propriétaire voit les chiffres (Paramètres › Une suggestion…). */
const STAT_LBL = { actif: "Personnes actives", nouveau: "Nouveaux comptes", ob: "Accueil terminé", invite: "Invitations envoyées", partage: "Liens partagés", bonplan: "Bons plans utilisés", cagnotte: "Cagnottes créées" };
function statHit(k) {
  if (!(typeof socOn === "function" && socOn()) || !STAT_LBL[k]) return;
  const day = todayISO(), key = "bourselle-st-" + k;
  try { if (localStorage.getItem(key) === day) return; localStorage.setItem(key, day); } catch (e) {}
  socApi("/me/stats", { method: "POST", body: JSON.stringify({ k }) }).catch(() => { try { localStorage.removeItem(key); } catch (e) {} });
}
async function statAdminLoad() {
  const box = document.getElementById("fbAdmin"); if (!box || !FB_OWNER) return;
  let days; try { days = (await socApi("/me/stats")).days || []; } catch (e) { return; }
  const sum = (k, n) => days.slice(0, n).reduce((a, d) => a + (d.n[k] || 0), 0);
  const avg7 = Math.round(sum("actif", 7) / 7 * 10) / 10, today = (days[0] && days[0].n.actif) || 0;
  const max = Math.max(1, ...days.map(d => d.n.actif || 0));
  const bars = days.slice().reverse().map(d => `<i style="height:${Math.round((d.n.actif || 0) / max * 100)}%" title="${esc(d.day)} : ${d.n.actif || 0}"></i>`).join("");
  const el = document.createElement("div"); el.className = "st-box"; el.id = "stAdmin";
  el.innerHTML = `<span class="lbl" style="margin-top:14px;display:block">Utilisation (anonyme)</span>
    <div class="st-kpi"><div><b class="num">${today}</b><small>actifs aujourd'hui</small></div><div><b class="num">${avg7.toLocaleString(appLocale())}</b><small>actifs par jour (7 j)</small></div></div>
    <div class="st-bars" aria-label="Personnes actives par jour, 30 derniers jours">${bars}</div>
    <table class="st-tab"><tr><th></th><th>7 j</th><th>30 j</th></tr>${Object.keys(STAT_LBL).filter(k => k !== "actif").map(k => `<tr><td>${esc(STAT_LBL[k])}</td><td class="num">${sum(k, 7)}</td><td class="num">${sum(k, 30)}</td></tr>`).join("")}</table>
    <p class="hint" style="margin:6px 0 0">Un total par jour, sans rien sur les personnes. Chacun compte au plus une fois par jour.</p>`;
  const old = document.getElementById("stAdmin"); if (old) old.remove();
  box.prepend(el);
}
// Ce qu'on compte : un toucher sur un bouton d'invitation ou de bon plan, et chaque partage par la feuille du téléphone
document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("button, a"); if (!t) return;
  if (t.matches("#ivWa, #ivSms, #ivSh, #ivCp, #socShare, #socQrShare, #socCopy, #obShare")) statHit("invite");
  if (t.matches("[data-ogo], [data-oused]")) statHit("bonplan");
}, true);
try { if (navigator.share) { const sh0 = navigator.share.bind(navigator); navigator.share = d => { statHit("partage"); return sh0(d); }; } } catch (e) {}
