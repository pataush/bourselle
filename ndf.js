// ---------- Notes de frais : dossier dans le Drive + classeur Excel ----------
// Les tickets des notes de frais sont rangés dans Bourselle › Notes de frais › AAAA › AAAA-MM,
// nommés « AAAA-MM-JJ - Libellé - Montant ». Le classeur « Notes de frais AAAA.xlsx » (un onglet par mois,
// une ligne par dépense, HT / TVA / TTC, totaux) est recréé dans ce dossier à chaque changement.

// --- Petit écrivain XLSX (zip sans compression) ---
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files) {   // files : [[nom, texte]]
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const u16 = v => [v & 255, (v >> 8) & 255], u32 = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  for (const [name, text] of files) {
    const nb = enc.encode(name), data = enc.encode(text), crc = crc32(data);
    const head = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nb.length), ...u16(0)];
    const local = new Uint8Array([0x50, 0x4b, 3, 4, ...head]);
    parts.push(local, nb, data);
    central.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...head, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nb);
    off += local.length + nb.length + data.length;
  }
  const csize = central.reduce((a, b) => a + b.length, 0);
  const end = new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(csize), ...u32(off), ...u16(0)]);
  return new Blob([...parts, ...central, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
const xmlEsc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const colL = i => { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const xlDate = iso => { const [y, m, d] = iso.split("-").map(Number); return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000); };
// Styles : chaque cellule peut porter { st: { font, fill, border, nf, al } } ; les styles sont regroupés automatiquement.
function xlsxBook(sheets) {
  const fonts = [], fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'], borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'], fmts = [], xfs = [];
  const idx = (arr, x) => { let i = arr.indexOf(x); if (i < 0) { arr.push(x); i = arr.length - 1; } return i; };
  const fontXml = f => `<font>${f.b ? "<b/>" : ""}${f.i ? "<i/>" : ""}${f.u ? "<u/>" : ""}<sz val="${f.sz || 10}"/>${f.color ? `<color rgb="FF${f.color}"/>` : ""}<name val="Arial"/></font>`;
  idx(fonts, fontXml({}));
  const side = (n, v) => v ? `<${n} style="${v}"><color rgb="FF000000"/></${n}>` : `<${n}/>`;
  const styleId = st => {
    if (!st) return 0;
    const fo = idx(fonts, fontXml(st.font || {}));
    const fi = st.fill ? idx(fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${st.fill}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const bd = st.border ? idx(borders, `<border>${side("left", st.border[0])}${side("right", st.border[1])}${side("top", st.border[2])}${side("bottom", st.border[3])}<diagonal/></border>`) : 0;
    const nf = st.nf ? 164 + idx(fmts, st.nf) : 0;
    const al = st.al ? `<alignment${st.al.h ? ` horizontal="${st.al.h}"` : ""}${st.al.v ? ` vertical="${st.al.v}"` : ""}${st.al.wrap ? ` wrapText="1"` : ""}/>` : "";
    const xf = `<xf numFmtId="${nf}" fontId="${fo}" fillId="${fi}" borderId="${bd}" xfId="0"${nf ? ' applyNumberFormat="1"' : ""} applyFont="1"${fi ? ' applyFill="1"' : ""}${bd ? ' applyBorder="1"' : ""}${al ? ' applyAlignment="1">' + al + "</xf>" : "/>"}`;
    return idx(xfs, xf) + 1;
  };
  const cellXml = (c, r, ci) => {
    if (c == null) return "";
    const ref = colL(ci) + r, o = typeof c === "object" ? c : { v: c };
    const sid = styleId(o.st), s = sid ? ` s="${sid}"` : "";
    if (o.f) { const isNum = typeof o.v === "number"; return `<c r="${ref}"${s}${isNum ? "" : ` t="str"`}><f>${xmlEsc(o.f)}</f>${o.v != null ? `<v>${xmlEsc(isNum ? Math.round(o.v * 100) / 100 : o.v)}</v>` : ""}</c>`; }
    if (typeof o.v === "number" && isFinite(o.v)) return `<c r="${ref}"${s}><v>${o.v}</v></c>`;
    if (o.v == null || o.v === "") return s ? `<c r="${ref}"${s}/>` : "";
    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(o.v)}</t></is></c>`;
  };
  const sheetXml = sh => {
    const data = sh.rows.map((row, ri) => { const h = sh.heights && sh.heights[ri + 1]; return `<row r="${ri + 1}"${h ? ` ht="${h}" customHeight="1"` : ""}>${(row || []).map((c, ci) => cellXml(c, ri + 1, ci)).join("")}</row>`; }).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0" zoomScale="${sh.zoom || 100}" zoomScaleNormal="${sh.zoom || 100}"${sh.first ? ` tabSelected="1"` : ""}${sh.grid === false ? ` showGridLines="0"` : ""}>${sh.freeze ? `<pane ySplit="${sh.freeze}" topLeftCell="A${sh.freeze + 1}" activePane="bottomLeft" state="frozen"/>` : ""}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${sh.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>
<sheetData>${data}</sheetData>
${sh.merges && sh.merges.length ? `<mergeCells count="${sh.merges.length}">${sh.merges.map(m => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : ""}
<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>
<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
  };
  const sheetFiles = sheets.map((sh, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sh)]);   // avant les styles : ils se remplissent ici
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${fmts.length ? `<numFmts count="${fmts.length}">${fmts.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${xmlEsc(f)}"/>`).join("")}</numFmts>` : ""}
<fonts count="${fonts.length}">${fonts.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="${borders.length}">${borders.join("")}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfs.length + 1}"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>${xfs.join("")}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return zipStore([
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="${Math.max(0, sheets.findIndex(s => s.first))}"/></bookViews>
<sheets>${sheets.map((sh, i) => `<sheet name="${xmlEsc(sh.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", styles], ...sheetFiles]);
}

