// Lecture des relevés bancaires en PDF (Crédit Agricole, et la plupart des banques françaises).
// Tout se passe sur le téléphone : le fichier n'est envoyé nulle part. pdf.js (lib/) n'est chargé qu'à la première lecture.
let PDFJS = null;
// Safari (iPhone) ne sait pas parcourir un ReadableStream avec « for await » : pdf.js en a besoin pour lire le texte
if (typeof ReadableStream !== "undefined" && !ReadableStream.prototype[Symbol.asyncIterator]) {
  ReadableStream.prototype.values = function ({ preventCancel = false } = {}) {
    const reader = this.getReader();
    return {
      async next() { const r = await reader.read(); if (r.done) reader.releaseLock(); return r; },
      async return(v) { if (!preventCancel) { const p = reader.cancel(v); reader.releaseLock(); await p; } else reader.releaseLock(); return { done: true, value: v }; },
      [Symbol.asyncIterator]() { return this; }
    };
  };
  ReadableStream.prototype[Symbol.asyncIterator] = ReadableStream.prototype.values;
}
async function pdfLib() {
  if (PDFJS) return PDFJS;
  const base = new URL("lib/", document.baseURI).href;
  PDFJS = await import(base + "pdf.min.mjs");
  PDFJS.GlobalWorkerOptions.workerSrc = base + "pdf.worker.min.mjs";
  return PDFJS;
}

// Montant au format français : 1 234,56 · 1.234,56 · -54,20 · 54,20- · +2 150,00
const PDF_AMT = /^[-+]?\d{1,3}(?:[\s  .]\d{3})*,\d{2}\s*-?$|^[-+]?\d+,\d{2}\s*-?$/;
const PDF_DATE = /^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2}|\d{4}))?$/;
const pdfNum = s => { const neg = /^-|-$/.test(s.trim()); const v = Number(s.replace(/[\s  .+-]/g, "").replace(",", ".")); return neg ? -v : v; };

async function pdfOpen(buf) {
  const lib = await pdfLib();
  try { return await lib.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false }).promise; }
  catch (e) {
    if (e && e.name === "PasswordException") throw new Error("ce PDF est protégé par un mot de passe");
    // Certains iPhone refusent le « worker » de pdf.js : on le charge alors dans la page elle-même
    if (!globalThis.pdfjsWorker) { try { globalThis.pdfjsWorker = await import(new URL("lib/pdf.worker.min.mjs", document.baseURI).href); } catch (e2) { throw e; } }
    return await lib.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false }).promise;
  }
}
async function pdfLines(buf) {
  const doc = await pdfOpen(buf);
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str.trim(), x: i.transform[4], y: i.transform[5], w: i.width || 0 }));
    // Regroupe les morceaux de texte en lignes (même hauteur, à 2,5 points près)
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    for (const it of items) {
      const l = lines.find(l => Math.abs(l.y - it.y) < 2.5);
      if (l) l.items.push(it); else lines.push({ y: it.y, items: [it] });
    }
    lines.forEach(l => l.items.sort((a, b) => a.x - b.x));
    pages.push(lines);
  }
  return pages;
}

// Fusionne les morceaux voisins d'une ligne (« 1 », « 234,56 » → « 1 234,56 »)
function pdfCells(items) {
  const out = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && it.x - (last.x + last.w) < 3 && !(PDF_AMT.test(last.s) && PDF_AMT.test(it.s)) && !(PDF_DATE.test(last.s) && PDF_DATE.test(it.s))) { last.s += (it.x - (last.x + last.w) > 0.8 ? " " : "") + it.s; last.w = it.x + it.w - last.x; }
    else out.push({ ...it });
  }
  // « 54,20 € », « 54,20 ¨ » (le symbole euro mal encodé du Crédit Agricole), « 54,20 EUR » → « 54,20 »
  for (const c of out) c.s = c.s.replace(/\s*(€|¨|EUR|euros?)$/i, "").trim();
  return out.filter(c => c.s);
}

