/* Bourselle — onglet Profil compact.
 * Les cartes des réglages sont rangées en rubriques ; chacune se replie et se déroule d'un toucher (l'état est retenu).
 * « Mon compte » reste toujours ouvert. Les trois listes de choix sont réunies en une seule carte. */
const PF_GROUPS = [
  ["Paiements et contacts", ["Me faire payer", "Mes contacts Bourselle", "Verrouillage et clé d'accès", "Mes comptes", "Bourselle Plus"]],
  ["Préférences", ["Apparence", "Langue et devise", "Notifications en direct", "Rappel des garanties"]],
  ["Mon budget", ["Combien as-tu vraiment ?", "Budget mensuel par catégorie", "Listes de choix", "Opérations automatiques", "Importer un relevé bancaire"]],
  ["Données et app", ["Exporter mes données", "Installer sur ton téléphone", "Version de l'app", "Outils"]],
  ["Aide", ["Une suggestion, un problème ?", "À propos"]],
  ["", ["Recommencer à zéro"]],
];
const PF_KEY = "bourselle-profil-ouvert";
const pfOpen = () => { try { return new Set(JSON.parse(localStorage.getItem(PF_KEY) || "[]")); } catch (e) { return new Set(); } };
const pfSave = s => { try { localStorage.setItem(PF_KEY, JSON.stringify([...s])); } catch (e) {} };
const pfTitle = card => { const h = card.querySelector(":scope > h2"); if (!h) return ""; const t = [...h.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()); return t ? t.textContent.trim() : ""; };
const PF_CHEV = '<svg class="pf-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

function pfOrganize() {
  const v = document.getElementById("view"); if (!v) return;
  const cards = [...v.querySelectorAll(":scope > .card")], byTitle = new Map();
  for (const c of cards) { const t = pfTitle(c); if (t && !byTitle.has(t)) byTitle.set(t, c); }
  const first = byTitle.get("Mon compte"); if (!first) return;
  // Les trois listes de choix → une carte
  const lists = ["Sources de rentrées", "Comptes épargne", "Types d'investissement"].map(t => byTitle.get(t)).filter(Boolean);
  if (lists.length) {
    const box = document.createElement("div"); box.className = "card"; box.innerHTML = `<h2>Listes de choix</h2><p class="hint" style="margin:0 0 6px">Les choix proposés dans le formulaire. Sépare-les par des virgules.</p>`;
    for (const c of lists) {
      const lab = document.createElement("label"); lab.className = "lbl"; lab.textContent = pfTitle(c);
      const inp = c.querySelector("input"); if (inp) lab.htmlFor = inp.id;
      box.appendChild(lab); if (inp) box.appendChild(inp); c.remove();
    }
    byTitle.set("Listes de choix", box);
  }
  const open = pfOpen();
  let anchor = first;
  const place = el => { anchor.after(el); anchor = el; };
  const used = new Set([first]);
  // Chaque rubrique = un bloc arrondi de lignes (comme le menu de la photo) ; une ligne se déroule d'un toucher
  const grps = [];
  for (const [label, titles] of PF_GROUPS) {
    const items = titles.map(t => byTitle.get(t)).filter(Boolean);
    if (!items.length) continue;
    if (label) { const h = document.createElement("div"); h.className = "pf-sec"; h.textContent = label; place(h); }
    const g = document.createElement("div"); g.className = "pf-grp"; place(g); grps.push(g);
    for (const c of items) { g.appendChild(c); used.add(c); pfFold(c, open); }
  }
  // Cartes non prévues (ajoutées plus tard) : avant l'aide, repliables aussi
  const extra = cards.filter(c => !used.has(c) && c.isConnected && c !== first && !lists.includes(c));
  if (extra.length) { const g = document.createElement("div"); g.className = "pf-grp"; const aide = [...v.querySelectorAll(".pf-sec")].find(h => h.textContent === "Aide");
    if (aide) aide.before(g); else v.appendChild(g); for (const c of extra) { g.appendChild(c); pfFold(c, open); } }
  // Ce qui n'est pas une carte (anciens titres de rubrique…) et reste entre les blocs : retiré
  [...v.children].forEach(el => { if (el.classList.contains("pf-sec") || el.classList.contains("pf-grp") || el === first || el.classList.contains("banner")) return; if (!el.classList.contains("card")) el.remove(); });
}
function pfFold(card, open) {
  if (card.classList.contains("pf-card")) return;
  const key = pfTitle(card), h = card.querySelector(":scope > h2"); if (!h || !key) return;
  // Bouton « Combien as-tu vraiment ? » : déjà une seule ligne d'action, on le laisse tel quel
  if (card.tagName === "BUTTON") return;
  card.classList.add("pf-card");
  const body = document.createElement("div"); body.className = "pf-body";
  while (h.nextSibling) body.appendChild(h.nextSibling);
  card.appendChild(body);
  h.insertAdjacentHTML("beforeend", PF_CHEV);
  h.setAttribute("role", "button"); h.tabIndex = 0;
  const set = o => { card.classList.toggle("pf-open", o); h.setAttribute("aria-expanded", String(o)); };
  set(open.has(key));
  const toggle = ev => {
    if (ev.target.closest("button, a, input, select, label")) return;   // un bouton dans le titre garde son rôle
    const s = pfOpen(), o = !card.classList.contains("pf-open"); o ? s.add(key) : s.delete(key); pfSave(s); set(o);
  };
  h.onclick = toggle; h.onkeydown = ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(ev); } };
}
{
  const _rr = renderReglages;
  renderReglages = function () { _rr.apply(this, arguments); try { pfOrganize(); } catch (e) { console.error(e); } };
}
// Aller à une carte des Paramètres (dépliée, mise en évidence) : ex. « Modifier » sur le budget du mois
function pfGoto(title) {
  const s = pfOpen(); s.add(title); pfSave(s);
  switchTab("reglages");
  setTimeout(() => {
    const c = [...document.querySelectorAll("#view .card")].find(x => pfTitle(x) === title); if (!c) return;
    c.classList.add("pf-open"); c.scrollIntoView({ block: "start", behavior: "smooth" });
    c.classList.add("pf-flash"); setTimeout(() => c.classList.remove("pf-flash"), 2000);
  }, 80);
}