// --- Note de frais : modèle « Note de frais » (frais par type en HT + TVA récupérable, déplacements, comptes) ---
const NDF_MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const tt = s => window.T ? T(s) : s;
// Types de frais et comptes de charge (plan comptable)
const NDF_TYPES = [["repas", "Repas"], ["transports", "Transports"], ["peage", "Péage"], ["stationnement", "Stationnement"], ["hotel", "Hôtel"], ["divers", "Divers"]];
const NDF_ACC = { repas: "625601", transports: "6251", peage: "625101", stationnement: "625101", hotel: "625131", divers: "6414", km: "625121" };
const NDF_OLD = { resto: "repas", transport: "transports", route: "peage", autre: "divers", km: "transports", auto: "" };
const ndfTypeNorm = t => !t ? "" : NDF_ACC[t] && t !== "km" ? t : (NDF_OLD[t] ?? "");
function ndfTypeOf(x) {
  const n = ndfTypeNorm(x.ndfType); if (n) return n;
  const t = (x.note || "").toLowerCase();
  if (/h[oô]tel|airbnb|nuit[ée]e|booking|h[ée]bergement/.test(t)) return "hotel";
  if (/parking|stationnement|horodateur|indigo|effia|saemes|onepark|zenpark/.test(t)) return "stationnement";
  if (/p[ée]age|autoroute|vinci|sanef|aprr|area\b|escota|cofiroute|t[ée]l[ée]p[ée]age|bip ?& ?go/.test(t)) return "peage";
  if (/sncf|train|tgv|\bter\b|ouigo|eurostar|thalys|avion|a[ée]roport|\bvol\b|air ?france|easyjet|ryanair|taxi|uber|vtc|bolt|heetch|\bg7\b|\bbus\b|m[ée]tro|ratp|navigo|blablacar|essence|carburant|gazole|station|total ?energ|esso|shell|location/.test(t)) return "transports";
  if (/resto|restaurant|d[ée]jeuner|d[îi]ner|repas|brasserie|caf[ée]|bistro|traiteur|boulangerie|mcdo|burger|pizza|sushi/.test(t) || x.cat === "loisirs" || x.cat === "courses") return "repas";
  if (x.cat === "transport") return "transports";
  return "divers";
}
function ndfVat(x) {   // HT et TVA dans la devise du budget
  const ttc = Number(x.amount);
  if (!x.vat) return { vat: 0, ht: ttc, ttc };
  const k = x.orig && x.vat.cur === x.orig.cur && x.orig.rate ? 1 / x.orig.rate : 1, vat = Math.round(x.vat.amount * k * 100) / 100;
  return { vat, ht: Math.round((ttc - vat) * 100) / 100, ttc };
}
const ndfFx = x => !x.orig || !x.orig.cur || x.orig.cur === baseCurrency() ? "" :
  ` (${fmtCur(x.orig.cur, x.orig.amount).replace(/[\u202f\u00a0]/g, " ")}, taux ${String(x.orig.rate).replace(".", window.LANG === "en" ? "." : ",")}${x.orig.rateDay ? ` BCE du ${frDate(x.orig.rateDay)}` : ""})`;