async function parseBankPdf(buf) {
  const pages = await pdfLines(buf);
  const all = pages.flat().map(l => pdfCells(l.items));
  const text = all.map(c => c.map(x => x.s).join(" ")).join("\n");
  if (/revolut/i.test(text)) { const r = parseRevolutPdf(all); if (r.length) return r; }
  // Année du relevé : « du 01.11.2026 au 30.11.2026 », « arrêté au 30/11/2026 », « 30 novembre 2026 »…
  const MO = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
  let endY = 0, endM = 0;
  { const m = [...text.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/g)].map(x => [+x[3], +x[2]]).sort((a, b) => b[0] - a[0] || b[1] - a[1])[0]; if (m) [endY, endM] = m; }
  if (!endY) { const m = norm(text).match(/\b(\d{1,2}) (janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre) (20\d{2})\b/); if (m) { endY = +m[3]; endM = MO.indexOf(m[2]) + 1; } }
  if (!endY) { endY = new Date().getFullYear(); endM = new Date().getMonth() + 1; }
  const iso = (d, m, y) => { let yy = y ? (y.length === 2 ? 2000 + +y : +y) : (+m > endM ? endY - 1 : endY); const dt = new Date(yy, +m - 1, +d); return dt.getMonth() === +m - 1 ? `${yy}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : ""; };

  const rows = []; let cols = null, cur = null;
  const skip = s => /\b(ancien|nouveau) solde|solde (crediteur|debiteur|au|precedent|final)|total des operations|total des mouvements|report\b|sous[- ]total|^solde\b/.test(norm(s));
  for (const cells of all) {
    const ln = norm(cells.map(c => c.s).join(" "));
    // En-tête de colonnes : position de « Débit » / « Crédit » (ou « Montant »)
    const deb = cells.find(c => /^debit/.test(norm(c.s))), cre = cells.find(c => /^credit/.test(norm(c.s))), mnt = cells.find(c => /^montant/.test(norm(c.s)));
    if ((deb && cre) || (mnt && /date/.test(ln))) { cols = { deb: deb ? deb.x + deb.w : null, cre: cre ? cre.x + cre.w : null }; cur = null; continue; }
    const first = cells[0], dm = first && first.s.match(PDF_DATE);
    const amts = cells.filter(c => PDF_AMT.test(c.s));
    if (dm && amts.length && !skip(ln)) {
      const date = iso(dm[1], dm[2], dm[3]); if (!date) { cur = null; continue; }
      const a = amts[amts.length === 1 ? 0 : (cols ? amts.length - 1 : 0)];
      let v = pdfNum(a.s);
      if (cols && cols.deb != null && cols.cre != null && !/^[-+]|-$/.test(a.s.trim())) {
        const r = a.x + a.w; v = Math.abs(r - cols.cre) < Math.abs(r - cols.deb) ? Math.abs(v) : -Math.abs(v);
      } else if (!/^[-+]|-$/.test(a.s.trim()) && !(cols && cols.cre != null)) v = -Math.abs(v);
      const label = cells.filter(c => c !== first && !amts.includes(c) && !PDF_DATE.test(c.s)).map(c => c.s).join(" ").trim();
      cur = { date, label, amount: Math.round(v * 100) / 100, more: 0 }; rows.push(cur);
    } else if (cur && !dm && !amts.length && cur.more < 2 && cells.length && !skip(ln)) {
      // Suite du libellé sur la ligne d'en dessous (Crédit Agricole : le nom du commerçant)
      cur.label += " " + cells.map(c => c.s).join(" "); cur.more++;
    } else if (amts.length || dm) cur = null;
  }
  return rows.filter(r => r.amount).map(({ date, label, amount }) => ({ date, label: label.replace(/\s+/g, " ").trim(), amount }));
}

// Relevé Revolut : dates en lettres (« 3 nov. 2026 », « 3 Nov 2026 »), montants avec le symbole (« €54.20 », « 54,20 € »),
// colonnes Argent sortant / Argent entrant / Solde (ou Money out / Money in / Balance). Les opérations annulées ou en attente sont ignorées.
const REV_MO = { jan: 1, janv: 1, janvier: 1, january: 1, feb: 2, fev: 2, fevr: 2, fevrier: 2, february: 2, mar: 3, mars: 3, march: 3, apr: 4, avr: 4, avril: 4, april: 4, may: 5, mai: 5,
  jun: 6, juin: 6, june: 6, jul: 7, juil: 7, juillet: 7, july: 7, aug: 8, aou: 8, aout: 8, august: 8, sep: 9, sept: 9, septembre: 9, september: 9, oct: 10, octobre: 10, october: 10,
  nov: 11, novembre: 11, november: 11, dec: 12, decembre: 12, december: 12 };
function revDate(s) {
  const t = norm(s).replace(/\./g, " ").replace(/,/g, " ").replace(/\s+/g, " ").trim();
  let m = t.match(/^(\d{1,2}) ([a-z]+) (20\d{2})\b/), d, mo, y;
  if (m) { d = +m[1]; mo = REV_MO[m[2]]; y = +m[3]; }
  else if ((m = t.match(/^([a-z]+) (\d{1,2}) (20\d{2})\b/))) { d = +m[2]; mo = REV_MO[m[1]]; y = +m[3]; }
  else if ((m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  if (!mo || !d || d > 31) return "";
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
const REV_AMT = /^[-+−]?\s?[€£$]?\s?[-−]?\d{1,3}(?:[\s\u00a0\u202f,.]\d{3})*[.,]\d{2}\s?(?:€|£|\$|EUR|GBP|USD)?$/;
function parseRevolutPdf(all) {
  const rows = []; let cols = null, on = true, cur = null;
  for (const raw of all) {
    const cells = raw;
    const ln = norm(cells.map(c => c.s).join(" "));
    // Sections : on ne garde que les opérations du compte (pas les annulées / en attente)
    if (/^(reverted|annulee|annulees|transactions annulees|operations annulees|pending|en attente|transactions en attente|operations en attente)\b/.test(ln)) { on = false; cur = null; continue; }
    if (/^(account transactions|transactions du compte|operations du compte|transactions from|transactions du)\b/.test(ln)) { on = true; cur = null; continue; }
    const out = cells.find(c => /^(money out|argent sortant|sortant|montant sortant|debit|sorties?)$/.test(norm(c.s))), inn = cells.find(c => /^(money in|argent entrant|entrant|montant entrant|credit|entrees?)$/.test(norm(c.s))),
      bal = cells.find(c => /^(balance|solde)$/.test(norm(c.s)));
    if (out && inn) { const r = c => c.x + c.w; cols = { out: r(out), inn: r(inn), bal: bal ? r(bal) : null }; cur = null; continue; }
    if (!on) continue;
    // La date peut être en un morceau (« 3 nov. 2026 ») ou en plusieurs (« 3 », « nov. », « 2026 »)
    let date = "", used = 0;
    for (let k = 1; k <= Math.min(3, cells.length) && !date; k++) { const d = revDate(cells.slice(0, k).map(c => c.s).join(" ")); if (d) { date = d; used = k; } }
    if (!date && cells[0]) { const m = norm(cells[0].s).match(/^(\d{1,2}[ .]+[a-z]+\.? 20\d{2}|[a-z]+ \d{1,2},? 20\d{2})/); if (m) { date = revDate(m[1]); } }
    const amts = cells.filter(c => REV_AMT.test(c.s.trim()));
    if (date && amts.length) {
      let pick = amts;
      if (cols && cols.bal != null) pick = amts.filter(a => Math.abs(a.x + a.w - cols.bal) > 12);
      else if (amts.length > 1) pick = amts.slice(0, -1);
      const a = pick[0]; if (!a) { cur = null; continue; }
      let v = Math.abs(bankNum(a.s.replace(/[€£$]|EUR|GBP|USD/g, "").replace(/[−]/g, "-")) || 0);
      if (cols) { const r = a.x + a.w; v = Math.abs(r - cols.inn) < Math.abs(r - cols.out) ? v : -v; }
      else v = /^\+/.test(a.s.trim()) ? v : -v;
      let label = cells.slice(used || 1).filter(c => !amts.includes(c)).map(c => c.s).join(" ").trim();
      if (!used) label = cells[0].s.replace(/^\s*(\d{1,2}[ .]+\S+\.? 20\d{2}|\S+ \d{1,2},? 20\d{2})\s*/i, "") + " " + label;
      cur = { date, label: label.trim(), amount: Math.round(v * 100) / 100, more: 0 }; rows.push(cur);
    } else if (cur && !amts.length && cur.more < 1 && cells.length && /^(to|from|a|de|vers|pour)\s*:/.test(ln)) {
      // « De : JEAN DUPONT », « To: Marie » : on garde le nom de la personne
      const who = cells.map(c => c.s).join(" ").replace(/^\s*\S+\s*:\s*/, "").trim();
      if (who && !norm(cur.label).includes(norm(who))) cur.label += " " + who; cur.more++;
    } else if (amts.length || date) cur = null;
  }
  return rows.filter(r => r.amount).map(({ date, label, amount }) => ({ date, label: label.replace(/\s+/g, " ").trim(), amount }));
}

// Excel (.xlsx) : on lit la première feuille et on la passe au lecteur CSV habituel
async function xlsxToText(buf) {
  const u = new Uint8Array(buf), dv = new DataView(buf), files = {};
  let e = u.length - 22; while (e > 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  let p = dv.getUint32(e + 16, true); const n = dv.getUint16(e + 10, true);
  for (let i = 0; i < n; i++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    if (!/^xl\/(sharedStrings\.xml|worksheets\/sheet1\.xml)$/.test(name)) continue;
    const ds = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), raw = u.subarray(ds, ds + csize);
    files[name] = method === 0 ? new TextDecoder().decode(raw) : await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  }
  const X = s => new DOMParser().parseFromString(s || "<x/>", "application/xml");
  const ss = [...X(files["xl/sharedStrings.xml"]).getElementsByTagName("si")].map(si => [...si.getElementsByTagName("t")].map(t => t.textContent).join(""));
  const colN = r => { let c = 0; for (const ch of r.replace(/\d+/g, "")) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };
  const out = [];
  for (const row of X(files["xl/worksheets/sheet1.xml"]).getElementsByTagName("row")) {
    const cells = [];
    for (const c of row.getElementsByTagName("c")) {
      const t = c.getAttribute("t"), v = (c.getElementsByTagName("v")[0] || {}).textContent, is = c.getElementsByTagName("is")[0];
      let val = t === "s" ? ss[+v] : t === "inlineStr" ? (is ? is.textContent : "") : v || "";
      // Dates Excel (nombre de jours depuis 1899) → jj/mm/aaaa
      if ((!t || t === "n") && /^\d{5}(\.\d+)?$/.test(val) && +val > 30000 && +val < 60000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(+val) * 864e5); val = d.toISOString().slice(0, 10).split("-").reverse().join("/"); }
      else if ((!t || t === "n") && /^-?\d+(\.\d+)?$/.test(val)) val = val.replace(".", ",");
      cells[colN(c.getAttribute("r") || "A")] = String(val).replace(/;/g, ",");
    }
    out.push([...cells].map(x => x || "").join(";"));
  }
  return out.join("\n");
}
