/* Bourselle — recherche intelligente, calculée sur le téléphone (rien n'est envoyé).
 * Comprend des questions comme « combien j'ai dépensé en resto ce mois-ci ? », « mes 5 plus grosses dépenses en octobre »,
 * « combien de fois chez Carrefour cette année ? », « moyenne par mois en courses », « compare mes sorties avec le mois dernier »,
 * « quand ai-je payé Netflix pour la dernière fois ? », « dépenses de plus de 100 € », « où j'ai le plus dépensé la semaine dernière ? ».
 * smartParse(texte) → { from, to, label, cat, words, type, intent, min, max, n } ; smartAnswer(texte) → réponse HTML + opérations trouvées. */
const smN = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, " ").replace(/\s+/g, " ").trim();
const SM_MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
const SM_MOIS_EN = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const smIso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const smD = iso => new Date(iso + "T12:00:00");
const smMonthEnd = (y, m) => smIso(new Date(y, m + 1, 0));
// Mots du langage courant → catégories par défaut
const SM_SYN = {
  loisirs: ["resto", "restau", "restaurant", "restos", "bar", "bars", "sortie", "sorties", "cine", "cinema", "concert", "loisir", "loisirs", "kebab", "mcdo", "fast", "brunch", "apero", "boite", "theatre", "netflix", "spotify", "jeux", "jeu"],
  courses: ["course", "courses", "supermarche", "supermarches", "alimentation", "bouffe", "nourriture", "epicerie", "marche", "carrefour", "leclerc", "auchan", "lidl", "intermarche", "monoprix", "franprix", "aldi", "casino", "picard"],
  transport: ["transport", "transports", "essence", "carburant", "gasoil", "diesel", "plein", "train", "sncf", "metro", "bus", "uber", "taxi", "vtc", "parking", "peage", "navigo", "voiture", "avion"],
  logement: ["loyer", "logement", "appartement", "appart", "maison", "charges", "proprio"],
  energie: ["electricite", "edf", "engie", "gaz", "eau", "chauffage", "energie"],
  telecom: ["internet", "box", "forfait", "mobile", "telephone", "portable", "telecom", "orange", "sfr", "bouygues", "free"],
  assurances: ["assurance", "assurances", "mutuelle"],
  credits: ["credit", "credits", "pret", "emprunt", "mensualite"],
  sante: ["sante", "medecin", "docteur", "pharmacie", "medicament", "medicaments", "dentiste", "kine", "hopital", "lunettes"],
  enfants: ["enfant", "enfants", "ecole", "creche", "nounou", "cantine", "education", "scolaire"],
  shopping: ["shopping", "vetement", "vetements", "habits", "fringues", "chaussures", "zara", "amazon", "habillement"],
  maison: ["bricolage", "deco", "decoration", "meuble", "meubles", "ikea", "jardin", "entretien", "menage"],
  impots: ["impot", "impots", "taxe", "taxes", "amende"],
  cadeaux: ["cadeau", "cadeaux", "don", "dons", "anniversaire"],
};
const SM_STOP = new Set(("a au aux avec ce ces cet cette chez combien comment dans de des du elle en et est etait il j je jai ai la le les leur lui ma mais me mes moi mon ne nous on ou par pas pour qu que quel quelle quelles quels qui sa se ses son sur ta te tes toi ton tu un une vos votre vous y " +
  "depense depenses depenser depensee depensees achete achat achats paye payer paie paiement paiements operation operations transaction transactions total totale montant argent euros euro eur sous fois nombre " +
  "mois semaine semaines jour jours an ans annee annees dernier derniere derniers dernieres precedent precedente passe passee ci cette ce aujourd hui hier depuis debut entre plus moins grosse grosses gros petite petites cher chere chers top liste montre affiche donne dis " +
  "quand moyenne moyen compare comparer comparaison rapport vs evolution chaque repartition categorie categories est-ce estce ai-je aije combien-de as tu t il y a fait faites the how much many what when my in on of for last this month week year spent spend " +
  "puis peux pourrais permettre acheter magasin magasins marchand marchands commerce commerces enseigne enseignes site sites boutique boutiques endroit endroits trimestre weekend week-end toujours tout tous toutes gagne recu touche revenu revenus rentree rentrees salaire epargne epargnes economise investi plus-de moins-de superieur inferieur dessus dessous budget budgets").split(" "));