const ndfLabel = x => [x.note || catById(x.cat).name, x.ndfMotif, x.ndfClient].filter(Boolean).join(" - ") + ndfFx(x);
// Barème kilométrique (voitures, jusqu'à 5 000 km / an) ; +20 % pour les véhicules 100 % électriques.
const NDF_BAREME = { 3: 0.529, 4: 0.606, 5: 0.636, 6: 0.665, 7: 0.697 };
const ndfBareme = (cv, elec) => { const r = NDF_BAREME[Math.min(7, Math.max(3, Number(cv) || 5))]; return Math.round(r * (elec ? 1.2 : 1) * 1000) / 1000; };
function ndfVehicle() { if (!settings.ndfVehicle) settings.ndfVehicle = { cv: 5, electric: false }; return settings.ndfVehicle; }
// Données d'un mois (AAAA-MM)
function ndfMonthData(ym) {
  const items = allItems().filter(x => x.type === "depense" && x.ndf && x.date && x.date.startsWith(ym)).sort((a, b) => a.date.localeCompare(b.date) || (a.created || 0) - (b.created || 0));
  const tr = Object.entries(trips).filter(([, t]) => t.date && t.date.startsWith(ym)).map(([id, t]) => ({ id, ...t })).sort((a, b) => a.date.localeCompare(b.date));
  const byType = {}; for (const [k] of NDF_TYPES) byType[k] = { ht: 0, vat: 0 };
  let ht = 0, vat = 0, ttc = 0;
  for (const x of items) { const v = ndfVat(x), k = ndfTypeOf(x); byType[k].ht += v.ht; byType[k].vat += v.vat; ht += v.ht; vat += v.vat; ttc += v.ttc; }
  const km = tr.reduce((s, t) => s + (Number(t.km) || 0), 0), B = tr.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  return { ym, items, trips: tr, byType, ht, vat, A: ttc, km, B, total: ttc + B };
}
function ndfMonthsList() {
  const set = new Set(allItems().filter(x => x.type === "depense" && x.ndf && x.date).map(x => x.date.slice(0, 7)));
  for (const t of Object.values(trips)) if (t.date) set.add(t.date.slice(0, 7));
  set.add(todayISO().slice(0, 7));
  return [...set].sort().reverse();
}
const ndfMonthName = ym => `${tt(NDF_MOIS[Number(ym.slice(5, 7)) - 1])} ${ym.slice(0, 4)}`;
const ndfLastDay = ym => { const [y, m] = ym.split("-").map(Number); return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`; };
function ndfInfo(ym) {
  const nums = settings.ndfNums || {};
  return { num: nums[ym] || ym.replace("-", ""), du: todayISO() < ndfLastDay(ym) ? todayISO() : ndfLastDay(ym), name: settings.ndfName || "",
    fonction: settings.ndfFonction || "", company: [settings.ndfCompany, settings.ndfAddress].filter(Boolean).join(" – "), start: `${ym}-01`, end: ndfLastDay(ym) };
}
// Comptes : les déplacements (625121) rejoignent les transports (6251) dans le récapitulatif, comme dans le modèle.
function ndfAccounts(d) {
  const acc = {};
  const add = (a, ht, vat) => { const o = acc[a] || (acc[a] = { ht: 0, vat: 0 }); o.ht += ht; o.vat += vat; };
  for (const [k] of NDF_TYPES) if (d.byType[k].ht || d.byType[k].vat) add(NDF_ACC[k], d.byType[k].ht, d.byType[k].vat);
  if (d.B) add("6251", d.B, 0);
  return Object.entries(acc).map(([a, o]) => ({ a, ht: o.ht, vat: o.vat, ttc: o.ht + o.vat }));
}

// --- Classeur Excel : un onglet par mois au format du modèle, aux couleurs de Bourselle ---
const NAVY = "16324A", YEL = "F2B928", CREAM = "FFF4D6", LINE = "9FB0C0", GREY = "E9EDF1";
function ndfSheet(ym) {
  const d = ndfMonthData(ym), info = ndfInfo(ym), cur = baseCurrency(), NF = NO_CENTS.includes(cur) ? "#,##0" : "#,##0.00";
  const T0 = "thin", B4 = [T0, T0, T0, T0];
  const rows = [], heights = {}, merges = [];
  const put = (r, c, v) => { (rows[r - 1] || (rows[r - 1] = []))[c] = v; };
  const font = (o = {}) => ({ sz: 10, ...o });
  const lab = (t, v) => ({ v: `${tt(t)} ${v || ""}`.trim(), st: { font: font({ b: 1 }) } });
  // en-tête
  put(1, 0, { v: tt("Note de frais"), st: { font: font({ b: 1, sz: 16, color: NAVY }) } }); heights[1] = 24;
  put(2, 0, { v: `N° ${info.num} – ${tt("du")} ${frDate(info.du)}`, st: { font: font({ b: 1 }) } });
  put(3, 0, lab("Salarié :", info.name)); put(4, 0, lab("Fonction :", info.fonction)); put(5, 0, lab("Entreprise :", info.company));
  put(6, 0, lab("Date de début :", frDate(info.start))); put(7, 0, lab("Date de fin :", frDate(info.end)));
  for (let r = 2; r <= 7; r++) merges.push(`A${r}:E${r}`);
  put(1, 7, { v: tt("Signature"), st: { font: font({ sz: 9, color: "5A6B7B" }), border: B4, al: { v: "top" } } });
  for (let r = 1; r <= 6; r++) for (let c = 7; c <= 9; c++) if (!(r === 1 && c === 7)) put(r, c, { v: "", st: { border: B4 } });
  merges.push("H1:J6");
  // tableau A : frais
  const hdA = 9, cols = ["Date", "Motif et fournisseur", "Repas", "Transports", "Péage", "Stationnement", "Hôtel", "Divers", "TVA récupérable", "TOTAL"];
  const H = (v, extra = {}) => ({ v: tt(v), st: { font: font({ b: 1, color: "FFFFFF" }), fill: NAVY, border: B4, al: { h: "center", v: "center", wrap: 1 }, ...extra } });
  const Hs = v => ({ v, st: { font: font({ sz: 9, color: "FFFFFF" }), fill: NAVY, border: B4, al: { h: "center", v: "center" } } });
  cols.forEach((c, i) => put(hdA, i, H(c)));
  NDF_TYPES.forEach(([k], i) => { put(hdA + 1, 2 + i, Hs(NDF_ACC[k])); put(hdA + 2, 2 + i, Hs(tt("montant en HT"))); });
  for (const c of [0, 1, 8, 9]) { put(hdA + 1, c, Hs("")); put(hdA + 2, c, Hs("")); merges.push(`${colL(c)}${hdA}:${colL(c)}${hdA + 2}`); }
  heights[hdA] = 24; heights[hdA + 1] = 15; heights[hdA + 2] = 15;
  const numC = (v, f, extra = {}) => ({ v: v === "" ? "" : v, f, st: { font: font(), nf: NF, border: B4, al: { h: "right", v: "center" }, ...extra } });
  let r = hdA + 3; const fA = r;
  for (const x of d.items) {
    const v = ndfVat(x), k = ndfTypeOf(x), ci = NDF_TYPES.findIndex(t => t[0] === k);
    put(r, 0, { v: xlDate(x.date), st: { font: font(), nf: "dd/mm/yyyy", border: B4, al: { h: "center", v: "center" } } });
    put(r, 1, { v: ndfLabel(x), st: { font: font(), border: B4, al: { v: "center", wrap: 1 } } });
    NDF_TYPES.forEach((_, i) => put(r, 2 + i, numC(i === ci ? v.ht : "")));
    put(r, 8, numC(v.vat || ""));
    put(r, 9, numC(v.ttc, `SUM(C${r}:I${r})`, { font: font({ b: 1 }) }));
    heights[r] = 28; r++;
  }
  if (!d.items.length) { put(r, 0, { v: "", st: { border: B4 } }); put(r, 1, { v: tt("Aucun frais ce mois-ci"), st: { font: font({ i: 1, color: "5A6B7B" }), border: B4 } }); for (let c = 2; c <= 9; c++) put(r, c, numC("")); r++; }
  const lA = r - 1, tot = r, totV = r + 1;
  const tc = (v, f, b) => ({ v, f, st: { font: font({ b: b ? 1 : 0 }), nf: NF, fill: CREAM, border: B4, al: { h: "right", v: "center" } } });
  put(tot, 0, { v: "", st: { fill: CREAM, border: B4 } }); put(tot, 1, { v: tt("TOTAL"), st: { font: font({ b: 1 }), fill: CREAM, border: B4, al: { h: "center" } } }); merges.push(`A${tot}:A${totV}`);
  put(totV, 1, { v: tt("dont TVA récupérable"), st: { font: font({ sz: 9, color: "5A6B7B" }), fill: CREAM, border: B4, al: { h: "center" } } });
  NDF_TYPES.forEach(([k], i) => { const c = colL(2 + i);
    put(tot, 2 + i, tc(d.byType[k].ht, `SUM(${c}${fA}:${c}${lA})`, 1));
    put(totV, 2 + i, tc(d.byType[k].vat, `SUMIFS($I$${fA}:$I$${lA},${c}${fA}:${c}${lA},"<>")`)); });
  put(tot, 8, tc(d.vat, `SUM(I${fA}:I${lA})`, 1)); put(tot, 9, { v: "", st: { fill: CREAM, border: B4 } });
  put(totV, 8, { v: tt("SOUS-TOTAL A"), st: { font: font({ b: 1, color: "FFFFFF" }), fill: NAVY, border: B4, al: { h: "center", v: "center" } } });
  put(totV, 9, { v: d.A, f: `SUM(J${fA}:J${lA})`, st: { font: font({ b: 1 }), nf: NF + ` "${(curSymOf(cur) || cur).replace(/"/g, "")}"`, fill: YEL, border: B4, al: { h: "right", v: "center" } } });
  put(totV + 1, 0, { v: tt("Joindre tous les justificatifs"), st: { font: font({ b: 1 }) } });
  put(totV + 2, 0, { v: tt("Nom du client à inscrire au dos des tickets repas + motif de l'invitation"), st: { font: font({ sz: 9 }) } });
  // tableau B : déplacements
  const hdB = totV + 4;
  ["Date", "Motif", "Plage horaire", "Trajet", "", "Puissance véhicule en CV", "Nombre de km parcourus aller-retour", "", "Valeur indemnité kilométrique retenue", "TOTAL"].forEach((c, i) => put(hdB, i, H(c, i === 7 ? { fill: "8796A6" } : {})));
  merges.push(`D${hdB}:E${hdB}`); heights[hdB] = 54;
  r = hdB + 1; const fB = r;
  for (const t of d.trips) {
    put(r, 0, { v: xlDate(t.date), st: { font: font(), nf: "dd/mm/yyyy", border: B4, al: { h: "center", v: "center" } } });
    put(r, 1, { v: [t.contact, t.motif].filter(Boolean).join("\n"), st: { font: font(), border: B4, al: { v: "center", wrap: 1 } } });
    put(r, 2, { v: t.start || t.end ? `${(t.start || "").replace(":", "h")}-${(t.end || "").replace(":", "h")}` : "", st: { font: font(), border: B4, al: { h: "center", v: "center" } } });
    put(r, 3, { v: t.dest || "", st: { font: font(), border: B4, al: { h: "center", v: "center", wrap: 1 } } }); put(r, 4, { v: "", st: { border: B4 } }); merges.push(`D${r}:E${r}`);
    put(r, 5, { v: Number(t.cv) || "", st: { font: font(), border: B4, al: { h: "center", v: "center" } } });
    put(r, 6, { v: Number(t.km) || 0, st: { font: font(), nf: "#,##0", border: B4, al: { h: "center", v: "center" } } });
    put(r, 7, { v: "", st: { fill: "C9D1D9", border: B4 } });
    put(r, 8, { v: Number(t.rate) || 0, st: { font: font(), nf: "0.000", border: B4, al: { h: "center", v: "center" } } });
    put(r, 9, { v: Number(t.amount) || 0, f: `G${r}*I${r}`, st: { font: font({ b: 1 }), nf: NF, border: B4, al: { h: "right", v: "center" } } });
    heights[r] = 28; r++;
  }
  if (!d.trips.length) { for (let c = 0; c <= 9; c++) put(r, c, { v: c === 1 ? tt("Aucun déplacement ce mois-ci") : "", st: { font: font({ i: 1, color: "5A6B7B" }), border: B4, fill: c === 7 ? "C9D1D9" : undefined } }); merges.push(`D${r}:E${r}`); r++; }
  const lB = r - 1, sB = r;
  put(sB, 6, { v: tt("SOUS-TOTAL B") + "  625121", st: { font: font({ b: 1, color: "FFFFFF" }), fill: NAVY, border: B4, al: { h: "center", v: "center" } } });
  put(sB, 7, { v: "", st: { fill: NAVY, border: B4 } }); put(sB, 8, { v: "", st: { fill: NAVY, border: B4 } }); merges.push(`G${sB}:I${sB}`);
  put(sB, 9, { v: d.B, f: `SUM(J${fB}:J${lB})`, st: { font: font({ b: 1 }), nf: NF + ` "${(curSymOf(cur) || cur).replace(/"/g, "")}"`, fill: YEL, border: B4, al: { h: "right", v: "center" } } });
  const cg = ndfVehicle().file && ndfVehicle().file.url;
  put(sB + 1, 0, cg ? { f: `HYPERLINK("${cg.replace(/"/g, "")}","${tt("Joindre une photocopie de la carte grise").replace(/"/g, "")} ↗")`, v: tt("Joindre une photocopie de la carte grise"), st: { font: font({ b: 1, u: 1, color: "1F5FBF" }) } }
    : { v: tt("Joindre une photocopie de la carte grise"), st: { font: font({ b: 1 }) } });
  // récapitulatif par compte + montant total
  const rc = sB + 3, acc = ndfAccounts(d);
  ["Compte charge", "Montant HT", "TVA récupérable", "Total"].forEach((c, i) => put(rc, 2 + i, H(c)));
  let rr = rc + 1;
  for (const o of acc) {
    put(rr, 2, { v: o.a, st: { font: font(), border: B4, al: { h: "center" } } });
    put(rr, 3, numC(Math.round(o.ht * 100) / 100)); put(rr, 4, numC(Math.round(o.vat * 100) / 100)); put(rr, 5, numC(Math.round(o.ttc * 100) / 100, `D${rr}+E${rr}`)); rr++;
  }
  if (!acc.length) { put(rr, 2, { v: "—", st: { border: B4, al: { h: "center" } } }); for (let c = 3; c <= 5; c++) put(rr, c, numC("")); rr++; }
  put(rr, 4, tc(d.vat, `SUM(E${rc + 1}:E${rr - 1})`, 1)); put(rr, 5, tc(d.total, `SUM(F${rc + 1}:F${rr - 1})`, 1));
  put(rc, 8, H("Montant note de frais")); merges.push(`I${rc}:J${rc}`); put(rc, 9, H(""));
  put(rc + 1, 8, { v: "A + B", st: { font: font({ b: 1 }), border: B4, al: { h: "center", v: "center" } } });
  put(rc + 1, 9, { v: d.total, f: `J${totV}+J${sB}`, st: { font: font({ b: 1, sz: 12 }), nf: NF + ` "${(curSymOf(cur) || cur).replace(/"/g, "")}"`, fill: YEL, border: B4, al: { h: "right", v: "center" } } });
  heights[rc + 1] = 24;
  put(rr + 2, 0, { v: `${tt("Montants en")} ${cur}. ${tt("Généré par Bourselle le")} ${frDate(todayISO())}.`, st: { font: font({ sz: 8, i: 1, color: "5A6B7B" }) } });
  return { name: ndfMonthName(ym).slice(0, 31), cols: [11, 44, 12, 12, 11, 14, 12, 11, 17, 13], rows, heights, merges, grid: false, data: d, refs: { A: `J${totV}`, B: `J${sB}`, vat: `I${tot}`, total: `J${rc + 1}` } };
}
function ndfBook(year) {
  const months = ndfMonthsList().filter(ym => ym.startsWith(year + "-")).sort();
  const sheets = months.map(ndfSheet).filter(sh => sh.data.items.length || sh.data.trips.length);
  const cur = baseCurrency(), NF = NO_CENTS.includes(cur) ? "#,##0" : "#,##0.00", B4 = ["thin", "thin", "thin", "thin"];
  const H = v => ({ v: tt(v), st: { font: { b: 1, sz: 10, color: "FFFFFF" }, fill: NAVY, border: B4, al: { h: "center", v: "center", wrap: 1 } } });
  const R = [[{ v: `${tt("Notes de frais")} ${year}${settings.ndfCompany ? ` – ${settings.ndfCompany}` : ""}`, st: { font: { b: 1, sz: 14, color: NAVY } } }], [],
    ["Mois", "Frais HT", "TVA récupérable", "Sous-total A (TTC)", "Km parcourus", "Sous-total B (km)", "Montant note de frais A + B"].map(H)];
  for (const sh of sheets) {
    const q = c => `'${sh.name.replace(/'/g, "''")}'!${c}`, d = sh.data;
    const c = (f, v, nf) => ({ f, v, st: { font: { sz: 10 }, nf: nf || NF, border: B4, al: { h: "right" } } });
    R.push([{ v: sh.name, st: { font: { sz: 10 }, border: B4 } }, c(`${q(sh.refs.A)}-${q(sh.refs.vat)}`, d.A - d.vat), c(q(sh.refs.vat), d.vat), c(q(sh.refs.A), d.A), { v: d.km, st: { font: { sz: 10 }, nf: "#,##0", border: B4, al: { h: "right" } } }, c(q(sh.refs.B), d.B), c(q(sh.refs.total), d.total)]);
  }
  const a = 4, b = R.length, S = k => sheets.reduce((s, sh) => s + sh.data[k], 0);
  const T = (f, v, nf) => ({ f, v, st: { font: { b: 1, sz: 10 }, nf: nf || NF, fill: CREAM, border: B4, al: { h: "right" } } });
  R.push([{ v: tt("TOTAL"), st: { font: { b: 1, sz: 10 }, fill: CREAM, border: B4 } }, T(`SUM(B${a}:B${b})`, S("A") - S("vat")), T(`SUM(C${a}:C${b})`, S("vat")), T(`SUM(D${a}:D${b})`, S("A")), T(`SUM(E${a}:E${b})`, S("km"), "#,##0"), T(`SUM(F${a}:F${b})`, S("B")), T(`SUM(G${a}:G${b})`, S("total"))]);
  R.push([], [{ v: `${tt("Montants en")} ${cur}. ${tt("Généré par Bourselle le")} ${frDate(todayISO())}.`, st: { font: { sz: 8, i: 1 } } }]);
  sheets.push({ name: tt("Récapitulatif"), cols: [18, 13, 14, 16, 13, 15, 18], rows: R, heights: { 3: 32 }, grid: false });
  if (sheets.length) sheets[0].first = true;
  return xlsxBook(sheets);
}
function ndfYears() { return [...new Set(ndfMonthsList().filter(ym => { const d = ndfMonthData(ym); return d.items.length || d.trips.length; }).map(ym => ym.slice(0, 4)))].sort(); }
function ndfBookName(year) { return `${settings.ndfCompany ? `${tt("Note de frais")} ${settings.ndfCompany}` : tt("Notes de frais")} ${year}.xlsx`; }
function ndfDownload(year) { const ok = saveFile(ndfBookName(year), ndfBook(year)); if (ok) toast(tt("Classeur Excel téléchargé")); }

// --- Version imprimable (PDF) du mois, même présentation ---
function ndfPrint(ym) {
  const d = ndfMonthData(ym), i = ndfInfo(ym), m = v => v ? esc(eur(v)) : "", cur = baseCurrency();
  const accs = ndfAccounts(d);
  const css = `<style>#printView .ndfp{color:#16324a;font-size:11px}#printView .ndfp table{border-collapse:collapse;width:100%;margin:6px 0}#printView .ndfp th{background:#16324a;color:#fff;font-weight:700;padding:5px 4px;border:1px solid #9fb0c0;font-size:10.5px}
    #printView .ndfp td{border:1px solid #9fb0c0;padding:4px;vertical-align:middle}#printView .ndfp .r{text-align:right;white-space:nowrap}#printView .ndfp .c{text-align:center}#printView .ndfp .tot td{background:#fff4d6;font-weight:700}#printView .ndfp .y{background:#f2b928!important;font-weight:800}
    #printView .ndfp .hd{display:flex;justify-content:space-between;gap:20px;margin-bottom:10px}#printView .ndfp .sig{border:1px solid #16324a;min-width:260px;min-height:100px;padding:6px;color:#5a6b7b}#printView .ndfp h1{font-size:20px;margin:0 0 4px}#printView .ndfp .acc{display:flex;gap:20px;align-items:flex-start}
    #printView .ndfp small{color:#5a6b7b}#printView .ndfp .hatch{background:repeating-linear-gradient(45deg,#c9d1d9 0 3px,#fff 3px 6px)}</style>`;
  const A = d.items.map(x => { const v = ndfVat(x), k = ndfTypeOf(x); return `<tr><td class="c">${esc(frDate(x.date))}</td><td>${esc(ndfLabel(x))}</td>${NDF_TYPES.map(([t]) => `<td class="r">${t === k ? m(v.ht) : ""}</td>`).join("")}<td class="r">${m(v.vat)}</td><td class="r"><b>${m(v.ttc)}</b></td></tr>`; }).join("")
    || `<tr><td colspan="10"><small>${esc(tt("Aucun frais ce mois-ci"))}</small></td></tr>`;
  const B = d.trips.map(t => `<tr><td class="c">${esc(frDate(t.date))}</td><td>${esc(t.contact || "")}${t.motif ? `<br>${esc(t.motif)}` : ""}</td><td class="c">${esc([(t.start || "").replace(":", "h"), (t.end || "").replace(":", "h")].filter(Boolean).join("-"))}</td><td class="c">${esc(t.dest || "")}</td><td class="c">${esc(String(t.cv || ""))}</td><td class="c">${esc(String(t.km || 0))}</td><td class="hatch"></td><td class="c">${esc(String(t.rate || "").replace(".", ","))}</td><td class="r"><b>${m(t.amount)}</b></td></tr>`).join("")
    || `<tr><td colspan="9"><small>${esc(tt("Aucun déplacement ce mois-ci"))}</small></td></tr>`;
  const html = `${css}<div class="ndfp"><div class="hd"><div><h1>${esc(tt("Note de frais"))}</h1>
    <div><b>N° ${esc(i.num)} – ${esc(tt("du"))} ${esc(frDate(i.du))}</b></div><div><b>${esc(tt("Salarié :"))}</b> ${esc(i.name)}</div><div><b>${esc(tt("Fonction :"))}</b> ${esc(i.fonction)}</div>
    <div><b>${esc(tt("Entreprise :"))}</b> ${esc(i.company)}</div><div><b>${esc(tt("Date de début :"))}</b> ${esc(frDate(i.start))}</div><div><b>${esc(tt("Date de fin :"))}</b> ${esc(frDate(i.end))}</div></div>
    <div class="sig">${esc(tt("Signature"))}</div></div>
    <table><thead><tr><th rowspan="2">${esc(tt("Date"))}</th><th rowspan="2">${esc(tt("Motif et fournisseur"))}</th>${NDF_TYPES.map(([k, l]) => `<th>${esc(tt(l))}</th>`).join("")}<th rowspan="2">${esc(tt("TVA récupérable"))}</th><th rowspan="2">${esc(tt("TOTAL"))}</th></tr>
    <tr>${NDF_TYPES.map(([k]) => `<th style="font-weight:400">${NDF_ACC[k]}<br>${esc(tt("montant en HT"))}</th>`).join("")}</tr></thead><tbody>${A}
    <tr class="tot"><td></td><td class="c">${esc(tt("TOTAL"))}</td>${NDF_TYPES.map(([k]) => `<td class="r">${esc(eur(d.byType[k].ht))}</td>`).join("")}<td class="r">${esc(eur(d.vat))}</td><td></td></tr>
    <tr class="tot"><td></td><td class="c"><small>${esc(tt("dont TVA récupérable"))}</small></td>${NDF_TYPES.map(([k]) => `<td class="r">${esc(eur(d.byType[k].vat))}</td>`).join("")}<td class="c">${esc(tt("SOUS-TOTAL A"))}</td><td class="r y">${esc(eur(d.A))}</td></tr></tbody></table>
    <div><b>${esc(tt("Joindre tous les justificatifs"))}</b><br><small>${esc(tt("Nom du client à inscrire au dos des tickets repas + motif de l'invitation"))}</small></div>
    <table><thead><tr><th>${esc(tt("Date"))}</th><th>${esc(tt("Motif"))}</th><th>${esc(tt("Plage horaire"))}</th><th>${esc(tt("Trajet"))}</th><th>${esc(tt("Puissance véhicule en CV"))}</th><th>${esc(tt("Nombre de km parcourus aller-retour"))}</th><th class="hatch"></th><th>${esc(tt("Valeur indemnité kilométrique retenue"))}</th><th>${esc(tt("TOTAL"))}</th></tr></thead>
    <tbody>${B}<tr class="tot"><td colspan="7"></td><td class="c">${esc(tt("SOUS-TOTAL B"))} <small>625121</small></td><td class="r y">${esc(eur(d.B))}</td></tr></tbody></table>
    <div><b>${esc(tt("Joindre une photocopie de la carte grise"))}</b></div>
    <div class="acc"><table style="width:auto;min-width:380px"><thead><tr><th>${esc(tt("Compte charge"))}</th><th>${esc(tt("Montant HT"))}</th><th>${esc(tt("TVA récupérable"))}</th><th>${esc(tt("Total"))}</th></tr></thead><tbody>
    ${accs.map(o => `<tr><td class="c">${o.a}</td><td class="r">${esc(eur(o.ht))}</td><td class="r">${esc(eur(o.vat))}</td><td class="r">${esc(eur(o.ttc))}</td></tr>`).join("")}
    <tr class="tot"><td></td><td></td><td class="r">${esc(eur(d.vat))}</td><td class="r">${esc(eur(d.total))}</td></tr></tbody></table>
    <table style="width:auto;min-width:220px;margin-left:auto"><thead><tr><th colspan="2">${esc(tt("Montant note de frais"))}</th></tr></thead><tbody><tr><td class="c"><b>A + B</b></td><td class="r y" style="font-size:14px">${esc(eur(d.total))}</td></tr></tbody></table></div>
    <p><small>${esc(tt("Montants en"))} ${esc(cur)}.</small></p></div>`;
  printDoc(`${tt("Note de frais")} ${i.num}`, html);
}