function smPeriod(n) {
  const T = todayISO(), td = smD(T), y = td.getFullYear(), m = td.getMonth();
  const P = (from, to, label) => ({ from, to, label });
  let r;
  if (/avant[- ]hier/.test(n)) { const d = addDays(T, -2); return P(d, d, "avant-hier"); }
  if (/aujourd ?hui|today/.test(n)) return P(T, T, "aujourd'hui");
  if (/\bhier\b|yesterday/.test(n)) { const d = addDays(T, -1); return P(d, d, "hier"); }
  if ((r = /(\d+) (derniers?|dernieres?) (jours?|semaines?|mois|ans?|annees?)|(?:last|past) (\d+) (days?|weeks?|months?|years?)|depuis (\d+) (jours?|semaines?|mois|ans?)/.exec(n))) {
    const k = Number(r[1] || r[4] || r[6]), u = r[3] || r[5] || r[7];
    const from = /^j|^d/.test(u) ? addDays(T, -k + 1) : /^s|^w/.test(u) ? addDays(T, -7 * k + 1) : /^m/.test(u) ? addDays(smIso(new Date(y, m - k, td.getDate())), 1) : smIso(new Date(y - k, m, td.getDate() + 1));
    return P(from, T, `sur les ${k} derniers ${/^j|^d/.test(u) ? "jours" : /^s|^w/.test(u) ? "semaines" : /^m/.test(u) ? "mois" : "ans"}`.replace(/sur les 1 derniers (\w+)s/, "sur le dernier $1"));
  }
  if (/semaine (derniere|passee|precedente)|last week/.test(n)) { const dow = (td.getDay() + 6) % 7, mon = addDays(T, -dow - 7); return P(mon, addDays(mon, 6), "la semaine dernière"); }
  if (/cette semaine|this week|depuis lundi/.test(n)) { const dow = (td.getDay() + 6) % 7; return P(addDays(T, -dow), T, "cette semaine"); }
  if (/(ce |le )?(week[- ]?end|we)\b/.test(n) && /week|\bwe\b/.test(n)) { const dow = td.getDay(), sat = dow === 6 ? T : dow === 0 ? addDays(T, -1) : addDays(T, -(dow + 1)); return P(sat, addDays(sat, 1), "le week-end"); }
  if (/(mois (dernier|precedent|passe))|last month/.test(n)) { const d = new Date(y, m - 1, 1); return P(smIso(d), smMonthEnd(d.getFullYear(), d.getMonth()), "le mois dernier"); }
  if (/ce mois|mois[- ]ci|this month|du mois\b|depuis le debut du mois/.test(n)) return P(smIso(new Date(y, m, 1)), T, "ce mois-ci");
  if (/ce trimestre|this quarter/.test(n)) return P(smIso(new Date(y, m - m % 3, 1)), T, "ce trimestre");
  if (/(l ?an (dernier|passe)|l ?annee (derniere|passee|precedente)|last year)/.test(n)) return P(`${y - 1}-01-01`, `${y - 1}-12-31`, `en ${y - 1}`);
  if (/(cette annee|this year|depuis (le )?debut de l ?annee|depuis janvier|de l ?annee)/.test(n)) return P(`${y}-01-01`, T, "cette année");
  // un mois nommé (« en octobre », « octobre 2025 », « octobre dernier »)
  for (let i = 0; i < 12; i++) {
    const re = new RegExp(`\\b(${SM_MOIS[i]}|${SM_MOIS_EN[i]})\\b( (\\d{4}))?`); const mm = re.exec(n);
    if (mm) { let yy = mm[3] ? Number(mm[3]) : (i > m ? y - 1 : y); const from = `${yy}-${String(i + 1).padStart(2, "0")}-01`, to = smMonthEnd(yy, i); return P(from, to > T ? T : to, `en ${SM_MOIS[i] === "aout" ? "août" : SM_MOIS[i] === "fevrier" ? "février" : SM_MOIS[i] === "decembre" ? "décembre" : SM_MOIS[i]}${yy !== y ? " " + yy : ""}`); }
  }
  if ((r = /\b(20\d\d)\b/.exec(n))) { const yy = Number(r[1]); return P(`${yy}-01-01`, yy === y ? T : `${yy}-12-31`, `en ${yy}`); }
  if (/(depuis toujours|au total|en tout|depuis le debut|tout le temps|all time|ever|jamais)/.test(n)) return P("0000-01-01", T, "depuis le début");
  return null;
}
function smPrev(p) {   // la période d'avant, de même durée (pour comparer)
  if (!p || p.from === "0000-01-01") return null;
  const a = smD(p.from), b = smD(p.to), T = todayISO();
  if (p.label === "ce mois-ci" || /^en [a-zé]+( \d{4})?$/.test(p.label) && a.getDate() === 1 && !/^en \d{4}$/.test(p.label)) {
    const d = new Date(a.getFullYear(), a.getMonth() - 1, 1), full = smMonthEnd(d.getFullYear(), d.getMonth());
    const to = p.to === T ? smIso(new Date(d.getFullYear(), d.getMonth(), Math.min(b.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))) : full;
    return { from: smIso(d), to, label: (p.label === "ce mois-ci" ? "le mois dernier" : `en ${SM_MOIS[d.getMonth()]}`) + (p.to === T ? " à la même date" : "") };
  }
  if (p.label === "cette année" || /^en \d{4}$/.test(p.label)) { const yy = a.getFullYear() - 1; return { from: `${yy}-01-01`, to: p.to === T ? `${yy}${T.slice(4)}` : `${yy}-12-31`, label: `en ${yy}${p.to === T ? " à la même date" : ""}` }; }
  const len = Math.round((b - a) / 864e5) + 1; return { from: addDays(p.from, -len), to: addDays(p.from, -1), label: "la période d'avant" };
}
// Les enseignes : on cherche d'abord le nom dans les libellés (« Netflix », « Carrefour »), sinon on prend la catégorie
const SM_BRAND = new Set("carrefour leclerc auchan lidl intermarche monoprix franprix aldi casino picard netflix spotify sncf uber edf engie orange sfr bouygues free zara amazon ikea mcdo navigo".split(" "));
let smNoteWords = null, smNoteAt = 0;
function smInNotes(w) { if (!smNoteWords || Date.now() - smNoteAt > 5000) { smNoteWords = allItems().map(x => smN(x.note)).join(" "); smNoteAt = Date.now(); } return smNoteWords.includes(w); }
function smCats(n, tokens) {
  const out = new Set(), used = new Set(), ids = new Set((settings.cats || []).map(c => c.id));
  for (const [id, words] of Object.entries(SM_SYN)) if (ids.has(id)) for (const w of words) if (tokens.includes(w) && !(SM_BRAND.has(w) && smInNotes(w))) { out.add(id); used.add(w); }
  for (const c of settings.cats || []) {
    const parts = smN(c.name).split(/[^a-z0-9]+/).filter(w => w.length >= 4);
    for (const w of parts) for (const t of tokens) if (t.length >= 4 && (t === w || (t.length >= 5 && w.startsWith(t.slice(0, 5))) || (w.length >= 5 && t.startsWith(w.slice(0, 5))))) { out.add(c.id); used.add(t); }
  }
  return { cats: [...out], used };
}
function smParse(q) {
  const n = smN(q), tokens = n.split(/[^a-z0-9]+/).filter(Boolean);
  const p = { q, n, period: smPeriod(n), intent: "sum", type: "", min: null, max: null, topN: null };
  // Type d'opération
  if (/(gagne|recu|touche|encaiss|rentree|revenu|salaire|income|earned|paye moi|vir(e|ement) recu)/.test(n)) p.type = "rentree";
  else if (/(epargn|mis de cote|mettre de cote|mis a cote|saved|savings)/.test(n)) p.type = "epargne";
  else if (/invest/.test(n)) p.type = "invest";
  else if (/(depens|achet|paye|spent|spend|cout|coute|frais)/.test(n)) p.type = "depense";
  // Montants (« plus de 50 », « moins de 20 », « entre 10 et 50 », « > 100 »)
  let r;
  if ((r = /entre (\d+(?:[.,]\d+)?) ?(?:e|eur|euros?)? et (\d+(?:[.,]\d+)?)/.exec(n))) { p.min = parseFloat(r[1].replace(",", ".")); p.max = parseFloat(r[2].replace(",", ".")); }
  else {
    if ((r = /(plus de|plus que|superieure? a|au[- ]dessus de|over|more than|>) ?(\d+(?:[.,]\d+)?)/.exec(n))) p.min = parseFloat(r[2].replace(",", "."));
    if ((r = /(moins de|moins que|inferieure? a|en[- ]dessous de|under|less than|<) ?(\d+(?:[.,]\d+)?)/.exec(n))) p.max = parseFloat(r[2].replace(",", "."));
  }
  if ((r = /\b(\d{1,2}) (plus|dernier|derniere|premiers?|top)|top (\d{1,2})/.exec(n))) p.topN = Number(r[1] || r[3]);
  // Intention
  if (/combien de fois|nombre d|how many times|how often|frequence/.test(n)) p.intent = "count";
  else if (/(derniere fois|dernier (achat|paiement|passage|plein)|quand (ai|est|j|ai-je|est-ce)|last time|when did)/.test(n)) p.intent = "last";
  else if (/premiere fois|first time/.test(n)) p.intent = "first";
  else if (/(plus (grosse|grosses|gros|cher|chere|chers|cheres|importante|importantes|grande|grandes)|biggest|largest|most expensive)/.test(n)) p.intent = "max";
  else if (/(plus petite|moins cher|smallest|cheapest)/.test(n)) p.intent = "min";
  else if (/(compar|par rapport|\bvs\b|versus|plus que le|moins que le|augment|baiss|difference|evolu)/.test(n)) p.intent = "compare";
  else if (/(mois par mois|chaque mois|par mois|month by month|per month|en moyenne|moyenne|average|par semaine|par jour|per day|per week)/.test(n)) p.intent = /mois par mois|chaque mois|month by month/.test(n) ? "bymonth" : "avg";
  else if (/(chez qui|quel (magasin|marchand|commer|enseigne|site)|quels (magasins|marchands|commerces|sites)|quelles enseignes)/.test(n)) p.intent = "merchants";
  else if (/(quelle categorie|quelles categories|par categorie|repartition|ou part|ou va|ou passe|plus depense|depense le plus|ou j ?ai le plus|ou je depense|breakdown)/.test(n)) p.intent = "cats";
  else if (/^(liste|montre|affiche|donne|quelles?|lesquelles|mes |toutes|tous|detail|show|list)/.test(n) || /\b(liste|detail)\b/.test(n)) p.intent = "list";
  if (p.intent === "compare" && /(avec|par rapport (a|au)|que|vs|versus|to) (le |la |l )?(mois (dernier|precedent)|semaine (derniere|precedente)|an dernier|annee (derniere|precedente)|last (month|week|year))/.test(n)) {
    const T = todayISO(), d = smD(T), dow = (d.getDay() + 6) % 7;
    p.period = /semaine|week/.test(n) ? { from: addDays(T, -dow), to: T, label: "cette semaine" } : /an |annee|year/.test(n) ? { from: `${d.getFullYear()}-01-01`, to: T, label: "cette année" } : { from: smIso(new Date(d.getFullYear(), d.getMonth(), 1)), to: T, label: "ce mois-ci" };
  }
  if (/par semaine|per week/.test(n)) p.unit = "semaine"; else if (/par jour|per day/.test(n)) p.unit = "jour"; else p.unit = "mois";
  const C = smCats(n, tokens); p.cats = C.cats;
  // Mots restants : un marchand ou un libellé (« Carrefour », « Netflix », « boulangerie »)
  const per = p.period ? smN(p.period.label).split(" ") : [];
  p.words = tokens.filter(t => t.length >= 3 && !SM_STOP.has(t) && !C.used.has(t) && !/^\d/.test(t) && !SM_MOIS.includes(t) && !SM_MOIS_EN.includes(t) && !per.includes(t));
  return p;
}
function smItems(p, period) {
  const pr = period || p.period, from = pr ? pr.from : "0000-01-01", to = pr ? pr.to : "9999-12-31";
  let L = allItems().filter(x => x.date >= from && x.date <= to);
  if (p.type) L = L.filter(x => x.type === p.type && !(p.type === "depense" && x.ndf));
  else L = L.filter(x => !(x.type === "depense" && x.ndf));
  if (p.cats.length) L = L.filter(x => p.cats.includes(x.cat));
  if (p.words.length) {
    const W = p.words, hay = x => smN([x.note, x.warranty && x.warranty.item, x.warranty && x.warranty.shop, x.type !== "depense" ? x.cat : ""].filter(Boolean).join(" "));
    const hit = L.filter(x => { const h = hay(x); return W.every(w => h.includes(w) || (w.length > 4 && h.includes(w.slice(0, -1)))); });
    L = hit.length || !p.cats.length ? hit : L;   // catégorie trouvée mais pas le mot exact : on garde la catégorie
  }
  if (p.min != null) L = L.filter(x => Number(x.amount) > p.min - 1e-9);
  if (p.max != null) L = L.filter(x => Number(x.amount) < p.max + 1e-9);
  return L;
}
const smSum = L => L.reduce((a, x) => a + (Number(x.amount) || 0), 0);
const smB = v => `<b class="num">${esc(eur(v))}</b>`;
const smWhat = p => {
  const c = p.cats.map(id => catById(id).name), w = p.words.map(x => x.charAt(0).toUpperCase() + x.slice(1));
  return [...c, ...w.map(x => (c.length ? "« " + x + " »" : "chez " + x))].join(", ");
};
const smVerb = (p, L) => { const t = p.type || (L.length && L.every(x => x.type === L[0].type) ? L[0].type : "depense"); return { depense: "dépensé", rentree: "reçu", epargne: "mis de côté", invest: "investi" }[t] || "dépensé"; };
const smRow = x => `<li><span class="num">${esc(frDate(x.date))}</span> · ${esc(x.note || catById(x.cat).name || "")} · ${smB(Number(x.amount))}</li>`;
// Réponse : { html, items } ou null si la question n'est pas comprise
function smartAnswer(q) {
  const p = smParse(q), n = p.n;
  // Questions à part : abonnements, garanties
  if (/abonnement|subscription/.test(n) && !p.words.length && p.intent !== "count" && p.intent !== "last") {
    const act = Object.values(subs || {}).filter(x => x.status !== "resilie"); if (!act.length) return { html: "<p>Tu n'as pas encore d'abonnement enregistré (Suivis › Abonnements).</p>", items: [] };
    const pm = act.reduce((a, x) => a + monthlyCost(x), 0);
    return { html: `<p>Tes ${act.length} abonnement${act.length > 1 ? "s" : ""} te coûte${act.length > 1 ? "nt" : ""} ${smB(pm)} par mois, soit ${smB(pm * 12)} par an.</p><ul class="ask-ul">${act.sort((a, b) => monthlyCost(b) - monthlyCost(a)).slice(0, 10).map(x => `<li>${esc(x.name)} · ${smB(monthlyCost(x))}/mois${nextOcc(x) ? ` · prochain le ${esc(frDate(nextOcc(x)))}` : ""}</li>`).join("")}</ul>`, items: [] };
  }
  if (/garantie|warrant/.test(n)) {
    const L = garItems().filter(x => garStatus(x.warranty) !== "exp").sort((a, b) => a.warranty.end.localeCompare(b.warranty.end));
    return { html: L.length ? `<p>${L.length} article${L.length > 1 ? "s" : ""} sous garantie :</p><ul class="ask-ul">${L.slice(0, 10).map(x => `<li>${esc(x.warranty.item || x.note || "Achat")} · jusqu'au ${esc(frDate(x.warranty.end))} (${esc(leftTxt(daysUntil(x.warranty.end)))})</li>`).join("")}</ul>` : "<p>Aucun article sous garantie pour l'instant.</p>", items: L };
  }
  // Budget d'une catégorie
  if (/budget/.test(n) && p.cats.length === 1) {
    const c = catById(p.cats[0]), T = todayISO(), M = smIso(new Date(smD(T).getFullYear(), smD(T).getMonth(), 1));
    const v = smSum(allItems().filter(x => x.type === "depense" && !x.ndf && x.cat === c.id && x.date >= M && x.date <= T));
    return { html: c.budget ? `<p>${esc(c.name)} : ${smB(v)} dépensés sur ${smB(c.budget)} ce mois-ci${v > c.budget ? ` — <b class="ask-late">dépassé de ${esc(eur(v - c.budget))}</b>` : ` — il reste ${smB(c.budget - v)}`}.</p>` : `<p>Pas de budget fixé pour ${esc(c.name)} (Paramètres › Budget). Ce mois-ci : ${smB(v)}.</p>`, items: [] };
  }
  const strong = p.cats.length || p.words.length || p.period || p.min != null || p.max != null || p.intent !== "sum" || /combien|total|how much/.test(n);
  if (!strong) return null;
  // Période par défaut : ce mois-ci (ou depuis le début pour « dernière fois », « première fois », « plus grosses »… sans date)
  if (!p.period) { const T = todayISO(), d = smD(T); p.period = ["last", "first", "list"].includes(p.intent) || (p.words.length && p.intent === "count") ? { from: "0000-01-01", to: T, label: "depuis le début" } : { from: smIso(new Date(d.getFullYear(), d.getMonth(), 1)), to: T, label: "ce mois-ci" }; p.periodDefault = true; }
  if (!p.type && p.intent !== "list") p.type = p.words.length && !p.cats.length ? "" : "depense";
  const L = smItems(p), tot = smSum(L), what = smWhat(p), per = p.period.label, verb = smVerb(p, L);
  const sorted = L.slice().sort((a, b) => b.date.localeCompare(a.date));
  const head = what ? `<b>${esc(what)}</b> · ${esc(per)}` : esc(per.charAt(0).toUpperCase() + per.slice(1));
  let h = "";
  if (!L.length && !["cats", "merchants", "compare", "bymonth"].includes(p.intent)) return { html: `<p>${head} : je n'ai trouvé aucune opération${p.words.length ? ` contenant « ${esc(p.words.join(" "))} »` : ""}.</p>${p.periodDefault ? `<p class="hint">Essaie avec une autre période : « cette année », « depuis le début »…</p>` : ""}`, items: [] };
  if (p.intent === "count") h = `<p>${head} : ${L.length} fois, pour un total de ${smB(tot)}${L.length ? ` (≈ ${smB(tot / L.length)} en moyenne)` : ""}.</p>`;
  else if (p.intent === "last" || p.intent === "first") {
    const x = p.intent === "last" ? sorted[0] : sorted[sorted.length - 1], d = -daysUntil(x.date);
    h = `<p>${p.intent === "last" ? "La dernière fois" : "La première fois"}${what ? ` (${esc(what)})` : ""} : le <b>${esc(frDate(x.date))}</b>${d > 0 ? ` (il y a ${d} jour${d > 1 ? "s" : ""})` : " (aujourd'hui)"} — ${esc(x.note || catById(x.cat).name)}, ${smB(Number(x.amount))}.</p>`;
  } else if (p.intent === "max" || p.intent === "min") {
    const k = p.topN || 5, S = L.slice().sort((a, b) => p.intent === "max" ? b.amount - a.amount : a.amount - b.amount).slice(0, k);
    h = `<p>${head} : ${p.intent === "max" ? "les plus grosses" : "les plus petites"} opérations</p><ul class="ask-ul">${S.map(smRow).join("")}</ul>`;
    return { html: h, items: S };
  } else if (p.intent === "avg") {
    const a = smD(p.period.from === "0000-01-01" ? (sorted[sorted.length - 1] || { date: todayISO() }).date : p.period.from), b = smD(p.period.to), days = Math.max(1, Math.round((b - a) / 864e5) + 1);
    const units = p.unit === "jour" ? days : p.unit === "semaine" ? days / 7 : Math.max(1, days / 30.44);
    h = `<p>${head} : en moyenne ${smB(tot / units)} par ${p.unit} (${smB(tot)} au total, ${L.length} opération${L.length > 1 ? "s" : ""}).</p>`;
  } else if (p.intent === "bymonth") {
    const M = {}; for (const x of L) M[x.date.slice(0, 7)] = (M[x.date.slice(0, 7)] || 0) + Number(x.amount);
    const ks = Object.keys(M).sort().slice(-12), mx = Math.max(...ks.map(k => M[k]), 1);
    h = `<p>${head} : ${verb} mois par mois</p><div class="sm-bars">${ks.map(k => `<div><span>${esc(SM_MOIS[Number(k.slice(5)) - 1].slice(0, 4))}. ${k.slice(2, 4)}</span><i style="width:${Math.round(M[k] / mx * 100)}%"></i><b class="num">${esc(eur(M[k], true))}</b></div>`).join("")}</div>`;
    return { html: h, items: sorted };
  } else if (p.intent === "cats" || p.intent === "merchants") {
    const G = {}; for (const x of L) { const k = p.intent === "cats" ? catById(x.cat).name : (x.note || "Sans libellé").trim().split(/\s+/).slice(0, 3).join(" "); G[k] = (G[k] || 0) + Number(x.amount); }
    const top = Object.entries(G).sort((a, b) => b[1] - a[1]).slice(0, p.topN || 6);
    if (!top.length) return { html: `<p>${head} : aucune dépense trouvée.</p>`, items: [] };
    h = `<p>${head} : ${smB(tot)} ${verb}. ${p.intent === "cats" ? "Les catégories" : "Là où"} ${p.intent === "cats" ? "les plus lourdes" : "tu as le plus dépensé"} :</p><ul class="ask-ul">${top.map(([k, v]) => `<li>${esc(k)} · ${smB(v)} <small>(${Math.round(v / (tot || 1) * 100)} %)</small></li>`).join("")}</ul>`;
    return { html: h, items: sorted };
  } else if (p.intent === "compare") {
    const pv = smPrev(p.period), L2 = pv ? smItems(p, pv) : [], t2 = smSum(L2);
    h = `<p>${head} : ${smB(tot)} ${verb}${pv ? `, contre ${smB(t2)} ${esc(pv.label)}` : ""}.</p>`;
    if (pv && t2 > 0) { const d = (tot - t2) / t2; h += `<p>${Math.abs(d) < .03 ? "C'est à peu près pareil." : `C'est <b class="${d > 0 && verb === "dépensé" ? "ask-late" : "ask-yes"}">${d > 0 ? "+" : "−"}${Math.round(Math.abs(d) * 100)} %</b> ${d > 0 ? "de plus" : "de moins"} (${d > 0 ? "+" : "−"}${esc(eur(Math.abs(tot - t2)))}).`}</p>`; }
    else if (pv) h += `<p>Rien ${esc(pv.label)}.</p>`;
  } else if (p.intent === "list") {
    h = `<p>${head} : ${L.length} opération${L.length > 1 ? "s" : ""}, ${smB(tot)} au total.</p><ul class="ask-ul">${sorted.slice(0, p.topN || 10).map(smRow).join("")}</ul>${L.length > (p.topN || 10) ? `<p class="hint">Et ${L.length - (p.topN || 10)} autre${L.length - (p.topN || 10) > 1 ? "s" : ""}.</p>` : ""}`;
    return { html: h, items: sorted };
  } else {
    // Total (le cas le plus courant), avec la comparaison à la période d'avant
    const byType = {}; for (const x of L) byType[x.type] = (byType[x.type] || 0) + Number(x.amount);
    const types = Object.keys(byType);
    if (types.length > 1 && !p.type) h = `<p>${head} : ${types.map(t => `${{ depense: "dépenses", rentree: "rentrées", epargne: "épargne", invest: "investissements" }[t]} ${smB(byType[t])}`).join(", ")} (${L.length} opérations).</p>`;
    else h = `<p>${head} : tu as ${verb} ${smB(tot)} en ${L.length} opération${L.length > 1 ? "s" : ""}.</p>`;
    const pv = smPrev(p.period); if (pv) { const t2 = smSum(smItems(p, pv)); if (t2 > 0) { const d = (tot - t2) / t2; h += `<p class="hint">${esc(pv.label.charAt(0).toUpperCase() + pv.label.slice(1))} : ${esc(eur(t2))}${Math.abs(d) >= .03 ? ` (${d > 0 ? "+" : "−"}${Math.round(Math.abs(d) * 100)} %)` : ""}.</p>`; } }
    if (p.cats.length === 1 && catById(p.cats[0]).budget && /mois/.test(per)) { const c = catById(p.cats[0]); h += `<p class="hint">Budget ${esc(c.name)} : ${esc(eur(c.budget))} par mois.</p>`; }
  }
  if (["sum", "count", "avg", "compare"].includes(p.intent)) h += `<ul class="ask-ul">${sorted.slice(0, 5).map(smRow).join("")}</ul>${L.length > 5 ? `<p class="hint">+ ${L.length - 5} autre${L.length - 5 > 1 ? "s" : ""}</p>` : ""}`;
  return { html: h, items: sorted };
}
// Une recherche qui ressemble à une question
const smIsQuestion = t => { const n = smN(t); return n.length > 3 && (/\?/.test(t) || /^(combien|quand|quel|quelle|quels|quelles|ou |qui|liste|montre|affiche|donne|top|moyenne|compar|mes |mon |ma |j ai|ai je|est ce|puis|je peux|peux|how|what|when|show|list|total|can i|who|where)/.test(n) || !!smPeriod(n) && n.split(" ").length >= 3); };

// ---------- Branchements ----------
// 1) « Demande à Bourselle » : les questions précises passent par la recherche intelligente
if (typeof askAnswer === "function") {
  const _askAnswer = askAnswer;
  askAnswer = function (q) {
    const p = smParse(q), n = p.n;
    // Questions « Demande à Bourselle » (reste, puis-je dépenser, factures à venir…) : l'assistant d'abord, s'il comprend
    if (/(puis[- ]?je|je peux|me permettre|qui me doi|on me doit|je dois|prochain|a venir|reste|restera|fin du mois|ou part|ou va|epargn|economis|can i|afford|left|next bill|upcoming|owe|where does|saved|save)/.test(n) && !p.cats.length) {
      const r0 = _askAnswer(q); if (r0 && !/Je sais répondre/.test(r0)) return r0;
    }
    const generic = /(puis[- ]?je|je peux|me permettre|qui me doi|on me doit|je dois|prochain|a venir|reste|restera|fin du mois)/.test(n) && !p.cats.length && !p.words.length;
    if (!generic) { try { const r = smartAnswer(q); if (r && (r.items && !r.items.length && !p.cats.length && /aucune op/.test(r.html) ? false : (p.cats.length || p.words.length || p.period || p.intent !== "sum" || p.min != null || p.max != null || /abonnement|garantie/.test(n)))) return r.html; } catch (e) { console.error(e); } }
    return _askAnswer(q);
  };
}
// 2) Onglet Recherche : une question → la réponse en haut, puis les opérations concernées
if (typeof drawResults === "function") {
  const _draw = drawResults;
  drawResults = function () {
    const t = typeof Q !== "undefined" ? Q.text : "";
    if (t && smIsQuestion(t)) {
      let r = null; const gen = /(puis[- ]?je|je peux|me permettre|qui me doi|on me doit|je dois|prochain|a venir|reste|restera|fin du mois|ou part|ou va|ou passe)/.test(smN(t));
      if (!gen) { try { r = smartAnswer(t); } catch (e) { console.error(e); } }
      if (!r && typeof askAnswer === "function") { try { r = { html: askAnswer(t), items: [] }; } catch (e) {} }   // questions de « Demande à Bourselle » (reste, puis-je dépenser…)
      if (r) {
        const shown = (r.items || []).slice(0, 100), tot = smSum(shown.filter(x => x.type === "depense"));
        document.getElementById("resCap").textContent = "Réponse calculée sur ton téléphone";
        const big = document.getElementById("resBig"); big.textContent = eur(tot); big.className = "big num"; document.getElementById("resPill").innerHTML = "";
        document.getElementById("qRes").innerHTML = `<div class="card sm-ans"><h2>💡 Réponse</h2>${r.html}</div>` + (shown.length ? `<div class="card"><h2>Opérations<small>${shown.length}${r.items.length > 100 ? " sur " + r.items.length : ""}</small></h2>${txListHTML(shown, true)}</div>` : "");
        document.querySelectorAll("#qRes .tx").forEach(b => b.onclick = () => { const x = shown.find(i => i.id === b.dataset.id); if (x) { const { key, ...tx } = x; openSheet(tx); } });
        return;
      }
    }
    _draw();
  };
}
// Exemples de questions, affichés sous le champ de recherche
const SM_EXAMPLES = ["Combien me reste-t-il après mes factures ?", "Puis-je dépenser 200 € ce mois-ci ?", "Qui me doit de l'argent ?", "Combien en resto ce mois-ci ?", "Mes 5 plus grosses dépenses en octobre", "Combien de fois chez Carrefour cette année ?", "Compare mes courses avec le mois dernier", "Moyenne par mois en transport", "Où j'ai le plus dépensé la semaine dernière ?", "Dépenses de plus de 100 € cette année", "Quand ai-je payé Netflix pour la dernière fois ?"];
if (typeof renderRecherche === "function") {
  const _rr = renderRecherche;
  renderRecherche = function () {
    _rr.apply(this, arguments);
    const t = document.getElementById("qText"); if (!t) return;
    t.placeholder = "Carrefour, 42,50… ou une question : « combien en resto ce mois-ci ? »";
    const h = document.getElementById("periodLabel"); if (h) h.textContent = "Rechercher ou demander";
    if (!Q.text) t.closest(".card").insertAdjacentHTML("beforeend", `<div class="sm-ex"><small>Essaie une question :</small><div class="chips">${SM_EXAMPLES.slice(0, 8).map(s => `<button type="button" class="chip" data-smq="${esc(s)}">${esc(s)}</button>`).join("")}</div></div>`);
    view.querySelectorAll("[data-smq]").forEach(b => b.onclick = () => { Q.text = b.dataset.smq; t.value = Q.text; drawResults(); const ex = view.querySelector(".sm-ex"); if (ex) ex.remove(); });
  };
}