// --- Déplacements ---
function editTrip(id, ym) {
  const v = ndfVehicle();
  const t = id ? clone(trips[id]) : { date: ym && ym !== todayISO().slice(0, 7) ? `${ym}-01` : todayISO(), contact: "", motif: "", start: "", end: "", dest: "", cv: v.cv, electric: !!v.electric, km: "", rate: ndfBareme(v.cv, v.electric) };
  openForm(`<div class="f2"><h3>${id ? tt("Modifier le déplacement") : tt("Ajouter un déplacement")}</h3>
    <div class="two"><div>${fld("tDate", "Date", `type="date" value="${esc(t.date)}"`)}</div><div>${fld("tContact", "Client / contact", `placeholder="ex. Client2" value="${esc(t.contact || "")}"`)}</div></div>
    ${fld("tMotif", "Motif", `placeholder="ex. Rdv suivi projet" value="${esc(t.motif || "")}"`)}
    <div class="two"><div>${fld("tStart", "Départ", `type="time" value="${esc(t.start || "")}"`)}</div><div>${fld("tEnd", "Retour", `type="time" value="${esc(t.end || "")}"`)}</div></div>
    ${fld("tDest", "Trajet (adresse de destination)", `placeholder="ex. 14 rue du château 80000 Amiens" value="${esc(t.dest || "")}"`)}
    <div class="two"><div><label class="lbl" for="tCv">Puissance du véhicule (CV)</label><select class="field" id="tCv">${[3, 4, 5, 6, 7].map(c => `<option value="${c}" ${Number(t.cv) === c ? "selected" : ""}>${c === 3 ? "3 CV et moins" : c === 7 ? "7 CV et plus" : c + " CV"}</option>`).join("")}</select></div>
      <div>${fld("tKm", "Km parcourus aller-retour", `inputmode="decimal" placeholder="0" value="${t.km === "" ? "" : esc(String(t.km).replace(".", ","))}"`)}</div></div>
    <div class="two"><div>${fld("tRate", "Valeur indemnité kilométrique (€/km)", `inputmode="decimal" value="${esc(String(t.rate).replace(".", ","))}"`)}</div><div><span class="lbl">Total</span><div class="trip-tot num" id="tTot"></div></div></div>
    <p class="hint" id="tHint" style="margin:4px 0 0"></p></div>`,
    () => {
      const date = val("tDate"), km = parseNum(val("tKm")), rate = parseNum(val("tRate"));
      if (!date) { toast(tt("Indique la date du déplacement")); return false; }
      if (!(km > 0)) { toast(tt("Indique le nombre de km")); return false; }
      const cv = Number(document.getElementById("tCv").value);
      trips[id || newId()] = { date, contact: val("tContact").slice(0, 80), motif: val("tMotif").slice(0, 120), start: val("tStart"), end: val("tEnd"), dest: val("tDest").slice(0, 160),
        cv, electric: !!v.electric, km, rate, amount: Math.round(km * rate * 100) / 100, created: t.created || Date.now() };
      if (!id) { v.cv = cv; }
      scheduleSave(); render(); toast(id ? tt("Déplacement modifié") : tt("Déplacement ajouté"));
    },
    id ? () => { delete trips[id]; scheduleSave(); render(); toast(tt("Déplacement supprimé")); } : null);
  const upd = () => {
    const km = parseNum(val("tKm")) || 0, rate = parseNum(val("tRate")) || 0;
    document.getElementById("tTot").textContent = eur(Math.round(km * rate * 100) / 100);
    const cv = Number(document.getElementById("tCv").value);
    document.getElementById("tHint").textContent = `${tt("Barème")} ${new Date().getFullYear()} (${cv === 7 ? "7 CV +" : cv + " CV"}${v.electric ? ", " + tt("électrique +20 %") : ""}) : ${String(ndfBareme(cv, v.electric)).replace(".", ",")} €/km ${tt("jusqu'à 5 000 km par an")}.`;
  };
  document.getElementById("tCv").onchange = () => { document.getElementById("tRate").value = String(ndfBareme(document.getElementById("tCv").value, v.electric)).replace(".", ","); upd(); };
  document.getElementById("tKm").oninput = upd; document.getElementById("tRate").oninput = upd; upd();
}

// --- Carte grise ---
async function ndfCarteGrise(file) {
  const v = ndfVehicle();
  if (!assets) { toast(tt("Connecte-toi avec Google ou Microsoft pour enregistrer la carte grise dans ton Drive.")); return; }
  const type = file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "image/jpeg");
  if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(type)) { toast("Format non accepté : utilise une photo JPG/PNG ou un PDF."); return; }
  toast(tt("Envoi de la carte grise…"));
  try {
    const res = await assets.uploadFile(file, type);
    const old = v.file; v.file = { id: res.id, name: res.name || file.name, type: res.type || type };
    if (store.placeFile) { try { const p = await store.placeFile(res.id, [ndfRoot(), tt("Véhicule")], `${tt("Carte grise")}.${type === "application/pdf" ? "pdf" : (type.split("/")[1] || "jpg").replace("jpeg", "jpg")}`); if (p && p.url) v.file.url = p.url; } catch (e) {}
    }
    if (old && old.id && old.id !== res.id) { try { await assets.deleteFile(old.id); } catch (e) {} }
    saveSettings(); render(); toast(tt("Carte grise enregistrée"));
  } catch (err) { toast(err && err.code === "auth" ? "Reconnecte-toi puis réessaie." : "Envoi impossible. Vérifie ta connexion et réessaie."); }
}

// --- Onglet Frais : la note de frais du mois ---
let ndfYm = null;
function ndfDocHTML() {
  const list = ndfMonthsList(); if (!ndfYm || !list.includes(ndfYm)) ndfYm = list[0];
  const d = ndfMonthData(ndfYm), i = ndfInfo(ndfYm), v = ndfVehicle(), blank = (s, ph) => s ? esc(s) : `<span class="ph">[${esc(tt(ph))}]</span>`;
  return `${typeof ndfQuotaHTML === "function" ? ndfQuotaHTML(ndfYm) : ""}<div class="card ndf-doc">
    <div class="ndf-month"><label class="lbl" for="ndfMonth">Mois</label><select class="field" id="ndfMonth">${list.map(ym => `<option value="${ym}" ${ym === ndfYm ? "selected" : ""}>${esc(ndfMonthName(ym))}</option>`).join("")}</select></div>
    <div class="ndf-head"><div class="ndf-id"><h2 style="margin:0 0 4px">Note de frais</h2>
      <div><b>N° ${esc(i.num)}</b> – <span>du</span> <b>${esc(frDate(i.du))}</b></div>
      <div><span>Salarié :</span> <b>${blank(i.name, "Indiquer le nom et le prénom")}</b></div><div><span>Fonction :</span> <b>${blank(i.fonction, "Préciser l'intitulé du poste")}</b></div><div><span>Entreprise :</span> <b>${blank(i.company, "Indiquer le nom de l'entreprise et son adresse")}</b></div>
      <div><span>Date de début :</span> <b>${esc(frDate(i.start))}</b></div><div><span>Date de fin :</span> <b>${esc(frDate(i.end))}</b></div></div>
      <div class="ndf-sign"><span>Signature</span></div></div>
    <div class="ndf-sum"><div><span>Frais (A)</span><b class="num">${esc(eur(d.A))}</b><small class="num">${esc(eur(d.ht))} HT · TVA ${esc(eur(d.vat))}</small></div>
      <div><span>Déplacements (B)</span><b class="num">${esc(eur(d.B))}</b><small class="num">${esc(String(d.km).replace(".", ","))} km</small></div>
      <div class="tot"><span>Montant A + B</span><b class="num">${esc(eur(d.total))}</b></div></div>
    <div class="acts"><button class="btn primary" id="ndfPrint">Imprimer / PDF</button><button class="btn" id="ndfXlsx">Excel ${esc(ndfYm.slice(0, 4))}</button>${ndfCanSync() ? `<button class="btn" id="ndfOpen">Ouvrir le dossier</button>` : ""}</div>
    <details class="ndf-who"><summary>Tes informations sur la note de frais</summary>
      <div class="vat-row" style="margin-top:8px"><label class="vat-f"><span>Nom et prénom</span><input class="field" id="ndfName" value="${esc(settings.ndfName || "")}" placeholder="${esc(tt("Indiquer le nom et le prénom"))}"></label>
      <label class="vat-f"><span>Fonction</span><input class="field" id="ndfFonction" value="${esc(settings.ndfFonction || "")}" placeholder="${esc(tt("Préciser l'intitulé du poste"))}"></label></div>
      <div class="vat-row" style="margin-top:8px"><label class="vat-f"><span>Entreprise</span><input class="field" id="ndfSoc" value="${esc(settings.ndfCompany || "")}" placeholder="${esc(tt("Nom de l'entreprise"))}"></label>
      <label class="vat-f"><span>Adresse de l'entreprise</span><input class="field" id="ndfAddr" value="${esc(settings.ndfAddress || "")}" placeholder="${esc(tt("Adresse de l'entreprise"))}"></label></div>
      <label class="vat-f" style="margin-top:8px"><span>N° de cette note</span><input class="field" id="ndfNum" value="${esc(i.num)}"></label></details></div>
  <div class="card"><h2>Déplacements<small>${esc(ndfMonthName(ndfYm))}</small></h2>
    ${d.trips.length ? d.trips.map(t => `<div class="trip"><div><div class="n">${esc([t.contact, t.motif].filter(Boolean).join(" – ") || tt("Déplacement"))}</div>
      <div class="s">${esc(frDate(t.date))}${t.start ? ` · ${esc((t.start || "").replace(":", "h"))}-${esc((t.end || "").replace(":", "h"))}` : ""}${t.dest ? ` · ${esc(t.dest)}` : ""}</div>
      <div class="s num">${esc(String(t.km).replace(".", ","))} km × ${esc(String(t.rate).replace(".", ","))} € · ${esc(String(t.cv))} CV</div></div>
      <div class="num" style="font-weight:700">${esc(eur(t.amount))}</div><button class="btn" data-trip="${esc(t.id)}">Modifier</button></div>`).join("") : `<div class="empty">Aucun déplacement ce mois-ci.</div>`}
    <button class="btn primary" id="tripAdd" style="margin-top:10px">Ajouter un déplacement</button></div>
  <div class="card"><h2>Véhicule<small>indemnités kilométriques</small></h2>
    <div class="vat-row"><label class="vat-f"><span>Puissance fiscale</span><select class="field" id="vehCv">${[3, 4, 5, 6, 7].map(c => `<option value="${c}" ${Number(v.cv) === c ? "selected" : ""}>${c === 3 ? "3 CV et moins" : c === 7 ? "7 CV et plus" : c + " CV"}</option>`).join("")}</select></label>
      <label class="vat-f"><span>Barème retenu</span><div class="field num" style="display:flex;align-items:center">${esc(String(ndfBareme(v.cv, v.electric)).replace(".", ","))} € / km</div></label></div>
    <label class="check" style="margin-top:8px"><input type="checkbox" id="vehElec" ${v.electric ? "checked" : ""}> <span>Véhicule 100 % électrique (+20 %)</span></label>
    <div class="acts" style="margin-top:10px"><button type="button" class="btn primary" id="cgAdd" aria-expanded="false">${v.file ? "Remplacer la carte grise" : "Ajouter la carte grise"}</button>
      ${v.file ? `<button class="btn" id="cgView">Voir la carte grise</button>` : ""}</div>
    <div class="acts" id="cgChoice" hidden style="margin-top:8px"><label class="btn" for="cgCam">Prendre une photo</label><label class="btn" for="cgFile">Choisir un fichier</label></div>
    <input type="file" id="cgCam" accept="image/*" capture="environment" hidden><input type="file" id="cgFile" accept="image/*,application/pdf" hidden>
    <p class="hint" style="margin:8px 0 0">${v.file ? `<span>Carte grise enregistrée dans</span> <b>Bourselle › ${esc(ndfRoot())} › ${esc(tt("Véhicule"))}</b>.` : `<span>La photocopie de la carte grise est à joindre aux indemnités kilométriques : elle sera rangée dans ton Drive.</span>`}</p></div>`;
}
function ndfDocBind() {
  const ms = document.getElementById("ndfMonth"); if (!ms) return;
  ms.onchange = () => { ndfYm = ms.value; render(); };
  document.getElementById("ndfPrint").onclick = () => ndfPrint(ndfYm);
  const up = document.getElementById("ndfPlus"); if (up) up.onclick = () => showPlus("ndf");
  document.getElementById("tripAdd").onclick = () => editTrip(null, ndfYm);
  document.querySelectorAll("[data-trip]").forEach(b => b.onclick = () => editTrip(b.dataset.trip));
  for (const [id, k] of [["ndfName", "ndfName"], ["ndfFonction", "ndfFonction"], ["ndfSoc", "ndfCompany"], ["ndfAddr", "ndfAddress"]]) {
    const el = document.getElementById(id); if (el) el.onchange = () => { settings[k] = el.value.trim(); saveSettings(); render(); };
  }
  const num = document.getElementById("ndfNum"); if (num) num.onchange = () => { settings.ndfNums = { ...(settings.ndfNums || {}), [ndfYm]: num.value.trim() }; saveSettings(); render(); };
  const v = ndfVehicle();
  document.getElementById("vehCv").onchange = e => { v.cv = Number(e.target.value); saveSettings(); render(); };
  document.getElementById("vehElec").onchange = e => { v.electric = e.target.checked; saveSettings(); render(); };
  const cgAdd = document.getElementById("cgAdd"), cgChoice = document.getElementById("cgChoice");
  cgAdd.onclick = () => { cgChoice.hidden = !cgChoice.hidden; cgAdd.setAttribute("aria-expanded", String(!cgChoice.hidden)); };
  for (const id of ["cgCam", "cgFile"]) document.getElementById(id).onchange = e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; cgChoice.hidden = true; if (f) ndfCarteGrise(f); };
  const cv = document.getElementById("cgView"); if (cv) cv.onclick = () => openViewer(v.file);
  // les détails restent ouverts après un changement
  const det = document.querySelector(".ndf-who"); if (det) { det.open = !!ndfDocBind.open; det.ontoggle = () => { ndfDocBind.open = det.open; }; }
}

// --- Rangement dans le Drive ---
const ndfSync = { timer: null, busy: false, status: "", when: null, error: null };
function ndfRoot() { if (!settings.ndfFolder) settings.ndfFolder = tt("Notes de frais"); return settings.ndfFolder; }
function ndfFileName(x, f, k, n) {
  const ext = (/\.([a-z0-9]{2,5})$/i.exec(f.name || "") || [])[1] || ({ "application/pdf": "pdf", "image/png": "png", "image/webp": "webp", "image/heic": "heic" }[f.type] || "jpg");
  const amt = (x.orig ? fmtCur(x.orig.cur, x.orig.amount) : eur(x.amount)).replace(/[  ]/g, " ");
  return `${x.date} - ${(x.note || catById(x.cat).name).slice(0, 50)} - ${amt}${n > 1 ? ` (${k + 1})` : ""}.${ext.toLowerCase()}`;
}
function ndfCanSync() { return !!(store && assets && store.placeFile && store.putFile && store.id !== "local"); }
function ndfSyncSoon() { if (!ndfCanSync()) return; clearTimeout(ndfSync.timer); ndfSync.timer = setTimeout(ndfRun, 2500); }
async function ndfRun() {
  if (!ndfCanSync() || ndfSync.busy) return;
  ndfSync.busy = true; const s0 = store;
  try {
    const root = ndfRoot(); let moved = 0; const changedKeys = new Set();
    for (const x of allItems().filter(x => x.type === "depense" && x.ndf && x.date && (x.files || []).length)) {
      const t = months[x.key] && months[x.key].items[x.id]; if (!t) continue;
      const path = [root, x.date.slice(0, 4), x.date.slice(0, 7)];
      for (let k = 0; k < t.files.length; k++) {
        const f = t.files[k], name = ndfFileName(t, f, k, t.files.length), key = path.join("/") + "|" + name;
        if (f.placed === key) continue;
        const r = await s0.placeFile(f.id, path, name);
        if (store !== s0) return;
        f.placed = key; if (r && r.url) f.url = r.url; moved++; changedKeys.add(x.key);
      }
    }
    if (moved) { for (const k of changedKeys) saveMonth(k); scheduleSave(); }
    for (const y of ndfYears()) {
      const ms = ndfMonthsList().filter(ym => ym.startsWith(y + "-"));
      const sig = JSON.stringify([window.LANG, baseCurrency(), settings.ndfName, settings.ndfFonction, settings.ndfCompany, settings.ndfAddress, settings.ndfNums, settings.ndfVehicle,
        ms.map(ym => { const d = ndfMonthData(ym); return [ym, d.items.map(x => [x.date, x.note, x.cat, x.amount, x.vat, x.orig, x.ndfType, x.ndfMotif, x.ndfClient]), d.trips]; })]);
      const lk = `bourselle-ndfx-${s0.id}-${y}`; let h = 0; for (let i = 0; i < sig.length; i++) h = (h * 31 + sig.charCodeAt(i)) | 0;
      if (localStorage.getItem(lk) === String(h)) continue;
      await s0.putFile([root], ndfBookName(y), ndfBook(y), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      if (store !== s0) return;
      localStorage.setItem(lk, String(h));
    }
    ndfSync.error = null; ndfSync.when = new Date();
  } catch (e) { ndfSync.error = e; }
  finally { ndfSync.busy = false; if (tab === "frais") { const el = document.getElementById("ndfDriveState"); if (el) el.innerHTML = ndfStateHTML(); } }
}
function ndfStateHTML() {
  if (!ndfCanSync()) return `<span>${tt("Connecte-toi avec Google ou Microsoft pour que les tickets soient rangés automatiquement dans ton Drive. Tu peux déjà télécharger le classeur.")}</span>`;
  if (ndfSync.busy) return `<span>${tt("Rangement en cours…")}</span>`;
  if (ndfSync.error) return `<span class="bad">${tt("Rangement impossible pour l'instant : nouvel essai au prochain enregistrement.")}</span>`;
  if (ndfSync.when) return `<span>${tt("À jour")} · ${esc(ndfSync.when.toLocaleTimeString(appLocale(), { hour: "2-digit", minute: "2-digit" }))}</span>`;
  return `<span>${tt("Mise à jour automatique à chaque changement.")}</span>`;
}
function ndfCardHTML(year) {
  const root = esc(settings.ndfFolder || tt("Notes de frais"));
  return `<div class="card"><h2>Dossier « Notes de frais »<small>Drive</small></h2>
    <p class="hint" style="margin-top:0">${ndfCanSync() ? `<span>Dans ton ${esc(store.label)}, les tickets sont rangés dans</span> <b>Bourselle › ${root} › ${year} › ${year}-MM</b><span>, nommés par date (année-mois-jour). Le classeur</span> <b>${esc(ndfBookName(year))}</b> <span>contient un onglet par mois au format de la note de frais.</span>` : `<span>Le classeur contient un onglet par mois au format de la note de frais.</span>`}</p>
    <p class="hint" id="ndfDriveState" style="margin:0 0 10px">${ndfStateHTML()}</p>
    <div class="acts"><button class="btn" id="ndfCsv">CSV</button></div></div>`;
}
function ndfBind(year) {
  ndfDocBind();
  const x = document.getElementById("ndfXlsx"); if (x) x.onclick = () => ndfDownload(ndfYm ? ndfYm.slice(0, 4) : year);
  const o = document.getElementById("ndfOpen");
  if (o) o.onclick = async () => {
    const w = window.open("", "_blank");
    try { const u = await store.folderLink([ndfRoot()]); if (w) w.location = u; else location.href = u; }
    catch (e) { if (w) w.close(); toast(tt("Dossier indisponible pour l'instant")); }
  };
  if (ndfCanSync()) ndfSyncSoon();
}
